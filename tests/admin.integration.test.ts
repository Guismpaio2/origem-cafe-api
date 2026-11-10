import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let mongod: MongoMemoryServer;
let app: typeof import('../src/app.js').app;
let disconnect: () => Promise<void>;
let OrderModel: typeof import('../src/models/order.model.js').OrderModel;
let ProductModel: typeof import('../src/models/product.model.js').ProductModel;
let UserModel: typeof import('../src/models/user.model.js').UserModel;

let clienteToken: string;
let adminToken: string;
let clienteId: string;
let cafeId: string;

const senha = 'senha-forte-123';

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.PORT = '4996';
  const appModule = await import('../src/app.js');
  const dbModule = await import('../src/config/database.js');
  app = appModule.app;
  disconnect = dbModule.disconnectDatabase;
  OrderModel = (await import('../src/models/order.model.js')).OrderModel;
  ProductModel = (await import('../src/models/product.model.js')).ProductModel;
  UserModel = (await import('../src/models/user.model.js')).UserModel;
  await dbModule.connectDatabase();

  const cliente = await request(app).post('/api/v1/auth/register').send({ nome: 'Cliente Admin Test', email: 'cli@admin.teste', senha, consentimentoLgpd: true });
  clienteToken = cliente.body.data.token;
  clienteId = cliente.body.data.user.id;

  // Administrador é criado direto no banco: não existe cadastro público de equipe.
  await UserModel.create({
    nome: 'Equipe Teste',
    email: 'equipe@admin.teste',
    passwordHash: await bcrypt.hash(senha, 12),
    role: 'admin',
    consentLgpd: { aceito: true, data: new Date(), versao: '1.0' },
  });
  const admin = await request(app).post('/api/v1/auth/login').send({ email: 'equipe@admin.teste', senha });
  adminToken = admin.body.data.token;

  const cafe = await ProductModel.create({
    nome: 'Café Admin',
    tipo: 'cafe',
    variants: [{ sku: 'ADM-FIL-250', moagem: 'Moído para filtro', pesoGramas: 250, precoCentavos: 4000, estoque: 10 }],
  });
  cafeId = cafe.id;
});

afterAll(async () => {
  await disconnect();
  await mongod.stop();
});

const cliente = () => ({ Authorization: `Bearer ${clienteToken}` });
const equipe = () => ({ Authorization: `Bearer ${adminToken}` });

describe('acesso administrativo (RNF007)', () => {
  it('sem login responde 401', async () => {
    const response = await request(app).get('/api/v1/admin/dashboard');
    expect(response.status).toBe(401);
  });

  it('cliente recebe 403 em todas as rotas administrativas', async () => {
    const dashboard = await request(app).get('/api/v1/admin/dashboard').set(cliente());
    const products = await request(app).get('/api/v1/admin/products').set(cliente());
    const orders = await request(app).get('/api/v1/admin/orders').set(cliente());
    expect(dashboard.status).toBe(403);
    expect(products.status).toBe(403);
    expect(orders.status).toBe(403);
  });

  it('equipe acessa o dashboard', async () => {
    const response = await request(app).get('/api/v1/admin/dashboard').set(equipe());
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty('faturamentoCentavos');
  });
});

describe('produtos (RF007, RN002)', () => {
  it('não cadastra café sem moagem e peso', async () => {
    const response = await request(app)
      .post('/api/v1/admin/products')
      .set(equipe())
      .send({ nome: 'Café incompleto', tipo: 'cafe', variants: [{ sku: 'X1', precoCentavos: 1000, estoque: 1 }] });
    expect(response.status).toBe(400);
  });

  it('cadastra, edita e desativa um produto (sai do catálogo)', async () => {
    const created = await request(app)
      .post('/api/v1/admin/products')
      .set(equipe())
      .send({
        nome: 'Novo Café',
        tipo: 'cafe',
        origem: 'Mogiana (SP)',
        notasSensoriais: ['mel'],
        variants: [{ sku: 'NOVO-250', moagem: 'Grão inteiro', pesoGramas: 250, precoCentavos: 3500, estoque: 5 }],
      });
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    const edited = await request(app).patch(`/api/v1/admin/products/${id}`).set(equipe()).send({ nome: 'Novo Café Editado' });
    expect(edited.body.data.nome).toBe('Novo Café Editado');

    await request(app).delete(`/api/v1/admin/products/${id}`).set(equipe());
    const catalog = await request(app).get(`/api/v1/products/${id}`);
    expect(catalog.status).toBe(404);
  });
});

describe('status de pedidos (RN007, RN008)', () => {
  async function pedido(status: 'Pago' | 'Em Preparação', quantidade = 2) {
    return OrderModel.create({
      userId: clienteId,
      items: [{ productId: cafeId, nome: 'Café Admin', sku: 'ADM-FIL-250', moagem: 'Moído para filtro', pesoGramas: 250, precoCentavos: 4000, quantidade }],
      subtotalCentavos: 4000 * quantidade,
      freteCentavos: 0,
      totalCentavos: 4000 * quantidade,
      tipoEntrega: 'retirada',
      status,
      statusHistory: [{ status, em: new Date(), motivo: null }],
      payment: { metodo: 'pix', status: 'aprovado' },
    });
  }

  it('aceita a transição prevista e registra no histórico', async () => {
    const order = await pedido('Pago');
    const response = await request(app).patch(`/api/v1/admin/orders/${order.id}/status`).set(equipe()).send({ status: 'Em Preparação' });
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('Em Preparação');
    expect(response.body.data.statusHistory.at(-1).status).toBe('Em Preparação');
  });

  it('pula etapa com 422 (RN007)', async () => {
    const order = await pedido('Em Preparação');
    const response = await request(app).patch(`/api/v1/admin/orders/${order.id}/status`).set(equipe()).send({ status: 'Entregue' });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
  });

  it('cancelar em preparação exige justificativa (RN008)', async () => {
    const order = await pedido('Em Preparação');
    const semMotivo = await request(app).patch(`/api/v1/admin/orders/${order.id}/status`).set(equipe()).send({ status: 'Cancelado' });
    expect(semMotivo.status).toBe(422);
  });

  it('cancelar com justificativa devolve o estoque baixado', async () => {
    const antes = (await ProductModel.findById(cafeId).lean<{ variants: { sku: string; estoque: number }[] }>())!.variants.find((v) => v.sku === 'ADM-FIL-250')!.estoque;
    const order = await pedido('Pago', 3);
    await ProductModel.updateOne({ _id: cafeId, 'variants.sku': 'ADM-FIL-250' }, { $inc: { 'variants.$.estoque': -3 } });

    const response = await request(app)
      .patch(`/api/v1/admin/orders/${order.id}/status`)
      .set(equipe())
      .send({ status: 'Cancelado', motivo: 'Cliente pediu o cancelamento.' });
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('Cancelado');
    const depois = (await ProductModel.findById(cafeId).lean<{ variants: { sku: string; estoque: number }[] }>())!.variants.find((v) => v.sku === 'ADM-FIL-250')!.estoque;
    expect(depois).toBe(antes);
  });

  it('lista pedidos com o cliente e o dashboard soma os pagos', async () => {
    const list = await request(app).get('/api/v1/admin/orders').set(equipe());
    expect(list.status).toBe(200);
    expect(list.body.data[0].cliente).toHaveProperty('email');

    const dash = await request(app).get('/api/v1/admin/dashboard').set(equipe());
    expect(dash.body.data.pedidos).toBeGreaterThan(0);
  });
});
