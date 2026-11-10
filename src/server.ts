import { app } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';

async function start(): Promise<void> {
  await connectDatabase();

  app.listen(env.PORT, () => {
    console.log(`API rodando em http://localhost:${env.PORT}`);
  });
}

start().catch((error: unknown) => {
  // Erro de inicialização: loga no servidor e encerra com código de falha.
  console.error('Falha ao iniciar a API:', error instanceof Error ? error.message : error);
  process.exit(1);
});
