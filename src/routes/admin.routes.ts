import { Router } from 'express';
import {
  changeStatusController,
  createProductController,
  dashboardController,
  deactivateProductController,
  listOrdersController,
  listProductsController,
  updateProductController,
} from '../controllers/admin.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { requireRole } from '../middlewares/require-role.js';

// Todas as rotas /admin exigem login e papel de administrador (RNF007).
export const adminRouter = Router();
adminRouter.use(authenticate, requireRole('admin'));
adminRouter.get('/dashboard', dashboardController);
adminRouter.get('/products', listProductsController);
adminRouter.post('/products', createProductController);
adminRouter.patch('/products/:id', updateProductController);
adminRouter.delete('/products/:id', deactivateProductController);
adminRouter.get('/orders', listOrdersController);
adminRouter.patch('/orders/:id/status', changeStatusController);
