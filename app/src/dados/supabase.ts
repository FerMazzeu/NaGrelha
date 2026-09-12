import { supabase } from '../integrations/supabase/client';
import type { Apetite, Item, Orcamento, Situacao } from '../dominio/tipos';
import type { Repositorio } from './repositorio';

/**
 * Implementação em Supabase.
 *
 * O banco normaliza o que o domínio trata como um objeto só: o orçamento vira
 * `eventos` mais `evento_itens` mais `evento_custos`. Essa tradução mora aqui e
 * em nenhum outro lugar, e é por isso que `calculo.ts` e as telas não mudaram
 * uma linha quando o armazenamento trocou.
 */

type LinhaEvento = {
  id: string;
  cliente: string;
  contato: string;
  data: string | null;
  hora: string | null;
  local: string;
  observacoes: string;
  situacao: Situacao;
  adultos: number;
  criancas: number;
  apetite: Apetite;
  margem: number;
  fator_carvao: number;
  preco_carvao: number;
  criado_em: string;
  atualizado_em: string;
};

type LinhaItem = {
  id: string;
  item_id: string | null;
  nome: string;
  categoria: Item['categoria'];
  unidade: Item['unidade'];
  por_pessoa: number;
  rendimento: number;
  preco: number;
  selecionado: boolean;
  ordem: number;
};

type LinhaCusto = { id: string; descricao: string; valor: number };

function paraItem(l: LinhaItem): Item {
  return {
    // O id do domínio é o do catálogo quando existe, porque é ele que a
    // seleção referencia. Item apagado do catálogo sobrevive pelo id da linha.
    id: l.item_id ?? l.id,
    nome: l.nome,
    categoria: l.categoria,
    unidade: l.unidade,
    porPessoa: Number(l.por_pessoa),
    rendimento: Number(l.rendimento),
    preco: Number(l.preco),
  };
}

function montar(evento: LinhaEvento, itens: LinhaItem[], custos: LinhaCusto[]): Orcamento {
  const ordenados = [...itens].sort((a, b) => a.ordem - b.ordem);
  return {
    id: evento.id,
    cliente: evento.cliente,
    contato: evento.contato,
    data: evento.data ?? '',
    hora: evento.hora ? evento.hora.slice(0, 5) : '',
    local: evento.local,
    observacoes: evento.observacoes,
    situacao: evento.situacao,
    adultos: evento.adultos,
    criancas: evento.criancas,
    apetite: evento.apetite,
    itens: ordenados.map(paraItem),
    selecionados: ordenados.filter((l) => l.selecionado).map((l) => l.item_id ?? l.id),
    custosExtras: custos.map((c) => ({ id: c.id, descricao: c.descricao, valor: Number(c.valor) })),
    margem: Number(evento.margem),
    fatorCarvao: Number(evento.fator_carvao),
    precoCarvao: Number(evento.preco_carvao),
    criadoEm: evento.criado_em,
    atualizadoEm: evento.atualizado_em,
  };
}

/** Campo de data e hora vazios precisam virar null, senão o Postgres recusa. */
const ouNulo = (v: string) => (v && v.trim() ? v : null);

async function carregarPartes(ids: string[]) {
  if (!ids.length) return { itens: [] as (LinhaItem & { evento_id: string })[], custos: [] as (LinhaCusto & { evento_id: string })[] };

  const [{ data: itens }, { data: custos }] = await Promise.all([
    supabase.from('evento_itens').select('*').in('evento_id', ids),
    supabase.from('evento_custos').select('*').in('evento_id', ids),
  ]);

  return {
    itens: (itens ?? []) as (LinhaItem & { evento_id: string })[],
    custos: (custos ?? []) as (LinhaCusto & { evento_id: string })[],
  };
}

export const repositorioSupabase: Repositorio = {
  async listarOrcamentos() {
    const { data: eventos, error } = await supabase
      .from('eventos')
      .select('*')
      .order('atualizado_em', { ascending: false });
    if (error) throw error;

    const linhas = (eventos ?? []) as LinhaEvento[];
    const { itens, custos } = await carregarPartes(linhas.map((e) => e.id));

    return linhas.map((e) =>
      montar(
        e,
        itens.filter((i) => i.evento_id === e.id),
        custos.filter((c) => c.evento_id === e.id),
      ),
    );
  },

  async obterOrcamento(id) {
    const { data: evento } = await supabase.from('eventos').select('*').eq('id', id).maybeSingle();
    if (!evento) return null;
    const { itens, custos } = await carregarPartes([id]);
    return montar(evento as LinhaEvento, itens, custos);
  },

  async salvarOrcamento(o) {
    const { error } = await supabase.from('eventos').upsert({
      id: o.id,
      cliente: o.cliente,
      contato: o.contato,
      data: ouNulo(o.data),
      hora: ouNulo(o.hora),
      local: o.local,
      observacoes: o.observacoes,
      situacao: o.situacao,
      adultos: o.adultos,
      criancas: o.criancas,
      apetite: o.apetite,
      margem: o.margem,
      fator_carvao: o.fatorCarvao,
      preco_carvao: o.precoCarvao,
    });
    if (error) throw error;

    // Itens e custos são reescritos por inteiro. São poucas dezenas de linhas
    // por evento, e reconciliar diferença aqui só traria bug sutil de sincronia.
    await supabase.from('evento_itens').delete().eq('evento_id', o.id);
    if (o.itens.length) {
      const { error: e2 } = await supabase.from('evento_itens').insert(
        o.itens.map((i, ordem) => ({
          evento_id: o.id,
          item_id: i.id.includes('-') ? i.id : null,
          nome: i.nome,
          categoria: i.categoria,
          unidade: i.unidade,
          por_pessoa: i.porPessoa,
          rendimento: i.rendimento,
          preco: i.preco,
          selecionado: o.selecionados.includes(i.id),
          ordem,
        })),
      );
      if (e2) throw e2;
    }

    await supabase.from('evento_custos').delete().eq('evento_id', o.id);
    if (o.custosExtras.length) {
      await supabase.from('evento_custos').insert(
        o.custosExtras.map((c) => ({ evento_id: o.id, descricao: c.descricao, valor: c.valor })),
      );
    }
  },

  async removerOrcamento(id) {
    // evento_itens e evento_custos caem junto por ON DELETE CASCADE
    const { error } = await supabase.from('eventos').delete().eq('id', id);
    if (error) throw error;
  },

  async lerCatalogo() {
    const { data, error } = await supabase
      .from('itens_catalogo')
      .select('*')
      .eq('ativo', true)
      .order('ordem');
    if (error) throw error;

    return (data ?? []).map((l) => ({
      id: l.id as string,
      nome: l.nome as string,
      categoria: l.categoria as Item['categoria'],
      unidade: l.unidade as Item['unidade'],
      porPessoa: Number(l.por_pessoa),
      rendimento: Number(l.rendimento),
      preco: Number(l.preco),
    }));
  },

  async salvarItem(item) {
    const { error } = await supabase
      .from('itens_catalogo')
      .update({
        nome: item.nome,
        categoria: item.categoria,
        unidade: item.unidade,
        por_pessoa: item.porPessoa,
        rendimento: item.rendimento,
        preco: item.preco,
      })
      .eq('id', item.id);
    if (error) throw error;
  },

  async criarItem(item) {
    const { data, error } = await supabase
      .from('itens_catalogo')
      .insert({
        nome: item.nome,
        categoria: item.categoria,
        unidade: item.unidade,
        por_pessoa: item.porPessoa,
        rendimento: item.rendimento,
        preco: item.preco,
        ordem: 999,
      })
      .select()
      .single();
    if (error) throw error;
    return { ...item, id: data.id as string };
  },

  async removerItem(id) {
    // Desativa em vez de apagar: evento antigo referencia este item, e apagar
    // levaria a referência junto.
    const { error } = await supabase.from('itens_catalogo').update({ ativo: false }).eq('id', id);
    if (error) throw error;
  },

  async listarMembros() {
    const { data, error } = await supabase.from('membros').select('*').eq('ativo', true).order('nome');
    if (error) throw error;
    return (data ?? []).map((m) => ({
      id: m.id as string,
      nome: m.nome as string,
      funcao: m.funcao as string,
      telefone: m.telefone as string,
      cachePadrao: Number(m.cache_padrao),
      ativo: m.ativo as boolean,
    }));
  },

  async salvarMembro(m) {
    const { error } = await supabase
      .from('membros')
      .update({ nome: m.nome, funcao: m.funcao, telefone: m.telefone, cache_padrao: m.cachePadrao })
      .eq('id', m.id);
    if (error) throw error;
  },

  async criarMembro(m) {
    const { data, error } = await supabase
      .from('membros')
      .insert({ nome: m.nome, funcao: m.funcao, telefone: m.telefone, cache_padrao: m.cachePadrao })
      .select()
      .single();
    if (error) throw error;
    return { ...m, id: data.id as string };
  },

  async removerMembro(id) {
    const { error } = await supabase.from('membros').update({ ativo: false }).eq('id', id);
    if (error) throw error;
  },

  async listarEscalas(eventoId) {
    const { data, error } = await supabase.from('escalas').select('*').eq('evento_id', eventoId);
    if (error) throw error;
    return (data ?? []).map((e) => ({
      id: e.id as string,
      eventoId: e.evento_id as string,
      membroId: e.membro_id as string,
      funcao: e.funcao as string,
      cache: Number(e.cache),
      confirmado: e.confirmado as boolean,
    }));
  },

  async escalar(eventoId, membroId, funcao, cache) {
    const { error } = await supabase
      .from('escalas')
      .insert({ evento_id: eventoId, membro_id: membroId, funcao, cache });
    if (error) throw error;
  },

  async atualizarEscala(e) {
    const { error } = await supabase
      .from('escalas')
      .update({ funcao: e.funcao, cache: e.cache, confirmado: e.confirmado })
      .eq('id', e.id);
    if (error) throw error;
  },

  async desescalar(id) {
    const { error } = await supabase.from('escalas').delete().eq('id', id);
    if (error) throw error;
  },
};

/** Ponto único de troca do armazenamento. */
export const repositorio: Repositorio = repositorioSupabase;
