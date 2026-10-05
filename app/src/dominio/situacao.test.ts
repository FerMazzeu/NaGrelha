import { describe, expect, it } from 'vitest';
import { separarPorSituacao } from './situacao';
import type { Orcamento, Situacao } from './tipos';

const faz = (cliente: string, situacao: Situacao, data = '') => ({ id: cliente, cliente, situacao, data }) as Orcamento;

describe('lista de orçamentos separada por situação', () => {
  it('o confirmado não se perde no meio dos orçados', () => {
    // O caso do print do Alan: um único confirmado no meio de seis orçados.
    // Nomes inventados: o repositório é público, e cliente dele não é assunto daqui.
    const blocos = separarPorSituacao([
      faz('Fulana', 'orcado', '2026-10-28'),
      faz('Ana', 'orcado', '2027-10-27'),
      faz('Beltrana', 'confirmado', '2026-10-10'),
      faz('Sicrana', 'orcado'),
    ]);

    expect(blocos.map((b) => b.situacao)).toEqual(['confirmado', 'orcado']);
    expect(blocos[0].orcamentos.map((o) => o.cliente)).toEqual(['Beltrana']);
  });

  it('o pedido do link vem antes de tudo, porque é o que pede ação', () => {
    const blocos = separarPorSituacao([faz('A', 'confirmado'), faz('B', 'rascunho'), faz('C', 'orcado')]);

    expect(blocos.map((b) => b.situacao)).toEqual(['rascunho', 'confirmado', 'orcado']);
  });

  it('o que vai acontecer sai do mais próximo para o mais longe', () => {
    const [orcados] = separarPorSituacao([
      faz('Novembro', 'orcado', '2026-11-20'),
      faz('Outubro', 'orcado', '2026-10-24'),
      faz('Ano que vem', 'orcado', '2027-10-27'),
    ]);

    expect(orcados.orcamentos.map((o) => o.cliente)).toEqual(['Outubro', 'Novembro', 'Ano que vem']);
  });

  it('sem data vai para o fim, e não para o topo', () => {
    const [orcados] = separarPorSituacao([faz('Sicrana', 'orcado'), faz('Ciclana', 'orcado', '2026-10-24')]);

    expect(orcados.orcamentos.map((o) => o.cliente)).toEqual(['Ciclana', 'Sicrana']);
  });

  it('o histórico sai do mais recente para o mais antigo', () => {
    const [feitos] = separarPorSituacao([
      faz('Antigo', 'realizado', '2026-01-10'),
      faz('Recente', 'realizado', '2026-09-30'),
    ]);

    expect(feitos.orcamentos.map((o) => o.cliente)).toEqual(['Recente', 'Antigo']);
  });

  it('bloco vazio não aparece', () => {
    expect(separarPorSituacao([faz('A', 'orcado')]).map((b) => b.situacao)).toEqual(['orcado']);
  });
});
