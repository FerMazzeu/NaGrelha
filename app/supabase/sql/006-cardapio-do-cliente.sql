-- Na Grelha — o cardápio que o cliente marca sozinho.
--
-- Hoje o cliente espera de dois a três dias por um orçamento, porque alguém
-- precisa sentar no Excel. A ideia do Alan é mandar um link: a pessoa abre,
-- marca o que quer, manda, e cai aqui dentro já montado.
--
-- Isso abre o banco para quem não tem login, então as duas regras abaixo são
-- o coração deste arquivo:
--
-- 1. Quem não tem login NÃO LÊ PREÇO. Nenhum. Nem de insumo, nem de evento.
-- 2. Quem não tem login só consegue ESCREVER um pedido, e nunca ler os que já
--    existem — senão o link viraria a lista de clientes da concorrência.

-- ---------------------------------------------------------------- cardápio --
/*
  Função em vez de view.

  Uma view sobre `itens_catalogo` liberada para anon herda as colunas todas se
  alguém mexer nela depois, e some do radar dos avisos de segurança. A função
  lista as colunas na mão: para o preço vazar, alguém precisa escrever `preco`
  aqui dentro, de propósito.
*/
create or replace function public.cardapio_publico()
returns table (id uuid, nome text, grupo text, categoria text, ordem int)
language sql
stable
security definer
set search_path to 'public'
as $$
  select i.id, i.nome, i.grupo, i.categoria, i.ordem
  from public.itens_catalogo i
  where i.ativo
  order by i.ordem, i.nome;
$$;

revoke all on function public.cardapio_publico() from public;
grant execute on function public.cardapio_publico() to anon, authenticated;

-- ----------------------------------------------------------------- pedidos --
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),

  cliente text not null,
  contato text not null default '',
  data date,
  local text not null default '',
  adultos int not null default 0,
  criancas int not null default 0,
  observacoes text not null default '',

  -- Os ids que a pessoa marcou. Array e não tabela filha porque um pedido é
  -- um papel preenchido uma vez, não um cadastro que se edita depois.
  itens uuid[] not null default '{}',

  -- O orçamento que nasceu deste pedido, quando alguém já o converteu. Serve
  -- para a lista saber o que ainda está esperando resposta.
  evento_id uuid references public.eventos(id) on delete set null,
  lido boolean not null default false,
  criado_em timestamptz not null default now(),

  -- Limites que valem como anti-besteira num endereço público: sem eles um
  -- robô grava um romance em `observacoes` e um array de dez mil ids.
  constraint pedido_tem_nome check (length(btrim(cliente)) between 2 and 120),
  constraint pedido_tem_item check (array_length(itens, 1) between 1 and 200),
  constraint pedido_contato_curto check (length(contato) <= 120),
  constraint pedido_local_curto check (length(local) <= 200),
  constraint pedido_observacoes_curtas check (length(observacoes) <= 2000),
  constraint pedido_convidados_plausiveis check (
    adultos between 0 and 5000 and criancas between 0 and 5000
  )
);

create index if not exists pedidos_criado_em on public.pedidos (criado_em desc);
create index if not exists pedidos_nao_lidos on public.pedidos (lido) where not lido;

/*
  Freio de enxurrada.

  O formulário é público e sem captcha. Vinte pedidos por hora é muito mais do
  que um buffet recebe e pouco o suficiente para que encher o banco dê
  trabalho. Se um dia atrapalhar uma feira movimentada, é um número só para
  mudar.
*/
create or replace function public.freia_pedidos()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if (select count(*) from public.pedidos where criado_em > now() - interval '1 hour') >= 20 then
    raise exception 'muitos pedidos seguidos; tente de novo daqui a pouco'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists freia_pedidos on public.pedidos;
create trigger freia_pedidos before insert on public.pedidos
for each row execute function public.freia_pedidos();

-- --------------------------------------------------------------------- RLS --
alter table public.pedidos enable row level security;

drop policy if exists "qualquer um manda um pedido" on public.pedidos;
create policy "qualquer um manda um pedido" on public.pedidos
  for insert to anon, authenticated with check (true);

-- Só insert para quem está de fora: sem esta separação, o mesmo link que
-- manda o pedido lê os pedidos de todo mundo.
drop policy if exists "só a equipe lê os pedidos" on public.pedidos;
create policy "só a equipe lê os pedidos" on public.pedidos
  for select to authenticated using (public.e_membro());

drop policy if exists "só a equipe mexe nos pedidos" on public.pedidos;
create policy "só a equipe mexe nos pedidos" on public.pedidos
  for update to authenticated using (public.e_membro()) with check (public.e_membro());

drop policy if exists "só a equipe apaga pedidos" on public.pedidos;
create policy "só a equipe apaga pedidos" on public.pedidos
  for delete to authenticated using (public.e_membro());
