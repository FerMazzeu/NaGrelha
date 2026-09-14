import type { Apetite, FaixaDeCache, Item, Orcamento, Resultado, Servico } from './tipos';

const FATOR_APETITE: Record<Apetite, number> = {
  leve: 0.85,
  normal: 1,
  forte: 1.15,
};

/**
 * Quantas pessoas o evento "pesa".
 *
 * Adulto conta 1. Criança conta a fração da faixa dela: quem paga metade come
 * perto de metade, e quem não paga quase não pesa na compra. O mesmo número
 * serve para calcular quanto comprar e para dividir o preço, e é isso que faz
 * a soma do que se cobra bater com o custo.
 */
export function pessoasEquivalentes(
  orcamento: Pick<Orcamento, 'adultos' | 'faixas' | 'apetite'>,
) {
  const adultos = Math.max(0, orcamento.adultos);
  const criancas = orcamento.faixas.reduce(
    (s, f) => s + Math.max(0, f.quantidade) * (Math.max(0, f.percentual) / 100),
    0,
  );
  return (adultos + criancas) * FATOR_APETITE[orcamento.apetite];
}

/** Cabeças de verdade, incluindo quem não paga. É o que vai na proposta. */
export function totalDeConvidados(orcamento: Pick<Orcamento, 'adultos' | 'faixas'>) {
  return Math.max(0, orcamento.adultos) + orcamento.faixas.reduce((s, f) => s + Math.max(0, f.quantidade), 0);
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

/** Preço fechado é preço redondo. Sobe para a dezena seguinte. */
export function arredondarPreco(valor: number) {
  if (valor <= 0) return 0;
  return Math.ceil(valor / 10) * 10;
}

/**
 * Acha o cachê da faixa que cobre esse número de convidados.
 *
 * É a tabela do rodapé da planilha: Alan e Érica cobram 500 até 30 convidados
 * e 1000 acima de 80. Faixa sem teto (`max` nulo) é a última.
 */
export function valorDaFaixa(faixas: FaixaDeCache[], convidados: number, padrao: number) {
  const achada = faixas.find(
    (f) => convidados >= f.min && (f.max === null || convidados <= f.max),
  );
  return achada ? achada.valor : padrao;
}

/** Valor sugerido de um serviço para um evento deste tamanho. */
export function valorSugerido(servico: Servico, convidados: number) {
  return servico.usaFaixa ? valorDaFaixa(servico.faixas, convidados, servico.valorPadrao) : servico.valorPadrao;
}

export function calcular(orcamento: Orcamento): Resultado {
  const pessoas = pessoasEquivalentes(orcamento);
  const convidados = totalDeConvidados(orcamento);
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

  // Serviço é a outra metade do orçamento: equipe, frete, imposto e caixa.
  const servicos = orcamento.servicos.map((servico) => ({
    servico,
    total: Math.max(0, servico.quantidade) * Math.max(0, servico.valor),
  }));
  const custoServicos = servicos.reduce((s, x) => s + x.total, 0);

  const custoItens = linhas.reduce((s, l) => s + l.custo, 0);
  const custosExtras = orcamento.custosExtras.reduce((s, c) => s + (Number(c.valor) || 0), 0);
  const custoTotal = custoItens + custoCarvao + custoServicos + custosExtras;

  // Markup sobre o custo. No modelo do cliente ele é zero, porque o que paga
  // o trabalho já está nas linhas de serviço, e imposto e caixa também.
  const preco = arredondarPreco(custoTotal * (1 + orcamento.margem / 100));
  const lucro = preco - custoTotal;

  // O preço de adulto é o preço cheio; cada faixa paga a fração dela. Como o
  // divisor é o mesmo peso usado para comprar, a soma da cobrança fecha com o
  // total, sem sobra nem falta.
  const precoPorAdulto = pessoas > 0 ? (preco / pessoas) * FATOR_APETITE[orcamento.apetite] : 0;

  const cobranca = [
    {
      rotulo: 'Adultos',
      quantidade: Math.max(0, orcamento.adultos),
      unitario: precoPorAdulto,
      total: Math.max(0, orcamento.adultos) * precoPorAdulto,
    },
    ...orcamento.faixas
      .filter((f) => f.quantidade > 0)
      .map((f) => ({
        rotulo: f.nome,
        quantidade: f.quantidade,
        unitario: precoPorAdulto * (f.percentual / 100),
        total: f.quantidade * precoPorAdulto * (f.percentual / 100),
      })),
  ];

  return {
    pessoasEquivalentes: pessoas,
    convidados,
    linhas,
    servicos,
    custoServicos,
    carnePorPessoa,
    carneCrua,
    carvaoKg,
    custoCarvao,
    custoItens,
    custosExtras,
    custoTotal,
    custoPorPessoa: pessoas > 0 ? custoTotal / pessoas : 0,
    preco,
    precoPorPessoa: convidados > 0 ? preco / convidados : 0,
    lucro,
    margemSobrePreco: preco > 0 ? (lucro / preco) * 100 : 0,
    precoPorAdulto,
    cobranca,
  };
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
