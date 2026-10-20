import { describe, expect, it } from 'vitest';
import { calcular } from './calculo';
import { juntarCompras } from './compras';
import { eventoExterno } from './evento-externo';
import type { Item, Orcamento } from './tipos';

/* Nomes inventados: o repositório é público. */

const item = (id: string, nome: string, grupo: string, p: Partial<Item> = {}): Item => ({
  id,
  nome,
  grupo,
  categoria: 'carne',
  unidade: 'kg',
  porPessoa: 200,
  rendimento: 1,
  preco: 50,
  ...p,
});

const picanha = item('picanha', 'Picanha', 'Churrasco');
const alhoArroz = item('alho1', 'Alho', 'Arroz', { categoria: 'guarnicao', unidade: 'un', porPessoa: 0.1, preco: 2 });
const alhoMaionese = item('alho2', 'Alho', 'Maionese', { categoria: 'guarnicao', unidade: 'un', porPessoa: 0.1, preco: 2 });

const evento = (id: string, cliente: string, data: string, adultos: number, itens: Item[] = [picanha, alhoArroz, alhoMaionese]): Orcamento => ({
  id,
  cliente,
  contato: '',
  data,
  hora: '',
  local: '',
  observacoes: '',
  situacao: 'confirmado',
  tipoEvento: 'aniversario',
  adultos,
  faixas: [],
  apetite: 'normal',
  duracaoHoras: 5,
  itens,
  selecionados: itens.map((i) => i.id),
  servicos: [],
  custosExtras: [],
  margem: 0,
  fatorCarvao: 0.5,
  precoCarvao: 5,
  criadoEm: '',
  atualizadoEm: '',
});

describe('lista de compras de vários eventos', () => {
  const a = evento('a', 'Fulana', '2026-11-20', 50);
  const b = evento('b', 'Beltrano', '2026-11-07', 30);
  const juntas = juntarCompras([a, b]);

  it('soma o mesmo item de eventos diferentes numa linha só', () => {
    const p = juntas.itens.find((i) => i.nome === 'Picanha')!;
    const deA = calcular(a).linhas.find((l) => l.item.id === 'picanha')!.comprar;
    const deB = calcular(b).linhas.find((l) => l.item.id === 'picanha')!.comprar;
    expect(p.comprar).toBe(deA + deB);
  });

  it('diz quanto vai para cada evento, na ordem da data', () => {
    const p = juntas.itens.find((i) => i.nome === 'Picanha')!;
    expect(p.porEvento.map((x) => x.cliente)).toEqual(['Beltrano', 'Fulana']);
  });

  it('o mesmo ingrediente em dois preparos do mesmo evento soma na parte daquele evento', () => {
    const alho = juntas.itens.filter((i) => i.nome === 'Alho');
    expect(alho).toHaveLength(1);
    expect(alho[0].porEvento).toHaveLength(2);
  });

  it('carvão, carne crua e custo vêm somados', () => {
    const ra = calcular(a);
    const rb = calcular(b);
    expect(juntas.carvaoKg).toBe(ra.carvaoKg + rb.carvaoKg);
    expect(juntas.carneCruaKg).toBeCloseTo(ra.carneCrua + rb.carneCrua, 9);
    expect(juntas.custoTotal).toBeCloseTo(ra.custoItens + ra.custoCarvao + rb.custoItens + rb.custoCarvao, 6);
  });

  it('evento fechado por fora não tem cardápio e fica de fora da soma', () => {
    const fora = { ...eventoExterno({ cliente: 'De fora', data: '2026-11-10', convidados: 80, valor: 5000 }), id: 'c' };
    expect(juntarCompras([a, fora]).eventos.map((e) => e.id)).toEqual(['a']);
  });

  it('categorias na ordem do mercado: carnes primeiro', () => {
    expect(juntas.porCategoria.map(([c]) => c)).toEqual(['Carnes', 'Guarnições']);
  });

  it('mesmo nome em unidades diferentes não soma', () => {
    const baconKg = item('b1', 'Bacon', 'Farofa');
    const baconPacote = item('b2', 'Bacon', 'Carreteiro', { unidade: 'un', porPessoa: 0.05 });
    const r = juntarCompras([evento('x', 'X', '2026-11-01', 20, [baconKg, baconPacote])]);
    expect(r.itens.filter((i) => i.nome === 'Bacon')).toHaveLength(2);
  });
});
