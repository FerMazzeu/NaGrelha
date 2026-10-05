import type { Unidade } from './tipos';

/**
 * Tudo que muda conforme a unidade de um item, num lugar só.
 *
 * Eram dois casos, quilo e unidade, e cada tela resolvia com um
 * `unidade === 'kg' ? 'g' : 'un'`. Litro entrou pelo chopp: o Alan compra
 * barril de 30 e de 50 litros, e por unidade ele tinha que fazer a conta de
 * cabeça. Um terceiro caso espalhado em vinte ternários é como um deles fica
 * para trás, então eles passaram a perguntar para cá.
 *
 * O "por pessoa" de cada unidade é como se pensa nela: carne em gramas no
 * prato, refrigerante em unidades, chopp em litros (1,5 L por pessoa).
 */

export const OPCOES_DE_UNIDADE: { valor: Unidade; rotulo: string }[] = [
  { valor: 'kg', rotulo: 'Por quilo' },
  { valor: 'un', rotulo: 'Por unidade' },
  { valor: 'l', rotulo: 'Por litro' },
];

/** Sufixo do campo "por pessoa". */
export const sufixoPorPessoa = (u: Unidade) => (u === 'kg' ? 'g' : u === 'l' ? 'L' : 'un');

/** Sufixo do preço: "/kg", "/un", "/L". */
export const sufixoPreco = (u: Unidade) => `/${rotuloUnidade(u)}`;

/** Como a unidade aparece numa coluna de planilha ou lista. */
export const rotuloUnidade = (u: Unidade) => (u === 'kg' ? 'kg' : u === 'l' ? 'L' : 'un');

/** O "por pessoa" guardado (gramas, unidades, litros) na unidade do preço. */
export const naUnidadeDoPreco = (u: Unidade, quantidade: number) => (u === 'kg' ? quantidade / 1000 : quantidade);

export const custoDe = (u: Unidade, quantidade: number, preco: number) => naUnidadeDoPreco(u, quantidade) * preco;

// ------------------------------------------------------------------ chopp --

const BARRIS = [50, 30];

export const ehChopp = (nome: string) => /\bchop+e?\b/i.test(nome);

/**
 * Os barris que cobrem a quantidade, com o mínimo de sobra.
 *
 * O chopp não se compra por litro: vem em barril de 30 ou de 50. Precisar de
 * 70 L é comprar 80 (um de cada), e não 100 (dois de 50). Empate na sobra
 * fica com menos barris, que é menos coisa para carregar e devolver.
 */
export function barrisDeChopp(litros: number): number[] {
  if (litros <= 0) return [];
  const [grande, pequeno] = BARRIS;
  let melhor: number[] = [];
  let melhorTotal = Number.POSITIVE_INFINITY;
  for (let g = 0; g <= Math.ceil(litros / grande); g++) {
    const p = Math.max(0, Math.ceil((litros - g * grande) / pequeno));
    const total = g * grande + p * pequeno;
    if (total < melhorTotal || (total === melhorTotal && g + p < melhor.length)) {
      melhorTotal = total;
      melhor = [...Array(g).fill(grande), ...Array(p).fill(pequeno)];
    }
  }
  return melhor;
}

/** "1 barril de 50 L + 1 de 30 L" */
export function descreverBarris(barris: number[]) {
  const conta = BARRIS.map((t) => [t, barris.filter((b) => b === t).length] as const).filter(([, n]) => n > 0);
  return conta
    .map(([t, n], i) => `${n} ${i === 0 ? (n > 1 ? 'barris de ' : 'barril de ') : 'de '}${t} L`)
    .join(' + ');
}
