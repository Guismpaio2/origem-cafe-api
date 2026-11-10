import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let mongod: MongoMemoryServer;
let app: typeof import('../src/app.js').app;
let disconnect: () => Promise<void>;
let ProductModel: typeof import('../src/models/product.model.js').ProductModel;

const senha = 'senha-forte-123';
let produtoId: string;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.PORT = '4994';
  const appModule = await import('../src/app.js');
  const dbModule = await import('../src/config/database.js');
  app = appModule.app;
  disconnect = dbModule.disconnectDatabase;
  ProductModel = (await import('../src/models/product.model.js')).ProductModel;
  await dbModule.connectDatabase();
  await request(app).post('/api/v1/auth/register').send({ nome: 'Ana Silva', email: 'ana@teste.com', senha, consentimentoLgpd: true });
  const product = await ProductModel.create({
    nome: 'Produto Catálogo',
    tipo: 'cafe',
    variants: [{ sku: 'CAT-1', moagem: 'Moído para filtro', pesoGramas: 250, precoCentavos: 3990, estoque: 2 }],
  });
  produtoId = product.id;
  await ProductModel.create({ nome: 'Produto Inativo', tipo: 'acessorio', ativo: false, variants: [{ sku: 'OFF', precoCentavos: 100, estoque: 1 }] });
});

afterAll(async () => {
  await disconnect();
  await mongod.stop();
});

describe('cadastro e login (RF005, RS005)', () => {
  it('não cadastra sem consentimento LGPD (RE001)', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({ nome: 'Sem Consent', email: 'x@teste.com', senha, consentimentoLgpd: false });
    expect(response.status).toBe(400);
  });

  it('não cadastra o mesmo e-mail duas vezes (409)', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({ nome: 'Ana de novo', email: 'ana@teste.com', senha, consentimentoLgpd: true });
    expect(response.status).toBe(409);
  });

  it('senha curta é recusada (400)', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({ nome: 'Curta', email: 'curta@teste.com', senha: '123', consentimentoLgpd: true });
    expect(response.status).toBe(400);
  });

  it('login com senha errada e e-mail inexistente dá a mesma mensagem (RS005)', async () => {
    const errada = await request(app).post('/api/v1/auth/login').send({ email: 'ana@teste.com', senha: 'errada-123' });
    const inexistente = await request(app).post('/api/v1/auth/login').send({ email: 'nao@existe.com', senha: 'errada-123' });
    expect(errada.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(errada.body.error.message).toBe(inexistente.body.error.message);
  });

  it('login com e-mail em maiúsculas funciona', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({ email: 'ANA@teste.com', senha });
    expect(response.status).toBe(200);
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('token inválido em /auth/me responde 401', async () => {
    const response = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer token.falso.aqui');
    expect(response.status).toBe(401);
  });
});

describe('catálogo (RF003)', () => {
  it('lista só produtos ativos e filtra por tipo', async () => {
    const all = await request(app).get('/api/v1/products');
    expect(all.body.data.map((p: { nome: string }) => p.nome)).not.toContain('Produto Inativo');
    const acessorios = await request(app).get('/api/v1/products?tipo=acessorio');
    expect(acessorios.body.data).toEqual([]);
  });

  it('responde 404 para produto inativo ou inexistente', async () => {
    const inativo = await ProductModel.findOne({ nome: 'Produto Inativo' });
    expect((await request(app).get(`/api/v1/products/${inativo!.id}`)).status).toBe(404);
    expect((await request(app).get('/api/v1/products/64b000000000000000000000')).status).toBe(404);
  });

  it('detalhe mostra disponibilidade, não a quantidade exata de estoque', async () => {
    const response = await request(app).get(`/api/v1/products/${produtoId}`);
    expect(response.body.data.variants[0].disponivel).toBe(true);
    expect(response.body.data.variants[0]).not.toHaveProperty('estoque');
  });

  it('paginação respeita o limite máximo de 50', async () => {
    const response = await request(app).get('/api/v1/products?limit=500');
    expect(response.status).toBe(400);
  });
});
