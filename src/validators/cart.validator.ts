import { z } from 'zod';

const objectIdPattern = /^[a-fA-F0-9]{24}$/;

export const addCartItemBody = z.object({
  productId: z.string().regex(objectIdPattern, 'ID de produto inválido.'),
  sku: z.string().trim().min(1),
  quantidade: z.number().int().min(1).max(20).default(1),
});

export const updateCartItemBody = z.object({
  quantidade: z.number().int().min(1).max(20),
});

export const cartItemParams = z.object({
  sku: z.string().trim().min(1).max(80),
});

// Identificador do visitante, gerado pelo navegador. Aceita só caracteres seguros.
export const guestIdHeader = z
  .string()
  .regex(/^[A-Za-z0-9-]{8,64}$/, 'Identificador de carrinho inválido.');
