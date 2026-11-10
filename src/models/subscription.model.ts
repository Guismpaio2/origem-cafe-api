import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const subscriptionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String, required: true },
    moagem: { type: String, default: null },
    pesoGramas: { type: Number, default: null },
    status: { type: String, enum: ['ativa', 'pausada', 'cancelada'], default: 'ativa' },
    // RN004: o cancelamento vale a partir do próximo ciclo, então a assinatura segue até lá.
    cancelamentoSolicitado: { type: Boolean, default: false },
    proximaCobranca: { type: Date, required: true },
  },
  { timestamps: true },
);

subscriptionSchema.index({ userId: 1 });
// RN004: no máximo uma assinatura ativa por cliente (pausada não conta como ativa).
subscriptionSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { status: 'ativa' } });

export const SubscriptionModel = model('Subscription', subscriptionSchema);
export type SubscriptionDocument = HydratedDocument<InferSchemaType<typeof subscriptionSchema>>;
