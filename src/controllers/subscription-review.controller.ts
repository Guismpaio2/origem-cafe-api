import type { Request, Response } from 'express';
import { applySubscriptionAction, createSubscription, listMySubscriptions } from '../services/subscription.service.js';
import { createReview, listReviews } from '../services/review.service.js';
import {
  createReviewBody,
  createSubscriptionBody,
  productIdParams,
  subscriptionActionBody,
  subscriptionIdParams,
} from '../validators/subscription-review.validator.js';

function currentUserId(response: Response): string {
  return (response.locals.auth as { userId: string }).userId;
}

export async function createSubscriptionController(request: Request, response: Response) {
  const body = createSubscriptionBody.parse(request.body);
  response.status(201).json({ data: await createSubscription(currentUserId(response), body.productId, body.sku) });
}

export async function listSubscriptionsController(_request: Request, response: Response) {
  response.json({ data: await listMySubscriptions(currentUserId(response)) });
}

export async function subscriptionActionController(request: Request, response: Response) {
  const { id } = subscriptionIdParams.parse(request.params);
  const { acao } = subscriptionActionBody.parse(request.body);
  response.json({ data: await applySubscriptionAction(currentUserId(response), id, acao) });
}

export async function createReviewController(request: Request, response: Response) {
  const { id } = productIdParams.parse(request.params);
  const body = createReviewBody.parse(request.body);
  response.status(201).json({ data: await createReview(currentUserId(response), id, body.nota, body.comentario) });
}

export async function listReviewsController(request: Request, response: Response) {
  const { id } = productIdParams.parse(request.params);
  response.json({ data: await listReviews(id) });
}
