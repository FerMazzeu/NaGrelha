import { supabase } from '../integrations/supabase/client';
import type {
  Apetite,
  Conversa,
  FaixaEtaria,
  Item,
  Orcamento,
  Anexo,
  MensagemSalva,
  PapelDeServico,
  Perfil,
  Servico,
  Situacao,
} from '../dominio/tipos';
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
  duracao_horas: number;
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
  grupo: string;
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
    grupo: l.grupo ?? '',
    categoria: l.categoria,
    unidade: l.unidade,
    porPessoa: Number(l.por_pessoa),
    rendimento: Number(l.rendimento),
    preco: Number(l.preco),
  };
}

type LinhaServico = {
  id: string;
  servico_id: string | null;
  nome: string;
  papel: PapelDeServico;
  pessoa: string;
  quantidade: number;
  valor: number;
  percentual: number;
  ordem: number;
};

type LinhaFaixa = {
  id: string;
  faixa_id: string | null;
  nome: string;
  percentual: number;
  quantidade: number;
  ordem: number;
};

function montar(
  evento: LinhaEvento,
  itens: LinhaItem[],
  custos: LinhaCusto[],
  servicos: LinhaServico[],
  faixas: LinhaFaixa[],
): Orcamento {
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
    apetite: evento.apetite,
    duracaoHoras: Number(evento.duracao_horas ?? 5),
    faixas: [...faixas]
      .sort((a, b) => a.ordem - b.ordem)
      .map((f) => ({
        id: f.id,
        faixaId: f.faixa_id,
        nome: f.nome,
        percentual: Number(f.percentual),
        quantidade: f.quantidade,
      })),
    servicos: [...servicos]
      .sort((a, b) => a.ordem - b.ordem)
      .map((x) => ({
        id: x.id,
        servicoId: x.servico_id,
        nome: x.nome,
        papel: x.papel,
        pessoa: x.pessoa,
        quantidade: Number(x.quantidade),
        valor: Number(x.valor),
        // `?? 0` porque orcamento gravado antes desta coluna existir nao tem
        // o campo, e servico sem percentual e servico de valor fixo.
        percentual: Number(x.percentual ?? 0),
      })),
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
  const vazio = {
    itens: [] as (LinhaItem & { evento_id: string })[],
    custos: [] as (LinhaCusto & { evento_id: string })[],
    servicos: [] as (LinhaServico & { evento_id: string })[],
    faixas: [] as (LinhaFaixa & { evento_id: string })[],
  };
  if (!ids.length) return vazio;

  const [{ data: itens }, { data: custos }, { data: servicos }, { data: faixas }] = await Promise.all([
    supabase.from('evento_itens').select('*').in('evento_id', ids),
    supabase.from('evento_custos').select('*').in('evento_id', ids),
    supabase.from('evento_servicos').select('*').in('evento_id', ids),
    supabase.from('evento_faixas').select('*').in('evento_id', ids),
  ]);

  return {
    itens: (itens ?? []) as typeof vazio.itens,
    custos: (custos ?? []) as typeof vazio.custos,
    servicos: (servicos ?? []) as typeof vazio.servicos,
    faixas: (faixas ?? []) as typeof vazio.faixas,
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
    const { itens, custos, servicos, faixas } = await carregarPartes(linhas.map((e) => e.id));

    return linhas.map((e) =>
      montar(
        e,
        itens.filter((i) => i.evento_id === e.id),
        custos.filter((c) => c.evento_id === e.id),
        servicos.filter((x) => x.evento_id === e.id),
        faixas.filter((f) => f.evento_id === e.id),
      ),
    );
  },

  async obterOrcamento(id) {
    const { data: evento } = await supabase.from('eventos').select('*').eq('id', id).maybeSingle();
    if (!evento) return null;
    const { itens, custos, servicos, faixas } = await carregarPartes([id]);
    return montar(evento as LinhaEvento, itens, custos, servicos, faixas);
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
      // a coluna antiga vira o total, para relatorio antigo nao quebrar
      criancas: o.faixas.reduce((s, f) => s + f.quantidade, 0),
      apetite: o.apetite,
      duracao_horas: o.duracaoHoras,
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
          grupo: i.grupo,
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

    await supabase.from('evento_servicos').delete().eq('evento_id', o.id);
    if (o.servicos.length) {
      const { error: e3 } = await supabase.from('evento_servicos').insert(
        o.servicos.map((x, ordem) => ({
          evento_id: o.id,
          servico_id: x.servicoId,
          nome: x.nome,
          papel: x.papel,
          pessoa: x.pessoa,
          quantidade: x.quantidade,
          valor: x.valor,
          percentual: x.percentual,
          ordem,
        })),
      );
      if (e3) throw e3;
    }

    await supabase.from('evento_faixas').delete().eq('evento_id', o.id);
    if (o.faixas.length) {
      const { error: e4 } = await supabase.from('evento_faixas').insert(
        o.faixas.map((f, ordem) => ({
          evento_id: o.id,
          faixa_id: f.faixaId,
          nome: f.nome,
          percentual: f.percentual,
          quantidade: f.quantidade,
          ordem,
        })),
      );
      if (e4) throw e4;
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
      grupo: (l.grupo as string) ?? '',
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
        grupo: item.grupo,
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
        grupo: item.grupo,
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

  async lerServicos(): Promise<Servico[]> {
    const [{ data: servicos, error }, { data: faixas }] = await Promise.all([
      supabase.from('servicos_catalogo').select('*').eq('ativo', true).order('ordem'),
      supabase.from('servico_faixas').select('*').order('min_convidados'),
    ]);
    if (error) throw error;

    return (servicos ?? []).map((s) => ({
      id: s.id as string,
      nome: s.nome as string,
      papel: s.papel as PapelDeServico,
      valorPadrao: Number(s.valor_padrao),
      usaFaixa: s.usa_faixa as boolean,
      percentual: Number(s.percentual ?? 0),
      faixas: (faixas ?? [])
        .filter((f) => f.servico_id === s.id)
        .map((f) => ({
          min: f.min_convidados as number,
          max: (f.max_convidados as number | null) ?? null,
          valor: Number(f.valor),
        })),
    }));
  },

  async salvarServico(servico) {
    const { error } = await supabase
      .from('servicos_catalogo')
      .update({
        nome: servico.nome,
        papel: servico.papel,
        valor_padrao: servico.valorPadrao,
        usa_faixa: servico.usaFaixa,
        percentual: servico.percentual,
      })
      .eq('id', servico.id);
    if (error) throw error;

    // As faixas sao poucas por servico; reescrever inteiro evita reconciliacao
    // e o bug sutil de sincronia que ela traz.
    await supabase.from('servico_faixas').delete().eq('servico_id', servico.id);
    if (servico.faixas.length) {
      await supabase.from('servico_faixas').insert(
        servico.faixas.map((f) => ({
          servico_id: servico.id,
          min_convidados: f.min,
          max_convidados: f.max,
          valor: f.valor,
        })),
      );
    }
  },

  async criarServico(servico) {
    const { data, error } = await supabase
      .from('servicos_catalogo')
      .insert({
        nome: servico.nome,
        papel: servico.papel,
        valor_padrao: servico.valorPadrao,
        usa_faixa: servico.usaFaixa,
        percentual: servico.percentual,
        ordem: 999,
      })
      .select()
      .single();
    if (error) throw error;
    return { ...servico, id: data.id as string, faixas: [] };
  },

  async removerServico(id) {
    // desativa: evento antigo referencia este servico
    const { error } = await supabase.from('servicos_catalogo').update({ ativo: false }).eq('id', id);
    if (error) throw error;
  },

  async lerFaixasEtarias(): Promise<FaixaEtaria[]> {
    const { data, error } = await supabase
      .from('faixas_etarias')
      .select('*')
      .eq('ativo', true)
      .order('ordem');
    if (error) throw error;
    return (data ?? []).map((f) => ({
      id: f.id as string,
      nome: f.nome as string,
      idadeMin: f.idade_min as number,
      idadeMax: (f.idade_max as number | null) ?? null,
      percentual: Number(f.percentual),
    }));
  },

  async salvarFaixaEtaria(faixa) {
    const { error } = await supabase
      .from('faixas_etarias')
      .update({
        nome: faixa.nome,
        idade_min: faixa.idadeMin,
        idade_max: faixa.idadeMax,
        percentual: faixa.percentual,
      })
      .eq('id', faixa.id);
    if (error) throw error;
  },

  async criarFaixaEtaria(faixa) {
    const { data, error } = await supabase
      .from('faixas_etarias')
      .insert({
        nome: faixa.nome,
        idade_min: faixa.idadeMin,
        idade_max: faixa.idadeMax,
        percentual: faixa.percentual,
        ordem: 999,
      })
      .select()
      .single();
    if (error) throw error;
    return { ...faixa, id: data.id as string };
  },

  async removerFaixaEtaria(id) {
    const { error } = await supabase.from('faixas_etarias').update({ ativo: false }).eq('id', id);
    if (error) throw error;
  },

  async listarConversas(): Promise<Conversa[]> {
    // A RLS ja limita as conversas ao dono delas, entao nao precisa filtrar
    // por usuario aqui: filtrar na tela seria a segunda camada, nao a primeira.
    const { data, error } = await supabase
      .from('conversas')
      .select('id, titulo, evento_id, atualizado_em')
      .order('atualizado_em', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((c) => ({
      id: c.id as string,
      titulo: (c.titulo as string) || 'Nova conversa',
      eventoId: (c.evento_id as string | null) ?? null,
      atualizadoEm: c.atualizado_em as string,
    }));
  },

  async criarConversa(titulo, eventoId) {
    const { data: sessao } = await supabase.auth.getUser();
    if (!sessao.user) throw new Error('sessao expirada');

    const { data, error } = await supabase
      .from('conversas')
      .insert({ usuario_id: sessao.user.id, titulo, evento_id: eventoId })
      .select('id, titulo, evento_id, atualizado_em')
      .single();
    if (error) throw error;
    return {
      id: data.id as string,
      titulo: data.titulo as string,
      eventoId: (data.evento_id as string | null) ?? null,
      atualizadoEm: data.atualizado_em as string,
    };
  },

  async lerMensagens(conversaId): Promise<MensagemSalva[]> {
    const { data, error } = await supabase
      .from('mensagens')
      .select('id, papel, conteudo, imagem_url, anexos, criado_em')
      .eq('conversa_id', conversaId)
      .order('criado_em');
    if (error) throw error;
    return (data ?? [])
      .filter((m) => m.papel !== 'system')
      .map((m) => ({
        id: m.id as string,
        papel: m.papel as 'user' | 'assistant',
        conteudo: (m.conteudo as string) ?? '',
        imagemUrl: (m.imagem_url as string | null) ?? null,
        anexos: Array.isArray(m.anexos) ? (m.anexos as Anexo[]) : [],
        criadoEm: m.criado_em as string,
      }));
  },

  async renomearConversa(id, titulo) {
    const { error } = await supabase.from('conversas').update({ titulo }).eq('id', id);
    if (error) throw error;
  },

  async removerConversa(id) {
    // as mensagens caem junto por ON DELETE CASCADE
    const { error } = await supabase.from('conversas').delete().eq('id', id);
    if (error) throw error;
  },

  async urlDaImagem(caminho) {
    // O bucket e privado: a imagem so abre por link assinado, e ele expira.
    // Por isso o link e pedido na hora de mostrar, e nao guardado no banco.
    const { data } = await supabase.storage.from('midias').createSignedUrl(caminho, 60 * 60);
    return data?.signedUrl ?? null;
  },

  async listarPerfis(): Promise<Perfil[]> {
    // select('*') de proposito: a coluna `email` so existe depois da migration
    // de acesso. Sem ela a tela cai no nome, em vez de quebrar a consulta.
    const { data, error } = await supabase.from('perfis').select('*').order('criado_em');
    if (error) throw error;
    return (data ?? []).map((p) => ({
      id: p.id as string,
      nome: (p.nome as string) || 'sem nome',
      email: (p.email as string) ?? '',
      telefone: (p.telefone as string) ?? '',
      papel: p.papel as Perfil['papel'],
      aprovado: p.aprovado as boolean,
      criadoEm: p.criado_em as string,
    }));
  },

  async definirAcesso(id, aprovado) {
    const { error } = await supabase.from('perfis').update({ aprovado }).eq('id', id);
    if (error) throw error;
  },

  async definirPapel(id, papel) {
    const { error } = await supabase.from('perfis').update({ papel }).eq('id', id);
    if (error) throw error;
  },

  async souDono() {
    // Pergunta ao banco, nao a tela: e a mesma funcao que as policies avaliam.
    const { data, error } = await supabase.rpc('e_dono');
    if (error) return false;
    return data === true;
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
