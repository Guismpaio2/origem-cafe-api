import type { Request, Response } from 'express';
import { getCurrentUser, loginUser, registerUser } from '../services/auth.service.js';
import { loginBody, registerBody } from '../validators/auth.validator.js';

export async function registerController(request: Request, response: Response) {
  const body = registerBody.parse(request.body);
  const result = await registerUser(body);
  response.status(201).json({ data: result });
}

export async function loginController(request: Request, response: Response) {
  const body = loginBody.parse(request.body);
  const result = await loginUser(body);
  response.json({ data: result });
}

export async function meController(_request: Request, response: Response) {
  const { userId } = response.locals.auth as { userId: string };
  const user = await getCurrentUser(userId);
  response.json({ data: user });
}
