import { valorSugerido } from './calculo';
import type { GrupoDeEquipe, Servico, ServicoDoEvento, TipoDeEvento } from './tipos';

/**
 * Põe o grupo no orçamento.
 *
 * Serviço que já está no orçamento fica com a linha dele (quem, valor digitado
 * à mão) e só passa a ter a quantidade do grupo. Serviço que falta entra com
 * o valor da tabela, como no botão "+ Garçom". Serviço que saiu do catálogo
 * depois que o grupo foi salvo não entra.
 */
export function aplicarGrupo(
  linhas: ServicoDoEvento[],
  grupo: GrupoDeEquipe,
  disponiveis: Servico[],
  convidados: number,
  tipo: TipoDeEvento | null,
  novoId: (s: Servico) => string,
): ServicoDoEvento[] {
  const resultado = [...linhas];
  for (const { servicoId, quantidade } of grupo.itens) {
    const s = disponiveis.find((d) => d.id === servicoId);
    if (!s) continue;
    const i = resultado.findIndex((l) => l.servicoId === servicoId);
    if (i >= 0) {
      resultado[i] = { ...resultado[i], quantidade };
      continue;
    }
    resultado.push({
      id: novoId(s),
      servicoId: s.id,
      nome: s.nome,
      papel: s.papel,
      pessoa: '',
      quantidade,
      valor: valorSugerido(s, convidados, tipo),
      percentual: s.percentual,
      valorManual: false,
    });
  }
  return resultado;
}

/** Os serviços do orçamento como itens de grupo. Linha digitada à mão, sem serviço do catálogo, fica de fora. */
export function itensDoGrupo(linhas: ServicoDoEvento[]): GrupoDeEquipe['itens'] {
  return linhas
    .filter((l): l is ServicoDoEvento & { servicoId: string } => !!l.servicoId)
    .map((l) => ({ servicoId: l.servicoId, quantidade: l.quantidade }));
}
