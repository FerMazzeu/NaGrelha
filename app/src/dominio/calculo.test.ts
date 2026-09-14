import { describe, expect, it } from 'vitest';
import {
  arredondarCompra,
  arredondarPreco,
  calcular,
  pessoasEquivalentes,
  redistribuirCarnes,
  totalDeConvidados,
  valorDaFaixa,
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
    { min: 1, max: 30, valor: 500 },
    { min: 31, max: 60, valor: 600 },
    { min: 61, max: 80, valor: 800 },
    { min: 81, max: null, valor: 1000 },
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
          { id: 'a', servicoId: null, nome: 'Churrasqueiro', papel: 'equipe', pessoa: 'Alan', quantidade: 1, valor: 600 },
          { id: 'b', servicoId: null, nome: 'Frete', papel: 'frete', pessoa: '', quantidade: 2, valor: 50 },
        ],
      }),
    );
    expect(r.custoServicos).toBe(700);
    expect(r.custoTotal).toBeCloseTo(900);
  });

  it('a cobrança fecha com o preço, sem sobra nem falta', () => {
    const r = calcular(
      orcamentoDe({
        adultos: 20,
        faixas: [faixa('Até 5', 0, 4), faixa('6 a 10', 50, 6)],
        servicos: [
          { id: 'a', servicoId: null, nome: 'Equipe', papel: 'equipe', pessoa: '', quantidade: 1, valor: 1000 },
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

  it('devolve tudo intacto quando não há carne selecionada', () => {
    expect(redistribuirCarnes(itens, ['c'], 300)).toEqual(itens);
  });
});
