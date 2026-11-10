import { z } from 'zod';

const objectIdPattern = /^[a-fA-F0-9]{24}$/;

export const addressInput = z.object({
  cep: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido.'),
  logradouro: z.string().trim().min(3, 'Informe o logradouro.').max(160),
  numero: z.string().trim().min(1, 'Informe o número.').max(20),
  complemento: z.string().trim().max(120).default(''),
  bairro: z.string().trim().max(120).default(''),
  cidade: z.string().trim().min(2, 'Informe a cidade.').max(120),
  uf: z.string().trim().length(2, 'Use a sigla do estado com 2 letras.').transform((value) => value.toUpperCase()),
});

export const orderItemInput = z.object({
  productId: z.string().regex(objectIdPattern, 'ID de produto inválido.'),
  sku: z.string().trim().min(1),
  quantidade: z.number().int().min(1).max(20),
});

const tipoEntregaInput = z.enum(['entrega', 'retirada']);

export const createOrderBody = z
  .object({
    items: z.array(orderItemInput).min(1, 'O pedido precisa de pelo menos um item.').max(50),
    tipoEntrega: tipoEntregaInput,
    endereco: addressInput.optional(),
    agendamento: z
      .object({
        data: z.string(),
        horario: z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido.'),
      })
      .optional(),
    pagamento: z.object({
      metodo: z.enum(['pix', 'cartao']),
      simularRecusa: z.boolean().default(false),
    }),
  })
  .superRefine((value, ctx) => {
    const skus = value.items.map((item) => item.sku);
    if (new Set(skus).size !== skus.length) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'Cada variante só pode aparecer uma vez no pedido.' });
    }
    if (value.tipoEntrega === 'entrega' && !value.endereco) {
      ctx.addIssue({ code: 'custom', path: ['endereco'], message: 'Informe o endereço de entrega.' });
    }
    if (value.tipoEntrega === 'retirada' && !value.agendamento) {
      ctx.addIssue({ code: 'custom', path: ['agendamento'], message: 'Escolha a data e o horário da retirada.' });
    }
  });

export const shippingQuoteBody = z.object({
  items: z.array(orderItemInput).min(1).max(50),
  tipoEntrega: tipoEntregaInput,
});

export const pickupAvailabilityQuery = z.object({
  date: z.string().min(10, 'Informe a data no formato AAAA-MM-DD.'),
});

export const orderIdParams = z.object({
  id: z.string().regex(objectIdPattern, 'ID de pedido inválido.'),
});

export type CreateOrderBody = z.infer<typeof createOrderBody>;
export type ShippingQuoteBody = z.infer<typeof shippingQuoteBody>;
