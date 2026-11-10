import type { Types } from 'mongoose';
import { AppError } from '../errors/app-error.js';
import { ProductModel } from '../models/product.model.js';
import type { ListProductsQuery } from '../validators/product.validator.js';

// Formato do documento depois do .lean(): o Mongoose devolve objetos simples.
interface ProductRecord {
  _id: Types.ObjectId;
  nome: string;
  tipo: 'cafe' | 'acessorio';
  descricao: string;
  origem: string;
  notasSensoriais: string[];
  imagens: string[];
  variants: { sku: string; moagem?: string; pesoGramas?: number; precoCentavos: number; estoque: number }[];
  ratingMedia: number;
  ratingTotal: number;
}

// Contrato público: _id vira id (string) e o estoque exato não precisa ir para o cliente final.
export function toProductDto(product: ProductRecord) {
  return {
    id: product._id.toString(),
    nome: product.nome,
    tipo: product.tipo,
    descricao: product.descricao,
    origem: product.origem,
    notasSensoriais: product.notasSensoriais,
    imagens: product.imagens,
    variants: product.variants.map((variant) => ({
      sku: variant.sku,
      moagem: variant.moagem ?? null,
      pesoGramas: variant.pesoGramas ?? null,
      precoCentavos: variant.precoCentavos,
      disponivel: variant.estoque > 0,
    })),
    ratingMedia: product.ratingMedia,
    ratingTotal: product.ratingTotal,
  };
}

export async function listProducts(query: ListProductsQuery) {
  // Só produtos ativos aparecem no catálogo público.
  const filter: { ativo: true; tipo?: 'cafe' | 'acessorio' } = { ativo: true };
  if (query.tipo) filter.tipo = query.tipo;

  const [products, total] = await Promise.all([
    ProductModel.find(filter)
      .sort({ nome: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<ProductRecord[]>(),
    ProductModel.countDocuments(filter),
  ]);

  return {
    data: products.map(toProductDto),
    meta: { page: query.page, limit: query.limit, total },
  };
}

export async function getProductById(id: string) {
  const product = await ProductModel.findOne({ _id: id, ativo: true }).lean<ProductRecord>();

  if (!product) {
    throw new AppError(404, 'NOT_FOUND', 'Produto não encontrado.');
  }

  return toProductDto(product);
}
