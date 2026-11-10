# Origem Café — API (back-end)

API REST do e-commerce da **Origem Café**, projeto final da disciplina ECOT11A — Laboratório de Engenharia de Software I (UNIFEI, Prof. Edvard).

- **Autor:** Guilherme Carneiro Sampaio — matrícula 2024003567
- **Front-end:** [`origem-cafe-front`](https://github.com/Guismpaio2/origem-cafe-front)
- **Branch de desenvolvimento:** `developer`

## Sobre o projeto

A API cuida das regras de negócio do e-commerce: catálogo, carrinho no servidor (com união no login), checkout com entrega ou retirada agendada, frete, pagamento em ambiente de teste, perfil e endereços, exclusão de conta, assinatura mensal, avaliações de compradores e painel administrativo.

## Tecnologias

Node.js 22+ · TypeScript (strict, ESM) · Express 5 · MongoDB com Mongoose 9 · Zod 4 · JWT · bcrypt · Vitest · Supertest · mongodb-memory-server

## Pré-requisitos

- **Node.js 22 ou superior** e npm
- **MongoDB**: MongoDB Atlas (plano gratuito) ou uma instância local (`mongodb://127.0.0.1:27017`)

## Como executar localmente

```bash
# 1. Instale as dependências
npm install

# 2. Crie o arquivo de variáveis de ambiente a partir do modelo
cp .env.example .env
# edite o .env: MONGODB_URI (sua conexão) e JWT_SECRET (pelo menos 32 caracteres aleatórios)
# para gerar um segredo: openssl rand -hex 32

# 3. Popule o banco com dados de teste (apaga as coleções users e products antes)
npm run seed

# 4. Suba a API com recarregamento automático
npm run dev
```

Teste se a API está no ar:

```bash
curl http://localhost:3000/api/v1/health
# {"status":"ok","service":"origem-cafe-api"}
curl "http://localhost:3000/api/v1/products?limit=2"
```

Para usar a API no Atlas, libere o IP de origem em **Security → Network Access**. Sem isso, a conexão é recusada.

## Dados de teste (seed)

O seed cria 8 produtos (6 cafés com moagem e peso em cada variante e 2 acessórios; uma variante do Caparaó está sem estoque) e dois usuários de teste. **As senhas abaixo são só para desenvolvimento.**

| Papel   | E-mail                    | Senha          |
| ------- | ------------------------- | -------------- |
| Admin   | `admin@origemcafe.test`   | `Admin#2026`   |
| Cliente | `cliente@origemcafe.test` | `Cliente#2026` |

## Comandos

| Comando                   | O que faz                                                    |
| ------------------------- | ------------------------------------------------------------ |
| `npm run dev`             | Sobe a API em modo de desenvolvimento (porta 3000)           |
| `npm run seed`            | Popula o banco com dados de teste                            |
| `npm test`                | Roda a suíte automatizada (Vitest, 68 testes)                |
| `npm run test:coverage`   | Mede a cobertura das regras dos services (meta: 70%)         |
| `npm run typecheck`       | Verifica os tipos sem gerar arquivos                         |
| `npm run build`           | Compila o TypeScript para `dist/`                            |
| `npm start`               | Executa a versão compilada (exige `npm run build` antes)     |

Os testes de integração usam um MongoDB em memória: não precisam do Atlas nem de conexão.

## Endpoints

Prefixo `/api/v1`. Erros seguem `{ "error": { "code", "message", "details" } }`. Valores monetários são inteiros em centavos.

| Área         | Rotas                                                                                  | Acesso        |
| ------------ | -------------------------------------------------------------------------------------- | ------------- |
| Saúde        | `GET /health`                                                                          | público       |
| Autenticação | `POST /auth/register` · `POST /auth/login` · `GET /auth/me`                            | público / login |
| Catálogo     | `GET /products` · `GET /products/:id`                                                  | público       |
| Avaliações   | `GET /products/:id/reviews` · `POST /products/:id/reviews`                             | público / comprador |
| Carrinho     | `GET /cart` · `POST /cart/items` · `PATCH /cart/items/:sku` · `DELETE /cart/items/:sku` · `POST /cart/merge` | visitante (`x-cart-id`) ou login |
| Frete e retirada | `POST /shipping/quote` · `GET /shipping/cep/:cep` · `GET /pickup/availability?date=` | público |
| Pedidos      | `POST /orders` · `GET /orders` · `GET /orders/:id`                                     | login         |
| Conta        | `PATCH /users/me` · `DELETE /users/me` · `POST /users/me/addresses` · `DELETE /users/me/addresses/:id` | login |
| Assinatura   | `POST /subscriptions` · `GET /subscriptions/me` · `PATCH /subscriptions/:id`           | login         |
| Administração | `GET /admin/dashboard` · `GET/POST /admin/products` · `PATCH/DELETE /admin/products/:id` · `GET /admin/orders` · `PATCH /admin/orders/:id/status` | administrador |

## Regras de negócio implementadas

| Regra | Onde está |
| ----- | --------- |
| RN001 avaliação só para quem recebeu o produto, uma por produto | `services/review.service.ts` |
| RN002 café exige moagem e peso | carrinho, checkout, assinatura e cadastro de produto |
| RN003 retirada seg a sáb, 08h–18h, slots de 30 min, 2 h de antecedência | `services/pickup.rules.ts` |
| RN004 uma assinatura ativa; cancelamento no próximo ciclo | `services/subscription.service.ts` |
| RN005 carrinho não reserva; checkout valida e baixa com pagamento aprovado | `services/order.service.ts` |
| RN006 frete R$ 15,00, grátis a partir de R$ 200,00; retirada sem frete | `services/shipping.rules.ts` |
| RN007 transições de status pela máquina de estados | `services/admin.service.ts` |
| RN008 cancelamento até Em Preparação; depois, justificativa do admin | `services/admin.service.ts` |
| RN009 exclusão anonimiza e preserva pedidos | `services/account.service.ts` |

## Estrutura de pastas

```
src/
  app.ts          configuração do Express (sem subir o servidor)
  server.ts       conecta ao banco e sobe a porta
  config/         variáveis de ambiente validadas e conexão com o MongoDB
  routes/         definição das URLs
  controllers/    recebe a requisição e devolve a resposta
  services/       regras de negócio
  models/         schemas do Mongoose
  validators/     schemas Zod das entradas
  middlewares/    autenticação, papel de administrador e tratamento de erros
  errors/         erros de aplicação com código HTTP
  seed/           dados de desenvolvimento
tests/            testes de regras e de integração
```

Diretrizes de desenvolvimento estão em [`AGENTS.md`](./AGENTS.md).

## Segurança

- Segredos apenas no `.env`, que não vai para o Git.
- Senhas em bcrypt com custo 12; o hash nunca sai na resposta.
- JWT de 15 minutos; login com mensagem genérica.
- Rotas administrativas respondem 403 para clientes.
- Pagamento em ambiente de teste (simulado): nenhum dado de cartão é recebido ou guardado.
