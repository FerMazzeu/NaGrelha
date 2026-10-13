-- Controle de caixa.
--
-- Substitui a planilha "CONTROLE CAIXA NA GRELHA", que tinha uma aba por ano
-- com os eventos (valor, entrada, restante, quanto o Alan e a Érica tiraram)
-- e, embaixo, o dinheiro no banco, em espécie e investido, menos o que já foi
-- recebido de evento que ainda vai acontecer.
--
-- Aqui o dinheiro vira lançamento: cada entrada e cada saída, com conta,
-- categoria e, quando tem, o evento e a pessoa. O resto é conta feita em
-- cima disso, no app: saldo, a receber, a pagar, caixa livre, resultado.
--
-- Só DONO enxerga. Dinheiro da empresa não é assunto de quem é da equipe, e
-- isso é garantido aqui no banco, não escondendo a aba.

-- ---------------------------------------------------------------- contas ---
create table if not exists public.contas_financeiras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null default 'banco'
    check (tipo in ('banco', 'especie', 'investimento', 'cartao')),
  -- O saldo no dia em que o controle começou. Lançamento pago ANTES dessa
  -- data já está dentro dele e não soma de novo: é o que deixa trazer o
  -- histórico antigo sem bagunçar o saldo de hoje.
  saldo_inicial numeric not null default 0,
  saldo_inicial_em date not null default current_date,
  ativo boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);

-- ------------------------------------------------------------ categorias ---
create table if not exists public.categorias_financeiras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('entrada', 'saida')),
  -- O grupo é o que monta o resultado: receita, custo do evento, equipe,
  -- pró-labore dos sócios, imposto, despesa fixa.
  grupo text not null default 'outros'
    check (grupo in ('receita', 'custo_evento', 'equipe', 'prolabore', 'imposto', 'despesa_fixa', 'investimento', 'outros')),
  ativo boolean not null default true,
  ordem int not null default 0
);

-- ----------------------------------------------------------- lançamentos ---
create table if not exists public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('entrada', 'saida', 'transferencia')),
  descricao text not null default '',
  valor numeric not null check (valor > 0),
  -- Quando vence. Sem `pago_em` o lançamento é previsto: conta a receber ou
  -- a pagar. Com `pago_em`, o dinheiro passou pela conta nesse dia.
  vencimento date not null,
  pago_em date,
  conta_id uuid references public.contas_financeiras (id) on delete restrict,
  -- Só na transferência: de `conta_id` para esta.
  conta_destino_id uuid references public.contas_financeiras (id) on delete restrict,
  categoria_id uuid references public.categorias_financeiras (id) on delete set null,
  evento_id uuid references public.eventos (id) on delete set null,
  membro_id uuid references public.membros (id) on delete set null,
  -- Quem recebeu ou pagou, quando não é alguém da equipe: o sócio (Alan e
  -- Érica não estão em `membros`), o fornecedor, o cliente.
  pessoa text not null default '',
  forma text not null default ''
    check (forma in ('', 'pix', 'dinheiro', 'cartao', 'boleto', 'transferencia', 'outro')),
  observacoes text not null default '',
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- Dinheiro que passou passou por alguma conta.
  constraint lancamento_pago_tem_conta check (pago_em is null or conta_id is not null),
  -- Transferência é sempre entre duas contas diferentes, e já aconteceu.
  constraint transferencia_completa check (
    tipo <> 'transferencia'
    or (conta_destino_id is not null and conta_destino_id <> conta_id and pago_em is not null)
  )
);

-- Para quem rodou a versão anterior deste arquivo, sem a coluna.
alter table public.lancamentos add column if not exists pessoa text not null default '';

create index if not exists lancamentos_pago_em on public.lancamentos (pago_em);
create index if not exists lancamentos_vencimento on public.lancamentos (vencimento) where pago_em is null;
create index if not exists lancamentos_evento on public.lancamentos (evento_id) where evento_id is not null;

create or replace function public.lancamento_atualizado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists lancamento_atualizado on public.lancamentos;
create trigger lancamento_atualizado
  before update on public.lancamentos
  for each row execute function public.lancamento_atualizado();

-- ------------------------------------------------------------------- RLS ---
alter table public.contas_financeiras enable row level security;
alter table public.categorias_financeiras enable row level security;
alter table public.lancamentos enable row level security;

drop policy if exists contas_dono on public.contas_financeiras;
create policy contas_dono on public.contas_financeiras
  for all to authenticated using (public.e_dono()) with check (public.e_dono());

drop policy if exists categorias_dono on public.categorias_financeiras;
create policy categorias_dono on public.categorias_financeiras
  for all to authenticated using (public.e_dono()) with check (public.e_dono());

drop policy if exists lancamentos_dono on public.lancamentos;
create policy lancamentos_dono on public.lancamentos
  for all to authenticated using (public.e_dono()) with check (public.e_dono());

revoke all on public.contas_financeiras, public.categorias_financeiras, public.lancamentos from anon;

-- --------------------------------------------------------------- partida ---
-- As contas da planilha do Alan. Saldo zero: quem é dono preenche o saldo
-- de hoje na tela, conferindo com o extrato.
insert into public.contas_financeiras (nome, tipo, ordem)
select v.nome, v.tipo, v.ordem
from (values
  ('Banco C6', 'banco', 1),
  ('Dinheiro em espécie', 'especie', 2),
  ('Investimento', 'investimento', 3)
) as v (nome, tipo, ordem)
where not exists (select 1 from public.contas_financeiras);

insert into public.categorias_financeiras (nome, tipo, grupo, ordem)
select v.nome, v.tipo, v.grupo, v.ordem
from (values
  ('Pagamento de evento', 'entrada', 'receita', 1),
  ('Outras receitas', 'entrada', 'receita', 2),
  ('Rendimento de investimento', 'entrada', 'outros', 3),
  ('Aporte dos sócios', 'entrada', 'outros', 4),
  ('Compras do evento (insumos)', 'saida', 'custo_evento', 10),
  ('Carvão e lenha', 'saida', 'custo_evento', 11),
  ('Locação de louça e equipamento', 'saida', 'custo_evento', 12),
  ('Frete', 'saida', 'custo_evento', 13),
  ('Descartáveis e limpeza', 'saida', 'custo_evento', 14),
  ('Cachê da equipe', 'saida', 'equipe', 20),
  ('Pró-labore dos sócios', 'saida', 'prolabore', 30),
  ('Imposto (DAS)', 'saida', 'imposto', 40),
  ('Taxa de cartão e banco', 'saida', 'despesa_fixa', 50),
  ('Combustível', 'saida', 'despesa_fixa', 51),
  ('Manutenção e equipamento', 'saida', 'despesa_fixa', 52),
  ('Marketing', 'saida', 'despesa_fixa', 53),
  ('Contador', 'saida', 'despesa_fixa', 54),
  ('Compra de equipamento', 'saida', 'investimento', 60),
  ('Outras despesas', 'saida', 'outros', 70)
) as v (nome, tipo, grupo, ordem)
where not exists (select 1 from public.categorias_financeiras);
