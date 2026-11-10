import type { Request, Response } from 'express';
import { createOrder, getOrderForUser, listOrdersForUser, quoteShipping } from '../services/order.service.js';
import { slotsFor } from '../services/pickup.rules.js';
import { createOrderBody, orderIdParams, pickupAvailabilityQuery, shippingQuoteBody } from '../validators/order.validator.js';

function currentUserId(response: Response): string {
  return (response.locals.auth as { userId: string }).userId;
}

export async function createOrderController(request: Request, response: Response) {
  const body = createOrderBody.parse(request.body);
  const order = await createOrder(currentUserId(response), body);
  response.status(201).json({ data: order });
}

export async function listOrdersController(_request: Request, response: Response) {
  const orders = await listOrdersForUser(currentUserId(response));
  response.json({ data: orders });
}

export async function getOrderController(request: Request, response: Response) {
  const { id } = orderIdParams.parse(request.params);
  const order = await getOrderForUser(currentUserId(response), id);
  response.json({ data: order });
}

export async function shippingQuoteController(request: Request, response: Response) {
  const body = shippingQuoteBody.parse(request.body);
  const quote = await quoteShipping(body);
  response.json({ data: quote });
}

export async function pickupAvailabilityController(request: Request, response: Response) {
  const { date } = pickupAvailabilityQuery.parse(request.query);
  response.json({ data: { date, slots: slotsFor(date, new Date()) } });
}
