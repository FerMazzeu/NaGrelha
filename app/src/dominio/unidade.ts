import type { Unidade } from './tipos';

/**
 * Tudo que muda conforme a unidade de um item, num lugar só.
 *
 * Eram dois casos, quilo e unidade, e cada tela resolvia com um
 * `unidade === 'kg' ? 'g' : 'un'`. Litro entrou pelo chopp, e um terceiro
 * caso espalhado em vinte ternários é como um deles fica para trás, então
 * eles passaram a perguntar para cá.
 *
 * O "por pessoa" de cada unidade é como se pensa nela: carne em gramas no
 * prato, pão em unidades, chopp em litros (1,5 L por pessoa).
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

/** O contrário: da unidade do preço (kg, un, L) para a que fica guardada. */
export const daUnidadeDoPreco = (u: Unidade, quantidade: number) => (u === 'kg' ? quantidade * 1000 : quantidade);

export const custoDe = (u: Unidade, quantidade: number, preco: number) => naUnidadeDoPreco(u, quantidade) * preco;

// ------------------------------------------------------------- embalagens --

/*
  Como se COMPRA, separado de como se CONSOME.

  O primeiro caso foi o chopp: bebe-se em litro e compra-se em barril de 30
  ou de 50. A solução de primeira foi uma regra para o chopp no código, e o
  próximo produto assim (guardanapo em pacote de 50, carvão em saco de 10 kg,
  arroz em fardo) pediria outra. Então o tamanho da embalagem virou cadastro:
  o Alan escreve "30, 50" no chopp e o app arredonda a compra por ela, sem
  ninguém mexer em código.

  O tamanho é escrito na unidade do preço (kg, un, L), que é como está no
  rótulo: "saco de 5 kg", e não "saco de 5000 g". O preço continua por
  quilo, unidade ou litro, então o custo é a quantidade comprada vezes o preço.
*/

export type Compra = { tamanho: number; quantas: number }[];

const ESCALA = 1000;
/** Acima disso a busca exata fica pesada demais para rodar a cada tecla. */
const LIMITE_DA_BUSCA = 200_000;

const mdc = (a: number, b: number): number => (b === 0 ? a : mdc(b, a % b));

/**
 * As embalagens que cobrem a quantidade, com o mínimo de sobra.
 *
 * Precisar de 70 L de chopp é comprar 80 (um barril de cada), e não 100 (dois
 * de 50). Empate na sobra fica com menos embalagens, que é menos coisa para
 * carregar e devolver.
 *
 * `quantidade` e os tamanhos estão na unidade do preço.
 */
export function embalagensPara(quantidade: number, tamanhos: number[]): Compra {
  const validos = [...new Set(tamanhos.filter((t) => Number.isFinite(t) && t > 0))].sort((a, b) => b - a);
  if (quantidade <= 0 || validos.length === 0) return [];

  // Inteiros, e divididos pelo MDC: 30 e 50 viram 3 e 5, e a conta é pequena.
  const inteiros = validos.map((t) => Math.round(t * ESCALA));
  const passo = inteiros.reduce(mdc);
  const pesos = inteiros.map((t) => t / passo);
  const alvo = Math.ceil((quantidade * ESCALA) / passo - 1e-9);
  const teto = alvo + Math.max(...pesos);

  if (teto > LIMITE_DA_BUSCA) {
    // Quantidade enorme para embalagens pequenas: a maior embalagem resolve,
    // e a sobra é menor que uma dela.
    return [{ tamanho: validos[0], quantas: Math.ceil(quantidade / validos[0] - 1e-9) }];
  }

  // menor[x] = menos embalagens para somar exatamente x; de[x] = a última usada.
  const menor = new Array<number>(teto + 1).fill(Infinity);
  const de = new Array<number>(teto + 1).fill(-1);
  menor[0] = 0;
  for (let x = 1; x <= teto; x++) {
    for (let i = 0; i < pesos.length; i++) {
      const antes = x - pesos[i];
      if (antes >= 0 && menor[antes] + 1 < menor[x]) {
        menor[x] = menor[antes] + 1;
        de[x] = i;
      }
    }
  }

  let x = alvo;
  while (x <= teto && !Number.isFinite(menor[x])) x++;
  const conta = new Array<number>(validos.length).fill(0);
  for (; x > 0; x -= pesos[de[x]]) conta[de[x]]++;
  return validos.map((tamanho, i) => ({ tamanho, quantas: conta[i] })).filter((c) => c.quantas > 0);
}

export const totalDaCompra = (c: Compra) => c.reduce((s, x) => s + x.tamanho * x.quantas, 0);

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

/** "1 de 50 L + 1 de 30 L" */
export function descreverCompra(c: Compra, u: Unidade) {
  return c.map((x) => `${x.quantas} de ${numero.format(x.tamanho)}${u === 'un' ? '' : ` ${rotuloUnidade(u)}`}`).join(' + ');
}

/**
 * "30 e 50" → [30, 50].
 *
 * Vírgula grudada no número é decimal, como se escreve aqui ("2,5 kg");
 * separa-se com "e", espaço, ";", "/" ou vírgula seguida de espaço. "30,50"
 * vira 30,5 — por isso a tela repete o que entendeu logo abaixo do campo.
 */
export function lerEmbalagens(texto: string): number[] {
  return texto
    .split(/\s*(?:;|\/|,\s+)\s*|\s+e\s+|\s+/i)
    .map((p) => Number(p.trim().replace(/[^\d,.]/g, '').replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export const escreverEmbalagens = (e: number[] | undefined) => (e ?? []).map((n) => numero.format(n)).join(', ');
