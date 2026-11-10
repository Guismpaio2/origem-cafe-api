import { describe, expect, it } from 'vitest';
import { calcularFrete } from '../src/services/shipping.rules.js';

describe('regras de frete (RN006)', () => {
  it('cobra R$ 15,00 na entrega abaixo de R$ 200,00', () => {
    expect(calcularFrete(19999, 'entrega')).toBe(1500);
  });

  it('entrega grátis a partir de R$ 200,00 em produtos', () => {
    expect(calcularFrete(20000, 'entrega')).toBe(0);
  });

  it('retirada nunca tem frete', () => {
    expect(calcularFrete(100, 'retirada')).toBe(0);
  });
});
