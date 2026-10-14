import { MODELO_DO_CONTRATO, type ConteudoDoContrato, type QuemFornece } from '../../supabase/functions/_shared/contrato';
import { totalDeConvidados } from './calculo';
import { montarCardapio } from './cardapio-do-cliente';
import { CONTATO_DUVIDAS } from './condicoes';
import { precoDoEvento } from './evento-externo';
import type { Orcamento, Resultado } from './tipos';

/** Os dados do buffet que vão no contrato. Os mesmos do contrato que o Alan já usava. */
export const CONTRATADA = {
  nome: 'BUFFET NA GRELHA, COM ALAN XAVIER',
  cnpj: '57.785.536/0001-87',
  endereco: 'Rua Dr. Edmundo de Almeida, nº 54',
  telefone: CONTATO_DUVIDAS.telefone,
};

export const FORO = 'Três Corações - MG';
export const VALOR_AVARIA = 10;

/** O que quem gera o link escolhe para cada contrato. */
export type OpcoesDoContrato = {
  descricao: string;
  carnes: QuemFornece;
  bebidas: QuemFornece;
  valorEntrada: number;
  incluiEstrutura: boolean;
};

/**
 * O ponto de partida das opções, a partir do orçamento.
 *
 * Bebida pelo buffet só quando o orçamento tem bebida marcada (o chopp, por
 * exemplo); senão vale a cláusula do modelo do Alan, que exclui bebidas.
 */
export function opcoesIniciais(o: Orcamento, r: Resultado): OpcoesDoContrato {
  return {
    descricao: o.tipoEvento === 'casamento' ? 'Casamento' : 'Aniversário',
    carnes: 'buffet',
    bebidas: r.linhas.some((l) => l.item.categoria === 'bebida') ? 'buffet' : 'contratante',
    valorEntrada: 0,
    incluiEstrutura: r.linhas.some((l) => l.item.categoria === 'estrutura') || !r.linhas.length,
  };
}

/**
 * O orçamento congelado no formato do contrato.
 *
 * O cardápio é o mesmo que o cliente viu na proposta (montarCardapio), e não
 * a lista de compras: "Pão de alho", e não "Pão francês, mussarela, pasta".
 */
export function conteudoDoContrato(
  o: Orcamento,
  r: Resultado,
  opcoes: OpcoesDoContrato,
  representante: string,
): ConteudoDoContrato {
  const secoes = montarCardapio(
    r.linhas.map((l, ordem) => ({
      id: l.item.id,
      nome: l.item.nome,
      grupo: l.item.grupo,
      categoria: l.item.categoria,
      ordem,
    })),
  );
  const criancas = o.faixas.reduce((s, f) => s + Math.max(0, f.quantidade), 0);
  return {
    modelo: MODELO_DO_CONTRATO,
    contratada: CONTRATADA,
    representante,
    evento: {
      descricao: opcoes.descricao.trim() || 'Evento',
      data: o.data,
      hora: o.hora,
      local: o.local.trim(),
      duracaoHoras: o.duracaoHoras,
      // Evento de fora não tem faixas: o total vai todo como adulto.
      adultos: criancas ? o.adultos : totalDeConvidados(o),
      criancas,
    },
    cardapio: secoes.map((s) => ({ titulo: s.titulo, itens: s.pratos.map((p) => p.nome) })),
    incluiEstrutura: opcoes.incluiEstrutura,
    carnes: opcoes.carnes,
    bebidas: opcoes.bebidas,
    valorTotal: Math.round(precoDoEvento(o, r) * 100) / 100,
    valorEntrada: Math.max(0, opcoes.valorEntrada),
    valorAvaria: VALOR_AVARIA,
    foro: FORO,
  };
}
