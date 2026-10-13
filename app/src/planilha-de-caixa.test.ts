import { describe, expect, it } from 'vitest';
import { eventoExterno } from './dominio/evento-externo';
import { saldos, type Categoria, type Conta } from './dominio/financeiro';
import { lerCaixa, pendenciasDaImportacao, planejarImportacao } from './planilha-de-caixa';

/*
  O formato da planilha "CONTROLE CAIXA" do Alan, célula por célula: título,
  cabeçalho na linha 4, uma linha por evento, total, e o bloco de dinheiro em
  caixa embaixo. Nomes e valores inventados: o repositório é público.
*/
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

const ABA_2026: unknown[][] = [
  [],
  [null, 'CONTROLE DE CAIXA', 'CONTROLE DE CAIXA'],
  [null, 'EVENTO CONFIRMADO', 'EVENTO CONFIRMADO'],
  [null, null, 'NOMES', 'DATA EVENTO ', 'VALOR TOTAL ', 'VALOR DA ENTRADA ', 'VALOR RESTANTE ', 'STATUS', null, 'ALAN', 'ERICA'],
  [null, 1, 'FULANA', d('2026-03-07'), 5000, 0, 0, 'REALIZADO', null, 600, 500],
  [null, 2, 'BELTRANO', d('2026-09-06'), 9000, 1000, { formula: 'E6-F6', result: 8000 }, null, null, 900, 700, 1],
  [null, 3, null, d('2026-09-12'), 0, 0, 0, null, null, 0, 0],
  [null, 4, null, d('2026-09-19'), 0, 0, 0, null, null, 900, 700],
  [null, 5, 'CICLANA', d('2026-12-12'), 6000, 1000, 0, null, null, 1000, 800],
  [null, 6, 'SEM VALOR', d('2026-05-16'), 0, 0, 0, 'REALIZADO', null, 0, 0],
  [],
  [null, 'TOTAL DE VALORES ', 'TOTAL DE VALORES ', null, { formula: 'SUM()', result: 20000 }],
  [null, 'A RECEBER', 'A RECEBER', null, { formula: 'x', result: 13000 }],
  [null, null, 'DINHEIRO EM CAIXA ', 'DINHEIRO EM CAIXA '],
  [null, null, 'BANCO ', 12000.5],
  [null, null, 'DINHEIRO EM ESPECIE', 3000],
  [null, null, 'INVESTIDO', { formula: 'x', result: 4000 }],
  [null, null, 'BASF', 1000],
];

const ABA_2025: unknown[][] = [
  [],
  [null, 'CONTROLE DE CAIXA'],
  [null, null, 'NOMES', 'DATA EVENTO ', 'VALOR TOTAL ', 'VALOR DA ENTRADA ', 'VALOR RESTANTE ', 'STATUS', null, 'ALAN', 'ERICA'],
  // Restante vazio e status "ok": as abas antigas não preenchiam a coluna.
  [null, 1, 'ANTIGA', d('2025-11-08'), 2500, 0, null, 'ok', null, 500, 500],
  [null, null, null, null, null, null, null, null, null, { formula: 'SUM()', result: 500 }, { formula: 'SUM()', result: 500 }],
  [null, null, 'DINHEIRO EM CAIXA '],
  [null, null, 'BANCO C6', 0],
  [null, null, 'DINHEIRO EM ESPECIE', 9999],
];

const lido = lerCaixa([
  { nome: 'CAIXA 2025', linhas: ABA_2025 },
  { nome: 'CAIXA 2026', linhas: ABA_2026 },
]);

describe('lerCaixa', () => {
  it('lê os eventos de todas as abas, com a coluna de cada sócio', () => {
    expect(lido.linhas.map((l) => l.cliente)).toEqual(['ANTIGA', 'FULANA', 'BELTRANO', 'CICLANA']);
    expect(lido.linhas[2]).toMatchObject({
      data: '2026-09-06',
      total: 9000,
      entrada: 1000,
      restante: 8000,
      socios: [
        { pessoa: 'Alan', valor: 900 },
        { pessoa: 'Érica', valor: 700 },
      ],
    });
  });

  it('o resumo de baixo ("A RECEBER", "BASF") não vira evento', () => {
    expect(lido.linhas.some((l) => /receber|basf|total/i.test(l.cliente))).toBe(false);
  });

  it('avisa linha com valor e sem cliente; semana vazia e subtotal passam quietos', () => {
    expect(lido.ignoradas).toEqual([
      { onde: 'aba "CAIXA 2026", linha 8', motivo: 'tem valor mas não tem nome de cliente' },
      { onde: 'aba "CAIXA 2026", linha 10', motivo: 'SEM VALOR: sem valor nenhum' },
    ]);
  });

  it('o dinheiro em caixa vem da aba do ano mais alto', () => {
    expect(lido.saldos).toEqual({ banco: 12000.5, especie: 3000, investido: 4000, aba: 'CAIXA 2026' });
  });
});

describe('planejarImportacao', () => {
  const HOJE = '2026-10-13';
  const banco: Conta = { id: 'banco', nome: 'Banco', tipo: 'banco', saldoInicial: 12000.5, saldoInicialEm: HOJE, ativo: true };
  const categorias: Categoria[] = [
    { id: 'rec', nome: 'Pagamento de evento', tipo: 'entrada', grupo: 'receita', ativo: true },
    { id: 'pl', nome: 'Pró-labore', tipo: 'saida', grupo: 'prolabore', ativo: true },
  ];
  const plano = planejarImportacao(lido, [], [], banco, categorias, HOJE, HOJE);
  const de = (cliente: string) => plano.find((p) => p.origem.cliente === cliente)!;

  it('evento que passou com restante zerado foi pago inteiro', () => {
    const p = de('FULANA');
    expect(p.novo).toMatchObject({ situacao: 'realizado', valorFechado: 5000 });
    expect(p.lancamentos.find((l) => l.tipo === 'entrada')).toMatchObject({ valor: 5000, pagoEm: '2026-03-07', eventoId: p.novo!.id });
  });

  it('restante vazio com status ok também é quitado', () => {
    expect(de('ANTIGA').lancamentos.find((l) => l.tipo === 'entrada')?.valor).toBe(2500);
  });

  it('com restante em aberto, só a entrada foi recebida', () => {
    expect(de('BELTRANO').lancamentos.find((l) => l.tipo === 'entrada')?.valor).toBe(1000);
  });

  it('evento futuro: a entrada fica na véspera do controle, e o pró-labore fica previsto', () => {
    const p = de('CICLANA');
    expect(p.novo?.situacao).toBe('confirmado');
    expect(p.lancamentos.map((l) => [l.tipo, l.valor, l.pagoEm, l.pessoa])).toEqual([
      ['entrada', 1000, '2026-10-12', ''],
      ['saida', 1000, '', 'Alan'],
      ['saida', 800, '', 'Érica'],
    ]);
  });

  it('nada importado mexe no saldo de hoje', () => {
    const todos = plano.flatMap((p) => p.lancamentos);
    expect(saldos([banco], todos)[0].saldo).toBe(12000.5);
  });

  it('evento que já está no app casa pela data e pelo começo do nome, e não duplica', () => {
    const noApp = { ...eventoExterno({ cliente: 'Ciclanaa', data: '2026-12-12', convidados: 80, valor: 6000 }), id: 'ja' };
    const [p] = planejarImportacao({ ...lido, linhas: [de('CICLANA').origem] }, [noApp], [], banco, categorias, HOJE, HOJE);
    expect(p.existente?.id).toBe('ja');
    expect(p.novo).toBeNull();
    expect(p.lancamentos.every((l) => l.eventoId === 'ja')).toBe(true);
  });

  it('subir de novo não repete recebimento nem pró-labore', () => {
    const jaLancados = plano.flatMap((p) => p.lancamentos.map((l) => ({ ...l, id: 'x' })));
    const eventos = plano.map((p) => p.novo!);
    const outra = planejarImportacao(lido, eventos, jaLancados, banco, categorias, HOJE, HOJE);
    expect(outra.every((p) => !p.novo && !p.lancamentos.length)).toBe(true);
  });
});

describe('pendências da importação', () => {
  it('vira lista o que só o Alan sabe responder', () => {
    const HOJE = '2026-10-13';
    const banco: Conta = { id: 'banco', nome: 'Banco', tipo: 'banco', saldoInicial: 0, saldoInicialEm: HOJE, ativo: true };
    const plano = planejarImportacao(lido, [], [], banco, [], HOJE, HOJE);
    const titulos = pendenciasDaImportacao(lido, plano, 'caixa.xlsx', HOJE).map((p) => p.titulo);
    expect(titulos).toEqual([
      'Conferir os saldos das contas com o extrato',
      'O que é "BASF" (R$\u00a01.000,00)?',
      'O que marca a coluna L da aba "CAIXA 2026"?',
      'BELTRANO (06/09/2026) pagou o restante?',
      'Ficou de fora: tem valor mas não tem nome de cliente',
      'Ficou de fora: SEM VALOR: sem valor nenhum',
    ]);
  });
});
