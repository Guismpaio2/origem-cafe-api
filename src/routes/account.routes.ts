import { Router } from 'express';
import {
  addAddressController,
  deleteAccountController,
  removeAddressController,
  updateProfileController,
} from '../controllers/account.controller.js';
import { authenticate } from '../middlewares/authenticate.js';

export const accountRouter = Router();
accountRouter.use(authenticate);
accountRouter.patch('/me', updateProfileController);
accountRouter.delete('/me', deleteAccountController);
accountRouter.post('/me/addresses', addAddressController);
accountRouter.delete('/me/addresses/:addressId', removeAddressController);
