import type { Types } from 'mongoose';
import { AppError } from '../errors/app-error.js';
import { clearCart, userKey } from './cart.service.js';
import { OrderModel, type OrderDocument, type OrderStatus } from '../models/order.model.js';
import { ProductModel } from '../models/product.model.js';
import type { CreateOrderBody, ShippingQuoteBody } from '../validators/order.validator.js';
import { charge } from './payment.gateway.js';
import { isSlotAvailable, isValidDate } from './pickup.rules.js';
import { calcularFrete } from './shipping.rules.js';

interface VariantRecord {
  sku: string;
  moagem?: string;
  pesoGramas?: number;
  precoCentavos: number;
  estoque: number;
}

interface ProductRecord {
  _id: Types.ObjectId;
  nome: string;
  tipo: 'cafe' | 'acessorio';
  ativo: boolean;
  variants: VariantRecord[];
}

interface OrderLine {
  productId: Types.ObjectId;
  nome: string;
  sku: string;
  moagem: string | null;
  pesoGramas: number | null;
  precoCentavos: number;
  quantidade: number;
}

const businessRule = (message: string) => new AppError(422, 'BUSINESS_RULE_VIOLATION', message);

// Valida cada item contra o banco e monta o snapshot com o preço atual (RN005, RN002).
async function resolveLines(items: CreateOrderBody['items']): Promise<OrderLine[]> {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await ProductModel.find({ _id: { $in: productIds }, ativo: true }).lean<ProductRecord[]>();

  return items.map((item) => {
    const product = products.find((candidate) => candidate._id.toString() === item.productId);
    const variant = product?.variants.find((candidate) => candidate.sku === item.sku);

    if (!product || !variant) {
      throw businessRule('Um dos itens não está mais disponível. Atualize o carrinho.');
    }
    // RN002: café só é vendido com moagem e peso definidos.
    if (product.tipo === 'cafe' && (!variant.moagem || !variant.pesoGramas)) {
      throw businessRule(`Escolha a moagem e o peso de ${product.nome}.`);
    }
    // RN005: o checkout valida o estoque; o carrinho não reserva nada.
    if (variant.estoque < item.quantidade) {
      throw businessRule(`Estoque insuficiente de ${product.nome}.`);
    }

    return {
      productId: product._id,
      nome: product.nome,
      sku: variant.sku,
      moagem: variant.moagem ?? null,
      pesoGramas: variant.pesoGramas ?? null,
      precoCentavos: variant.precoCentavos,
      quantidade: item.quantidade,
    };
  });
}

function subtotalOf(lines: OrderLine[]): number {
  return lines.reduce((total, line) => total + line.precoCentavos * line.quantidade, 0);
}

// Retirada precisa de horário livre pela RN003. Entrega não tem horário.
function assertPickupWindow(agendamento: { data: string; horario: string }, now: Date): void {
  if (!isValidDate(agendamento.data) || !isSlotAvailable(agendamento.data, agendamento.horario, now)) {
    throw businessRule('Horário indisponível para retirada. Veja os horários livres e escolha outro.');
  }
}

export async function quoteShipping(input: ShippingQuoteBody) {
  const lines = await resolveLines(input.items);
  const subtotalCentavos = subtotalOf(lines);
  const freteCentavos = calcularFrete(subtotalCentavos, input.tipoEntrega);
  return {
    subtotalCentavos,
    freteCentavos,
    totalCentavos: subtotalCentavos + freteCentavos,
  };
}

// Reserva a baixa de estoque só depois do pagamento aprovado (RN005).
// Se alguma variante acabou no meio do caminho, desfaz o que já foi baixado.
async function decrementStock(lines: OrderLine[]): Promise<boolean> {
  const done: OrderLine[] = [];
  for (const line of lines) {
    const result = await ProductModel.updateOne(
      { _id: line.productId, variants: { $elemMatch: { sku: line.sku, estoque: { $gte: line.quantidade } } } },
      { $inc: { 'variants.$.estoque': -line.quantidade } },
    );
    if (result.modifiedCount === 0) {
      for (const previous of done) {
        await ProductModel.updateOne(
          { _id: previous.productId, 'variants.sku': previous.sku },
          { $inc: { 'variants.$.estoque': previous.quantidade } },
        );
      }
      return false;
    }
    done.push(line);
  }
  return true;
}

export async function createOrder(userId: string, input: CreateOrderBody, now = new Date()) {
  const lines = await resolveLines(input.items);
  const subtotalCentavos = subtotalOf(lines);
  const freteCentavos = calcularFrete(subtotalCentavos, input.tipoEntrega);
  const totalCentavos = subtotalCentavos + freteCentavos;

  if (input.tipoEntrega === 'retirada' && input.agendamento) {
    assertPickupWindow(input.agendamento, now);
  }

  const order = new OrderModel({
    userId,
    items: lines,
    subtotalCentavos,
    freteCentavos,
    totalCentavos,
    tipoEntrega: input.tipoEntrega,
    endereco: input.tipoEntrega === 'entrega' ? input.endereco : null,
    agendamento: input.tipoEntrega === 'retirada' ? input.agendamento : { data: null, horario: null },
    status: 'Criado',
    statusHistory: [{ status: 'Criado', em: now, motivo: null }],
    payment: { metodo: input.pagamento.metodo, gateway: 'simulado', status: 'pendente' },
  });

  const payment = await charge({
    amountCentavos: totalCentavos,
    metodo: input.pagamento.metodo,
    simularRecusa: input.pagamento.simularRecusa,
  });
  order.set('payment.referencia', payment.referencia);

  if (payment.status === 'refused') {
    // RS004/E1: pagamento recusado cancela o pedido e não mexe no estoque.
    order.set('payment.status', 'recusado');
    setStatus(order, 'Cancelado', now, payment.motivo);
  } else {
    order.set('payment.status', 'aprovado');
    const stockOk = await decrementStock(lines);
    if (stockOk) {
      setStatus(order, 'Pago', now, null);
    } else {
      setStatus(order, 'Cancelado', now, 'Estoque esgotou durante o pagamento.');
    }
  }

  await order.save();
  // O carrinho da conta é esvaziado quando o pedido é feito (RF004).
  await clearCart(userKey(userId));
  return toOrderDto(order);
}

function setStatus(order: OrderDocument, status: OrderStatus, now: Date, motivo: string | null) {
  order.status = status;
  order.statusHistory.push({ status, em: now, motivo });
}

export async function listOrdersForUser(userId: string) {
  const orders = await OrderModel.find({ userId }).sort({ createdAt: -1 });
  return orders.map(toOrderDto);
}

export async function getOrderForUser(userId: string, orderId: string) {
  // Pedido de outra pessoa responde como "não encontrado", para não revelar que existe.
  const order = await OrderModel.findOne({ _id: orderId, userId });
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Pedido não encontrado.');
  return toOrderDto(order);
}

export function toOrderDto(order: OrderDocument) {
  return {
    id: order.id,
    status: order.status,
    tipoEntrega: order.tipoEntrega,
    items: order.items.map((item) => ({
      productId: item.productId.toString(),
      nome: item.nome,
      sku: item.sku,
      moagem: item.moagem,
      pesoGramas: item.pesoGramas,
      precoCentavos: item.precoCentavos,
      quantidade: item.quantidade,
    })),
    subtotalCentavos: order.subtotalCentavos,
    freteCentavos: order.freteCentavos,
    totalCentavos: order.totalCentavos,
    endereco: order.endereco ?? null,
    agendamento: order.tipoEntrega === 'retirada' ? order.agendamento ?? null : null,
    pagamento: { metodo: order.payment?.metodo ?? null, status: order.payment?.status ?? null },
    statusHistory: order.statusHistory,
    criadoEm: order.createdAt ?? null,
  };
}
