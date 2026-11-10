import { z } from 'zod';
import { ORDER_STATUSES } from '../models/order.model.js';

const variantInput = z.object({
  sku: z.string().trim().min(1).max(60),
  moagem: z.string().trim().min(1).max(60).optional(),
  pesoGramas: z.number().int().min(1).max(10000).optional(),
  precoCentavos: z.number().int().min(0),
  estoque: z.number().int().min(0),
});

const productFields = z.object({
  nome: z.string().trim().min(2).max(120),
  tipo: z.enum(['cafe', 'acessorio']),
  descricao: z.string().trim().max(2000).default(''),
  origem: z.string().trim().max(120).default(''),
  notasSensoriais: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  imagens: z.array(z.string().url()).max(10).default([]),
  variants: z.array(variantInput).min(1).max(30),
  ativo: z.boolean().default(true),
});

// RN002: café precisa de moagem e peso em cada variante; SKUs não se repetem.
export const productBody = productFields.superRefine((value, ctx) => {
  const skus = value.variants.map((variant) => variant.sku);
  if (new Set(skus).size !== skus.length) {
    ctx.addIssue({ code: 'custom', path: ['variants'], message: 'Cada SKU precisa ser único.' });
  }
  if (value.tipo === 'cafe') {
    value.variants.forEach((variant, index) => {
      if (!variant.moagem || !variant.pesoGramas) {
        ctx.addIssue({ code: 'custom', path: ['variants', index], message: 'Café precisa de moagem e peso em cada variante.' });
      }
    });
  }
});

export const productPatchBody = productFields.partial();

export const productIdParams = z.object({
  id: z.string().regex(/^[a-fA-F0-9]{24}$/, 'ID de produto inválido.'),
});

export const orderStatusBody = z.object({
  status: z.enum(ORDER_STATUSES),
  motivo: z.string().trim().min(5, 'Escreva a justificativa com pelo menos 5 caracteres.').max(300).optional(),
});

export const orderIdParams = z.object({
  id: z.string().regex(/^[a-fA-F0-9]{24}$/, 'ID de pedido inválido.'),
});

export const orderListQuery = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
});
