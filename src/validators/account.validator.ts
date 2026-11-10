import { z } from 'zod';
import { addressInput } from './order.validator.js';

export const updateProfileBody = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome completo.').max(120),
});

export const addAddressBody = addressInput.extend({
  apelido: z.string().trim().max(40).optional(),
});

export const addressIdParams = z.object({
  addressId: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Endereço inválido.'),
});

export const cepParams = z.object({
  cep: z.string().min(8).max(9),
});

export const deleteAccountBody = z.object({
  confirmacao: z.literal('EXCLUIR', { message: 'Digite EXCLUIR para confirmar.' }),
});
