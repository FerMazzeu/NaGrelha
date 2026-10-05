import type { Unidade } from './dominio/tipos';
import { descreverCompra, embalagensPara, naUnidadeDoPreco } from './dominio/unidade';

const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const numeroCheio = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export const real = (v: number) => dinheiro.format(Number.isFinite(v) ? v : 0);

/**
 * Gramas viram quilo quando passam de mil, porque é assim que se compra e é
 * assim que se confere na balança.
 */
export function peso(gramas: number) {
  if (!Number.isFinite(gramas) || gramas <= 0) return '0 g';
  if (gramas >= 1000) return `${numero.format(gramas / 1000)} kg`;
  return `${numeroCheio.format(gramas)} g`;
}

/**
 * Quanto comprar, e em que embalagens quando o item tem:
 * "80 L (1 de 50 L + 1 de 30 L)".
 */
export function quantidade(valor: number, unidade: Unidade, embalagens: number[] = []) {
  const base =
    unidade === 'kg' ? peso(valor) : unidade === 'un' ? `${numeroCheio.format(valor)} un` : `${numero.format(valor)} L`;
  const compra = embalagensPara(naUnidadeDoPreco(unidade, valor), embalagens);
  return compra.length ? `${base} (${descreverCompra(compra, unidade)})` : base;
}

export const inteiro = (v: number) => numeroCheio.format(Number.isFinite(v) ? v : 0);
export const decimal = (v: number) => numero.format(Number.isFinite(v) ? v : 0);

export function dataCurta(iso: string) {
  if (!iso) return 'sem data';
  const [ano, mes, dia] = iso.split('-');
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

export function novoId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Normaliza para busca: tira acento e caixa.
 *
 * Sem isso, procurar "salpicao" nao acha "Salpicão", e ninguem digita acento
 * no celular com a mao suja de tempero.
 */
export const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/** Casa o alvo com qualquer um dos campos, sem acento e sem caixa. */
export function casaBusca(alvo: string, ...campos: string[]) {
  const procurado = normalizar(alvo);
  if (!procurado) return true;
  return campos.some((c) => normalizar(c).includes(procurado));
}
