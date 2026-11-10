import { randomUUID } from 'node:crypto';
import { AppError } from '../errors/app-error.js';
import { UserModel } from '../models/user.model.js';
import { toUserDto } from './auth.service.js';

const MAX_ADDRESSES = 5;

async function findActiveUser(userId: string) {
  const user = await UserModel.findOne({ _id: userId, deletedAt: null });
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Sessão inválida. Entre novamente.');
  return user;
}

export async function updateProfile(userId: string, input: { nome: string }) {
  const user = await findActiveUser(userId);
  user.set('nome', input.nome);
  await user.save();
  return toUserDto({ id: user.id, nome: user.nome, email: user.email, role: user.role, addresses: user.addresses });
}

export async function addAddress(
  userId: string,
  input: { apelido?: string; cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string },
) {
  const user = await findActiveUser(userId);
  if (user.addresses.length >= MAX_ADDRESSES) {
    throw new AppError(422, 'BUSINESS_RULE_VIOLATION', `Você pode guardar até ${MAX_ADDRESSES} endereços.`);
  }
  user.addresses.push({ ...input, apelido: input.apelido ?? '' });
  await user.save();
  return toUserDto({ id: user.id, nome: user.nome, email: user.email, role: user.role, addresses: user.addresses });
}

export async function removeAddress(userId: string, addressId: string) {
  const user = await findActiveUser(userId);
  const address = user.addresses.id(addressId);
  if (!address) throw new AppError(404, 'NOT_FOUND', 'Endereço não encontrado.');
  address.deleteOne();
  await user.save();
  return toUserDto({ id: user.id, nome: user.nome, email: user.email, role: user.role, addresses: user.addresses });
}

// RN009 e RE001: a exclusão anonimiza os dados pessoais. Pedidos e avaliações ficam, sem identificação.
export async function deleteAccount(userId: string, now = new Date()): Promise<void> {
  const user = await findActiveUser(userId);
  user.set({
    nome: 'Conta excluída',
    email: `excluida-${randomUUID()}@anonimizado.invalid`,
    passwordHash: `anonimizado-${randomUUID()}`,
    addresses: [],
    deletedAt: now,
  });
  await user.save();
}
