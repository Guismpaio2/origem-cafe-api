import type { Request, Response } from 'express';
import { getProductById, listProducts } from '../services/product.service.js';
import { listProductsQuery, productIdParams } from '../validators/product.validator.js';

// Controller: lê a requisição, valida com Zod, chama o service e devolve a resposta.
// Nenhuma regra de negócio aqui (AGENTS.md, seção 4).
export async function listProductsController(request: Request, response: Response) {
  const query = listProductsQuery.parse(request.query);
  const result = await listProducts(query);
  response.json(result);
}

export async function getProductController(request: Request, response: Response) {
  const { id } = productIdParams.parse(request.params);
  const product = await getProductById(id);
  response.json({ data: product });
}
