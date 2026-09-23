import type { Categoria, Item } from './dominio/tipos';

/**
 * Chuta categoria e aproveitamento a partir do nome.
 *
 * Existe porque a planilha do Alan não tem essas duas colunas, e o que a
 * importação fazia era pior que chutar: botava tudo como "extra" com 100% de
 * aproveitamento. Cem por cento em costela com osso erra a compra em dezenas
 * de quilos, porque metade da peça é osso.
 *
 * Não é adivinhação de verdade, é tabela de nomes conhecidos. Erra em nome
 * esquisito, e por isso o resultado aparece na tela para conferência, num
 * campo que dá para trocar, em vez de entrar calado no catálogo.
 */

type Palpite = { categoria: Categoria; rendimento: number };

/**
 * Aproveitamento por corte, do que se compra ao que chega no prato.
 *
 * Os números vêm do que já estava escrito no domínio e no prompt do
 * assistente: costela com osso perto de 50%, linguiça 85%, picanha 72%,
 * coxa e sobrecoxa 62%.
 */
const CARNES: [RegExp, number][] = [
  [/costel/i, 0.5],
  [/coxa|sobrecoxa|frango|tulipa|asa/i, 0.62],
  [/picanha|ancho|chorizo|maminha|fraldinha|alcatra|contra.?fil|shoulder|shouder|copa.?lombo|copalombo/i, 0.72],
  [/lingui[çc]a|calabresa|toscana|chori/i, 0.85],
  [/panc|bacon|barriga|pururuca|leit/i, 0.8],
  [/carne|bovin|suin|porco|boi|file|filé/i, 0.75],
];

const POR_NOME: [RegExp, Categoria][] = [
  [/detergente|alco?ol|bucha|l[ãa] de a[çc]o|desinfetante|saco de lixo|sab[ãa]o|limpeza|luva|papel toalha/i, 'limpeza'],
  /*
    Sem "grelha" e sem "mesa" de propósito.

    Estas regras também rodam sobre o NOME DO PREPARO, e quase todo preparo do
    Alan tem "na grelha" no nome: "FAROFA NA GRELHA", "HAMBURGUER NA GRELHA".
    Com "grelha" aqui, farofa virava equipamento. "Mesa de frios" tinha o mesmo
    problema. Os equipamentos de verdade da planilha dele estão listados abaixo.
  */
  [/copo|prato|garfo|faca|colher|bandeij|richo|rech[ôo]|cuba|t[áa]bua|lou[çc]a|toalha|cadeira|espeto|carv[ãa]o/i, 'estrutura'],
  [/refrigerante|cerveja|chopp|[áa]gua|suco|refri|bebida/i, 'bebida'],
  [/p[ãa]o|queijo|mu[çs]arela|mussarela|provol|choripan|batata r[úu]stica|geleia|aperitivo|abacaxi na|frios|presunto|salame/i, 'entrada'],
  [/arroz|farofa|farinha|maionese|salada|vinagrete|macarr[ãa]o|massa|feij[ãa]o|mandioca|salpic[ãa]o|tutu|caldo/i, 'guarnicao'],
];

/** Preparos inteiros que já dizem a categoria, e ganham do nome do item. */
const POR_PREPARO: [RegExp, Categoria][] = [
  [/limpeza/i, 'limpeza'],
  [/lou[çc]a|fogo|estrutura/i, 'estrutura'],
  [/bebida/i, 'bebida'],
  [/churrasco|carne/i, 'carne'],
];

export function adivinhar(nome: string, preparo: string): Palpite {
  /*
    O preparo manda, e não o nome do item.

    Esta ordem custou dois testes para eu entender. "Bacon" é um nome de carne,
    mas dentro de "ARROZ CARRETEIRO" ele é tempero da guarnição, e tratar como
    churrasco daria 80% de aproveitamento numa coisa que se usa inteira: a
    compra pediria mais bacon do que a receita gasta.
    Só quando o preparo é de churrasco é que o nome do corte decide, porque aí
    o aproveitamento é o número que importa.
  */
  const doPreparo =
    POR_PREPARO.find(([r]) => r.test(preparo))?.[1] ?? POR_NOME.find(([r]) => r.test(preparo))?.[1];

  if (doPreparo && doPreparo !== 'carne') return { categoria: doPreparo, rendimento: 1 };

  const carne = CARNES.find(([r]) => r.test(nome));
  if (carne) return { categoria: 'carne', rendimento: carne[1] };

  // Preparo de churrasco com corte que ninguém conhece: ainda perde na brasa.
  if (doPreparo === 'carne') return { categoria: 'carne', rendimento: 0.75 };

  const doNome = POR_NOME.find(([r]) => r.test(nome))?.[1];
  if (doNome) return { categoria: doNome, rendimento: 1 };

  // Aproveitamento 1 erra para menos na compra, que é o erro barato.
  return { categoria: 'extra', rendimento: 1 };
}

/** Só para a tela explicar de onde saiu o número, em vez de mostrar 72% do nada. */
export function explicarAproveitamento(item: Pick<Item, 'categoria' | 'rendimento'>) {
  if (item.categoria !== 'carne' || item.rendimento >= 1) return '';
  const perda = Math.round((1 - item.rendimento) * 100);
  return `perde ${perda}% entre osso, gordura e brasa`;
}
