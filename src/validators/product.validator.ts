import { z } from 'zod';

export const listProductsQuery = z.object({
  tipo: z.enum(['cafe', 'acessorio']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const productIdParams = z.object({
  id: z.string().regex(/^[a-fA-F0-9]{24}$/, 'ID de produto inválido.'),
});

export type ListProductsQuery = z.infer<typeof listProductsQuery>;
