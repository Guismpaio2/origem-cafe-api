import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { getProductController, listProductsController } from '../controllers/product.controller.js';
import { createReviewController, listReviewsController } from '../controllers/subscription-review.controller.js';

export const productRouter = Router();

// Rotas só associam URL + método a controllers (AGENTS.md, seção 4).
productRouter.get('/', listProductsController);
productRouter.get('/:id', getProductController);
productRouter.get('/:id/reviews', listReviewsController);
productRouter.post('/:id/reviews', authenticate, createReviewController);
