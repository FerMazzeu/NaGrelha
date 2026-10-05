-- Na Grelha — o cardápio que o cliente marca sozinho.
--
-- Hoje o cliente espera de dois a três dias por um orçamento, porque alguém
-- precisa sentar no Excel. Agora a equipe manda um link: a pessoa abre, diz
-- quem é, onde e quando é a festa e quantos vêm, marca os pratos que quer, e
-- manda. O app transforma isso num orçamento em rascunho, que a equipe
-- confere antes de mandar a proposta.
--
-- Isso abre o banco para quem não tem login, então três regras são o coração
-- deste arquivo:
--
-- 1. Quem não tem login NÃO LÊ PREÇO. Nenhum: nem de insumo, nem de evento,
--    nem o percentual que criança paga.
-- 2. Quem não tem login só ESCREVE um pedido, e nunca lê os que já existem —
--    senão o link viraria a lista de clientes para qualquer um.
-- 3. O pedido não vira orçamento sozinho no banco. Quem converte é o app, com
--    a mesma regra de orçamento novo que a equipe já usa (serviços, cachê
--    pela tabela, margem). Repetir essa regra em SQL seria ter duas, e as
--    duas acabariam discordando.

-- --------------------------------------------------------- situação nova --
/*
  'rascunho' é o orçamento que nasceu do link e ninguém conferiu ainda.

  O tipo da coluna `eventos.situacao` foi criado fora deste repositório, então
  o bloco abaixo não supõe nada: se for enum, ganha o valor; se for texto com
  CHECK, o CHECK é trocado por um que aceita os cinco.
*/
do $$
declare
  tipo text;
  restricao record;
begin
  select t.typname into tipo
  from pg_attribute a
  join pg_type t on t.oid = a.atttypid
  where a.attrelid = 'public.eventos'::regclass and a.attname = 'situacao';

  if exists (select 1 from pg_type where typname = tipo and typtype = 'e') then
    execute format('alter type public.%I add value if not exists %L', tipo, 'rascunho');
  else
    for restricao in
      select conname from pg_constraint
      where conrelid = 'public.eventos'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%situacao%'
    loop
      execute format('alter table public.eventos drop constraint %I', restricao.conname);
    end loop;

    alter table public.eventos add constraint eventos_situacao_valida
      check (situacao in ('rascunho', 'orcado', 'confirmado', 'realizado', 'perdido'));
  end if;
end;
$$;

-- -------------------------------------------------------------- cardápio --
/*
  Função em vez de view.

  Uma view sobre `itens_catalogo` liberada para anon herda as colunas todas se
  alguém mexer nela depois. A função lista as colunas na mão: para o preço
  vazar, alguém precisa escrever `preco` aqui dentro, de propósito.

  Louça e limpeza nem saem daqui: não são escolha do cliente, e listar
  "detergente" num cardápio de festa é estranho.
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
  where i.ativo and i.categoria not in ('estrutura', 'limpeza')
  order by i.ordem, i.nome;
$$;

/* Faixa de idade sem o percentual: quanto criança paga é conta da equipe. */
create or replace function public.faixas_publicas()
returns table (id uuid, nome text, idade_min int, idade_max int)
language sql
stable
security definer
set search_path to 'public'
as $$
  select f.id, f.nome, f.idade_min, f.idade_max
  from public.faixas_etarias f
  order by f.idade_min;
$$;

revoke all on function public.cardapio_publico() from public;
revoke all on function public.faixas_publicas() from public;
grant execute on function public.cardapio_publico() to anon, authenticated;
grant execute on function public.faixas_publicas() to anon, authenticated;

-- --------------------------------------------------------------- pedidos --
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),

  cliente text not null,
  contato text not null,
  tipo_evento text not null default 'aniversario',
  data date,
  hora text not null default '',
  local text not null default '',
  adultos int not null default 0,
  -- [{ "faixa_id": uuid, "quantidade": int }], uma entrada por faixa de idade.
  criancas jsonb not null default '[]',
  observacoes text not null default '',

  -- Os ids marcados. Array e não tabela filha: um pedido é um papel
  -- preenchido uma vez, não um cadastro que se edita depois.
  itens uuid[] not null default '{}',

  /*
    novo        → ninguém converteu ainda
    convertendo → um app reservou e está montando o orçamento
    convertido  → virou orçamento, e não volta a virar

    O estado, e não só o `evento_id`, porque apagar o rascunho zera o
    `evento_id` pela chave estrangeira. Se a regra fosse "sem evento_id =
    converter", o rascunho apagado ressuscitaria no próximo login.
  */
  estado text not null default 'novo',
  reservado_em timestamptz,
  evento_id uuid references public.eventos(id) on delete set null,
  criado_em timestamptz not null default now(),

  -- Limites que valem como anti-besteira num endereço público.
  constraint pedido_tem_nome check (length(btrim(cliente)) between 2 and 120),
  constraint pedido_tem_contato check (length(btrim(contato)) between 8 and 120),
  constraint pedido_tem_item check (array_length(itens, 1) between 1 and 300),
  constraint pedido_tipo_valido check (tipo_evento in ('aniversario', 'casamento')),
  constraint pedido_hora_curta check (length(hora) <= 10),
  constraint pedido_local_curto check (length(local) <= 200),
  constraint pedido_observacoes_curtas check (length(observacoes) <= 2000),
  constraint pedido_criancas_lista check (jsonb_typeof(criancas) = 'array' and jsonb_array_length(criancas) <= 20),
  constraint pedido_convidados_plausiveis check (adultos between 1 and 5000),
  constraint pedido_estado_valido check (estado in ('novo', 'convertendo', 'convertido'))
);

create index if not exists pedidos_pendentes on public.pedidos (criado_em) where estado <> 'convertido';

/*
  Freio de enxurrada.

  O formulário é público e sem captcha. Vinte pedidos por hora é muito mais do
  que um buffet recebe, e pouco o bastante para que encher o banco dê
  trabalho. Se um dia atrapalhar, é um número só para mudar.
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
  -- Quem está de fora não escolhe o estado nem aponta para evento nenhum.
  new.estado := 'novo';
  new.evento_id := null;
  new.reservado_em := null;
  new.criado_em := now();
  return new;
end;
$$;

drop trigger if exists freia_pedidos on public.pedidos;
create trigger freia_pedidos before insert on public.pedidos
for each row execute function public.freia_pedidos();

-- ------------------------------------------------------------------- RLS --
alter table public.pedidos enable row level security;

drop policy if exists "qualquer um manda um pedido" on public.pedidos;
create policy "qualquer um manda um pedido" on public.pedidos
  for insert to anon, authenticated with check (true);

-- Só insert para quem está de fora: sem esta separação, o mesmo link que
-- manda o pedido leria os pedidos de todo mundo.
drop policy if exists "só a equipe lê os pedidos" on public.pedidos;
create policy "só a equipe lê os pedidos" on public.pedidos
  for select to authenticated using (public.e_membro());

drop policy if exists "só a equipe mexe nos pedidos" on public.pedidos;
create policy "só a equipe mexe nos pedidos" on public.pedidos
  for update to authenticated using (public.e_membro()) with check (public.e_membro());

drop policy if exists "só a equipe apaga pedidos" on public.pedidos;
create policy "só a equipe apaga pedidos" on public.pedidos
  for delete to authenticated using (public.e_membro());

-- Sem isto o anon nem chega na RLS: a tabela nova nasce sem permissão.
grant insert on public.pedidos to anon, authenticated;
grant select, update, delete on public.pedidos to authenticated;
