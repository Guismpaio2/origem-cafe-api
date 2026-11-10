import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';

// RNF007: rotas administrativas respondem 403 para quem não é da equipe. Use depois de authenticate.
export function requireRole(role: 'admin'): RequestHandler {
  return (_request, response, next) => {
    const auth = response.locals.auth as { role?: string } | undefined;
    if (!auth) {
      next(new AppError(401, 'UNAUTHORIZED', 'Faça login para continuar.'));
      return;
    }
    if (auth.role !== role) {
      next(new AppError(403, 'FORBIDDEN', 'Acesso restrito à equipe da Origem Café.'));
      return;
    }
    next();
  };
}
