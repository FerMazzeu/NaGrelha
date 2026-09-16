import { describe, expect, it } from 'vitest';
import { calcular } from './dominio/calculo';
import type { Item, Orcamento } from './dominio/tipos';
import { textoDaListaDeCompras, textoDaProposta } from './texto';

/**
 * O alho da planilha do cliente.
 *
 * Ele aparece em três preparos diferentes, e na planilha são três linhas, cada
 * uma comprada à parte. Isso não é duplicata: é como o orçamento do Alan é
 * organizado, e o total bate com a planilha dele por causa disso.
 *
 * O que muda aqui é só a lista de compras, que é o papel que vai ao mercado.
 */
const alho = (grupo: string, porPessoa: number): Item => ({
  id: `alho-${grupo}`,
  nome: 'Alho',
  grupo,
  categoria: 'extra',
  unidade: 'un',
  porPessoa,
  rendimento: 1,
  preco: 2,
});

const bacon = (grupo: string, unidade: Item['unidade'], porPessoa: number): Item => ({
  id: `bacon-${grupo}-${unidade}`,
  nome: 'Bacon',
  grupo,
  categoria: 'extra',
  unidade,
  porPessoa,
  rendimento: 1,
  preco: 30,
});

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

function orcamentoDe(itens: Item[]): Orcamento {
  const agora = '2026-01-01T00:00:00.000Z';
  return {
    id: 'x',
    cliente: 'ANA',
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
    itens,
    selecionados: itens.map((i) => i.id),
    servicos: [],
    custosExtras: [],
    margem: 0,
    fatorCarvao: 0,
    precoCarvao: 0,
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

const listar = (itens: Item[]) => {
  const o = orcamentoDe(itens);
  return textoDaListaDeCompras(o, calcular(o));
};

describe('lista de compras', () => {
  it('soma o mesmo ingrediente de preparos diferentes numa linha só', () => {
    const texto = listar([alho('Arroz carreteiro', 1), alho('Macarrão no disco', 2), alho('Maionese', 1)]);

    // 10 pessoas x (1 + 2 + 1) unidades = 40, numa linha.
    expect(texto).toContain('• Alho: 40 un');
    expect(texto.match(/• Alho:/g)).toHaveLength(1);
  });

  it('diz de quais preparos o ingrediente veio', () => {
    const texto = listar([alho('Arroz carreteiro', 1), alho('Maionese', 1)]);
    expect(texto).toContain('Arroz carreteiro, Maionese');
  });

  it('não polui a linha quando o ingrediente vem de um preparo só', () => {
    const texto = listar([alho('Maionese', 1)]);
    expect(texto).toContain('• Alho: 10 un');
    expect(texto).not.toContain('(Maionese)');
  });

  it('não soma quilo com unidade', () => {
    // Bacon vem em quilo no arroz e em pacote no hambúrguer. Uma soma dos dois
    // daria um número que não existe em lugar nenhum.
    const texto = listar([bacon('Arroz carreteiro', 'kg', 20), bacon('Hamburguer na grelha', 'un', 1)]);
    expect(texto).toContain('• Bacon: 200 g');
    expect(texto).toContain('• Bacon: 10 un');
  });

  it('separa por categoria, na ordem de andar no mercado', () => {
    const texto = listar([picanha, alho('Maionese', 1)]);
    expect(texto).toContain('*CARNES*');
    expect(texto.indexOf('*CARNES*')).toBeLessThan(texto.indexOf('• Picanha'));
  });
});

describe('proposta para o cliente', () => {
  const proposta = () => {
    const o = orcamentoDe([picanha]);
    return textoDaProposta(o, calcular(o));
  };

  it('não mostra a gramatura por pessoa', () => {
    /*
      O Alan pediu para tirar. É número interno: na mão de quem contrata vira
      negociação de peso, e vira promessa que ninguém vai pesar no dia.
    */
    const texto = proposta();
    expect(texto).not.toMatch(/g de carne por pessoa/i);
    expect(texto).not.toMatch(/Servimos/i);
  });

  it('continua mostrando o que o cliente precisa ver', () => {
    const texto = proposta();
    expect(texto).toContain('Tudo preparado no local');
    expect(texto).toContain('*VALORES*');
    expect(texto).toContain('Orçamento fechado, sem custo oculto.');
  });
});
