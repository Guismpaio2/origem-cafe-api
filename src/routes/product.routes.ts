import { Router } from 'express';
import { getProductController, listProductsController } from '../controllers/product.controller.js';

export const productRouter = Router();

// Rotas só associam URL + método a controllers (AGENTS.md, seção 4).
productRouter.get('/', listProductsController);
productRouter.get('/:id', getProductController);
