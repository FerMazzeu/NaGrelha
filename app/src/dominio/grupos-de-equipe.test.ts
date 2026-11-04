import { describe, expect, it } from 'vitest';
import { aplicarGrupo, itensDoGrupo } from './grupos-de-equipe';
import type { Servico, ServicoDoEvento } from './tipos';

const servico = (id: string, nome: string, valorPadrao: number, extra: Partial<Servico> = {}): Servico => ({
  id,
  nome,
  papel: 'equipe',
  valorPadrao,
  usaFaixa: false,
  faixas: [],
  percentual: 0,
  ...extra,
});

const CATALOGO = [
  servico('chu', 'Churrasqueiro', 600, { usaFaixa: true, faixas: [{ min: 0, max: 50, valor: 500, tipo: null }] }),
  servico('gar', 'Garçom', 200),
  servico('das', 'Imposto (DAS)', 0, { papel: 'imposto', percentual: 7 }),
];

const GRUPO = {
  id: 'g',
  nome: 'Até 50 pessoas',
  itens: [
    { servicoId: 'chu', quantidade: 1 },
    { servicoId: 'gar', quantidade: 3 },
    { servicoId: 'das', quantidade: 1 },
    { servicoId: 'saiu', quantidade: 1 },
  ],
};

const novoId = (s: Servico) => `novo-${s.id}`;

describe('grupo de equipe', () => {
  it('põe os serviços que faltam, com o valor da tabela e a quantidade do grupo', () => {
    const linhas = aplicarGrupo([], GRUPO, CATALOGO, 40, null, novoId);

    expect(linhas.map((l) => [l.nome, l.quantidade, l.valor, l.percentual])).toEqual([
      ['Churrasqueiro', 1, 500, 0],
      ['Garçom', 3, 200, 0],
      ['Imposto (DAS)', 1, 0, 7],
    ]);
  });

  it('serviço que já está no orçamento só muda a quantidade, e o valor digitado fica', () => {
    const garcom: ServicoDoEvento = {
      id: 'x',
      servicoId: 'gar',
      nome: 'Garçom',
      papel: 'equipe',
      pessoa: 'João',
      quantidade: 1,
      valor: 180,
      percentual: 0,
      valorManual: true,
    };
    const linhas = aplicarGrupo([garcom], GRUPO, CATALOGO, 40, null, novoId);

    expect(linhas.filter((l) => l.servicoId === 'gar')).toEqual([{ ...garcom, quantidade: 3 }]);
    expect(linhas).toHaveLength(3);
  });

  it('salvar como grupo leva serviço e quantidade, e deixa de fora a linha sem serviço do catálogo', () => {
    const linhas = aplicarGrupo([], GRUPO, CATALOGO, 40, null, novoId);
    const avulsa = { ...linhas[0], id: 'a', servicoId: null, nome: 'Fotógrafo' };

    expect(itensDoGrupo([...linhas, avulsa])).toEqual([
      { servicoId: 'chu', quantidade: 1 },
      { servicoId: 'gar', quantidade: 3 },
      { servicoId: 'das', quantidade: 1 },
    ]);
  });
});
