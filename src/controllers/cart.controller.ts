import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { addToCart, guestKey, mergeGuestIntoUser, removeFromCart, setCartQuantity, userKey, viewCart } from '../services/cart.service.js';
import { addCartItemBody, cartItemParams, guestIdHeader, updateCartItemBody } from '../validators/cart.validator.js';

// Quem é dono do carrinho: o cliente logado, ou o visitante pelo cabeçalho x-cart-id.
function ownerKeyOf(request: Request, response: Response): string {
  const auth = response.locals.auth as { userId: string } | undefined;
  if (auth) return userKey(auth.userId);

  const header = request.headers['x-cart-id'];
  const parsed = guestIdHeader.safeParse(typeof header === 'string' ? header : undefined);
  if (!parsed.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Identificador do carrinho ausente ou inválido.');
  }
  return guestKey(parsed.data);
}

export async function getCartController(request: Request, response: Response) {
  response.json({ data: await viewCart(ownerKeyOf(request, response)) });
}

export async function addCartItemController(request: Request, response: Response) {
  const body = addCartItemBody.parse(request.body);
  const cart = await addToCart(ownerKeyOf(request, response), body.productId, body.sku, body.quantidade);
  response.status(201).json({ data: cart });
}

export async function updateCartItemController(request: Request, response: Response) {
  const { sku } = cartItemParams.parse(request.params);
  const body = updateCartItemBody.parse(request.body);
  response.json({ data: await setCartQuantity(ownerKeyOf(request, response), sku, body.quantidade) });
}

export async function removeCartItemController(request: Request, response: Response) {
  const { sku } = cartItemParams.parse(request.params);
  response.json({ data: await removeFromCart(ownerKeyOf(request, response), sku) });
}

export async function mergeCartController(request: Request, response: Response) {
  const auth = response.locals.auth as { userId: string };
  const header = request.headers['x-cart-id'];
  const parsed = guestIdHeader.safeParse(typeof header === 'string' ? header : undefined);
  if (!parsed.success) {
    // Sem carrinho de visitante, só devolve o carrinho da conta.
    response.json({ data: await viewCart(userKey(auth.userId)) });
    return;
  }
  response.json({ data: await mergeGuestIntoUser(parsed.data, auth.userId) });
}
