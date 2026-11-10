import { AppError } from '../errors/app-error.js';
import { OrderModel, type OrderStatus } from '../models/order.model.js';
import { ProductModel } from '../models/product.model.js';
import { UserModel } from '../models/user.model.js';
import { toOrderDto } from './order.service.js';
import { toProductDto } from './product.service.js';

// Transições permitidas (RN007). "Cancelado" só a partir de Criado, Pago ou Em Preparação (RN008).
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  Criado: ['Pago', 'Cancelado'],
  Pago: ['Em Preparação', 'Cancelado'],
  'Em Preparação': ['Pronto p/ retirada', 'Em Entrega', 'Cancelado'],
  'Pronto p/ retirada': ['Retirado'],
  'Em Entrega': ['Entregue'],
  Retirado: [],
  Entregue: [],
  Cancelado: [],
};

const PAID_STATUSES: OrderStatus[] = ['Pago', 'Em Preparação', 'Pronto p/ retirada', 'Em Entrega', 'Retirado', 'Entregue'];

export async function dashboard() {
  const [byStatus, clientes, produtosAtivos] = await Promise.all([
    OrderModel.aggregate<{ _id: string; count: number; total: number }>([
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$totalCentavos' } } },
    ]),
    UserModel.countDocuments({ role: 'cliente', deletedAt: null }),
    ProductModel.countDocuments({ ativo: true }),
  ]);

  const pedidosPorStatus = Object.fromEntries(byStatus.map((row) => [row._id, row.count]));
  const faturamentoCentavos = byStatus
    .filter((row) => PAID_STATUSES.includes(row._id as OrderStatus))
    .reduce((total, row) => total + row.total, 0);

  return {
    pedidos: byStatus.reduce((total, row) => total + row.count, 0),
    pedidosPorStatus,
    faturamentoCentavos,
    clientes,
    produtosAtivos,
  };
}

export async function listProductsAdmin() {
  const products = await ProductModel.find().sort({ nome: 1 }).lean();
  return products.map((product) => ({ ...toProductDto(product as never), ativo: product.ativo }));
}

export async function createProduct(input: Record<string, unknown>) {
  const product = await ProductModel.create(input);
  return toProductDto(product.toObject() as never);
}

export async function updateProduct(id: string, input: Record<string, unknown>) {
  const product = await ProductModel.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).lean();
  if (!product) throw new AppError(404, 'NOT_FOUND', 'Produto não encontrado.');
  return toProductDto(product as never);
}

// Exclusão lógica: o produto some do catálogo, mas pedidos antigos continuam válidos (snapshot).
export async function deactivateProduct(id: string) {
  const product = await ProductModel.findByIdAndUpdate(id, { $set: { ativo: false } }, { new: true }).lean();
  if (!product) throw new AppError(404, 'NOT_FOUND', 'Produto não encontrado.');
  return { id, ativo: false };
}

export async function listOrdersAdmin(status?: OrderStatus) {
  const filter = status ? { status } : {};
  const orders = await OrderModel.find(filter).sort({ createdAt: -1 }).limit(200);
  const userIds = [...new Set(orders.map((order) => order.userId.toString()))];
  const users = await UserModel.find({ _id: { $in: userIds } }).select('nome email').lean<{ _id: { toString(): string }; nome: string; email: string }[]>();
  const byId = new Map(users.map((user) => [user._id.toString(), { nome: user.nome, email: user.email }]));

  return orders.map((order) => ({
    ...toOrderDto(order),
    cliente: byId.get(order.userId.toString()) ?? { nome: 'Conta excluída', email: null },
  }));
}

// Mudança de status com a máquina de estados (RN007). Cancelamento após o pedido ser pago devolve o estoque.
export async function changeOrderStatus(orderId: string, novo: OrderStatus, motivo: string | undefined, now = new Date()) {
  const order = await OrderModel.findById(orderId);
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Pedido não encontrado.');

  const atual = order.status as OrderStatus;
  if (!TRANSITIONS[atual].includes(novo)) {
    throw new AppError(422, 'BUSINESS_RULE_VIOLATION', `Não é possível mudar de "${atual}" para "${novo}".`);
  }
  // RN008: depois de "Em Preparação" o cancelamento exige justificativa.
  if (novo === 'Cancelado' && atual === 'Em Preparação' && !motivo) {
    throw new AppError(422, 'BUSINESS_RULE_VIOLATION', 'Cancelar um pedido em preparação exige uma justificativa.');
  }

  if (novo === 'Cancelado' && PAID_STATUSES.includes(atual)) {
    for (const item of order.items) {
      await ProductModel.updateOne(
        { _id: item.productId, 'variants.sku': item.sku },
        { $inc: { 'variants.$.estoque': item.quantidade } },
      );
    }
  }

  order.status = novo;
  order.statusHistory.push({ status: novo, em: now, motivo: motivo ?? null });
  await order.save();
  return toOrderDto(order);
}
