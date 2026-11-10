import { AppError } from '../errors/app-error.js';
import { CartModel, type CartDocument } from '../models/cart.model.js';
import { ProductModel } from '../models/product.model.js';

const TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_QUANTIDADE = 20;

export function userKey(userId: string): string {
  return `user:${userId}`;
}

export function guestKey(guestId: string): string {
  return `guest:${guestId}`;
}

interface ProductRecord {
  _id: { toString(): string };
  nome: string;
  tipo: 'cafe' | 'acessorio';
  ativo: boolean;
  variants: { sku: string; moagem?: string; pesoGramas?: number; precoCentavos: number; estoque: number }[];
}

async function findCartOrEmpty(key: string): Promise<CartDocument | null> {
  return CartModel.findOne({ ownerKey: key });
}

async function ensureCart(key: string): Promise<CartDocument> {
  const cart = await CartModel.findOneAndUpdate(
    { ownerKey: key },
    { $setOnInsert: { ownerKey: key, items: [] }, $set: { expiresAt: new Date(Date.now() + TTL_MS) } },
    { upsert: true, new: true },
  );
  return cart;
}

async function touch(cart: CartDocument): Promise<void> {
  cart.set('expiresAt', new Date(Date.now() + TTL_MS));
  await cart.save();
}

// Visão do carrinho com preços e disponibilidade atuais. O preço nunca vem do cliente.
export async function viewCart(key: string) {
  const cart = await findCartOrEmpty(key);
  const rawItems = cart?.items ?? [];
  if (rawItems.length === 0) return { items: [], count: 0, subtotalCentavos: 0 };

  const ids = [...new Set(rawItems.map((item) => item.productId.toString()))];
  const products = await ProductModel.find({ _id: { $in: ids } }).lean<ProductRecord[]>();

  const items = rawItems.flatMap((item) => {
    const product = products.find((candidate) => candidate._id.toString() === item.productId.toString());
    const variant = product?.variants.find((candidate) => candidate.sku === item.sku);
    if (!product || !variant || !product.ativo) return [];
    return [
      {
        productId: product._id.toString(),
        nome: product.nome,
        sku: variant.sku,
        moagem: variant.moagem ?? null,
        pesoGramas: variant.pesoGramas ?? null,
        precoCentavos: variant.precoCentavos,
        quantidade: item.quantidade,
        disponivel: variant.estoque > 0,
      },
    ];
  });

  const subtotalCentavos = items.reduce((total, item) => total + item.precoCentavos * item.quantidade, 0);
  const count = items.reduce((total, item) => total + item.quantidade, 0);
  return { items, count, subtotalCentavos };
}

export async function addToCart(key: string, productId: string, sku: string, quantidade: number) {
  const product = await ProductModel.findOne({ _id: productId, ativo: true }).lean<ProductRecord>();
  const variant = product?.variants.find((candidate) => candidate.sku === sku);
  if (!product || !variant) throw new AppError(404, 'NOT_FOUND', 'Produto não encontrado.');
  // RN002: café só entra no carrinho com moagem e peso definidos.
  if (product.tipo === 'cafe' && (!variant.moagem || !variant.pesoGramas)) {
    throw new AppError(422, 'BUSINESS_RULE_VIOLATION', 'Escolha a moagem e o peso antes de adicionar ao carrinho.');
  }

  const cart = await ensureCart(key);
  const existing = cart.items.find((item) => item.sku === sku);
  if (existing) {
    existing.quantidade = Math.min(existing.quantidade + quantidade, MAX_QUANTIDADE);
  } else {
    cart.items.push({ productId: product._id, sku, quantidade: Math.min(quantidade, MAX_QUANTIDADE) });
  }
  await touch(cart);
  return viewCart(key);
}

export async function setCartQuantity(key: string, sku: string, quantidade: number) {
  const cart = await findCartOrEmpty(key);
  const item = cart?.items.find((candidate) => candidate.sku === sku);
  if (!cart || !item) throw new AppError(404, 'NOT_FOUND', 'Item não está no carrinho.');
  item.quantidade = Math.min(Math.max(quantidade, 1), MAX_QUANTIDADE);
  await touch(cart);
  return viewCart(key);
}

export async function removeFromCart(key: string, sku: string) {
  const cart = await findCartOrEmpty(key);
  if (cart) {
    cart.set('items', cart.items.filter((item) => item.sku !== sku));
    await touch(cart);
  }
  return viewCart(key);
}

export async function clearCart(key: string): Promise<void> {
  await CartModel.updateOne({ ownerKey: key }, { $set: { items: [] } });
}

// Login: soma o carrinho do visitante ao da conta, respeitando o limite por item (RF004).
export async function mergeGuestIntoUser(guestId: string, userId: string) {
  const guest = await findCartOrEmpty(guestKey(guestId));
  if (guest && guest.items.length > 0) {
    const target = await ensureCart(userKey(userId));
    for (const item of guest.items) {
      const existing = target.items.find((candidate) => candidate.sku === item.sku);
      if (existing) {
        existing.quantidade = Math.min(existing.quantidade + item.quantidade, MAX_QUANTIDADE);
      } else {
        target.items.push({ productId: item.productId, sku: item.sku, quantidade: item.quantidade });
      }
    }
    await touch(target);
    await CartModel.deleteOne({ ownerKey: guestKey(guestId) });
  }
  return viewCart(userKey(userId));
}
