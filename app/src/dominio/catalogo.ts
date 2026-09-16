import type { Categoria } from './tipos';

/**
 * Constantes do dominio que nao vivem no banco.
 *
 * O catalogo em si mora na tabela `itens_catalogo` e foi semeado la. O que
 * sobra aqui e o que e decisao de produto, nao dado editavel.
 */

/**
 * O que ja vem marcado num orcamento novo, por NOME.
 *
 * Por nome porque o id do item e do banco: muda entre projetos e nao pode
 * virar constante no codigo.
 */
export const SELECAO_PADRAO = [
  'Picanha',
  'Fraldinha',
  'Linguiça toscana',
  'Coxa e sobrecoxa',
  'Pão de alho',
  'Arroz',
  'Farofa',
  'Vinagrete',
  'Maionese',
  'Salada tropical',
];

export const ROTULO_CATEGORIA: Record<Categoria, string> = {
  carne: 'Carnes',
  entrada: 'Entradas',
  guarnicao: 'Guarnições',
  bebida: 'Bebidas',
  estrutura: 'Louças e estrutura',
  limpeza: 'Limpeza',
  extra: 'Extras',
};

/** A ordem em que as seções aparecem na tela e na lista de compras. */
export const CATEGORIAS: Categoria[] = [
  'carne',
  'entrada',
  'guarnicao',
  'bebida',
  'extra',
  'estrutura',
  'limpeza',
];

/** Sugestões de custo que aparecem como atalho, para não digitar toda vez. */
export const EXTRAS_SUGERIDOS = [
  'Deslocamento',
  'Mão de obra',
  'Descartáveis e gelo',
  'Aluguel de estrutura',
  'Gás e acendedor',
];

/**
 * Zero de proposito.
 *
 * No modelo do cliente nao existe markup: o que paga o trabalho ja esta nas
 * linhas de servico, e imposto e caixa tambem. Somar 60% em cima disso
 * dobraria o preco em relacao ao que eles cobram hoje. Quem quiser margem
 * extra sobe esse numero no proprio orcamento.
 */
export const MARGEM_PADRAO = 0;
export const FATOR_CARVAO_PADRAO = 0.5;
export const PRECO_CARVAO_PADRAO = 5.5;

/**
 * Agrupa itens pelo preparo a que pertencem.
 *
 * "Separar as matérias-primas por prato", nas palavras do Alan. É como a
 * planilha dele sempre foi e como a compra acontece: quatro linhas de cheiro
 * verde em preparos diferentes não são duplicata, são quatro compras.
 *
 * A ordem dos grupos segue a ordem em que os itens aparecem, que é a ordem do
 * catálogo. Item sem preparo cai no rótulo da categoria.
 */
export function agruparPorPreparo<T extends { grupo: string; categoria: Categoria }>(itens: T[]) {
  const grupos = new Map<string, T[]>();
  for (const item of itens) {
    const chave = item.grupo || ROTULO_CATEGORIA[item.categoria];
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(item);
  }
  return [...grupos.entries()];
}
