import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Banco real em memória (mesmo tipo de servidor do Atlas, sem rede).
let mongod: MongoMemoryServer;
let app: typeof import('../src/app.js').app;
let disconnect: () => Promise<void>;
let ProductModel: typeof import('../src/models/product.model.js').ProductModel;

let clienteToken: string;
let outraToken: string;
let cafeId: string;
let acessorioId: string;

const MONDAY = '2030-01-07';
const SUNDAY = '2030-01-06';
const endereco = { cep: '37500-000', logradouro: 'Rua Teste', numero: '10', cidade: 'Itajubá', uf: 'MG' };

async function estoque(sku: string): Promise<number> {
  const product = await ProductModel.findOne({ 'variants.sku': sku }).lean<{ variants: { sku: string; estoque: number }[] }>();
  return product!.variants.find((variant) => variant.sku === sku)!.estoque;
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.PORT = '4999';

  const appModule = await import('../src/app.js');
  const dbModule = await import('../src/config/database.js');
  const productModule = await import('../src/models/product.model.js');
  app = appModule.app;
  ProductModel = productModule.ProductModel;
  disconnect = dbModule.disconnectDatabase;
  await dbModule.connectDatabase();

  const cafe = await ProductModel.create({
    nome: 'Cerrado Teste',
    tipo: 'cafe',
    origem: 'Cerrado Mineiro (MG)',
    variants: [
      { sku: 'T-INT-250', moagem: 'Grão inteiro', pesoGramas: 250, precoCentavos: 3990, estoque: 4 },
      { sku: 'T-FIL-250', moagem: 'Moído para filtro', pesoGramas: 250, precoCentavos: 3990, estoque: 20 },
    ],
  });
  const acessorio = await ProductModel.create({
    nome: 'Prensa Teste',
    tipo: 'acessorio',
    variants: [{ sku: 'T-PREN', precoCentavos: 12990, estoque: 10 }],
  });
  cafeId = cafe.id;
  acessorioId = acessorio.id;

  const cliente = await request(app).post('/api/v1/auth/register').send({
    nome: 'Cliente Teste',
    email: 'checkout@teste.com',
    senha: 'senha-forte-123',
    consentimentoLgpd: true,
  });
  clienteToken = cliente.body.data.token;

  const outra = await request(app).post('/api/v1/auth/register').send({
    nome: 'Outra Pessoa',
    email: 'outra@teste.com',
    senha: 'senha-forte-123',
    consentimentoLgpd: true,
  });
  outraToken = outra.body.data.token;
});

afterAll(async () => {
  await disconnect();
  await mongod.stop();
});

describe('horários de retirada (RN003) pela API', () => {
  it('lista 20 horários para uma segunda-feira futura', async () => {
    const response = await request(app).get(`/api/v1/pickup/availability?date=${MONDAY}`);
    expect(response.status).toBe(200);
    expect(response.body.data.slots).toHaveLength(20);
  });

  it('não lista horário no domingo', async () => {
    const response = await request(app).get(`/api/v1/pickup/availability?date=${SUNDAY}`);
    expect(response.body.data.slots).toEqual([]);
  });
});

describe('frete pela API (RN006)', () => {
  it('calcula R$ 15,00 de frete para entrega de pedido pequeno', async () => {
    const response = await request(app)
      .post('/api/v1/shipping/quote')
      .send({ items: [{ productId: cafeId, sku: 'T-FIL-250', quantidade: 1 }], tipoEntrega: 'entrega' });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ subtotalCentavos: 3990, freteCentavos: 1500, totalCentavos: 5490 });
  });

  it('não cobra frete na retirada', async () => {
    const response = await request(app)
      .post('/api/v1/shipping/quote')
      .send({ items: [{ productId: cafeId, sku: 'T-FIL-250', quantidade: 1 }], tipoEntrega: 'retirada' });
    expect(response.body.data.freteCentavos).toBe(0);
  });
});

describe('finalização de pedido (RF001, RN005, RS001, RS004)', () => {
  it('exige login para finalizar (RU003)', async () => {
    const response = await request(app).post('/api/v1/orders').send({});
    expect(response.status).toBe(401);
  });

  it('entrega aprovada: pedido vai para Pago, baixa estoque e aplica o frete', async () => {
    const antes = await estoque('T-FIL-250');
    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({
        items: [{ productId: cafeId, sku: 'T-FIL-250', quantidade: 2 }],
        tipoEntrega: 'entrega',
        endereco,
        pagamento: { metodo: 'pix' },
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('Pago');
    expect(response.body.data.totalCentavos).toBe(7980 + 1500);
    expect(response.body.data.statusHistory.map((entry: { status: string }) => entry.status)).toEqual(['Criado', 'Pago']);
    expect(await estoque('T-FIL-250')).toBe(antes - 2);
  });

  it('retirada no horário livre: pedido Pago e sem frete', async () => {
    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({
        items: [{ productId: cafeId, sku: 'T-FIL-250', quantidade: 1 }],
        tipoEntrega: 'retirada',
        agendamento: { data: MONDAY, horario: '10:00' },
        pagamento: { metodo: 'cartao' },
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('Pago');
    expect(response.body.data.freteCentavos).toBe(0);
    expect(response.body.data.agendamento).toEqual({ data: MONDAY, horario: '10:00' });
  });

  it('retirada em domingo é bloqueada com 422 (RN003)', async () => {
    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({
        items: [{ productId: cafeId, sku: 'T-FIL-250', quantidade: 1 }],
        tipoEntrega: 'retirada',
        agendamento: { data: SUNDAY, horario: '10:00' },
        pagamento: { metodo: 'pix' },
      });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
  });

  it('pagamento recusado: pedido Cancelado e estoque intacto (RS004)', async () => {
    const antes = await estoque('T-FIL-250');
    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({
        items: [{ productId: cafeId, sku: 'T-FIL-250', quantidade: 3 }],
        tipoEntrega: 'entrega',
        endereco,
        pagamento: { metodo: 'pix', simularRecusa: true },
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('Cancelado');
    expect(response.body.data.pagamento.status).toBe('recusado');
    expect(await estoque('T-FIL-250')).toBe(antes);
  });

  it('quantidade acima do estoque é bloqueada com 422 (RN005)', async () => {
    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({
        items: [{ productId: cafeId, sku: 'T-INT-250', quantidade: 5 }],
        tipoEntrega: 'entrega',
        endereco,
        pagamento: { metodo: 'pix' },
      });
    expect(response.status).toBe(422);
    expect(response.body.error.message).toMatch(/Estoque insuficiente/);
  });

  it('acessório acima de R$ 200,00 tem frete grátis (RN006)', async () => {
    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({
        items: [{ productId: acessorioId, sku: 'T-PREN', quantidade: 2 }],
        tipoEntrega: 'entrega',
        endereco,
        pagamento: { metodo: 'pix' },
      });
    expect(response.body.data.subtotalCentavos).toBe(25980);
    expect(response.body.data.freteCentavos).toBe(0);
  });

  it('entrega sem endereço é recusada com 400', async () => {
    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${clienteToken}`)
      .send({ items: [{ productId: cafeId, sku: 'T-FIL-250', quantidade: 1 }], tipoEntrega: 'entrega', pagamento: { metodo: 'pix' } });
    expect(response.status).toBe(400);
  });

  it('lista só os pedidos do próprio cliente', async () => {
    const response = await request(app).get('/api/v1/orders').set('Authorization', `Bearer ${outraToken}`);
    expect(response.body.data).toEqual([]);
  });

  it('outra pessoa não consegue abrir o pedido (404 para não revelar que existe)', async () => {
    const mine = await request(app).get('/api/v1/orders').set('Authorization', `Bearer ${clienteToken}`);
    const orderId = mine.body.data[0].id;
    const response = await request(app).get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${outraToken}`);
    expect(response.status).toBe(404);
  });
});
