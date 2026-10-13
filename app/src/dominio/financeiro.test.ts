import { describe, expect, it } from 'vitest';
import { eventoExterno } from './evento-externo';
import {
  aPagar,
  extrato,
  lancamentoNovo,
  porMes,
  recebiveis,
  repetirMensal,
  resultadoPorEvento,
  resultadoPorGrupo,
  resumir,
  saldos,
  ultimosMeses,
  type Categoria,
  type Conta,
  type Lancamento,
} from './financeiro';
import type { Escala, Membro, Orcamento } from './tipos';

/* Valores e nomes inventados: o repositório é público. */

const HOJE = '2026-10-13';

const banco: Conta = { id: 'banco', nome: 'Banco', tipo: 'banco', saldoInicial: 1000, saldoInicialEm: '2026-10-01', ativo: true };
const especie: Conta = { id: 'especie', nome: 'Espécie', tipo: 'especie', saldoInicial: 200, saldoInicialEm: '2026-10-01', ativo: true };
const contas = [banco, especie];

const categorias: Categoria[] = [
  { id: 'evento', nome: 'Pagamento de evento', tipo: 'entrada', grupo: 'receita', ativo: true },
  { id: 'insumos', nome: 'Insumos', tipo: 'saida', grupo: 'custo_evento', ativo: true },
  { id: 'prolabore', nome: 'Pró-labore', tipo: 'saida', grupo: 'prolabore', ativo: true },
  { id: 'cache', nome: 'Cachê', tipo: 'saida', grupo: 'equipe', ativo: true },
];

let seq = 0;
const l = (p: Partial<Lancamento>): Lancamento =>
  lancamentoNovo('entrada', { id: `l${++seq}`, contaId: 'banco', vencimento: HOJE, pagoEm: HOJE, valor: 100, ...p });

const evento = (cliente: string, data: string, valor: number, situacao: Orcamento['situacao'] = 'confirmado') => ({
  ...eventoExterno({ cliente, data, valor, convidados: 50, situacao }),
  id: cliente,
});

describe('saldos', () => {
  it('saldo inicial mais o que entrou menos o que saiu, por conta', () => {
    const r = saldos(contas, [
      l({ tipo: 'entrada', valor: 500, pagoEm: '2026-10-05' }),
      l({ tipo: 'saida', valor: 120.5, pagoEm: '2026-10-06' }),
      l({ tipo: 'saida', valor: 50, contaId: 'especie', pagoEm: '2026-10-06' }),
    ]);
    expect(r.map((x) => x.saldo)).toEqual([1379.5, 150]);
  });

  it('o que foi pago antes do saldo inicial já está nele e não soma de novo', () => {
    const r = saldos(contas, [l({ tipo: 'entrada', valor: 999, pagoEm: '2026-09-30' })]);
    expect(r[0].saldo).toBe(1000);
  });

  it('previsto não mexe no saldo', () => {
    expect(saldos(contas, [l({ tipo: 'saida', valor: 300, pagoEm: '' })])[0].saldo).toBe(1000);
  });

  it('transferência sai de uma e entra na outra; o total não muda', () => {
    const r = saldos(contas, [l({ tipo: 'transferencia', valor: 300, contaId: 'banco', contaDestinoId: 'especie' })]);
    expect(r.map((x) => x.saldo)).toEqual([700, 500]);
  });
});

describe('extrato', () => {
  const lancamentos = [
    l({ id: 'a', tipo: 'entrada', valor: 500, pagoEm: '2026-10-05' }),
    l({ id: 'b', tipo: 'saida', valor: 100, pagoEm: '2026-10-20' }),
    l({ id: 'c', tipo: 'transferencia', valor: 50, contaDestinoId: 'especie', pagoEm: '2026-10-21' }),
  ];

  it('de uma conta, com saldo andando e o saldo anterior ao período', () => {
    const r = extrato(contas, lancamentos, 'banco', '2026-10-10', '2026-10-31');
    expect(r.saldoAnterior).toBe(1500);
    expect(r.linhas.map((x) => [x.lancamento.id, x.efeito, x.saldo])).toEqual([
      ['b', -100, 1400],
      ['c', -50, 1350],
    ]);
    expect(r.saldoFinal).toBe(1350);
  });

  it('de todas, a transferência aparece mas não muda o total', () => {
    const r = extrato(contas, lancamentos, null, '2026-10-01', '2026-10-31');
    expect(r.saldoAnterior).toBe(0);
    expect(r.linhas.map((x) => x.efeito)).toEqual([500, -100, 0]);
    expect(r.saldoFinal).toBe(1600);
  });
});

describe('a receber', () => {
  it('o valor é o do evento, o recebido são as entradas ligadas a ele', () => {
    const e = evento('Fulana', '2026-11-20', 5000);
    const [r] = recebiveis([e], [l({ eventoId: e.id, valor: 1000 }), l({ eventoId: e.id, valor: 500, pagoEm: '' })], HOJE);
    expect(r).toMatchObject({ total: 5000, recebido: 1000, previsto: 500, restante: 4000, situacao: 'parcial', vencimento: '2026-11-16', atrasado: false });
  });

  it('atrasa quatro dias antes da festa, e quitado não atrasa', () => {
    const e = evento('Beltrano', '2026-10-15', 2000);
    expect(recebiveis([e], [], HOJE)[0].atrasado).toBe(true);
    expect(recebiveis([e], [l({ eventoId: e.id, valor: 2000 })], HOJE)[0]).toMatchObject({ situacao: 'quitado', atrasado: false });
  });

  it('orçamento ainda não fechado e evento perdido não são dinheiro', () => {
    expect(recebiveis([evento('A', '2026-11-01', 1, 'orcado'), evento('B', '2026-11-01', 1, 'perdido')], [], HOJE)).toEqual([]);
  });
});

describe('a pagar', () => {
  const e = evento('Fulana', '2026-11-20', 5000);
  const escala: Escala = { id: 'x', eventoId: e.id, membroId: 'm1', funcao: 'Garçom', cache: 220, confirmado: true };
  const membros: Membro[] = [{ id: 'm1', nome: 'Fulano', funcao: 'Garçom', telefone: '', cachePadrao: 220, ativo: true }];

  it('junta saída prevista e cachê da escala ainda não pago', () => {
    const r = aPagar([l({ tipo: 'saida', valor: 80, pagoEm: '', vencimento: '2026-10-10' })], [escala], membros, [e], HOJE);
    expect(r.map((x) => [x.origem, x.valor, x.atrasado])).toEqual([
      ['lancamento', 80, true],
      ['cache', 220, false],
    ]);
  });

  it('cachê pago ao membro naquele evento some da lista', () => {
    const r = aPagar([l({ tipo: 'saida', valor: 220, eventoId: e.id, membroId: 'm1' })], [escala], membros, [e], HOJE);
    expect(r).toEqual([]);
  });
});

describe('resumo e caixa livre', () => {
  it('o recebido de evento que ainda vai acontecer é adiantamento, e sai do caixa livre', () => {
    const futuro = evento('Futuro', '2027-05-22', 15000);
    const passado = evento('Passado', '2026-09-01', 3000, 'realizado');
    const r = resumir(
      contas,
      [
        l({ eventoId: futuro.id, valor: 2000 }),
        l({ eventoId: passado.id, valor: 3000 }),
        l({ tipo: 'saida', valor: 400, pagoEm: '' }),
        // Pró-labore do evento futuro: sai do adiantamento, não do caixa livre.
        l({ tipo: 'saida', valor: 900, pagoEm: '', eventoId: futuro.id, vencimento: '2027-05-22' }),
      ],
      [futuro, passado],
      [],
      [],
      HOJE,
    );
    expect(r.saldoTotal).toBe(6200);
    expect(r.adiantado).toBe(2000);
    expect(r.aPagar).toBe(1300);
    expect(r.caixaLivre).toBe(3800);
    expect(r.aReceber).toBe(13000);
  });
});

describe('resultado', () => {
  it('por mês, sem contar transferência', () => {
    const r = porMes(
      [l({ valor: 300, pagoEm: '2026-09-02' }), l({ tipo: 'saida', valor: 100, pagoEm: '2026-09-03' }), l({ tipo: 'transferencia', contaDestinoId: 'especie', pagoEm: '2026-09-04' })],
      ['2026-09'],
    );
    expect(r).toEqual([{ mes: '2026-09', entradas: 300, saidas: 100, resultado: 200 }]);
  });

  it('últimos meses atravessam a virada do ano', () => {
    expect(ultimosMeses(3, '2027-01-15')).toEqual(['2026-11', '2026-12', '2027-01']);
  });

  it('por grupo, e o sem categoria não some', () => {
    const r = resultadoPorGrupo(
      [l({ valor: 1000, categoriaId: 'evento' }), l({ tipo: 'saida', valor: 300, categoriaId: 'insumos' }), l({ tipo: 'saida', valor: 50 })],
      categorias,
      '2026-10-01',
      '2026-10-31',
    );
    expect(r.grupos.map((g) => g.grupo)).toEqual(['receita', 'custo_evento', 'outros']);
    expect(r.resultado).toBe(650);
  });

  it('por evento, com o pró-labore de cada sócio separado do custo', () => {
    const e = evento('Fulana', '2026-11-20', 5000);
    const [r] = resultadoPorEvento(
      [e],
      [
        l({ eventoId: e.id, valor: 1000 }),
        l({ tipo: 'saida', eventoId: e.id, valor: 800, categoriaId: 'prolabore', pessoa: 'Sócio A' }),
        l({ tipo: 'saida', eventoId: e.id, valor: 600, categoriaId: 'prolabore', pessoa: 'Sócio B', pagoEm: '' }),
        l({ tipo: 'saida', eventoId: e.id, valor: 1500, categoriaId: 'insumos' }),
      ],
      categorias,
      '2026',
    );
    expect(r).toMatchObject({ total: 5000, recebido: 1000, restante: 4000, custos: 1500, sobra: 2100 });
    expect(r.prolabore).toEqual([
      { pessoa: 'Sócio A', valor: 800 },
      { pessoa: 'Sócio B', valor: 600 },
    ]);
  });
});

describe('repetir mensal', () => {
  it('gera as parcelas previstas, e dia 31 cai no fim de fevereiro', () => {
    const r = repetirMensal(l({ tipo: 'saida', descricao: 'Contador', vencimento: '2027-01-31', pagoEm: '2027-01-31' }), 3);
    expect(r.map((x) => [x.descricao, x.vencimento, x.pagoEm])).toEqual([
      ['Contador (1/3)', '2027-01-31', '2027-01-31'],
      ['Contador (2/3)', '2027-02-28', ''],
      ['Contador (3/3)', '2027-03-31', ''],
    ]);
  });
});
