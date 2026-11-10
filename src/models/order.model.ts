import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

// Estados do pedido (RN007): só as transições do diagrama são permitidas.
export const ORDER_STATUSES = [
  'Criado',
  'Pago',
  'Em Preparação',
  'Pronto p/ retirada',
  'Em Entrega',
  'Retirado',
  'Entregue',
  'Cancelado',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Snapshot: o pedido guarda nome, moagem, peso e preço do momento da compra (AGENTS.md, seção 6).
const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    nome: { type: String, required: true },
    sku: { type: String, required: true },
    moagem: { type: String, default: null },
    pesoGramas: { type: Number, default: null },
    precoCentavos: { type: Number, required: true, min: 0 },
    quantidade: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const addressSnapshotSchema = new Schema(
  {
    cep: { type: String, required: true },
    logradouro: { type: String, required: true },
    numero: { type: String, required: true },
    complemento: { type: String, default: '' },
    bairro: { type: String, default: '' },
    cidade: { type: String, required: true },
    uf: { type: String, required: true },
  },
  { _id: false },
);

const statusHistorySchema = new Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    em: { type: Date, required: true },
    motivo: { type: String, default: null },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [orderItemSchema], required: true },
    subtotalCentavos: { type: Number, required: true, min: 0 },
    freteCentavos: { type: Number, required: true, min: 0 },
    totalCentavos: { type: Number, required: true, min: 0 },
    tipoEntrega: { type: String, enum: ['entrega', 'retirada'], required: true },
    endereco: { type: addressSnapshotSchema, default: null },
    agendamento: {
      data: { type: String, default: null },
      horario: { type: String, default: null },
    },
    status: { type: String, enum: ORDER_STATUSES, required: true, default: 'Criado' },
    statusHistory: { type: [statusHistorySchema], default: [] },
    payment: {
      metodo: { type: String, enum: ['pix', 'cartao'], required: true },
      gateway: { type: String, default: 'simulado' },
      referencia: { type: String, default: null },
      status: { type: String, enum: ['pendente', 'aprovado', 'recusado'], default: 'pendente' },
    },
  },
  { timestamps: true },
);

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

export const OrderModel = model('Order', orderSchema);
export type OrderDocument = HydratedDocument<InferSchemaType<typeof orderSchema>>;
