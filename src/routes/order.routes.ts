import { Router } from 'express';
import {
  createOrderController,
  getOrderController,
  listOrdersController,
  pickupAvailabilityController,
  shippingQuoteController,
} from '../controllers/order.controller.js';
import { authenticate } from '../middlewares/authenticate.js';

// Pedidos exigem login (RU003: o login é pedido só na hora de finalizar).
export const orderRouter = Router();
orderRouter.post('/', authenticate, createOrderController);
orderRouter.get('/', authenticate, listOrdersController);
orderRouter.get('/:id', authenticate, getOrderController);

// Entrega e retirada são públicas: o visitante pode simular o frete e ver os horários.
export const shippingRouter = Router();
shippingRouter.post('/quote', shippingQuoteController);

export const pickupRouter = Router();
pickupRouter.get('/availability', pickupAvailabilityController);
