import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Como authenticate, mas não bloqueia: visitante segue sem login (RU002).
export const optionalAuth: RequestHandler = (request, response, next) => {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as { sub: string; role: 'cliente' | 'admin' };
      response.locals.auth = { userId: payload.sub, role: payload.role };
    } catch {
      // Token inválido vale como visitante; a rota que exige login responde 401.
    }
  }
  next();
};
