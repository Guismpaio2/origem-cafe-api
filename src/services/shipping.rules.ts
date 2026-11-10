// Frete (RN006): entrega custa R$ 15,00 e é grátis a partir de R$ 200,00 em produtos.
// Retirada não tem frete. Valores em centavos e parametrizáveis.

export const FRETE_PADRAO_CENTAVOS = 1500;
export const FRETE_GRATIS_ACIMA_CENTAVOS = 20000;

export type TipoEntrega = 'entrega' | 'retirada';

export function calcularFrete(subtotalCentavos: number, tipoEntrega: TipoEntrega): number {
  if (tipoEntrega === 'retirada') return 0;
  return subtotalCentavos >= FRETE_GRATIS_ACIMA_CENTAVOS ? 0 : FRETE_PADRAO_CENTAVOS;
}
