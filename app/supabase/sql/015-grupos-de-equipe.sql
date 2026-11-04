-- Grupos de equipe: um pacote de serviços com quantidade, aplicado de uma vez
-- no orçamento.
--
-- Todo orçamento recebia os mesmos oito ou nove serviços adicionados um a um
-- (churrasqueiro, assistente, cozinha, garçom vezes três, maître, caixa,
-- frete, imposto). O grupo guarda essa lista com um nome ("Até 50 pessoas") e
-- um toque põe tudo no orçamento.
--
-- `itens` é jsonb, e não tabela filha: são poucas linhas por grupo, lidas e
-- gravadas sempre inteiras. Cada uma é {"servico_id": uuid, "quantidade": n}.
-- O valor não fica aqui de propósito: ele vem do catálogo de serviços (e da
-- faixa de cachê) na hora de aplicar, para o grupo não congelar preço velho.

create table if not exists public.grupos_de_equipe (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  itens jsonb not null default '[]',
  ordem int not null default 999,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

alter table public.grupos_de_equipe enable row level security;

drop policy if exists grupos_de_equipe_equipe on public.grupos_de_equipe;
create policy grupos_de_equipe_equipe on public.grupos_de_equipe
  for all using (public.e_membro()) with check (public.e_membro());
