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

export const ROTULO_CATEGORIA = {
  carne: 'Carnes',
  entrada: 'Entradas',
  guarnicao: 'Guarnições',
} as const;

/** Sugestões de custo que aparecem como atalho, para não digitar toda vez. */
export const EXTRAS_SUGERIDOS = [
  'Deslocamento',
  'Mão de obra',
  'Descartáveis e gelo',
  'Aluguel de estrutura',
  'Gás e acendedor',
];

export const MARGEM_PADRAO = 60;
export const FATOR_CARVAO_PADRAO = 0.5;
export const PRECO_CARVAO_PADRAO = 5.5;
