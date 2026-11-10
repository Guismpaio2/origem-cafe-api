# Origem Café — API (Back-end)

API REST do e-commerce da **Origem Café**, desenvolvida como projeto final da disciplina ECOT11A — Laboratório de Engenharia de Software I (UNIFEI, Prof. Edvard).

- **Autor:** Guilherme Carneiro Sampaio — matrícula 2024003567
- **Repositório do front-end:** `origem-cafe-front`

## Sobre o projeto

A API cuida das regras de negócio do e-commerce: catálogo, carrinho, checkout com agendamento de retirada, assinaturas, avaliações restritas a compradores, integração com gateway de pagamento e painel administrativo.

## Tecnologias

Node.js · TypeScript · Express 5 · MongoDB com Mongoose · Zod · JWT · bcrypt

## Pré-requisitos

- **Node.js 22 ou superior** (LTS) e npm
- **MongoDB**: uma das opções abaixo
  - MongoDB Atlas (nuvem, plano gratuito M0), ou
  - MongoDB Community Server instalado localmente (`mongodb://127.0.0.1:27017`)

## Como executar localmente

```bash
# 1. Instale as dependências
npm install

# 2. Crie o arquivo de variáveis de ambiente a partir do modelo
cp .env.example .env
# edite o .env com a sua MONGODB_URI e um JWT_SECRET longo e aleatório

# 3. Suba o servidor com recarregamento automático
npm run dev
```

Teste se a API está no ar:

```bash
curl http://localhost:3000/api/v1/health
# {"status":"ok","service":"origem-cafe-api"}
```

Outros comandos:

| Comando             | O que faz                                    |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Servidor em modo de desenvolvimento          |
| `npm run seed`      | Popula o banco com produtos e usuários de teste (apaga `users` e `products` antes) |
| `npm run build`     | Compila TypeScript para `dist/`              |
| `npm start`         | Executa a versão compilada (`dist/server.js`) |
| `npm run typecheck` | Verifica tipos sem gerar arquivos            |

## Dados de teste (seed)

Depois de conectar o banco, rode `npm run seed`. Ele cria:

- 8 produtos: 6 cafés (cada um com moagem "Grão inteiro" ou "Moído para filtro" e peso de 250 g ou 500 g) e 2 acessórios. Uma variante do Caparaó está sem estoque, para testar o estado "esgotado".
- 2 usuários de teste, **somente para desenvolvimento**:

| Papel   | E-mail                       | Senha          |
| ------- | ---------------------------- | -------------- |
| Admin   | `admin@origemcafe.test`      | `Admin#2026`   |
| Cliente | `cliente@origemcafe.test`    | `Cliente#2026` |

## Endpoints disponíveis

Prefixo `/api/v1`. Erros seguem `{ "error": { "code", "message", "details" } }`.

| Método | Rota                     | Acesso    | Descrição                                   |
| ------ | ------------------------ | --------- | ------------------------------------------- |
| GET    | `/health`                | público   | Verifica se a API está no ar                |
| GET    | `/products`              | público   | Lista produtos (`?tipo=cafe`, `?page=1&limit=20`) |
| GET    | `/products/:id`          | público   | Detalhe de um produto com variantes         |
| POST   | `/auth/register`         | público   | Cadastro; exige `consentimentoLgpd: true`   |
| POST   | `/auth/login`            | público   | Login; devolve um JWT de 15 min             |
| GET    | `/auth/me`               | autenticado | Dados do usuário logado (`Authorization: Bearer <token>`) |

## Variáveis de ambiente

Veja `.env.example`. Nunca faça commit do arquivo `.env`.

## Estrutura de pastas

```
src/
  app.ts          configuração do Express (sem subir o servidor)
  server.ts       sobe o servidor HTTP
  config/         leitura e validação do ambiente e conexão com o MongoDB
  routes/         definição das URLs
  controllers/    recebe a requisição e devolve a resposta
  services/       regras de negócio
  models/         schemas do Mongoose
  validators/     schemas Zod das entradas
  middlewares/    autenticação JWT, papel de administrador, tratamento de erros
  errors/         erros de aplicação com código HTTP
```

Diretrizes detalhadas para desenvolvimento estão em [`AGENTS.md`](./AGENTS.md).
