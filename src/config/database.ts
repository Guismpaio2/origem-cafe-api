import mongoose from 'mongoose';
import { env } from './env.js';

// Nome do banco fixo no código: a URI do Atlas costuma vir sem o nome do banco.
export const DATABASE_NAME = 'origem_cafe';

export async function connectDatabase(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI, { dbName: DATABASE_NAME });
  console.log(`MongoDB conectado (banco: ${DATABASE_NAME})`);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
