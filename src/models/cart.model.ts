import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

// Carrinho de visitante ("guest:<id>") ou de cliente ("user:<id>"). RNF003: expira em 24 h.
const cartItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String, required: true },
    quantidade: { type: Number, required: true, min: 1, max: 20 },
  },
  { _id: false },
);

const cartSchema = new Schema(
  {
    ownerKey: { type: String, required: true, unique: true },
    items: { type: [cartItemSchema], default: [] },
    // Índice TTL: o Mongo apaga o carrinho quando expiresAt passa (RNF003).
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
);

export const CartModel = model('Cart', cartSchema);
export type CartDocument = HydratedDocument<InferSchemaType<typeof cartSchema>>;
