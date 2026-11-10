import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { cartRouter } from './cart.routes.js';
import { orderRouter, pickupRouter, shippingRouter } from './order.routes.js';
import { productRouter } from './product.routes.js';

// Prefixo fixo /api/v1 é aplicado em app.ts.
export const apiRouter = Router();

apiRouter.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'origem-cafe-api' });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/products', productRouter);
apiRouter.use('/cart', cartRouter);
apiRouter.use('/orders', orderRouter);
apiRouter.use('/shipping', shippingRouter);
apiRouter.use('/pickup', pickupRouter);
