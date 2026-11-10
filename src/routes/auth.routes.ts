import { Router } from 'express';
import { loginController, meController, registerController } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/authenticate.js';

export const authRouter = Router();

authRouter.post('/register', registerController);
authRouter.post('/login', loginController);
authRouter.get('/me', authenticate, meController);
