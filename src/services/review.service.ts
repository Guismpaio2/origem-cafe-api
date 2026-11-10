import { Types } from 'mongoose';
import { AppError } from '../errors/app-error.js';
import { OrderModel } from '../models/order.model.js';
import { ProductModel } from '../models/product.model.js';
import { ReviewModel } from '../models/review.model.js';
import { UserModel } from '../models/user.model.js';

interface ReviewLike {
  _id: Types.ObjectId;
  nota: number;
  comentario?: string;
  autorNome?: string;
  createdAt?: Date;
}

function toReviewDto(review: ReviewLike) {
  return {
    id: review._id.toString(),
    nota: review.nota,
    comentario: review.comentario ?? '',
    autor: review.autorNome ?? 'Cliente',
    criadoEm: review.createdAt ?? null,
  };
}

// RN001: só quem recebeu o produto (pedido Entregue ou Retirado) pode avaliar.
export async function createReview(userId: string, productId: string, nota: number, comentario: string) {
  const delivered = await OrderModel.findOne({
    userId,
    status: { $in: ['Entregue', 'Retirado'] },
    'items.productId': productId,
  }).lean<{ _id: Types.ObjectId }>();
  if (!delivered) {
    throw new AppError(422, 'BUSINESS_RULE_VIOLATION', 'Só é possível avaliar um produto que você recebeu.');
  }

  const existing = await ReviewModel.findOne({ userId, productId });
  if (existing) {
    // RNF010: reenvio da mesma avaliação não duplica nada.
    throw new AppError(409, 'CONFLICT', 'Você já avaliou este produto.');
  }

  const user = await UserModel.findById(userId).select('nome').lean<{ nome: string }>();
  const firstName = user?.nome.split(' ')[0] ?? 'Cliente';
  const review = await ReviewModel.create({
    userId,
    productId,
    orderId: delivered._id,
    nota,
    comentario,
    autorNome: firstName,
  });

  await recalculateRating(productId);
  return toReviewDto(review);
}

async function recalculateRating(productId: string): Promise<void> {
  const [stats] = await ReviewModel.aggregate<{ media: number; total: number }>([
    { $match: { productId: new Types.ObjectId(productId) } },
    { $group: { _id: null, media: { $avg: '$nota' }, total: { $sum: 1 } } },
  ]);
  await ProductModel.updateOne(
    { _id: productId },
    { $set: { ratingMedia: stats ? Math.round(stats.media * 10) / 10 : 0, ratingTotal: stats?.total ?? 0 } },
  );
}

export async function listReviews(productId: string) {
  const reviews = await ReviewModel.find({ productId }).sort({ createdAt: -1 }).limit(50).lean<ReviewLike[]>();
  return reviews.map(toReviewDto);
}
