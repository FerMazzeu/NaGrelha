import type { Orcamento, Situacao } from './tipos';

/**
 * Os blocos da lista de orçamentos, na ordem em que a equipe precisa olhar.
 *
 * Antes era uma lista só, do mais mexido para o menos. O Alan não achava o
 * único evento confirmado no meio de seis propostas: ele estava lá,
 * com um "Confirmado" do mesmo tamanho e da mesma cor de "Orçado".
 *
 * A ordem é a do que pede ação primeiro:
 *
 * 1. o que o cliente mandou pelo link e ninguém conferiu ainda;
 * 2. o que está fechado, porque é evento que vai acontecer;
 * 3. o que está esperando resposta do cliente;
 * 4. histórico, que só se consulta.
 */
export const BLOCOS: { situacao: Situacao; titulo: string; dica: string; historico: boolean }[] = [
  {
    situacao: 'rascunho',
    titulo: 'Para validar',
    dica: 'O cliente montou pelo link. Confira o cardápio e o preço antes de mandar.',
    historico: false,
  },
  { situacao: 'confirmado', titulo: 'Confirmados', dica: 'Evento fechado.', historico: false },
  { situacao: 'orcado', titulo: 'Orçados', dica: 'Proposta enviada, esperando o cliente.', historico: false },
  { situacao: 'realizado', titulo: 'Realizados', dica: '', historico: true },
  { situacao: 'perdido', titulo: 'Perdidos', dica: '', historico: true },
];

/** Data do evento como número para ordenar. Sem data vai para o fim. */
const quando = (o: Orcamento) => (o.data ? Date.parse(`${o.data}T12:00:00`) : Number.POSITIVE_INFINITY);

/**
 * Separa e ordena.
 *
 * O que ainda vai acontecer sai do mais próximo para o mais longe: é a
 * pergunta "o que vem por aí". O histórico sai do mais recente para o mais
 * antigo, que é como se procura um evento que já passou.
 *
 * Sem data fica no fim em todos os blocos. É o orçamento que ainda precisa de
 * conversa, e no topo ele empurraria a semana que vem para baixo.
 */
export function separarPorSituacao(orcamentos: Orcamento[]) {
  return BLOCOS.map((bloco) => {
    const doBloco = orcamentos.filter((o) => o.situacao === bloco.situacao);
    doBloco.sort((a, b) => {
      const qa = quando(a);
      const qb = quando(b);
      if (qa === qb) return a.cliente.localeCompare(b.cliente, 'pt-BR');
      if (!Number.isFinite(qa)) return 1;
      if (!Number.isFinite(qb)) return -1;
      return bloco.historico ? qb - qa : qa - qb;
    });
    return { ...bloco, orcamentos: doBloco };
  }).filter((b) => b.orcamentos.length > 0);
}
