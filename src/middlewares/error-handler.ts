import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';

// Último da cadeia. Converte qualquer erro no formato { error: { code, message, details } }.
// Erros 500 são logados só no servidor e nunca mostram o stack trace ao cliente (AGENTS.md, seção 9).
export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: error.issues },
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.', details: [] },
  });
};
