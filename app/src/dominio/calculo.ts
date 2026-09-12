import type { Apetite, Item, Orcamento, Resultado } from './tipos';

/** Criança come perto da metade de um adulto. */
export const PESO_CRIANCA = 0.5;

const FATOR_APETITE: Record<Apetite, number> = {
  leve: 0.85,
  normal: 1,
  forte: 1.15,
};

export function pessoasEquivalentes(orcamento: Pick<Orcamento, 'adultos' | 'criancas' | 'apetite'>) {
  const cabecas = Math.max(0, orcamento.adultos) + Math.max(0, orcamento.criancas) * PESO_CRIANCA;
  return cabecas * FATOR_APETITE[orcamento.apetite];
}

/**
 * Arredonda a compra para cima, no degrau em que a coisa é vendida.
 *
 * Comprar 12,437 kg de picanha não existe. Para kg o degrau é 100 g, para
 * unidade é 1. Para cima sempre: faltar carne na festa é um problema de outra
 * ordem de grandeza do que sobrar duzentos gramas.
 */
export function arredondarCompra(quantidade: number, unidade: 'kg' | 'un') {
  if (quantidade <= 0) return 0;
  const degrau = unidade === 'kg' ? 100 : 1;
  return Math.ceil(quantidade / degrau) * degrau;
}

export function calcular(orcamento: Orcamento): Resultado {
  const pessoas = pessoasEquivalentes(orcamento);
  const escolhidos = orcamento.itens.filter((i) => orcamento.selecionados.includes(i.id));

  const linhas = escolhidos.map((item) => {
    const servido = item.porPessoa * pessoas;
    // O aproveitamento é o que separa peso no prato de peso na nota fiscal.
    const rendimento = item.rendimento > 0 ? item.rendimento : 1;
    const bruto = servido / rendimento;
    const comprar = arredondarCompra(bruto, item.unidade);
    const custo = item.unidade === 'kg' ? (comprar / 1000) * item.preco : comprar * item.preco;
    return { item, servido, comprar, custo };
  });

  const carnes = linhas.filter((l) => l.item.categoria === 'carne');
  const carnePorPessoa = pessoas > 0 ? carnes.reduce((s, l) => s + l.servido, 0) / pessoas : 0;
  const carneCrua = carnes.reduce((s, l) => s + l.comprar, 0) / 1000;

  // Carvão sai do peso de carne crua, não do número de convidados: quem gasta
  // brasa é quilo de carne em cima da grelha.
  const carvaoKg = Math.ceil(carneCrua * orcamento.fatorCarvao);
  const custoCarvao = carvaoKg * orcamento.precoCarvao;

  const custoItens = linhas.reduce((s, l) => s + l.custo, 0);
  const custosExtras = orcamento.custosExtras.reduce((s, c) => s + (Number(c.valor) || 0), 0);
  const custoTotal = custoItens + custoCarvao + custosExtras;

  // Markup sobre o custo. É como se fala na cozinha ("custo mais 60%"), e não
  // é a mesma coisa que margem sobre o preço, por isso as duas aparecem.
  const preco = arredondarPreco(custoTotal * (1 + orcamento.margem / 100));
  const lucro = preco - custoTotal;

  return {
    pessoasEquivalentes: pessoas,
    linhas,
    carnePorPessoa,
    carneCrua,
    carvaoKg,
    custoCarvao,
    custoItens,
    custosExtras,
    custoTotal,
    custoPorPessoa: pessoas > 0 ? custoTotal / pessoas : 0,
    preco,
    precoPorPessoa: pessoas > 0 ? preco / pessoas : 0,
    lucro,
    margemSobrePreco: preco > 0 ? (lucro / preco) * 100 : 0,
  };
}

/** Preço fechado é preço redondo. Sobe para a dezena seguinte. */
export function arredondarPreco(valor: number) {
  if (valor <= 0) return 0;
  return Math.ceil(valor / 10) * 10;
}

/**
 * Reescala as carnes selecionadas para bater uma meta de gramas por pessoa,
 * mantendo a proporção entre os cortes.
 *
 * É assim que a decisão acontece de verdade: primeiro se define "vou de 400 g
 * por pessoa", depois se distribui entre picanha, costela e linguiça.
 */
export function redistribuirCarnes(itens: Item[], selecionados: string[], metaPorPessoa: number): Item[] {
  const carnesEscolhidas = itens.filter((i) => i.categoria === 'carne' && selecionados.includes(i.id));
  const atual = carnesEscolhidas.reduce((s, i) => s + i.porPessoa, 0);
  if (atual <= 0 || metaPorPessoa <= 0) return itens;

  const fator = metaPorPessoa / atual;
  return itens.map((i) =>
    i.categoria === 'carne' && selecionados.includes(i.id)
      ? { ...i, porPessoa: Math.round(i.porPessoa * fator) }
      : i,
  );
}
