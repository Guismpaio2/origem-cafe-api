import { Schema, model } from 'mongoose';

const reviewSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    nota: { type: Number, required: true, min: 1, max: 5 },
    comentario: { type: String, default: '', maxlength: 1000 },
    autorNome: { type: String, default: 'Cliente' },
  },
  { timestamps: true },
);

// RN001: uma avaliação por pessoa e por produto. Reenvio não duplica (RNF010).
reviewSchema.index({ userId: 1, productId: 1 }, { unique: true });
reviewSchema.index({ productId: 1, createdAt: -1 });

export const ReviewModel = model('Review', reviewSchema);
