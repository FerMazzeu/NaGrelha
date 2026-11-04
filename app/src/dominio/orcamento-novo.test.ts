import { describe, expect, it } from 'vitest';
import { comPrecosQueFaltavam, orcamentoNovo } from './orcamento-novo';
import type { Item } from './tipos';

const item = (id: string, nome: string, preco: number): Item => ({
  id,
  nome,
  grupo: '',
  categoria: 'guarnicao',
  unidade: 'kg',
  porPessoa: 66,
  rendimento: 1,
  preco,
});

describe('preço que faltava no orçamento', () => {
  const doDia = orcamentoNovo([item('man', 'Mandioca na manteiga', 0), item('arr', 'Arroz', 6.99)], []);
  const catalogoDeHoje = [item('man', 'Mandioca na manteiga', 20), item('arr', 'Arroz', 7.5)];

  it('item que entrou com zero pega o preço que o catálogo ganhou depois', () => {
    const o = comPrecosQueFaltavam(doDia, catalogoDeHoje);
    expect(o.itens.find((i) => i.id === 'man')?.preco).toBe(20);
  });

  it('preço que o orçamento já tinha não muda, mesmo diferente do catálogo', () => {
    const o = comPrecosQueFaltavam(doDia, catalogoDeHoje);
    expect(o.itens.find((i) => i.id === 'arr')?.preco).toBe(6.99);
  });

  it('evento confirmado não muda de valor sozinho', () => {
    const confirmado = { ...doDia, situacao: 'confirmado' as const };
    expect(comPrecosQueFaltavam(confirmado, catalogoDeHoje)).toBe(confirmado);
  });

  it('sem nada a preencher, devolve o mesmo orçamento', () => {
    expect(comPrecosQueFaltavam(doDia, [item('man', 'Mandioca na manteiga', 0)])).toBe(doDia);
  });
});
