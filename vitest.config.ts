import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Variáveis mínimas para o env.ts validar em qualquer teste.
    env: {
      JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres',
      MONGODB_URI: 'mongodb://127.0.0.1:1/placeholder',
    },
  },
});
