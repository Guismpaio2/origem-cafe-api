import { Schema, model } from 'mongoose';

// Variante = combinação de moagem e peso, com preço e estoque próprios (glossário, Entrega 1).
const variantSchema = new Schema(
  {
    sku: { type: String, required: true, trim: true },
    moagem: { type: String, trim: true },
    pesoGramas: { type: Number, min: 1 },
    precoCentavos: { type: Number, required: true, min: 0 },
    estoque: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    nome: { type: String, required: true, trim: true },
    tipo: { type: String, enum: ['cafe', 'acessorio'], required: true },
    descricao: { type: String, default: '' },
    origem: { type: String, default: '' },
    notasSensoriais: { type: [String], default: [] },
    imagens: { type: [String], default: [] },
    variants: { type: [variantSchema], default: [] },
    ativo: { type: Boolean, default: true },
    ratingMedia: { type: Number, default: 0 },
    ratingTotal: { type: Number, default: 0 },
  },
  { timestamps: true },
);

productSchema.index({ tipo: 1 });
productSchema.index({ ativo: 1 });

export const ProductModel = model('Product', productSchema);
