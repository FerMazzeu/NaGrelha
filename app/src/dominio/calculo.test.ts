import { describe, expect, it } from 'vitest';
import { arredondarCompra, arredondarPreco, calcular, pessoasEquivalentes, redistribuirCarnes } from './calculo';
import type { Item, Orcamento } from './tipos';

const picanha: Item = {
  id: 'picanha',
  nome: 'Picanha',
  categoria: 'carne',
  unidade: 'kg',
  porPessoa: 100,
  rendimento: 0.5,
  preco: 100,
};

function orcamentoDe(parcial: Partial<Orcamento> = {}): Orcamento {
  return {
    id: 'x',
    cliente: '',
    contato: '',
    data: '',
    hora: '',
    local: '',
    situacao: 'orcado',
    observacoes: '',
    adultos: 10,
    criancas: 0,
    apetite: 'normal',
    itens: [picanha],
    selecionados: ['picanha'],
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
  it('conta criança como meia pessoa', () => {
    expect(pessoasEquivalentes({ adultos: 10, criancas: 4, apetite: 'normal' })).toBe(12);
  });

  it('aplica o apetite sobre o total', () => {
    expect(pessoasEquivalentes({ adultos: 10, criancas: 0, apetite: 'forte' })).toBeCloseTo(11.5);
    expect(pessoasEquivalentes({ adultos: 10, criancas: 0, apetite: 'leve' })).toBeCloseTo(8.5);
  });

  it('não deixa número negativo virar desconto', () => {
    expect(pessoasEquivalentes({ adultos: -5, criancas: 0, apetite: 'normal' })).toBe(0);
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

describe('cálculo do orçamento', () => {
  it('corrige o peso de compra pelo aproveitamento', () => {
    // 10 pessoas x 100 g no prato = 1000 g servidos.
    // Com aproveitamento de 0,5, é preciso comprar 2000 g.
    const r = calcular(orcamentoDe());
    expect(r.linhas[0].servido).toBe(1000);
    expect(r.linhas[0].comprar).toBe(2000);
    expect(r.linhas[0].custo).toBeCloseTo(200);
  });

  it('mantém a gramatura por pessoa no prato, não na compra', () => {
    const r = calcular(orcamentoDe());
    expect(r.carnePorPessoa).toBe(100);
    expect(r.carneCrua).toBe(2);
  });

  it('tira o carvão do peso de carne crua, não do número de convidados', () => {
    const r = calcular(orcamentoDe({ fatorCarvao: 0.5, precoCarvao: 10 }));
    // 2 kg de carne crua x 0,5 = 1 kg de carvão
    expect(r.carvaoKg).toBe(1);
    expect(r.custoCarvao).toBe(10);
  });

  it('soma custos extras no custo total', () => {
    const r = calcular(
      orcamentoDe({ custosExtras: [{ id: 'a', descricao: 'Deslocamento', valor: 150 }] }),
    );
    expect(r.custoItens).toBeCloseTo(200);
    expect(r.custoTotal).toBeCloseTo(350);
  });

  it('aplica markup sobre o custo e reporta a margem sobre o preço', () => {
    const r = calcular(orcamentoDe({ margem: 100 }));
    // custo 200, markup de 100% = 400
    expect(r.preco).toBe(400);
    expect(r.lucro).toBeCloseTo(200);
    // markup de 100% sobre o custo é margem de 50% sobre o preço
    expect(r.margemSobrePreco).toBeCloseTo(50);
  });

  it('não divide por zero quando não há convidado', () => {
    const r = calcular(orcamentoDe({ adultos: 0, criancas: 0 }));
    expect(r.precoPorPessoa).toBe(0);
    expect(r.carnePorPessoa).toBe(0);
    expect(Number.isFinite(r.custoPorPessoa)).toBe(true);
  });

  it('ignora item que não está selecionado', () => {
    const r = calcular(orcamentoDe({ selecionados: [] }));
    expect(r.linhas).toHaveLength(0);
    expect(r.custoTotal).toBe(0);
  });

  it('trata aproveitamento zerado como 1 em vez de estourar', () => {
    const r = calcular(orcamentoDe({ itens: [{ ...picanha, rendimento: 0 }] }));
    expect(Number.isFinite(r.linhas[0].comprar)).toBe(true);
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
    const novo = redistribuirCarnes(itens, ['a', 'b', 'c'], 300);
    expect(novo.find((i) => i.id === 'c')!.porPessoa).toBe(70);
  });

  it('não mexe em carne que não está no evento', () => {
    const novo = redistribuirCarnes(itens, ['a'], 200);
    expect(novo.find((i) => i.id === 'a')!.porPessoa).toBe(200);
    expect(novo.find((i) => i.id === 'b')!.porPessoa).toBe(100);
  });

  it('devolve tudo intacto quando não há carne selecionada', () => {
    expect(redistribuirCarnes(itens, ['c'], 300)).toEqual(itens);
  });
});
