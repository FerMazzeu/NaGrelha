import { describe, expect, it } from 'vitest';
import { arredondarCompra, calcular } from './calculo';
import { custoDe, descreverCompra, embalagensPara, lerEmbalagens, totalDaCompra } from './unidade';
import { quantidade } from '../formato';
import type { Item, Orcamento } from './tipos';

describe('embalagens', () => {
  it('70 L de chopp em barril de 30 e 50 é um de cada, e não dois de 50', () => {
    expect(embalagensPara(70, [30, 50])).toEqual([
      { tamanho: 50, quantas: 1 },
      { tamanho: 30, quantas: 1 },
    ]);
    expect(arredondarCompra(70, 'l', [30, 50])).toBe(80);
  });

  it('a sobra é a menor possível, e no empate ganha quem usa menos embalagens', () => {
    expect(totalDaCompra(embalagensPara(25, [30, 50]))).toBe(30);
    expect(totalDaCompra(embalagensPara(45, [30, 50]))).toBe(50);
    expect(embalagensPara(90, [30, 50])).toEqual([{ tamanho: 30, quantas: 3 }]);
    expect(embalagensPara(100, [30, 50])).toEqual([{ tamanho: 50, quantas: 2 }]);
  });

  it('serve para qualquer produto, não só chopp', () => {
    // Guardanapo em pacote de 50: 130 usados são 3 pacotes.
    expect(arredondarCompra(130, 'un', [50])).toBe(150);
    // Arroz em pacote de 5 kg: a compra guardada é em gramas.
    expect(arredondarCompra(7200, 'kg', [5])).toBe(10000);
    // Embalagem com casa decimal.
    expect(arredondarCompra(1200, 'kg', [0.5])).toBe(1500);
  });

  it('sem embalagem, arredonda como sempre', () => {
    expect(arredondarCompra(12.3, 'l')).toBe(13);
    expect(arredondarCompra(12437, 'kg')).toBe(12500);
    expect(arredondarCompra(7, 'un', [])).toBe(7);
  });

  it('quantidade enorme para embalagem pequena não trava', () => {
    expect(totalDaCompra(embalagensPara(5000, [0.001, 0.003]))).toBeGreaterThanOrEqual(5000);
  });

  it('o orçamento cobra a embalagem inteira', () => {
    const chopp: Item = {
      id: 'c',
      nome: 'Chopp',
      grupo: 'BEBIDAS',
      categoria: 'bebida',
      unidade: 'l',
      porPessoa: 1,
      rendimento: 1,
      preco: 14,
      embalagens: [30, 50],
    };
    const o = {
      adultos: 70,
      faixas: [],
      apetite: 'normal',
      itens: [chopp],
      selecionados: ['c'],
      servicos: [],
      custosExtras: [],
      margem: 0,
      fatorCarvao: 0,
      precoCarvao: 0,
    } as unknown as Orcamento;
    const [linha] = calcular(o).linhas;
    expect(linha.comprar).toBe(80);
    expect(linha.custo).toBe(1120);
  });

  it('preço por litro multiplica direto', () => {
    expect(custoDe('l', 80, 14)).toBe(1120);
    expect(custoDe('kg', 1500, 40)).toBe(60);
  });

  it('a lista diz em que embalagens vem', () => {
    expect(quantidade(80, 'l', [30, 50])).toBe('80 L (1 de 50 L + 1 de 30 L)');
    expect(quantidade(150, 'un', [50])).toBe('150 un (3 de 50)');
    expect(quantidade(13, 'l')).toBe('13 L');
    expect(descreverCompra([{ tamanho: 5, quantas: 2 }], 'kg')).toBe('2 de 5 kg');
  });

  it('lê o que a pessoa digita', () => {
    expect(lerEmbalagens('30 e 50')).toEqual([30, 50]);
    expect(lerEmbalagens('30, 50')).toEqual([30, 50]);
    expect(lerEmbalagens('30; 50')).toEqual([30, 50]);
    expect(lerEmbalagens('2,5')).toEqual([2.5]);
    expect(lerEmbalagens('5 kg')).toEqual([5]);
    expect(lerEmbalagens('')).toEqual([]);
    expect(lerEmbalagens('30 e')).toEqual([30]);
  });
});
