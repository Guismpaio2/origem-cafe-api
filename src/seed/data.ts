// Dados de desenvolvimento. Preços em centavos (RNF e convenção: R$ 39,90 = 3990).
// Senhas de teste estão no README: são só para ambiente local/sandbox.

export interface VariantSeed {
  sku: string;
  moagem?: string;
  pesoGramas?: number;
  precoCentavos: number;
  estoque: number;
}

export interface ProductSeed {
  nome: string;
  tipo: 'cafe' | 'acessorio';
  descricao: string;
  origem: string;
  notasSensoriais: string[];
  variants: VariantSeed[];
  ratingMedia: number;
  ratingTotal: number;
}

const MOAGENS = ['Grão inteiro', 'Moído para filtro'] as const;
const PESOS = [250, 500] as const;
const PRECO_POR_PESO: Record<number, number> = { 250: 3990, 500: 6990 };

// Gera as 4 variantes (2 moagens x 2 pesos) que todo café precisa ter (RN002).
function variantesDeCafe(slug: string, estoquePadrao = 20, estoqueZeradoEm500 = false): VariantSeed[] {
  const variantes: VariantSeed[] = [];
  for (const moagem of MOAGENS) {
    for (const peso of PESOS) {
      variantes.push({
        sku: `${slug}-${moagem === 'Grão inteiro' ? 'INT' : 'FIL'}-${peso}G`,
        moagem,
        pesoGramas: peso,
        precoCentavos: PRECO_POR_PESO[peso] ?? 0,
        estoque: estoqueZeradoEm500 && peso === 500 ? 0 : estoquePadrao,
      });
    }
  }
  return variantes;
}

export const products: ProductSeed[] = [
  {
    nome: 'Cerrado Mineiro Arábica',
    tipo: 'cafe',
    descricao: 'Café de altitude do Cerrado Mineiro, com corpo médio e doçura marcante. Ideal para o dia a dia.',
    origem: 'Cerrado Mineiro (MG)',
    notasSensoriais: ['chocolate ao leite', 'caramelo', 'nozes'],
    variants: variantesDeCafe('CERR'),
    ratingMedia: 4.6,
    ratingTotal: 38,
  },
  {
    nome: 'Sul de Minas Bourbon',
    tipo: 'cafe',
    descricao: 'Bourbon colhido em fazendas do Sul de Minas, com acidez viva e notas de frutas vermelhas.',
    origem: 'Sul de Minas (MG)',
    notasSensoriais: ['frutas vermelhas', 'floral', 'chocolate'],
    variants: variantesDeCafe('SULM'),
    ratingMedia: 4.8,
    ratingTotal: 52,
  },
  {
    nome: 'Mogiana Catuaí',
    tipo: 'cafe',
    descricao: 'Catuaí da região da Mogiana paulista, equilibrado, com finalização de mel.',
    origem: 'Mogiana (SP)',
    notasSensoriais: ['cítrico', 'mel', 'açúcar mascavo'],
    variants: variantesDeCafe('MOGI'),
    ratingMedia: 4.3,
    ratingTotal: 19,
  },
  {
    nome: 'Chapada Diamantina Natural',
    tipo: 'cafe',
    descricao: 'Processo natural na Chapada Diamantina: corpo denso e notas de frutas tropicais.',
    origem: 'Chapada Diamantina (BA)',
    notasSensoriais: ['frutas tropicais', 'vinho', 'cacau'],
    variants: variantesDeCafe('CHAP'),
    ratingMedia: 4.7,
    ratingTotal: 27,
  },
  {
    nome: 'Caparaó Yellow Bourbon',
    tipo: 'cafe',
    descricao: 'Yellow Bourbon de altitude do Caparaó, delicado, com aroma floral. Edição limitada.',
    origem: 'Caparaó (MG/ES)',
    notasSensoriais: ['damasco', 'jasmim', 'baunilha'],
    // Uma variante sem estoque, para testar o estado "indisponível" no front.
    variants: variantesDeCafe('CAPA', 12, true),
    ratingMedia: 4.9,
    ratingTotal: 11,
  },
  {
    nome: 'Blend da Casa',
    tipo: 'cafe',
    descricao: 'Blend de uso diário, pensado para o espresso e para a cafeteira italiana.',
    origem: 'Blend (MG e SP)',
    notasSensoriais: ['chocolate', 'nozes', 'toque cítrico'],
    variants: variantesDeCafe('BLEN', 40),
    ratingMedia: 4.4,
    ratingTotal: 64,
  },
  {
    nome: 'Prensa Francesa 350 ml',
    tipo: 'acessorio',
    descricao: 'Prensa francesa de vidro borossilicato com filtro de aço inoxidável.',
    origem: '',
    notasSensoriais: [],
    variants: [{ sku: 'ACES-PREN-350', precoCentavos: 12990, estoque: 10 }],
    ratingMedia: 4.5,
    ratingTotal: 8,
  },
  {
    nome: 'Coador de Pano Orgânico',
    tipo: 'acessorio',
    descricao: 'Coador de algodão orgânico com aro de madeira, para filtrar sem papel.',
    origem: '',
    notasSensoriais: [],
    variants: [{ sku: 'ACES-COAD-PANO', precoCentavos: 3490, estoque: 25 }],
    ratingMedia: 4.2,
    ratingTotal: 5,
  },
];

export interface UserSeed {
  nome: string;
  email: string;
  senha: string;
  role: 'cliente' | 'admin';
}

export const users: UserSeed[] = [
  { nome: 'Administração Origem Café', email: 'admin@origemcafe.test', senha: 'Admin#2026', role: 'admin' },
  { nome: 'Cliente de Teste', email: 'cliente@origemcafe.test', senha: 'Cliente#2026', role: 'cliente' },
];
