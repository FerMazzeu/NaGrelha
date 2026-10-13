import type { Categoria, Conta, Lancamento } from '../dominio/financeiro';
import type { Escala } from '../dominio/tipos';
import { supabase } from '../integrations/supabase/client';

/*
  Leitura e gravação do caixa.

  Separado de `supabase.ts` porque só dono enxerga estas tabelas (a RLS
  devolve vazio para os outros), e a tela do caixa só monta para dono. O
  resto do app não depende de nada daqui.
*/

/*
  O Supabase corta a consulta em 1000 linhas sem avisar. Lançamento cresce
  todo mês e passa disso em um ano de uso; foi o mesmo corte que tirou o
  cardápio de dois orçamentos em out/2026. Então lê de página em página.
*/
const PAGINA = 1000;

async function tudo<T>(tabela: string, ordem: string): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase
      .from(tabela)
      .select('*')
      .order(ordem)
      .order('id')
      .range(de, de + PAGINA - 1);
    if (error) throw error;
    linhas.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGINA) return linhas;
  }
}

type LinhaConta = {
  id: string;
  nome: string;
  tipo: Conta['tipo'];
  saldo_inicial: number | string;
  saldo_inicial_em: string;
  ativo: boolean;
  ordem: number;
};

type LinhaCategoria = {
  id: string;
  nome: string;
  tipo: Categoria['tipo'];
  grupo: Categoria['grupo'];
  ativo: boolean;
  ordem: number;
};

type LinhaLancamento = {
  id: string;
  tipo: Lancamento['tipo'];
  descricao: string;
  valor: number | string;
  vencimento: string;
  pago_em: string | null;
  conta_id: string | null;
  conta_destino_id: string | null;
  categoria_id: string | null;
  evento_id: string | null;
  membro_id: string | null;
  pessoa: string | null;
  forma: Lancamento['forma'];
  observacoes: string;
};

const paraConta = (c: LinhaConta): Conta => ({
  id: c.id,
  nome: c.nome,
  tipo: c.tipo,
  saldoInicial: Number(c.saldo_inicial),
  saldoInicialEm: c.saldo_inicial_em,
  ativo: c.ativo,
});

const paraLancamento = (l: LinhaLancamento): Lancamento => ({
  id: l.id,
  tipo: l.tipo,
  descricao: l.descricao,
  // Numeric do Postgres chega como texto.
  valor: Number(l.valor),
  vencimento: l.vencimento,
  pagoEm: l.pago_em ?? '',
  contaId: l.conta_id,
  contaDestinoId: l.conta_destino_id,
  categoriaId: l.categoria_id,
  eventoId: l.evento_id,
  membroId: l.membro_id,
  pessoa: l.pessoa ?? '',
  forma: l.forma ?? '',
  observacoes: l.observacoes ?? '',
});

/** O lançamento do domínio nas colunas do banco. Id vazio é lançamento novo. */
function linhaDe(l: Lancamento) {
  return {
    ...(l.id ? { id: l.id } : {}),
    tipo: l.tipo,
    descricao: l.descricao.trim(),
    valor: Math.round(l.valor * 100) / 100,
    vencimento: l.vencimento,
    pago_em: l.pagoEm || null,
    conta_id: l.contaId,
    conta_destino_id: l.tipo === 'transferencia' ? l.contaDestinoId : null,
    categoria_id: l.tipo === 'transferencia' ? null : l.categoriaId,
    evento_id: l.eventoId,
    membro_id: l.membroId,
    pessoa: l.pessoa.trim(),
    forma: l.forma,
    observacoes: l.observacoes.trim(),
  };
}

export const financeiro = {
  async lerContas(): Promise<Conta[]> {
    return (await tudo<LinhaConta>('contas_financeiras', 'ordem')).map(paraConta);
  },

  async salvarConta(c: Conta) {
    const { error } = await supabase
      .from('contas_financeiras')
      .update({
        nome: c.nome.trim(),
        tipo: c.tipo,
        saldo_inicial: c.saldoInicial,
        saldo_inicial_em: c.saldoInicialEm,
        ativo: c.ativo,
      })
      .eq('id', c.id);
    if (error) throw error;
  },

  async criarConta(c: Omit<Conta, 'id'>): Promise<Conta> {
    const { data, error } = await supabase
      .from('contas_financeiras')
      .insert({
        nome: c.nome.trim(),
        tipo: c.tipo,
        saldo_inicial: c.saldoInicial,
        saldo_inicial_em: c.saldoInicialEm,
        ativo: c.ativo,
        ordem: 99,
      })
      .select()
      .single();
    if (error) throw error;
    return paraConta(data as LinhaConta);
  },

  async lerCategorias(): Promise<Categoria[]> {
    return (await tudo<LinhaCategoria>('categorias_financeiras', 'ordem')).map((c) => ({
      id: c.id,
      nome: c.nome,
      tipo: c.tipo,
      grupo: c.grupo,
      ativo: c.ativo,
    }));
  },

  async criarCategoria(c: Omit<Categoria, 'id'>): Promise<Categoria> {
    const { data, error } = await supabase
      .from('categorias_financeiras')
      .insert({ nome: c.nome.trim(), tipo: c.tipo, grupo: c.grupo, ativo: c.ativo, ordem: 99 })
      .select()
      .single();
    if (error) throw error;
    return { ...c, id: data.id as string };
  },

  async salvarCategoria(c: Categoria) {
    const { error } = await supabase
      .from('categorias_financeiras')
      .update({ nome: c.nome.trim(), grupo: c.grupo, ativo: c.ativo })
      .eq('id', c.id);
    if (error) throw error;
  },

  async lerLancamentos(): Promise<Lancamento[]> {
    return (await tudo<LinhaLancamento>('lancamentos', 'vencimento')).map(paraLancamento);
  },

  /** Cria ou atualiza. Devolve como ficou no banco, já com id. */
  async salvarLancamento(l: Lancamento): Promise<Lancamento> {
    const { data, error } = l.id
      ? await supabase.from('lancamentos').update(linhaDe(l)).eq('id', l.id).select().single()
      : await supabase.from('lancamentos').insert(linhaDe(l)).select().single();
    if (error) throw error;
    return paraLancamento(data as LinhaLancamento);
  },

  /** Vários de uma vez, numa chamada só: repetição mensal e importação. */
  async criarLancamentos(ls: Lancamento[]): Promise<Lancamento[]> {
    if (!ls.length) return [];
    const { data, error } = await supabase
      .from('lancamentos')
      .insert(ls.map((l) => linhaDe({ ...l, id: '' })))
      .select();
    if (error) throw error;
    return ((data ?? []) as LinhaLancamento[]).map(paraLancamento);
  },

  async removerLancamento(id: string) {
    const { error } = await supabase.from('lancamentos').delete().eq('id', id);
    if (error) throw error;
  },

  /** A escala de todos os eventos, para o cachê a pagar. */
  async lerEscalas(): Promise<Escala[]> {
    type LinhaEscala = { id: string; evento_id: string; membro_id: string; funcao: string; cache: number | string; confirmado: boolean };
    return (await tudo<LinhaEscala>('escalas', 'evento_id')).map((e) => ({
      id: e.id,
      eventoId: e.evento_id,
      membroId: e.membro_id,
      funcao: e.funcao,
      cache: Number(e.cache),
      confirmado: e.confirmado,
    }));
  },
};
