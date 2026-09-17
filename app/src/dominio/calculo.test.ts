import { describe, expect, it } from 'vitest';
import {
  arredondarCompra,
  arredondarPreco,
  calcular,
  faltaFaixa,
  pessoasEquivalentes,
  redistribuirCarnes,
  totalDeConvidados,
  valorDaFaixa,
  valorSugerido,
} from './calculo';
import type { Item, Orcamento } from './tipos';

const picanha: Item = {
  id: 'picanha',
  nome: 'Picanha',
  grupo: 'Churrasco',
  categoria: 'carne',
  unidade: 'kg',
  porPessoa: 100,
  rendimento: 0.5,
  preco: 100,
};

const faixa = (nome: string, percentual: number, quantidade: number) => ({
  id: nome,
  faixaId: null,
  nome,
  percentual,
  quantidade,
});

function orcamentoDe(parcial: Partial<Orcamento> = {}): Orcamento {
  return {
    id: 'x',
    cliente: '',
    contato: '',
    data: '',
    hora: '',
    local: '',
    observacoes: '',
    situacao: 'orcado',
    tipoEvento: 'aniversario',
    adultos: 10,
    faixas: [],
    apetite: 'normal',
    duracaoHoras: 5,
    itens: [picanha],
    selecionados: ['picanha'],
    servicos: [],
    custosExtras: [],
    margem: 0,
    fatorCarvao: 0,
    precoCarvao: 0,
    criadoEm: '',
    atualizadoEm: '',
    ...parcial,
  };
}

describe('pessoas equivalentes', () => {
  it('adulto conta inteiro', () => {
    expect(pessoasEquivalentes({ adultos: 10, faixas: [], apetite: 'normal' })).toBe(10);
  });

  it('criança conta a fração da faixa dela', () => {
    expect(
      pessoasEquivalentes({ adultos: 10, faixas: [faixa('6 a 10', 50, 4)], apetite: 'normal' }),
    ).toBe(12);
  });

  it('faixa que não paga quase não pesa na compra', () => {
    expect(
      pessoasEquivalentes({ adultos: 10, faixas: [faixa('Até 5', 0, 6)], apetite: 'normal' }),
    ).toBe(10);
  });

  it('soma várias faixas', () => {
    const r = pessoasEquivalentes({
      adultos: 20,
      faixas: [faixa('Até 5', 0, 3), faixa('6 a 10', 50, 4), faixa('11+', 100, 2)],
      apetite: 'normal',
    });
    expect(r).toBe(24);
  });

  it('aplica o apetite sobre o total', () => {
    expect(pessoasEquivalentes({ adultos: 10, faixas: [], apetite: 'forte' })).toBeCloseTo(11.5);
  });

  it('conta cabeças de verdade separado do peso', () => {
    const o = { adultos: 10, faixas: [faixa('Até 5', 0, 6)] };
    expect(totalDeConvidados(o)).toBe(16);
  });
});

describe('arredondamento', () => {
  it('sobe a compra para o degrau de 100 g', () => {
    expect(arredondarCompra(12_437, 'kg')).toBe(12_500);
  });

  it('sobe unidade inteira', () => {
    expect(arredondarCompra(15.2, 'un')).toBe(16);
  });

  it('nunca arredonda para baixo, porque faltar carne é pior que sobrar', () => {
    expect(arredondarCompra(10_001, 'kg')).toBe(10_100);
  });

  it('preço fechado sobe para a dezena', () => {
    expect(arredondarPreco(1234.01)).toBe(1240);
  });
});

describe('cachê por faixa de convidados', () => {
  // a tabela do rodapé da planilha do cliente
  const faixas = [
    { min: 1, max: 30, valor: 500, tipo: null },
    { min: 31, max: 60, valor: 600, tipo: null },
    { min: 61, max: 80, valor: 800, tipo: null },
    { min: 81, max: null, valor: 1000, tipo: null },
  ];

  it('pega a faixa certa', () => {
    expect(valorDaFaixa(faixas, 30, 0)).toBe(500);
    expect(valorDaFaixa(faixas, 31, 0)).toBe(600);
    expect(valorDaFaixa(faixas, 80, 0)).toBe(800);
  });

  it('faixa sem teto cobre daqui para cima', () => {
    expect(valorDaFaixa(faixas, 81, 0)).toBe(1000);
    expect(valorDaFaixa(faixas, 500, 0)).toBe(1000);
  });

  it('cai no padrão quando nenhuma faixa cobre', () => {
    expect(valorDaFaixa(faixas, 0, 123)).toBe(123);
  });
});

/*
  As duas tabelas que o Alan mandou.

  Casamento e festa de 15 anos pagam mais que aniversário e corporativo para o
  mesmo número de convidados. A do casamento para em 199 de propósito: as duas
  últimas faixas vieram cortadas na foto, e cachê chutado é dinheiro chutado.
*/
describe('cachê por tipo de evento', () => {
  const duasTabelas = [
    { min: 1, max: 30, valor: 500, tipo: 'aniversario' as const },
    { min: 100, max: 120, valor: 1200, tipo: 'aniversario' as const },
    { min: 250, max: 300, valor: 2000, tipo: 'aniversario' as const },
    { min: 1, max: 30, valor: 800, tipo: 'casamento' as const },
    { min: 100, max: 120, valor: 1600, tipo: 'casamento' as const },
  ];

  it('o mesmo evento custa mais em casamento', () => {
    expect(valorDaFaixa(duasTabelas, 20, 0, 'aniversario')).toBe(500);
    expect(valorDaFaixa(duasTabelas, 20, 0, 'casamento')).toBe(800);

    expect(valorDaFaixa(duasTabelas, 110, 0, 'aniversario')).toBe(1200);
    expect(valorDaFaixa(duasTabelas, 110, 0, 'casamento')).toBe(1600);
  });

  it('a tabela do tipo ganha da tabela geral', () => {
    const misturado = [
      { min: 1, max: 300, valor: 999, tipo: null },
      { min: 1, max: 30, valor: 500, tipo: 'aniversario' as const },
    ];
    expect(valorDaFaixa(misturado, 20, 0, 'aniversario')).toBe(500);
    // Casamento não tem faixa própria aqui, então herda a geral.
    expect(valorDaFaixa(misturado, 20, 0, 'casamento')).toBe(999);
  });

  it('convidados fora da tabela caem no padrão, e isso é detectável', () => {
    const servico = {
      id: 's',
      nome: 'Churrasqueiro',
      papel: 'equipe' as const,
      valorPadrao: 600,
      usaFaixa: true,
      percentual: 0,
      faixas: duasTabelas,
    };

    // 250 existe em aniversário, mas não em casamento.
    expect(valorSugerido(servico, 260, 'aniversario')).toBe(2000);
    expect(faltaFaixa(servico, 260, 'aniversario')).toBe(false);

    expect(valorSugerido(servico, 260, 'casamento')).toBe(600);
    expect(faltaFaixa(servico, 260, 'casamento')).toBe(true);
  });

  it('serviço de valor fixo nunca reclama de faixa', () => {
    const fixo = {
      id: 'f',
      nome: 'Garçom',
      papel: 'equipe' as const,
      valorPadrao: 200,
      usaFaixa: false,
      percentual: 0,
      faixas: [],
    };
    expect(faltaFaixa(fixo, 1000, 'casamento')).toBe(false);
    expect(valorSugerido(fixo, 1000, 'casamento')).toBe(200);
  });
});

describe('cálculo do orçamento', () => {
  it('corrige o peso de compra pelo aproveitamento', () => {
    const r = calcular(orcamentoDe());
    expect(r.linhas[0].servido).toBe(1000);
    expect(r.linhas[0].comprar).toBe(2000);
    expect(r.linhas[0].custo).toBeCloseTo(200);
  });

  it('soma os serviços no custo', () => {
    const r = calcular(
      orcamentoDe({
        servicos: [
          { id: 'a', servicoId: null, nome: 'Churrasqueiro', papel: 'equipe', pessoa: 'Alan', quantidade: 1, valor: 600, percentual: 0 , valorManual: false },
          { id: 'b', servicoId: null, nome: 'Frete', papel: 'frete', pessoa: '', quantidade: 2, valor: 50, percentual: 0 , valorManual: false },
        ],
      }),
    );
    expect(r.custoServicos).toBe(700);
    expect(r.custoTotal).toBeCloseTo(900);
  });

  /*
    O imposto do Alan e 7% sobre o total que ele cobra, e nao sobre o custo.
    A diferenca e real: 7% de 900 sao 63, mas quem cobra 967,74 e paga 7%
    disso fica com 900 limpos. Somar por fora deixaria 4,74 de buraco.
  */
  it('imposto percentual incide sobre o total, e nao sobre o custo', () => {
    const r = calcular(
      orcamentoDe({
        servicos: [
          { id: 'i', servicoId: null, nome: 'Imposto (DAS)', papel: 'imposto', pessoa: '', quantidade: 1, valor: 0, percentual: 7 , valorManual: false },
        ],
      }),
    );

    // Sem serviço fixo, a base é só o item: 200 de carne.
    expect(r.custoTotal).toBeCloseTo(200 / 0.93, 6);
    expect(r.custoServicos).toBeCloseTo(r.custoTotal * 0.07, 6);
    // O que sobra depois do imposto é exatamente a base.
    expect(r.custoTotal - r.custoServicos).toBeCloseTo(200, 6);
  });

  it('percentual e valor fixo convivem no mesmo orçamento', () => {
    const r = calcular(
      orcamentoDe({
        servicos: [
          { id: 'a', servicoId: null, nome: 'Churrasqueiro', papel: 'equipe', pessoa: 'Alan', quantidade: 1, valor: 600, percentual: 0 , valorManual: false },
          { id: 'i', servicoId: null, nome: 'Imposto (DAS)', papel: 'imposto', pessoa: '', quantidade: 1, valor: 0, percentual: 7 , valorManual: false },
        ],
      }),
    );

    const base = 200 + 600;
    expect(r.custoTotal).toBeCloseTo(base / 0.93, 6);

    const imposto = r.servicos.find((x) => x.servico.papel === 'imposto')!;
    expect(imposto.total).toBeCloseTo(r.custoTotal * 0.07, 6);

    // A soma das partes tem que dar o todo, sem sobra de centavo.
    expect(r.custoItens + r.custoCarvao + r.custosExtras + r.custoServicos).toBeCloseTo(r.custoTotal, 6);
  });

  it('percentual absurdo não derruba a conta', () => {
    const r = calcular(
      orcamentoDe({
        servicos: [
          { id: 'i', servicoId: null, nome: 'Imposto', papel: 'imposto', pessoa: '', quantidade: 1, valor: 0, percentual: 150 , valorManual: false },
        ],
      }),
    );
    expect(Number.isFinite(r.custoTotal)).toBe(true);
    expect(r.custoTotal).toBeGreaterThan(0);
  });

  it('a cobrança fecha com o preço, sem sobra nem falta', () => {
    const r = calcular(
      orcamentoDe({
        adultos: 20,
        faixas: [faixa('Até 5', 0, 4), faixa('6 a 10', 50, 6)],
        servicos: [
          { id: 'a', servicoId: null, nome: 'Equipe', papel: 'equipe', pessoa: '', quantidade: 1, valor: 1000, percentual: 0 , valorManual: false },
        ],
      }),
    );
    const somado = r.cobranca.reduce((s, c) => s + c.total, 0);
    expect(somado).toBeCloseTo(r.preco, 6);
  });

  it('criança de 50% paga metade do adulto', () => {
    const r = calcular(orcamentoDe({ adultos: 10, faixas: [faixa('6 a 10', 50, 2)] }));
    const adulto = r.cobranca.find((c) => c.rotulo === 'Adultos')!;
    const crianca = r.cobranca.find((c) => c.rotulo === '6 a 10')!;
    expect(crianca.unitario).toBeCloseTo(adulto.unitario / 2);
  });

  it('faixa de 0% aparece na cobrança zerada, porque isento é argumento de venda', () => {
    const r = calcular(orcamentoDe({ adultos: 10, faixas: [faixa('Até 5', 0, 5)] }));
    const bebe = r.cobranca.find((c) => c.rotulo === 'Até 5')!;
    expect(bebe.quantidade).toBe(5);
    expect(bebe.unitario).toBe(0);
    expect(bebe.total).toBe(0);
    expect(r.convidados).toBe(15);
  });

  it('margem zero devolve exatamente o custo, que é o modelo do cliente', () => {
    const r = calcular(orcamentoDe({ margem: 0 }));
    // 200 de custo, arredondado para a dezena
    expect(r.preco).toBe(200);
    expect(r.lucro).toBe(0);
  });

  it('aplica markup sobre o custo e reporta a margem sobre o preço', () => {
    const r = calcular(orcamentoDe({ margem: 100 }));
    expect(r.preco).toBe(400);
    expect(r.margemSobrePreco).toBeCloseTo(50);
  });

  it('tira o carvão do peso de carne crua, não do número de convidados', () => {
    const r = calcular(orcamentoDe({ fatorCarvao: 0.5, precoCarvao: 10 }));
    expect(r.carvaoKg).toBe(1);
    expect(r.custoCarvao).toBe(10);
  });

  it('não divide por zero quando não há convidado', () => {
    const r = calcular(orcamentoDe({ adultos: 0, faixas: [] }));
    expect(r.precoPorAdulto).toBe(0);
    expect(r.precoPorPessoa).toBe(0);
    expect(Number.isFinite(r.custoPorPessoa)).toBe(true);
  });

  it('ignora item que não está selecionado', () => {
    const r = calcular(orcamentoDe({ selecionados: [] }));
    expect(r.linhas).toHaveLength(0);
    expect(r.custoTotal).toBe(0);
  });

  it('carne vendida por unidade nao entra na gramatura em gramas', () => {
    const hamburguer: Item = {
      id: 'h',
      nome: 'Hambúrguer artesanal',
      grupo: 'Hamburguer na grelha',
      categoria: 'carne',
      unidade: 'un',
      porPessoa: 1,
      rendimento: 1,
      preco: 8,
    };
    const r = calcular(orcamentoDe({ itens: [picanha, hamburguer], selecionados: ['picanha', 'h'] }));
    // so a picanha conta: 100 g no prato, e nao 101
    expect(r.carnePorPessoa).toBe(100);
    expect(r.carneCrua).toBe(2);
    // mas o custo do hamburguer continua entrando
    expect(r.custoItens).toBeCloseTo(200 + 10 * 8);
  });

  it('trata aproveitamento zerado como 1 em vez de estourar', () => {
    const r = calcular(orcamentoDe({ itens: [{ ...picanha, rendimento: 0 }] }));
    expect(r.linhas[0].comprar).toBe(1000);
  });
});

describe('redistribuir carnes', () => {
  const itens: Item[] = [
    { ...picanha, id: 'a', porPessoa: 100 },
    { ...picanha, id: 'b', porPessoa: 100 },
    { ...picanha, id: 'c', categoria: 'guarnicao', porPessoa: 70 },
  ];

  it('escala as carnes para bater a meta mantendo a proporção', () => {
    const novo = redistribuirCarnes(itens, ['a', 'b', 'c'], 300);
    expect(novo.find((i) => i.id === 'a')!.porPessoa).toBe(150);
    expect(novo.find((i) => i.id === 'b')!.porPessoa).toBe(150);
  });

  it('não mexe em guarnição', () => {
    expect(redistribuirCarnes(itens, ['a', 'b', 'c'], 300).find((i) => i.id === 'c')!.porPessoa).toBe(70);
  });

  it('não reescala carne vendida por unidade', () => {
    const comHamburguer: Item[] = [
      { ...picanha, id: 'a', porPessoa: 100 },
      { ...picanha, id: 'h', unidade: 'un', porPessoa: 1 },
    ];
    const novo = redistribuirCarnes(comHamburguer, ['a', 'h'], 300);
    expect(novo.find((i) => i.id === 'a')!.porPessoa).toBe(300);
    // continua 1 hamburguer por pessoa, e nao 3
    expect(novo.find((i) => i.id === 'h')!.porPessoa).toBe(1);
  });

  it('devolve tudo intacto quando não há carne selecionada', () => {
    expect(redistribuirCarnes(itens, ['c'], 300)).toEqual(itens);
  });
});
