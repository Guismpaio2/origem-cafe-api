# AGENTS.md — origem-cafe-api (back-end)

Instruções para qualquer agente de IA que trabalhe neste repositório. Leia antes de alterar código.

## 1. Contexto

- Projeto final da disciplina ECOT11A (UNIFEI). API do e-commerce da **Origem Café**.
- O autor é o Guilherme Carneiro Sampaio (matrícula 2024003567). O autor conhece Angular e está aprendendo React. Na API, a base é mais sólida, mas explique decisões de arquitetura quando forem novas para o autor.
- Repositório irmão do front: `../origem-cafe-front`. Os endpoints aqui são o contrato que o front consome.
- Fonte de verdade dos requisitos: `../../lab05_2024003567_ecot11a.pdf` (seções 4 a 6) e o agente `especialista-ecommerce-cafe` em `.claude/agents/` na raiz do curso.

## 2. Stack (não trocar sem alinhar com o autor)

| Item          | Escolha                                              |
| ------------- | ---------------------------------------------------- |
| Runtime       | Node.js 22+ (LTS)                                    |
| Linguagem     | TypeScript em `strict`, módulos ESM (`"type": "module"`) |
| HTTP          | Express 5                                            |
| Banco         | MongoDB com Mongoose 9                               |
| Validação     | Zod 4 (entrada de todas as rotas)                    |
| Autenticação  | JWT (`jsonwebtoken`) + senha com `bcryptjs`          |
| Segurança HTTP | `helmet`, `cors`                                    |
| Testes        | Vitest + Supertest + mongodb-memory-server (a instalar no passo de testes) |

Imports relativos precisam da extensão `.js` (ex.: `import { app } from './app.js'`), exigência do `NodeNext`.

## 3. Comandos

```bash
npm install          # dependências
npm run dev          # tsx watch em src/server.ts
npm run typecheck    # tsc --noEmit (deve passar antes de entregar)
npm run build        # gera dist/
npm start            # executa dist/server.js
```

## 4. Arquitetura em camadas (regra obrigatória)

```
routes/  ->  controllers/  ->  services/  ->  models/ (Mongoose)
   |              |                 |
middlewares/   validators/       errors/
```

- **routes**: só associam URL + método a middlewares e controllers.
- **controllers**: leem `request`, chamam um service e devolvem `response`. Sem regra de negócio.
- **services**: concentram as regras de negócio (RN001 a RN009). Não recebem `request` nem `response`.
- **models**: schemas e índices do Mongoose.
- **validators**: schemas Zod. Toda entrada passa por validação antes de chegar ao controller.
- **middlewares**: `authenticate` (JWT), `requireRole('admin')`, `errorHandler` (último da cadeia).
- **errors**: `AppError(statusCode, code, message)`. Services lançam `AppError`; o `errorHandler` converte em resposta.
- `app.ts` monta o Express sem chamar `listen`. `server.ts` é o único que sobe a porta.

## 5. Convenções de API

- Prefixo fixo: `/api/v1`.
- JSON em `camelCase`. IDs são `ObjectId` do Mongo, serializados como string.
- Datas em ISO 8601 UTC (ex.: `2026-11-03T11:00:00.000Z`).
- **Dinheiro em centavos** (inteiro). Ex.: `precoCentavos: 4990` = R$ 49,90. Nunca use `number` com casas decimais para valores monetários.
- Formato de erro, sempre:
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "Mensagem em português", "details": [] } }
  ```
- Códigos HTTP: 200/201 sucesso; 400 validação; 401 não autenticado; 403 sem permissão; 404 não encontrado; 409 conflito (ex.: avaliação duplicada); 422 regra de negócio violada.
- Paginação em listagens: `?page=1&limit=20`, resposta com `{ data, meta: { page, limit, total } }`.

### Endpoints previstos (contrato inicial)

| Método | Rota                                  | Acesso        | Requisito        |
| ------ | ------------------------------------- | ------------- | ---------------- |
| GET    | `/health`                             | público       | infra            |
| POST   | `/auth/register`                      | público       | RF005, RE001     |
| POST   | `/auth/login`                         | público       | RF005, RNF002    |
| GET    | `/auth/me`                            | cliente/admin | RF005            |
| PATCH  | `/users/me`                           | cliente       | RF005            |
| DELETE | `/users/me`                           | cliente       | RF010, RE001     |
| GET    | `/products`                           | público       | RF003            |
| GET    | `/products/:id`                       | público       | RF003            |
| GET    | `/cart`                               | público (guest ou user) | RF004      |
| POST   | `/cart/items`                         | público       | RF004, RN002     |
| PATCH  | `/cart/items/:itemId`                 | público       | RF004            |
| DELETE | `/cart/items/:itemId`                 | público       | RF004            |
| POST   | `/cart/merge`                         | cliente       | RF004            |
| GET    | `/shipping/cep/:cep`                  | público       | RF009            |
| POST   | `/shipping/quote`                     | público       | RF009, RN006     |
| GET    | `/pickup/availability?date=YYYY-MM-DD` | público      | RF001, RN003     |
| POST   | `/orders`                             | cliente       | RF001, RF008     |
| GET    | `/orders`                             | cliente       | RF001            |
| GET    | `/orders/:id`                         | dono do pedido | RF001           |
| POST   | `/payments/webhook`                   | gateway (assinado) | RF008, RE002 |
| POST   | `/subscriptions`                      | cliente       | RF006, RN004     |
| GET    | `/subscriptions/me`                   | cliente       | RF006            |
| PATCH  | `/subscriptions/:id`                  | dono          | RF006, RN004     |
| GET    | `/products/:id/reviews`               | público       | RF002            |
| POST   | `/products/:id/reviews`               | cliente comprador | RF002, RN001 |
| GET    | `/admin/dashboard`                    | admin         | RF007            |
| POST   | `/admin/products`                     | admin         | RF007            |
| PATCH  | `/admin/products/:id`                 | admin         | RF007            |
| DELETE | `/admin/products/:id`                 | admin         | RF007            |
| GET    | `/admin/orders`                       | admin         | RF007            |
| PATCH  | `/admin/orders/:id/status`            | admin         | RF007, RN007, RN008 |

Se precisar de um endpoint fora desta lista, adicione aqui também.

## 6. Modelo de dados (MongoDB)

| Coleção         | Campos principais                                                                 | Índices / observações |
| --------------- | --------------------------------------------------------------------------------- | --------------------- |
| `users`         | nome, email, passwordHash, role (`cliente`/`admin`), consentLgpd {aceito, data, versao}, addresses[], deletedAt | `email` único |
| `products`      | nome, tipo (`cafe`/`acessorio`), descricao, origem, notasSensoriais[], imagens[], variants[] {sku, moagem?, pesoGramas?, precoCentavos, estoque}, ativo, ratingMedia, ratingTotal | `tipo`, `ativo` |
| `carts`         | ownerId (user ou guestId), items[] {productId, sku, quantidade, precoCentavos}, expiresAt | **TTL em `expiresAt` (24 h, RNF003)** |
| `orders`        | userId, items[] (snapshot de nome, moagem, peso, preço), subtotalCentavos, freteCentavos, totalCentavos, tipoEntrega (`entrega`/`retirada`), endereco (snapshot), agendamento {data, horario}, status, statusHistory[], payment {gateway, referencia, status} | `userId`, `status` |
| `subscriptions` | userId, productId, moagem, pesoGramas, status (`ativa`/`pausada`/`cancelada`), proximaCobranca | `userId` |
| `reviews`       | userId, productId, orderId, nota (1 a 5), comentario | **índice único {userId, productId}** (RN001) |

Regras de modelagem:
- Snapshot: `orders.items` copia nome e preço do momento da compra. Alterar o produto depois não muda pedidos antigos.
- Endereço de entrega também é snapshot dentro do pedido.
- Exclusão de conta (RE001) = anonimização: remove dados pessoais de `users`, mantém pedidos com `userId` anonimizado por obrigação fiscal.

## 7. Regras de negócio (resumo; fonte completa no PDF do lab05, seção 5)

- **RN001** — avaliação só para pedido com status `Entregue` ou `Retirado`, do próprio cliente. Uma avaliação por usuário por produto.
- **RN002** — café exige moagem e peso ao entrar no carrinho.
- **RN003** — retirada: seg a sáb, 08h às 18h, com antecedência mínima de 2 h e slots de 30 min.
- **RN004** — assinatura: no máximo 1 ativa por cliente; cancelamento a qualquer momento, com efeito no próximo ciclo.
- **RN005** — estoque: adicionar ao carrinho não reserva; checkout valida estoque; a baixa acontece quando o pagamento é aprovado.
- **RN006** — frete: entrega custa frete fixo parametrizável (padrão R$ 15,00); frete grátis a partir de R$ 200,00 em produtos. Retirada não tem frete.
- **RN007** — transições válidas de status: `Criado → Pago → Em Preparação → (Pronto para Retirada | Em Entrega) → (Retirado | Entregue)`; `Criado → Cancelado` e `Pago → Cancelado` (falha/recusa, ou cancelamento permitido).
- **RN008** — cancelamento pelo cliente ou admin só até `Em Preparação`; depois disso, só o admin pode cancelar, com justificativa.
- **RN009** — anonimização na exclusão de conta preserva pedidos e avaliações sem dados pessoais.

Qualquer violação de regra retorna `422` com código `BUSINESS_RULE_VIOLATION`.

## 8. Requisitos não funcionais que afetam a API

- **RNF001 (desempenho)** — checkout e agendamento respondem em até 1,5 s para 99% das requisições.
- **RNF002 (segurança)** — TLS 1.3 em produção; token JWT expira após 15 min de inatividade; senha com bcrypt custo mínimo 12; nunca retornar `passwordHash`.
- **RNF003 (disponibilidade)** — carrinho e rascunho de checkout persistidos por 24 h (TTL).
- **RNF007 (autorização)** — rotas `/admin/*` retornam 403 para cliente; isso precisa de teste automatizado.
- **RNF009 (manutenibilidade)** — testes cobrindo pelo menos 70% das regras de negócio dos services.
- **RNF011 (privacidade)** — nenhum log contém senha, token ou dado de cartão. Cartão nunca passa pela API (RE002).
- **RNF010** — o front reenvia avaliações pendentes; a API precisa aceitar reenvio idempotente (usar `Idempotency-Key` ou índice único).

## 9. Segurança (obrigatório)

- Nunca commitar `.env`. Segredos apenas em variáveis de ambiente.
- Validar **todas** as entradas com Zod, inclusive `params` e `query`.
- Webhook de pagamento: validar assinatura do gateway antes de processar.
- Não confiar no front para regras (ex.: RN001 é validada no service, não só na tela).
- Erros 500 não devem vazar stack trace para o cliente; logar no servidor.

## 10. Git

- Não faça commit nem push sem o autor pedir.
- Mensagens em **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `test:`), descrição em português.

## 11. Estado atual

- Projeto criado (TypeScript + Express + Mongoose instalados).
- `GET /api/v1/health` respondendo.
- Ainda não há conexão com MongoDB nem modelos. Próximos passos guiados: `config/env.ts` (validação com Zod), conexão com o banco, `models/User`, rota de cadastro/login.
