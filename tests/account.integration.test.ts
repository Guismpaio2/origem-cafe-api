import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let mongod: MongoMemoryServer;
let app: typeof import('../src/app.js').app;
let disconnect: () => Promise<void>;
let OrderModel: typeof import('../src/models/order.model.js').OrderModel;
let UserModel: typeof import('../src/models/user.model.js').UserModel;

const senha = 'senha-forte-123';
const endereco = { cep: '37500-000', logradouro: 'Rua Teste', numero: '10', complemento: '', bairro: 'Centro', cidade: 'Itajubá', uf: 'MG' };

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.PORT = '4997';
  const appModule = await import('../src/app.js');
  const dbModule = await import('../src/config/database.js');
  app = appModule.app;
  disconnect = dbModule.disconnectDatabase;
  OrderModel = (await import('../src/models/order.model.js')).OrderModel;
  UserModel = (await import('../src/models/user.model.js')).UserModel;
  await dbModule.connectDatabase();

  // ViaCEP simulado: nenhuma chamada à internet nos testes.
  vi.stubGlobal('fetch', async (url: string) => {
    if (url.includes('37500000')) {
      return new Response(JSON.stringify({ logradouro: 'Rua Teste', bairro: 'Centro', localidade: 'Itajubá', uf: 'mg' }), { status: 200 });
    }
    return new Response(JSON.stringify({ erro: true }), { status: 200 });
  });
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await disconnect();
  await mongod.stop();
});

async function registrar(email: string) {
  const response = await request(app).post('/api/v1/auth/register').send({ nome: 'Conta Teste', email, senha, consentimentoLgpd: true });
  return { token: response.body.data.token as string, id: response.body.data.user.id as string };
}

describe('busca de CEP (RF009)', () => {
  it('preenche o endereço pelo ViaCEP', async () => {
    const response = await request(app).get('/api/v1/shipping/cep/37500-000');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ cep: '37500-000', logradouro: 'Rua Teste', bairro: 'Centro', cidade: 'Itajubá', uf: 'MG' });
  });

  it('CEP inexistente responde 404', async () => {
    const response = await request(app).get('/api/v1/shipping/cep/00000000');
    expect(response.status).toBe(404);
  });

  it('CEP com formato inválido responde 400', async () => {
    const response = await request(app).get('/api/v1/shipping/cep/123');
    expect(response.status).toBe(400);
  });
});

describe('perfil e endereços (RU007, RF005)', () => {
  it('atualiza o nome da conta', async () => {
    const { token } = await registrar('perfil@teste.com');
    const response = await request(app).patch('/api/v1/users/me').set('Authorization', `Bearer ${token}`).send({ nome: 'Maria Atualizada' });
    expect(response.status).toBe(200);
    expect(response.body.data.nome).toBe('Maria Atualizada');
  });

  it('guarda até 5 endereços e remove um', async () => {
    const { token } = await registrar('enderecos@teste.com');
    let last: { body: { data: { addresses: { id: string }[] } } } | undefined;
    for (let i = 0; i < 5; i += 1) {
      last = await request(app).post('/api/v1/users/me/addresses').set('Authorization', `Bearer ${token}`).send(endereco);
    }
    expect(last!.body.data.addresses).toHaveLength(5);

    const sexto = await request(app).post('/api/v1/users/me/addresses').set('Authorization', `Bearer ${token}`).send(endereco);
    expect(sexto.status).toBe(422);

    const removed = await request(app)
      .delete(`/api/v1/users/me/addresses/${last!.body.data.addresses[0].id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(removed.body.data.addresses).toHaveLength(4);
  });

  it('exige login para mexer no perfil', async () => {
    const response = await request(app).patch('/api/v1/users/me').send({ nome: 'Sem login' });
    expect(response.status).toBe(401);
  });
});

describe('exclusão de conta com anonimização (RE001, RN009)', () => {
  it('exige a confirmação digitada', async () => {
    const { token } = await registrar('semconfirmacao@teste.com');
    const response = await request(app).delete('/api/v1/users/me').set('Authorization', `Bearer ${token}`).send({});
    expect(response.status).toBe(400);
  });

  it('anonimiza os dados, bloqueia o login e mantém os pedidos sem identificação', async () => {
    const email = 'excluir@teste.com';
    const { token, id } = await registrar(email);
    await OrderModel.create({
      userId: id,
      items: [{ productId: id, nome: 'Item histórico', sku: 'HIST', precoCentavos: 1000, quantidade: 1 }],
      subtotalCentavos: 1000,
      freteCentavos: 0,
      totalCentavos: 1000,
      tipoEntrega: 'retirada',
      status: 'Retirado',
      statusHistory: [{ status: 'Retirado', em: new Date(), motivo: null }],
      payment: { metodo: 'pix', status: 'aprovado' },
    });

    const removed = await request(app).delete('/api/v1/users/me').set('Authorization', `Bearer ${token}`).send({ confirmacao: 'EXCLUIR' });
    expect(removed.status).toBe(204);

    const user = await UserModel.findById(id).select('+passwordHash');
    expect(user?.nome).toBe('Conta excluída');
    expect(user?.email).not.toBe(email);
    expect(user?.deletedAt).toBeInstanceOf(Date);

    const login = await request(app).post('/api/v1/auth/login').send({ email, senha });
    expect(login.status).toBe(401);

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(401);

    expect(await OrderModel.countDocuments({ userId: id })).toBe(1);
  });
});
