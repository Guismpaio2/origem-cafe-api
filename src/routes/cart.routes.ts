import { Router } from 'express';
import {
  addCartItemController,
  getCartController,
  mergeCartController,
  removeCartItemController,
  updateCartItemController,
} from '../controllers/cart.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { optionalAuth } from '../middlewares/optional-auth.js';

export const cartRouter = Router();
// Visitante usa x-cart-id; cliente logado usa o token. Os dois funcionam nas mesmas rotas.
cartRouter.get('/', optionalAuth, getCartController);
cartRouter.post('/items', optionalAuth, addCartItemController);
cartRouter.patch('/items/:sku', optionalAuth, updateCartItemController);
cartRouter.delete('/items/:sku', optionalAuth, removeCartItemController);
cartRouter.post('/merge', authenticate, mergeCartController);
