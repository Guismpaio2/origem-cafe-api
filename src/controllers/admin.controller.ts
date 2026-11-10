import type { Request, Response } from 'express';
import {
  changeOrderStatus,
  createProduct,
  dashboard,
  deactivateProduct,
  listOrdersAdmin,
  listProductsAdmin,
  updateProduct,
} from '../services/admin.service.js';
import {
  orderIdParams,
  orderListQuery,
  orderStatusBody,
  productBody,
  productIdParams,
  productPatchBody,
} from '../validators/admin.validator.js';

export async function dashboardController(_request: Request, response: Response) {
  response.json({ data: await dashboard() });
}

export async function listProductsController(_request: Request, response: Response) {
  response.json({ data: await listProductsAdmin() });
}

export async function createProductController(request: Request, response: Response) {
  const body = productBody.parse(request.body);
  response.status(201).json({ data: await createProduct(body) });
}

export async function updateProductController(request: Request, response: Response) {
  const { id } = productIdParams.parse(request.params);
  const body = productPatchBody.parse(request.body);
  response.json({ data: await updateProduct(id, body) });
}

export async function deactivateProductController(request: Request, response: Response) {
  const { id } = productIdParams.parse(request.params);
  response.json({ data: await deactivateProduct(id) });
}

export async function listOrdersController(request: Request, response: Response) {
  const { status } = orderListQuery.parse(request.query);
  response.json({ data: await listOrdersAdmin(status) });
}

export async function changeStatusController(request: Request, response: Response) {
  const { id } = orderIdParams.parse(request.params);
  const body = orderStatusBody.parse(request.body);
  response.json({ data: await changeOrderStatus(id, body.status, body.motivo) });
}
