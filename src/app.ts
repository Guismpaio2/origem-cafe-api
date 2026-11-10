import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middlewares/error-handler.js';
import { apiRouter } from './routes/index.js';

// Monta o Express sem chamar listen (quem sobe a porta é o server.ts).
export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/v1', apiRouter);

// O errorHandler precisa ser o último middleware.
app.use(errorHandler);
