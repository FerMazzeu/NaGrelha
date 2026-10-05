import {
  pedidoParaOrcamento,
  type CriancasDoPedido,
  type ItemPublico,
  type Pedido,
} from '../dominio/cardapio-do-cliente';
import type { Categoria, FaixaEtaria, Item, Orcamento, Servico, TipoDeEvento } from '../dominio/tipos';
import { supabase } from '../integrations/supabase/client';

/**
 * O pedido que o cliente monta pelo link.
 *
 * Duas pontas na mesma porta:
 *
 * - o cliente, SEM login, lê o cardápio sem preço e grava um pedido;
 * - a equipe, logada, pega os pedidos novos e transforma em orçamento.
 *
 * Toda a proteção está no banco (ver supabase/sql/006): sem login dá para
 * chamar as duas funções públicas e inserir em `pedidos`, e mais nada.
 */

// --------------------------------------------------------------- o cliente --

export type FaixaPublica = { id: string; nome: string; idadeMin: number; idadeMax: number | null };

export async function lerCardapioPublico(): Promise<ItemPublico[]> {
  const { data, error } = await supabase.rpc('cardapio_publico');
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((i) => ({
    id: String(i.id),
    nome: String(i.nome),
    grupo: String(i.grupo ?? ''),
    categoria: i.categoria as Categoria,
    ordem: Number(i.ordem ?? 0),
  }));
}

export async function lerFaixasPublicas(): Promise<FaixaPublica[]> {
  const { data, error } = await supabase.rpc('faixas_publicas');
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((f) => ({
    id: String(f.id),
    nome: String(f.nome),
    idadeMin: Number(f.idade_min),
    idadeMax: f.idade_max === null || f.idade_max === undefined ? null : Number(f.idade_max),
  }));
}

export type PedidoNovo = {
  cliente: string;
  contato: string;
  tipoEvento: TipoDeEvento;
  data: string;
  hora: string;
  local: string;
  adultos: number;
  criancas: CriancasDoPedido;
  observacoes: string;
  itens: string[];
};

export async function enviarPedido(p: PedidoNovo) {
  /*
    Sem `.select()` depois do insert, de propósito.

    Quem está de fora pode escrever e não pode ler. Pedir a linha de volta é
    uma leitura, e a RLS recusa o insert inteiro por causa dela: o cliente
    veria "erro" num pedido que, sem o select, teria entrado.
  */
  const { error } = await supabase.from('pedidos').insert({
    cliente: p.cliente.trim(),
    contato: p.contato.trim(),
    tipo_evento: p.tipoEvento,
    data: p.data || null,
    hora: p.hora,
    local: p.local.trim(),
    adultos: p.adultos,
    criancas: p.criancas
      .filter((c) => c.quantidade > 0)
      .map((c) => ({ faixa_id: c.faixaId, quantidade: c.quantidade })),
    observacoes: p.observacoes.trim(),
    itens: [...new Set(p.itens)],
  });
  if (error) throw error;
}

// ---------------------------------------------------------------- a equipe --

/** Reserva vencida: o app que reservou caiu no meio, e outro pode assumir. */
const RESERVA_VENCE_EM_MS = 10 * 60 * 1000;

function paraPedido(l: Record<string, unknown>): Pedido {
  return {
    id: String(l.id),
    cliente: String(l.cliente ?? ''),
    contato: String(l.contato ?? ''),
    tipoEvento: l.tipo_evento === 'casamento' ? 'casamento' : 'aniversario',
    data: (l.data as string | null) ?? null,
    hora: String(l.hora ?? ''),
    local: String(l.local ?? ''),
    adultos: Number(l.adultos ?? 0),
    criancas: ((l.criancas as { faixa_id: string; quantidade: number }[] | null) ?? []).map((c) => ({
      faixaId: String(c.faixa_id),
      quantidade: Number(c.quantidade),
    })),
    observacoes: String(l.observacoes ?? ''),
    itens: ((l.itens as string[] | null) ?? []).map(String),
    criadoEm: String(l.criado_em ?? new Date().toISOString()),
  };
}

/**
 * Transforma em rascunho todo pedido que ainda não virou orçamento.
 *
 * Roda quando alguém da equipe abre o app. Dois cuidados:
 *
 * 1. RESERVA ANTES DE CRIAR. O Alan e a Érica podem abrir o app no mesmo
 *    minuto. Sem reserva, os dois veem o pedido novo e os dois criam o
 *    orçamento: rascunho em dobro. O `update ... where estado = 'novo'` só
 *    passa para um deles, porque o banco reavalia a condição de quem chegou
 *    depois.
 *
 * 2. NUNCA DERRUBA O APP. Se a tabela de pedidos ainda não existe, ou a rede
 *    falhou, o app abre normalmente com os orçamentos que já tem. Pedido que
 *    falhou fica para a próxima abertura.
 */
export async function converterPedidosPendentes(deps: {
  catalogo: Item[];
  servicos: Servico[];
  faixas: FaixaEtaria[];
  salvar: (o: Orcamento) => Promise<void>;
}): Promise<Orcamento[]> {
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .neq('estado', 'convertido')
    .order('criado_em');

  if (error) {
    // Tabela que não existe ainda é o caso esperado até a migração 006 rodar.
    console.warn('pedidos pelo link indisponíveis:', error.message);
    return [];
  }

  const criados: Orcamento[] = [];
  const vencida = new Date(Date.now() - RESERVA_VENCE_EM_MS).toISOString();

  for (const linha of (data ?? []) as Record<string, unknown>[]) {
    const pedido = paraPedido(linha);
    // Pedido sem prato não é pedido. O banco deveria recusar, e por um tempo
    // não recusou (ver a regra `pedido_tem_item` na migração 006): sem esta
    // linha, um teste vazio virava rascunho na lista do Alan.
    if (!pedido.itens.length) continue;
    try {
      const { data: reservado } = await supabase
        .from('pedidos')
        .update({ estado: 'convertendo', reservado_em: new Date().toISOString() })
        .eq('id', pedido.id)
        .or(`estado.eq.novo,and(estado.eq.convertendo,reservado_em.lt.${vencida})`)
        .select('id');
      if (!reservado?.length) continue;

      const orcamento = pedidoParaOrcamento(pedido, deps.catalogo, deps.servicos, deps.faixas);
      try {
        await deps.salvar(orcamento);
      } catch (e) {
        // O orçamento não entrou: devolve o pedido para a fila, senão ele
        // fica preso em "convertendo" até a reserva vencer.
        console.warn('pedido não convertido, fica para depois:', pedido.id, e);
        await supabase.from('pedidos').update({ estado: 'novo', reservado_em: null }).eq('id', pedido.id);
        continue;
      }

      // Daqui em diante o orçamento JÁ existe. Devolver o pedido para a fila
      // agora criaria um segundo rascunho no próximo login, então uma falha
      // aqui só é tentada de novo, nunca desfeita.
      criados.push(orcamento);
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        const { error: e } = await supabase
          .from('pedidos')
          .update({ estado: 'convertido', evento_id: orcamento.id })
          .eq('id', pedido.id);
        if (!e) break;
      }
    } catch (e) {
      console.warn('pedido não reservado, fica para depois:', pedido.id, e);
    }
  }

  return criados;
}
