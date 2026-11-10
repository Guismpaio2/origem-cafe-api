import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let mongod: MongoMemoryServer;
let app: typeof import('../src/app.js').app;
let disconnect: () => Promise<void>;
let ProductModel: typeof import('../src/models/product.model.js').ProductModel;
let OrderModel: typeof import('../src/models/order.model.js').OrderModel;

let cafeId: string;
let cafeSemMoagemId: string;

const assinante = { email: 'assinante@teste.com', senha: 'senha-forte-123' };
const avaliador = { email: 'avaliador@teste.com', senha: 'senha-forte-123' };
let tokenA: string;
let tokenB: string;
let idB: string;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.PORT = '4995';
  const appModule = await import('../src/app.js');
  const dbModule = await import('../src/config/database.js');
  app = appModule.app;
  disconnect = dbModule.disconnectDatabase;
  ProductModel = (await import('../src/models/product.model.js')).ProductModel;
  OrderModel = (await import('../src/models/order.model.js')).OrderModel;
  await dbModule.connectDatabase();

  const cafe = await ProductModel.create({
    nome: 'Assinatura Café',
    tipo: 'cafe',
    variants: [{ sku: 'SUB-250', moagem: 'Grão inteiro', pesoGramas: 250, precoCentavos: 3990, estoque: 50 }],
  });
  cafeId = cafe.id;
  const semMoagem = await ProductModel.create({
    nome: 'Café sem moagem',
    tipo: 'cafe',
    variants: [{ sku: 'SEM-MOAGEM', precoCentavos: 3990, estoque: 5 }],
  });
  cafeSemMoagemId = semMoagem.id;

  const a = await request(app).post('/api/v1/auth/register').send({ nome: 'Assinante', ...assinante, consentimentoLgpd: true });
  tokenA = a.body.data.token;
  const b = await request(app).post('/api/v1/auth/register').send({ nome: 'Avaliador Teste', ...avaliador, consentimentoLgpd: true });
  tokenB = b.body.data.token;
  idB = b.body.data.user.id;
});

afterAll(async () => {
  await disconnect();
  await mongod.stop();
});

const comA = () => ({ Authorization: `Bearer ${tokenA}` });
const comB = () => ({ Authorization: `Bearer ${tokenB}` });

describe('assinatura (RF006, RN002, RN004)', () => {
  it('exige moagem e peso para assinar', async () => {
    const response = await request(app).post('/api/v1/subscriptions').set(comA()).send({ productId: cafeSemMoagemId, sku: 'SEM-MOAGEM' });
    expect(response.status).toBe(422);
  });

  it('cria a assinatura com próxima cobrança no mesmo dia do mês seguinte (RS003)', async () => {
    const response = await request(app).post('/api/v1/subscriptions').set(comA()).send({ productId: cafeId, sku: 'SUB-250' });
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('ativa');
    const proxima = new Date(response.body.data.proximaCobranca);
    const hoje = new Date();
    expect(proxima.getUTCMonth()).toBe((hoje.getUTCMonth() + 1) % 12);
  });

  it('recusa uma segunda assinatura ativa (RN004)', async () => {
    const response = await request(app).post('/api/v1/subscriptions').set(comA()).send({ productId: cafeId, sku: 'SUB-250' });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
  });

  it('pausa e retoma; cancelamento segue valendo até o próximo ciclo (RN004)', async () => {
    const list = await request(app).get('/api/v1/subscriptions/me').set(comA());
    const id = list.body.data[0].id;

    const paused = await request(app).patch(`/api/v1/subscriptions/${id}`).set(comA()).send({ acao: 'pausar' });
    expect(paused.body.data.status).toBe('pausada');

    const resumed = await request(app).patch(`/api/v1/subscriptions/${id}`).set(comA()).send({ acao: 'retomar' });
    expect(resumed.body.data.status).toBe('ativa');

    const cancelled = await request(app).patch(`/api/v1/subscriptions/${id}`).set(comA()).send({ acao: 'cancelar' });
    expect(cancelled.body.data.status).toBe('ativa');
    expect(cancelled.body.data.cancelamentoSolicitado).toBe(true);
  });
});

describe('avaliações (RF002, RN001, RNF010)', () => {
  it('quem não comprou o produto não avalia (RN001)', async () => {
    const response = await request(app).post(`/api/v1/products/${cafeId}/reviews`).set(comB()).send({ nota: 5, comentario: 'Ótimo' });
    expect(response.status).toBe(422);
  });

  it('comprador com pedido retirado avalia e a média do produto é atualizada', async () => {
    await OrderModel.create({
      userId: idB,
      items: [{ productId: cafeId, nome: 'Assinatura Café', sku: 'SUB-250', moagem: 'Grão inteiro', pesoGramas: 250, precoCentavos: 3990, quantidade: 1 }],
      subtotalCentavos: 3990,
      freteCentavos: 0,
      totalCentavos: 3990,
      tipoEntrega: 'retirada',
      status: 'Retirado',
      statusHistory: [{ status: 'Retirado', em: new Date(), motivo: null }],
      payment: { metodo: 'pix', status: 'aprovado' },
    });

    const response = await request(app).post(`/api/v1/products/${cafeId}/reviews`).set(comB()).send({ nota: 4, comentario: 'Gostei muito' });
    expect(response.status).toBe(201);
    expect(response.body.data.autor).toBe('Avaliador');

    const product = await ProductModel.findById(cafeId).lean<{ ratingMedia: number; ratingTotal: number }>();
    expect(product?.ratingTotal).toBe(1);
    expect(product?.ratingMedia).toBe(4);
  });

  it('reenvio não duplica a avaliação (RNF010)', async () => {
    const response = await request(app).post(`/api/v1/products/${cafeId}/reviews`).set(comB()).send({ nota: 2 });
    expect(response.status).toBe(409);
    const list = await request(app).get(`/api/v1/products/${cafeId}/reviews`);
    expect(list.body.data).toHaveLength(1);
  });

  it('a nota precisa estar entre 1 e 5', async () => {
    const response = await request(app).post(`/api/v1/products/${cafeId}/reviews`).set(comA()).send({ nota: 9 });
    expect(response.status).toBe(400);
  });
});
