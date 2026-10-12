import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Orcamento } from '../dominio/tipos';

/*
  O banco de mentira, com o comportamento que derrubou o cardápio de dois
  orçamentos: no máximo 1000 linhas por consulta, o resto cortado sem aviso.
*/
const TETO = 1000;

type Linha = Record<string, unknown>;
let tabelas: Record<string, Linha[]> = {};
let falharInsertEm: string | null = null;
let falharLeituraEm: string | null = null;
/** Banco sem a migração 008, como produção antes de rodar o SQL. */
let semFuncao = true;
let relogio = 0;

/*
  A função `salvar_orcamento` do banco, de mentira: troca tudo de uma vez e
  confere a versão, como a de verdade (supabase/sql/008).
*/
function salvarOrcamentoNoBanco(args: { p: Record<string, never>; p_versao: string | null }) {
  if (semFuncao) return { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
  const { evento, itens, custos, servicos, faixas } = args.p as unknown as Record<string, Linha[]> & { evento: Linha };
  const id = evento.id as string;
  const atual = (tabelas.eventos ??= []).find((e) => e.id === id);
  if (args.p_versao && !atual) return { data: null, error: { code: 'P0001', message: 'ORCAMENTO_EXCLUIDO' } };
  if (args.p_versao && atual && atual.atualizado_em !== args.p_versao) {
    return { data: null, error: { code: 'P0001', message: 'ORCAMENTO_ALTERADO' } };
  }
  const nova = `2026-10-12T15:00:${String(++relogio).padStart(2, '0')}+00:00`;
  tabelas.eventos = [...tabelas.eventos.filter((e) => e.id !== id), { ...atual, ...evento, atualizado_em: nova }];
  const trocar = (t: string, linhas: Linha[]) => {
    tabelas[t] = [...(tabelas[t] ?? []).filter((l) => l.evento_id !== id), ...linhas.map((l) => ({ id: crypto.randomUUID(), ...l }))];
  };
  trocar('evento_itens', itens);
  trocar('evento_custos', custos);
  trocar('evento_servicos', servicos);
  trocar('evento_faixas', faixas);
  return { data: nova, error: null };
}

function consulta(tabela: string) {
  let filtro: ((l: Linha) => boolean) | null = null;
  let faixa: [number, number] | null = null;
  let ordenarPor: string | null = null;
  let acao: 'select' | 'delete' | 'insert' | 'upsert' = 'select';
  let dados: Linha[] = [];

  const q = {
    select: () => q,
    in: (col: string, vals: string[]) => ((filtro = (l) => vals.includes(String(l[col]))), q),
    eq: (col: string, v: string) => ((filtro = (l) => l[col] === v), q),
    order: (col: string) => ((ordenarPor = col), q),
    range: (de: number, ate: number) => ((faixa = [de, ate]), q),
    delete: () => ((acao = 'delete'), q),
    insert: (d: Linha[]) => ((acao = 'insert'), (dados = d), q),
    upsert: (d: Linha) => ((acao = 'upsert'), (dados = [d]), q),
    maybeSingle: () => q,
    then: (ok: (r: unknown) => void) => {
      const todas = (tabelas[tabela] ??= []);
      if (acao === 'select') {
        if (falharLeituraEm === tabela) return ok({ data: null, error: { message: 'leitura caiu' } });
        let r = todas.filter((l) => !filtro || filtro(l));
        if (ordenarPor) r = [...r].sort((a, b) => String(a[ordenarPor!]).localeCompare(String(b[ordenarPor!])));
        r = faixa ? r.slice(faixa[0], faixa[1] + 1) : r;
        return ok({ data: r.slice(0, TETO), error: null });
      }
      if (acao === 'delete') {
        tabelas[tabela] = todas.filter((l) => !(filtro && filtro(l)));
        return ok({ data: null, error: null });
      }
      if (acao === 'insert') {
        // Recusa só a primeira gravação: a devolução das linhas antigas, que o
        // banco já tinha aceitado antes, passa.
        if (falharInsertEm === tabela) {
          falharInsertEm = null;
          return ok({ data: null, error: { message: `recusado em ${tabela}` } });
        }
        todas.push(...dados.map((d) => ({ id: d.id ?? crypto.randomUUID(), ...d })));
        return ok({ data: null, error: null });
      }
      return ok({ data: null, error: null });
    },
  };
  return q;
}

vi.mock('../integrations/supabase/client', () => ({
  supabase: {
    from: (t: string) => consulta(t),
    rpc: vi.fn(async (nome: string, args: never) => (nome === 'salvar_orcamento' ? salvarOrcamentoNoBanco(args) : { data: null, error: null })),
    auth: {},
  },
}));

const { repositorioSupabase, ORCAMENTO_ALTERADO, ORCAMENTO_EXCLUIDO } = await import('./supabase');

const evento = (id: string, cliente: string) => ({
  id,
  cliente,
  contato: '',
  data: null,
  hora: null,
  local: '',
  observacoes: '',
  situacao: 'orcado',
  tipo_evento: 'aniversario',
  adultos: 30,
  criancas: 0,
  apetite: 'normal',
  duracao_horas: 5,
  margem: 0,
  fator_carvao: 0.5,
  preco_carvao: 5,
  criado_em: '2026-10-01T12:00:00Z',
  atualizado_em: '2026-10-01T12:00:00Z',
});

const linhaDeItem = (eventoId: string, n: number) => ({
  id: `${eventoId}-linha-${String(n).padStart(4, '0')}`,
  evento_id: eventoId,
  item_id: `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`,
  nome: `Item ${n}`,
  grupo: 'CHURRASCO',
  categoria: 'carne',
  unidade: 'kg',
  por_pessoa: 100,
  rendimento: 0.8,
  preco: 50,
  embalagens: [],
  selecionado: true,
  ordem: n,
});

beforeEach(() => {
  tabelas = {};
  falharInsertEm = null;
  falharLeituraEm = null;
  semFuncao = true;
});

describe('ler os orçamentos', () => {
  it('traz todos os itens mesmo passando de 1000 linhas no banco', () => {
    // Como em produção: 1147 linhas. A leitura de uma vez só trazia 1000.
    return (async () => {
      const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      tabelas.eventos = ids.map((id) => evento(id, `Cliente ${id}`));
      tabelas.evento_itens = ids.flatMap((id, i) =>
        Array.from({ length: i === 7 ? 97 : 150 }, (_, n) => linhaDeItem(id, n)),
      );
      expect(tabelas.evento_itens.length).toBe(1147);

      const orcamentos = await repositorioSupabase.listarOrcamentos();

      expect(orcamentos.reduce((s, o) => s + o.itens.length, 0)).toBe(1147);
      expect(orcamentos.every((o) => o.itens.length > 0)).toBe(true);
    })();
  });

  it('erro de leitura vira erro, e não orçamento sem cardápio', async () => {
    tabelas.eventos = [evento('a', 'Fulana')];
    tabelas.evento_itens = [linhaDeItem('a', 1)];
    falharLeituraEm = 'evento_itens';

    await expect(repositorioSupabase.listarOrcamentos()).rejects.toMatchObject({ message: 'leitura caiu' });
  });
});

describe('gravar o orçamento', () => {
  const orcamento = (itens: number) =>
    ({
      id: 'a',
      cliente: 'Fulana',
      contato: '',
      data: '',
      hora: '',
      local: '',
      observacoes: '',
      situacao: 'orcado',
      tipoEvento: 'aniversario',
      adultos: 30,
      faixas: [],
      apetite: 'normal',
      duracaoHoras: 5,
      itens: Array.from({ length: itens }, (_, n) => ({
        id: `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`,
        nome: `Novo ${n}`,
        grupo: 'CHURRASCO',
        categoria: 'carne',
        unidade: 'kg',
        porPessoa: 100,
        rendimento: 0.8,
        preco: 50,
      })),
      selecionados: [],
      servicos: [],
      custosExtras: [],
      margem: 0,
      fatorCarvao: 0.5,
      precoCarvao: 5,
      criadoEm: '',
      atualizadoEm: '',
    }) as unknown as Orcamento;

  it('se o banco recusar os itens novos, os antigos voltam', async () => {
    tabelas.evento_itens = Array.from({ length: 5 }, (_, n) => linhaDeItem('a', n));
    falharInsertEm = 'evento_itens';

    await expect(repositorioSupabase.salvarOrcamento(orcamento(3))).rejects.toMatchObject({
      message: 'recusado em evento_itens',
    });

    // Antes ficava vazio. Agora o cardápio da última gravação boa continua.
    expect(tabelas.evento_itens.map((l) => l.nome)).toEqual(['Item 0', 'Item 1', 'Item 2', 'Item 3', 'Item 4']);
  });

  it('uma tabela recusada não impede as outras de gravar', async () => {
    falharInsertEm = 'evento_itens';
    const o = {
      ...orcamento(2),
      servicos: [
        { id: 's', servicoId: null, nome: 'Garçom', papel: 'equipe', pessoa: '', quantidade: 2, valor: 250, percentual: 0, valorManual: false },
      ],
    } as unknown as Orcamento;

    await expect(repositorioSupabase.salvarOrcamento(o)).rejects.toBeTruthy();

    expect(tabelas.evento_servicos?.map((l) => l.nome)).toEqual(['Garçom']);
  });

  it('número quebrado (NaN) vira zero em vez de derrubar a gravação', async () => {
    const o = orcamento(1);
    (o.itens[0] as { porPessoa: number }).porPessoa = Number.NaN;

    await repositorioSupabase.salvarOrcamento(o);

    expect(tabelas.evento_itens[0].por_pessoa).toBe(0);
  });

  it('item sem par no catálogo volta a gravar sem item_id', async () => {
    // Linha antiga, sem item_id: o id dela não pode ir parar em item_id.
    tabelas.eventos = [evento('a', 'Fulana')];
    tabelas.evento_itens = [{ ...linhaDeItem('a', 1), item_id: null, id: '11111111-2222-3333-4444-555555555555' }];

    const [lido] = await repositorioSupabase.listarOrcamentos();
    await repositorioSupabase.salvarOrcamento(lido);

    expect(tabelas.evento_itens[0].item_id).toBeNull();
    expect(tabelas.evento_itens[0].selecionado).toBe(true);
  });
});

describe('gravar numa transação só (migração 008)', () => {
  beforeEach(() => {
    semFuncao = false;
  });

  const comServicos = (o: Orcamento, valor: number) =>
    ({
      ...o,
      servicos: [
        { id: 's', servicoId: null, nome: 'Garçom', papel: 'equipe', pessoa: '', quantidade: 6, valor, percentual: 0, valorManual: true },
      ],
    }) as unknown as Orcamento;

  it('grava tudo pela função, sem apagar tabela por tabela', async () => {
    tabelas.eventos = [evento('a', 'Fulana')];
    const [lido] = await repositorioSupabase.listarOrcamentos();

    await repositorioSupabase.salvarOrcamento(comServicos({ ...lido, situacao: 'orcado' }, 220));

    const [relido] = await repositorioSupabase.listarOrcamentos();
    expect(relido.servicos.map((s) => s.valor)).toEqual([220]);
  });

  it('cópia velha de outro aparelho não grava por cima da nova', async () => {
    tabelas.eventos = [evento('a', 'Fulana')];
    // Os dois aparelhos abrem o mesmo orçamento.
    const [noComputador] = await repositorioSupabase.listarOrcamentos();
    const noCelular = structuredClone(noComputador);

    // O computador põe a mão de obra e grava.
    await repositorioSupabase.salvarOrcamento(comServicos(noComputador, 220));

    // O celular, com a cópia de antes, muda a situação: seria gravar sem serviço.
    // O módulo é um só nos dois "aparelhos" deste teste, então a versão que
    // o celular tinha é posta de volta à mão.
    tabelas.eventos[0] = { ...tabelas.eventos[0] };
    const versaoDoCelular = '2026-10-01T12:00:00Z';
    const banco = tabelas.eventos[0].atualizado_em;
    expect(banco).not.toBe(versaoDoCelular);
    const { supabase } = await import('../integrations/supabase/client');
    const r = await supabase.rpc('salvar_orcamento', { p: { evento: { id: 'a' }, itens: [], custos: [], servicos: [], faixas: [] }, p_versao: versaoDoCelular } as never);
    expect(r.error?.message).toBe('ORCAMENTO_ALTERADO');
    expect(noCelular.servicos).toEqual([]);

    expect(tabelas.evento_servicos.map((l) => l.valor)).toEqual([220]);
  });

  it('o aviso de conflito chega como texto que dá para mostrar', async () => {
    tabelas.eventos = [evento('a', 'Fulana')];
    const [lido] = await repositorioSupabase.listarOrcamentos();
    // Outro aparelho grava por fora.
    tabelas.eventos[0] = { ...tabelas.eventos[0], atualizado_em: '2026-10-12T16:00:00+00:00' };

    await expect(repositorioSupabase.salvarOrcamento(lido)).rejects.toThrow(ORCAMENTO_ALTERADO);
    expect(tabelas.evento_servicos ?? []).toEqual([]);
  });

  it('gravações seguidas do mesmo aparelho não se acusam de conflito', async () => {
    tabelas.eventos = [evento('a', 'Fulana')];
    const [lido] = await repositorioSupabase.listarOrcamentos();

    await repositorioSupabase.salvarOrcamento(comServicos(lido, 200));
    await repositorioSupabase.salvarOrcamento(comServicos(lido, 210));
    await repositorioSupabase.salvarOrcamento(comServicos(lido, 220));

    expect(tabelas.evento_servicos.map((l) => l.valor)).toEqual([220]);
  });

  it('orçamento excluído em outro aparelho não volta a existir', async () => {
    tabelas.eventos = [evento('a', 'Fulana')];
    const [lido] = await repositorioSupabase.listarOrcamentos();
    tabelas.eventos = [];

    await expect(repositorioSupabase.salvarOrcamento(lido)).rejects.toThrow(ORCAMENTO_EXCLUIDO);
    expect(tabelas.eventos).toEqual([]);
  });

  it('orçamento novo, que o banco ainda não conhece, grava', async () => {
    const o = { ...comServicos({ id: 'novo', itens: [], selecionados: [], custosExtras: [], faixas: [] } as unknown as Orcamento, 100) };
    Object.assign(o, { cliente: 'X', contato: '', data: '', hora: '', local: '', observacoes: '', situacao: 'rascunho', tipoEvento: 'aniversario', adultos: 10, apetite: 'normal', duracaoHoras: 5, margem: 0, fatorCarvao: 0.5, precoCarvao: 5 });

    await repositorioSupabase.salvarOrcamento(o);

    expect(tabelas.eventos.map((e) => e.id)).toEqual(['novo']);
  });
});
