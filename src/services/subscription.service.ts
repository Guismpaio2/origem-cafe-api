import type { Types } from 'mongoose';
import { AppError } from '../errors/app-error.js';
import { ProductModel } from '../models/product.model.js';
import { SubscriptionModel } from '../models/subscription.model.js';

interface SubscriptionLike {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  sku: string;
  moagem?: string | null;
  pesoGramas?: number | null;
  status: string;
  cancelamentoSolicitado: boolean;
  proximaCobranca: Date;
}

// Próxima cobrança: mesmo dia no mês seguinte (RS003).
function nextCycle(from: Date): Date {
  const next = new Date(from);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

export function toSubscriptionDto(subscription: SubscriptionLike) {
  return {
    id: subscription._id.toString(),
    productId: subscription.productId.toString(),
    sku: subscription.sku,
    moagem: subscription.moagem ?? null,
    pesoGramas: subscription.pesoGramas ?? null,
    status: subscription.status,
    cancelamentoSolicitado: subscription.cancelamentoSolicitado,
    proximaCobranca: subscription.proximaCobranca,
  };
}

export async function createSubscription(userId: string, productId: string, sku: string, now = new Date()) {
  const product = await ProductModel.findOne({ _id: productId, ativo: true, tipo: 'cafe' }).lean<{
    variants: { sku: string; moagem?: string; pesoGramas?: number }[];
  }>();
  const variant = product?.variants.find((candidate) => candidate.sku === sku);
  if (!product || !variant) throw new AppError(404, 'NOT_FOUND', 'Café não encontrado para assinatura.');
  // RN002: a assinatura também precisa de moagem e peso.
  if (!variant.moagem || !variant.pesoGramas) {
    throw new AppError(422, 'BUSINESS_RULE_VIOLATION', 'Escolha a moagem e o peso do café para assinar.');
  }

  // RN004: o cliente só pode ter uma assinatura ativa, mesmo que ela já tenha cancelamento agendado.
  const current = await SubscriptionModel.findOne({ userId, status: 'ativa' });
  if (current) {
    throw new AppError(422, 'BUSINESS_RULE_VIOLATION', 'Você já tem uma assinatura ativa. Cancele ou pause a atual para criar outra.');
  }

  const created = await SubscriptionModel.create({
    userId,
    productId,
    sku,
    moagem: variant.moagem,
    pesoGramas: variant.pesoGramas,
    status: 'ativa',
    proximaCobranca: nextCycle(now),
  });
  return toSubscriptionDto(created);
}

export async function listMySubscriptions(userId: string) {
  const subscriptions = await SubscriptionModel.find({ userId }).sort({ createdAt: -1 });
  return subscriptions.map(toSubscriptionDto);
}

// Ações do cliente sobre a própria assinatura (RF006).
export async function applySubscriptionAction(userId: string, id: string, acao: 'pausar' | 'retomar' | 'cancelar') {
  const subscription = await SubscriptionModel.findOne({ _id: id, userId });
  if (!subscription) throw new AppError(404, 'NOT_FOUND', 'Assinatura não encontrada.');

  if (acao === 'cancelar') {
    // RN004: o cancelamento vale a partir do próximo ciclo; até lá a assinatura segue.
    subscription.set('cancelamentoSolicitado', true);
  } else if (acao === 'pausar') {
    if (subscription.status !== 'ativa') throw new AppError(422, 'BUSINESS_RULE_VIOLATION', 'Só é possível pausar uma assinatura ativa.');
    subscription.set('status', 'pausada');
  } else {
    if (subscription.status !== 'pausada') throw new AppError(422, 'BUSINESS_RULE_VIOLATION', 'Só é possível retomar uma assinatura pausada.');
    const other = await SubscriptionModel.findOne({ userId, status: 'ativa' });
    if (other) throw new AppError(422, 'BUSINESS_RULE_VIOLATION', 'Você já tem outra assinatura ativa.');
    subscription.set('status', 'ativa');
  }

  await subscription.save();
  return toSubscriptionDto(subscription);
}
