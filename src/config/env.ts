import 'dotenv/config';
import { z } from 'zod';

// Lê o process.env uma única vez e valida. Se algo estiver errado, a API
// nem sobe e mostra exatamente qual variável falta (melhor que falhar depois).
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI é obrigatório'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter pelo menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  VIACEP_BASE_URL: z.url().default('https://viacep.com.br/ws'),
  PAYMENT_GATEWAY_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
