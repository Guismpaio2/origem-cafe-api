import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { ProductModel } from '../models/product.model.js';
import { UserModel } from '../models/user.model.js';
import { products, users } from './data.js';

// Custo mínimo do bcrypt exigido pelo RNF002.
const BCRYPT_COST = 12;
const CONSENT_VERSION = '1.0';

// Popula o banco de desenvolvimento. ATENÇÃO: apaga as coleções users e products antes de inserir.
// Rode só no banco de desenvolvimento (origem_cafe), nunca em produção.
async function seed(): Promise<void> {
  await connectDatabase();

  console.log('Apagando users e products...');
  await Promise.all([UserModel.deleteMany({}), ProductModel.deleteMany({})]);

  await ProductModel.insertMany(products);
  console.log(`${products.length} produtos inseridos.`);

  const now = new Date();
  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.senha, BCRYPT_COST);
    await UserModel.create({
      nome: user.nome,
      email: user.email,
      passwordHash,
      role: user.role,
      consentLgpd: { aceito: true, data: now, versao: CONSENT_VERSION },
    });
  }
  console.log(`${users.length} usuários de teste criados.`);

  await disconnectDatabase();
  console.log('Seed concluído.');
}

seed().catch(async (error: unknown) => {
  console.error('Falha no seed:', error instanceof Error ? error.message : error);
  await disconnectDatabase();
  process.exitCode = 1;
});
