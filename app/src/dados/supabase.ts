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
  tipo_evento: 'aniversario' | 'casamento' | null;
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
  embalagens: number[] | null;
  selecionado: boolean;
  ordem: number;
};

type LinhaCusto = { id: string; descricao: string; valor: number };

/*
  O id do item dentro do orçamento.

  É o do catálogo quando existe, porque é ele que a seleção referencia. Linha
  sem `item_id` (orçamento antigo, ou cópia dele) usava o id da própria linha,
  que é um uuid com hífen. Na gravação seguinte, hífen quer dizer "é do
  catálogo", e esse id ia parar em `item_id`, apontando para um item que não
  existe: o banco recusava a regravação inteira. Sem hífen, ele grava como
  "sem item do catálogo", que é o que ele é.
*/
const idDoItem = (l: { id: string; item_id: string | null }) => l.item_id ?? `linha${l.id.replace(/-/g, '')}`;

/** Número que o banco aceita: NaN e infinito viram zero em vez de derrubar a gravação. */
const num = (n: number) => (Number.isFinite(n) ? n : 0);

/**
 * Troca as linhas de uma tabela filha do evento sem nunca deixar vazio.
 *
 * Antes era apagar e regravar. Se a regravação falhava (uma linha recusada
 * pelo banco já basta), o evento ficava sem nada: foi assim que o orçamento
 * de uma cliente perdeu o cardápio depois de pronto, com o PDF já enviado.
 *
 * Agora o que estava no banco é lido antes, e se a regravação falhar, volta.
 * O erro sobe do mesmo jeito, e aparece na tela, mas o orçamento continua
 * como estava na última gravação boa.
 */
async function reescrever(tabela: string, eventoId: string, linhas: Record<string, unknown>[]) {
  const { data: antes, error: erroAoLer } = await supabase.from(tabela).select('*').eq('evento_id', eventoId);
  if (erroAoLer) throw erroAoLer;

  const { error: erroAoApagar } = await supabase.from(tabela).delete().eq('evento_id', eventoId);
  if (erroAoApagar) throw erroAoApagar;
  if (!linhas.length) return;

  const { error } = await supabase.from(tabela).insert(linhas);
  if (!error) return;

  if (antes?.length) {
    const { error: erroAoDevolver } = await supabase.from(tabela).insert(antes);
    if (erroAoDevolver) console.error(`não consegui devolver ${tabela} do evento ${eventoId}`, erroAoDevolver);
  }
  throw error;
}

function paraItem(l: LinhaItem): Item {
  return {
    id: idDoItem(l),
    nome: l.nome,
    grupo: l.grupo ?? '',
    categoria: l.categoria,
    unidade: l.unidade,
    porPessoa: Number(l.por_pessoa),
    rendimento: Number(l.rendimento),
    preco: Number(l.preco),
    embalagens: paraEmbalagens(l.embalagens),
  };
}

/** Numeric do Postgres chega como string; coluna ausente ou nula vira vazio. */
function paraEmbalagens(bruto: unknown): number[] {
  return Array.isArray(bruto) ? bruto.map(Number).filter((n) => Number.isFinite(n) && n > 0) : [];
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
  valor_manual: boolean;
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
    // Orcamento gravado antes desta coluna existir e aniversario, que era a
    // unica tabela que havia.
    tipoEvento: (evento.tipo_evento as 'aniversario' | 'casamento' | null) ?? 'aniversario',
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
        valorManual: Boolean(x.valor_manual ?? false),
      })),
    itens: ordenados.map(paraItem),
    selecionados: ordenados.filter((l) => l.selecionado).map(idDoItem),
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

  const [itens, custos, servicos, faixas] = await Promise.all([
    todasAsLinhas<(typeof vazio.itens)[number]>('evento_itens', ids),
    todasAsLinhas<(typeof vazio.custos)[number]>('evento_custos', ids),
    todasAsLinhas<(typeof vazio.servicos)[number]>('evento_servicos', ids),
    todasAsLinhas<(typeof vazio.faixas)[number]>('evento_faixas', ids),
  ]);

  return { itens, custos, servicos, faixas };
}

/*
  Leitura de uma tabela filha para vários eventos, inteira.

  O Supabase devolve no máximo 1000 linhas por consulta e corta o resto sem
  avisar. Cada orçamento novo copia o catálogo inteiro, uns 150 itens, e com
  1147 linhas no banco a leitura de uma vez trazia só 1000: os orçamentos que
  caíam fora do corte abriam SEM CARDÁPIO, e a primeira edição gravava o
  vazio. Foi assim que dois orçamentos perderam o cardápio em out/2026.

  Agora vem de página em página, numa ordem fixa (sem ordem, duas páginas
  podem repetir ou pular linha), até a página vir incompleta.

  E erro de leitura sobe. Antes ele virava lista vazia, que é o mesmo
  desastre por outro caminho.
*/
const PAGINA = 1000;

async function todasAsLinhas<T>(tabela: string, ids: string[]): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase
      .from(tabela)
      .select('*')
      .in('evento_id', ids)
      .order('id')
      .range(de, de + PAGINA - 1);
    if (error) throw error;
    linhas.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGINA) return linhas;
  }
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
      tipo_evento: o.tipoEvento,
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

    // Cada tabela filha é trocada por inteiro, mas nunca fica vazia por erro:
    // ver `reescrever`. A ordem importa pouco agora, porque uma falha não
    // apaga nada, e todas são tentadas antes de reclamar.
    const falhas: unknown[] = [];
    const tentar = (p: Promise<void>) => p.catch((e) => void falhas.push(e));

    await tentar(
      reescrever(
        'evento_itens',
        o.id,
        o.itens.map((i, ordem) => ({
          evento_id: o.id,
          item_id: i.id.includes('-') ? i.id : null,
          nome: i.nome,
          grupo: i.grupo,
          categoria: i.categoria,
          unidade: i.unidade,
          por_pessoa: num(i.porPessoa),
          rendimento: num(i.rendimento),
          preco: num(i.preco),
          embalagens: (i.embalagens ?? []).filter((e) => Number.isFinite(e)),
          selecionado: o.selecionados.includes(i.id),
          ordem,
        })),
      ),
    );

    await tentar(
      reescrever(
        'evento_custos',
        o.id,
        o.custosExtras.map((c) => ({ evento_id: o.id, descricao: c.descricao, valor: num(c.valor) })),
      ),
    );

    await tentar(
      reescrever(
        'evento_servicos',
        o.id,
        o.servicos.map((x, ordem) => ({
          evento_id: o.id,
          servico_id: x.servicoId,
          nome: x.nome,
          papel: x.papel,
          pessoa: x.pessoa,
          quantidade: num(x.quantidade),
          valor: num(x.valor),
          percentual: num(x.percentual),
          valor_manual: x.valorManual,
          ordem,
        })),
      ),
    );

    await tentar(
      reescrever(
        'evento_faixas',
        o.id,
        o.faixas.map((f, ordem) => ({
          evento_id: o.id,
          faixa_id: f.faixaId,
          nome: f.nome,
          percentual: num(f.percentual),
          quantidade: num(f.quantidade),
          ordem,
        })),
      ),
    );

    if (falhas.length) throw falhas[0];
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
      embalagens: paraEmbalagens(l.embalagens),
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
        embalagens: item.embalagens ?? [],
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
        embalagens: item.embalagens ?? [],
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
          tipo: (f.tipo_evento as 'aniversario' | 'casamento' | null) ?? null,
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
          tipo_evento: f.tipo,
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
