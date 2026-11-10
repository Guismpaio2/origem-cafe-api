import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

export interface CepResult {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

// RF009: consulta o ViaCEP pelo servidor, com tempo limite, para não expor a API externa ao navegador.
export async function lookupCep(rawCep: string): Promise<CepResult> {
  const cep = rawCep.replace(/\D/g, '');
  if (cep.length !== 8) {
    throw new AppError(400, 'VALIDATION_ERROR', 'CEP inválido. Use 8 números.');
  }

  let body: { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
  try {
    const response = await fetch(`${env.VIACEP_BASE_URL}/${cep}/json/`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`ViaCEP respondeu ${response.status}`);
    body = (await response.json()) as typeof body;
  } catch {
    throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Não foi possível consultar o CEP agora. Preencha o endereço manualmente.');
  }

  if (body.erro) {
    throw new AppError(404, 'NOT_FOUND', 'CEP não encontrado.');
  }

  return {
    cep: `${cep.slice(0, 5)}-${cep.slice(5)}`,
    logradouro: body.logradouro ?? '',
    bairro: body.bairro ?? '',
    cidade: body.localidade ?? '',
    uf: (body.uf ?? '').toUpperCase(),
  };
}
