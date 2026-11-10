import { randomUUID } from 'node:crypto';

// Gateway SIMULADO (ambiente de teste). Não há chamada de rede nem dado de cartão (RE002).
// Pagamentos reais ficam para depois: a interface abaixo é o que um gateway real implementaria.

export interface ChargeInput {
  amountCentavos: number;
  metodo: 'pix' | 'cartao';
  // Só para testes: força a recusa para cobrir o fluxo RS004.
  simularRecusa: boolean;
}

export interface ChargeResult {
  status: 'approved' | 'refused';
  referencia: string;
  motivo: string | null;
}

export async function charge(input: ChargeInput): Promise<ChargeResult> {
  const referencia = `sim_${randomUUID()}`;
  if (input.simularRecusa) {
    return { status: 'refused', referencia, motivo: 'Pagamento recusado no ambiente de teste.' };
  }
  return { status: 'approved', referencia, motivo: null };
}
