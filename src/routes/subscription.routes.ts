import { Router } from 'express';
import {
  createSubscriptionController,
  listSubscriptionsController,
  subscriptionActionController,
} from '../controllers/subscription-review.controller.js';
import { authenticate } from '../middlewares/authenticate.js';

export const subscriptionRouter = Router();
subscriptionRouter.use(authenticate);
subscriptionRouter.post('/', createSubscriptionController);
subscriptionRouter.get('/me', listSubscriptionsController);
subscriptionRouter.patch('/:id', subscriptionActionController);
