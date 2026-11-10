import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

interface TokenPayload {
  sub: string;
  role: 'cliente' | 'admin';
}

// Lê "Authorization: Bearer <token>", valida o JWT e guarda quem é o usuário em res.locals.auth.
export const authenticate: RequestHandler = (request, response, next) => {
  const header = request.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    next(new AppError(401, 'UNAUTHORIZED', 'Faça login para continuar.'));
    return;
  }

  try {
    const token = header.slice('Bearer '.length);
    const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    response.locals.auth = { userId: payload.sub, role: payload.role };
    next();
  } catch {
    // Token expirado (15 min, RNF002) ou assinatura inválida: o cliente precisa entrar de novo.
    next(new AppError(401, 'UNAUTHORIZED', 'Sessão expirada. Entre novamente.'));
  }
};
