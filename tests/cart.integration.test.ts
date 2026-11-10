import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let mongod: MongoMemoryServer;
let app: typeof import('../src/app.js').app;
let disconnect: () => Promise<void>;
let ProductModel: typeof import('../src/models/product.model.js').ProductModel;
let CartModel: typeof import('../src/models/cart.model.js').CartModel;

let cafeId: string;
let acessorioId: string;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.PORT = '4998';
  const appModule = await import('../src/app.js');
  const dbModule = await import('../src/config/database.js');
  ProductModel = (await import('../src/models/product.model.js')).ProductModel;
  CartModel = (await import('../src/models/cart.model.js')).CartModel;
  app = appModule.app;
  disconnect = dbModule.disconnectDatabase;
  await dbModule.connectDatabase();

  const cafe = await ProductModel.create({
    nome: 'Carrinho Café',
    tipo: 'cafe',
    variants: [{ sku: 'C-FIL-250', moagem: 'Moído para filtro', pesoGramas: 250, precoCentavos: 3990, estoque: 30 }],
  });
  const acessorio = await ProductModel.create({
    nome: 'Coador Teste',
    tipo: 'acessorio',
    variants: [{ sku: 'C-COADOR', precoCentavos: 3490, estoque: 0 }],
  });
  cafeId = cafe.id;
  acessorioId = acessorio.id;
});

afterAll(async () => {
  await disconnect();
  await mongod.stop();
});

describe('carrinho do visitante (RU002, RF004)', () => {
  it('exige o identificador do carrinho para visitante', async () => {
    const response = await request(app).get('/api/v1/cart');
    expect(response.status).toBe(400);
  });

  it('adiciona café com moagem e peso e calcula o subtotal com o preço do banco', async () => {
    const guest = 'visitante-aaaa-1111';
    const add = await request(app)
      .post('/api/v1/cart/items')
      .set('x-cart-id', guest)
      .send({ productId: cafeId, sku: 'C-FIL-250', quantidade: 2 });

    expect(add.status).toBe(201);
    expect(add.body.data.subtotalCentavos).toBe(7980);
    expect(add.body.data.items[0]).toMatchObject({ sku: 'C-FIL-250', quantidade: 2, disponivel: true });
  });

  it('não aceita café sem variante escolhida (RN002)', async () => {
    const response = await request(app)
      .post('/api/v1/cart/items')
      .set('x-cart-id', 'visitante-bbbb-2222')
      .send({ productId: cafeId, sku: 'SKU-INEXISTENTE', quantidade: 1 });
    expect(response.status).toBe(404);
  });

  it('muda a quantidade e remove itens', async () => {
    const guest = 'visitante-cccc-3333';
    await request(app).post('/api/v1/cart/items').set('x-cart-id', guest).send({ productId: cafeId, sku: 'C-FIL-250' });
    const updated = await request(app).patch('/api/v1/cart/items/C-FIL-250').set('x-cart-id', guest).send({ quantidade: 5 });
    expect(updated.body.data.count).toBe(5);

    const removed = await request(app).delete('/api/v1/cart/items/C-FIL-250').set('x-cart-id', guest);
    expect(removed.body.data.items).toEqual([]);
  });

  it('limita a quantidade por item a 20', async () => {
    const guest = 'visitante-dddd-4444';
    await request(app).post('/api/v1/cart/items').set('x-cart-id', guest).send({ productId: cafeId, sku: 'C-FIL-250', quantidade: 15 });
    const response = await request(app).post('/api/v1/cart/items').set('x-cart-id', guest).send({ productId: cafeId, sku: 'C-FIL-250', quantidade: 15 });
    expect(response.body.data.count).toBe(20);
  });
});

describe('união do carrinho no login (RF004)', () => {
  it('soma o carrinho do visitante ao da conta ao entrar', async () => {
    const senha = 'senha-forte-123';
    const email = 'merge@teste.com';
    await request(app).post('/api/v1/auth/register').send({ nome: 'Merge', email, senha, consentimentoLgpd: true });
    const login = await request(app).post('/api/v1/auth/login').send({ email, senha });
    const token = login.body.data.token as string;

    const guest = 'visitante-eeee-5555';
    await request(app).post('/api/v1/cart/items').set('x-cart-id', guest).send({ productId: cafeId, sku: 'C-FIL-250', quantidade: 1 });

    const merged = await request(app)
      .post('/api/v1/cart/merge')
      .set('Authorization', `Bearer ${token}`)
      .set('x-cart-id', guest);

    expect(merged.status).toBe(200);
    expect(merged.body.data.count).toBe(1);
    const guestAfter = await CartModel.findOne({ ownerKey: `guest:${guest}` });
    expect(guestAfter).toBeNull();
  });

  it('o TTL de 24 h está configurado no banco (RNF003)', async () => {
    const indexes = await CartModel.collection.indexes();
    const ttl = indexes.find((index) => index.key && 'expiresAt' in index.key);
    expect(ttl?.expireAfterSeconds).toBe(0);
  });

  it('produto esgotado aparece como indisponível no carrinho', async () => {
    const response = await request(app)
      .post('/api/v1/cart/items')
      .set('x-cart-id', 'visitante-ffff-6666')
      .send({ productId: acessorioId, sku: 'C-COADOR', quantidade: 1 });
    expect(response.body.data.items[0].disponivel).toBe(false);
  });
});
