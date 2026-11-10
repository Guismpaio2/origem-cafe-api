// Erro de aplicação: carrega o status HTTP e o código que o front vai receber.
// Services lançam AppError; o errorHandler transforma em resposta JSON.
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: unknown[];

  constructor(statusCode: number, code: string, message: string, details: unknown[] = []) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
