import { z } from 'zod';

const objectIdPattern = /^[a-fA-F0-9]{24}$/;

export const createSubscriptionBody = z.object({
  productId: z.string().regex(objectIdPattern, 'ID de produto inválido.'),
  sku: z.string().trim().min(1),
});

export const subscriptionActionBody = z.object({
  acao: z.enum(['pausar', 'retomar', 'cancelar']),
});

export const subscriptionIdParams = z.object({
  id: z.string().regex(objectIdPattern, 'ID de assinatura inválido.'),
});

export const createReviewBody = z.object({
  nota: z.number().int().min(1, 'A nota vai de 1 a 5.').max(5, 'A nota vai de 1 a 5.'),
  comentario: z.string().trim().max(1000).default(''),
});

export const productIdParams = z.object({
  id: z.string().regex(objectIdPattern, 'ID de produto inválido.'),
});
