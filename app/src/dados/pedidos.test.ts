import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Orcamento } from '../dominio/tipos';

/*
  A conversão de pedido em rascunho, com o banco de mentira.

  O que interessa aqui não é o Supabase, é a ordem das coisas: reservar antes
  de criar, não criar o que outro já reservou, e não devolver para a fila o que
  já virou orçamento. Erro nessa ordem é rascunho em dobro na tela do Alan.
*/

type Chamada = { tabela: string; acao: string; dados?: unknown; filtros: string[] };
const chamadas: Chamada[] = [];

let pendentes: Record<string, unknown>[] = [];
let erroAoListar: { message: string } | null = null;
/** Quais pedidos o "outro app" já reservou: o update não devolve linha. */
let reservadosPorOutro = new Set<string>();
let falhaAoMarcar = 0;

function consulta(tabela: string) {
  const c: Chamada = { tabela, acao: 'select', filtros: [] };
  const q = {
    select: () => q,
    neq: (col: string, v: string) => (c.filtros.push(`${col}!=${v}`), q),
    order: () => q,
    eq: (col: string, v: string) => (c.filtros.push(`${col}=${v}`), q),
    or: (expr: string) => (c.filtros.push(`or(${expr})`), q),
    update: (dados: Record<string, unknown>) => ((c.acao = 'update'), (c.dados = dados), q),
    then: (ok: (r: unknown) => void) => {
      chamadas.push(c);
      if (c.acao === 'select') return ok({ data: erroAoListar ? null : pendentes, error: erroAoListar });
      const id = c.filtros.find((f) => f.startsWith('id='))?.slice(3);
      const dados = c.dados as { estado?: string };
      if (dados.estado === 'convertendo') {
        return ok({ data: reservadosPorOutro.has(id!) ? [] : [{ id }], error: null });
      }
      if (dados.estado === 'convertido' && falhaAoMarcar > 0) {
        falhaAoMarcar--;
        return ok({ data: null, error: { message: 'rede caiu' } });
      }
      return ok({ data: null, error: null });
    },
  };
  return q;
}

vi.mock('../integrations/supabase/client', () => ({
  supabase: { from: (t: string) => consulta(t), rpc: vi.fn() },
}));

const { converterPedidosPendentes } = await import('./pedidos');

const linha = (id: string) => ({
  id,
  cliente: `Cliente ${id}`,
  contato: '35999990000',
  tipo_evento: 'aniversario',
  data: '2026-11-21',
  hora: '',
  local: 'Varginha',
  adultos: 30,
  criancas: [],
  observacoes: '',
  itens: [],
  criado_em: '2026-10-04T12:00:00Z',
});

const deps = (salvar: (o: Orcamento) => Promise<void> = async () => {}) => ({
  catalogo: [],
  servicos: [],
  faixas: [],
  salvar,
});

const estados = (id: string) =>
  chamadas.filter((c) => c.acao === 'update' && c.filtros.includes(`id=${id}`)).map((c) => (c.dados as { estado: string }).estado);

beforeEach(() => {
  chamadas.length = 0;
  pendentes = [];
  erroAoListar = null;
  reservadosPorOutro = new Set();
  falhaAoMarcar = 0;
});

describe('pedido do link vira rascunho', () => {
  it('reserva, cria e marca como convertido, nessa ordem', async () => {
    pendentes = [linha('p1')];
    const salvos: string[] = [];

    const criados = await converterPedidosPendentes(deps(async (o) => void salvos.push(o.cliente)));

    expect(criados.map((o) => o.situacao)).toEqual(['rascunho']);
    expect(salvos).toEqual(['Cliente p1']);
    expect(estados('p1')).toEqual(['convertendo', 'convertido']);
  });

  it('pedido que outro login reservou não vira um segundo rascunho', async () => {
    // O Alan e a Érica abriram o app no mesmo minuto.
    pendentes = [linha('p1'), linha('p2')];
    reservadosPorOutro = new Set(['p1']);
    const salvar = vi.fn(async () => {});

    const criados = await converterPedidosPendentes(deps(salvar));

    expect(criados.map((o) => o.cliente)).toEqual(['Cliente p2']);
    expect(salvar).toHaveBeenCalledTimes(1);
  });

  it('a reserva só pega pedido novo, ou reserva que venceu', async () => {
    pendentes = [linha('p1')];

    await converterPedidosPendentes(deps());

    const reserva = chamadas.find((c) => (c.dados as { estado?: string })?.estado === 'convertendo')!;
    expect(reserva.filtros.find((f) => f.startsWith('or('))).toMatch(
      /^or\(estado\.eq\.novo,and\(estado\.eq\.convertendo,reservado_em\.lt\..+\)\)$/,
    );
  });

  it('se o orçamento não salvou, o pedido volta para a fila', async () => {
    pendentes = [linha('p1')];

    const criados = await converterPedidosPendentes(
      deps(async () => {
        throw new Error('sem rede');
      }),
    );

    expect(criados).toEqual([]);
    expect(estados('p1')).toEqual(['convertendo', 'novo']);
  });

  it('se o orçamento salvou e só a marcação falhou, NÃO volta para a fila', async () => {
    // Voltar para a fila aqui criaria um segundo rascunho no próximo login.
    pendentes = [linha('p1')];
    falhaAoMarcar = 1;

    const criados = await converterPedidosPendentes(deps());

    expect(criados).toHaveLength(1);
    expect(estados('p1')).toEqual(['convertendo', 'convertido', 'convertido']);
    expect(estados('p1')).not.toContain('novo');
  });

  it('tabela que ainda não existe não derruba o app', async () => {
    // É o caso até a migração 006 rodar no banco.
    erroAoListar = { message: 'relation "public.pedidos" does not exist' };

    await expect(converterPedidosPendentes(deps())).resolves.toEqual([]);
  });

  it('pedido já convertido nem é buscado', async () => {
    await converterPedidosPendentes(deps());

    expect(chamadas[0].filtros).toContain('estado!=convertido');
  });
});
