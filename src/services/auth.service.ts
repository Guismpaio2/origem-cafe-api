import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { UserModel } from '../models/user.model.js';
import type { LoginBody, RegisterBody } from '../validators/auth.validator.js';

// RNF002: custo mínimo 12 para o bcrypt.
const BCRYPT_COST = 12;
const CONSENT_VERSION = '1.0';

type Role = 'cliente' | 'admin';

// Nunca devolve passwordHash (RNF002).
export function toUserDto(user: { id: string; nome: string; email: string; role: Role; addresses: unknown[] }) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    role: user.role,
    addresses: user.addresses,
  };
}

export function signToken(userId: string, role: Role): string {
  return jwt.sign({ role }, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export async function registerUser(input: RegisterBody) {
  const alreadyExists = await UserModel.exists({ email: input.email });
  if (alreadyExists) {
    throw new AppError(409, 'CONFLICT', 'Já existe uma conta com este e-mail.');
  }

  const passwordHash = await bcrypt.hash(input.senha, BCRYPT_COST);

  const user = await UserModel.create({
    nome: input.nome,
    email: input.email,
    passwordHash,
    role: 'cliente',
    consentLgpd: { aceito: true, data: new Date(), versao: CONSENT_VERSION },
  });

  return {
    user: toUserDto({ id: user.id, nome: user.nome, email: user.email, role: user.role, addresses: user.addresses }),
    token: signToken(user.id, user.role),
  };
}

export async function loginUser(input: LoginBody) {
  const user = await UserModel.findOne({ email: input.email, deletedAt: null }).select('+passwordHash');

  // RS005/E1: mensagem genérica, sem dizer se o e-mail existe.
  const passwordMatches = user ? await bcrypt.compare(input.senha, user.passwordHash) : false;
  if (!user || !passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');
  }

  return {
    user: toUserDto({ id: user.id, nome: user.nome, email: user.email, role: user.role, addresses: user.addresses }),
    token: signToken(user.id, user.role),
  };
}

export async function getCurrentUser(userId: string) {
  const user = await UserModel.findOne({ _id: userId, deletedAt: null });
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Sessão inválida. Entre novamente.');
  }
  return toUserDto({ id: user.id, nome: user.nome, email: user.email, role: user.role, addresses: user.addresses });
}
