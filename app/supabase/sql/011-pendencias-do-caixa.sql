-- Pendências do caixa: o que alguém precisa conferir e responder.
--
-- A importação da planilha de caixa sempre deixa dúvida que só o Alan sabe
-- responder ("o que é BASF?", "o Wilson pagou o resto?"). Antes isso ia por
-- mensagem e se perdia. Aqui vira uma lista dentro do caixa: cada ponto com
-- o evento, a resposta de quem conferiu e quando foi resolvido.
--
-- Mesma regra do resto do caixa: só dono.

create table if not exists public.pendencias_financeiras (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  detalhe text not null default '',
  evento_id uuid references public.eventos (id) on delete set null,
  valor numeric,
  situacao text not null default 'aberta' check (situacao in ('aberta', 'resolvida')),
  resposta text not null default '',
  resolvida_em timestamptz,
  resolvida_por uuid,
  criado_em timestamptz not null default now()
);

alter table public.pendencias_financeiras enable row level security;

drop policy if exists pendencias_dono on public.pendencias_financeiras;
create policy pendencias_dono on public.pendencias_financeiras
  for all to authenticated using (public.e_dono()) with check (public.e_dono());

revoke all on public.pendencias_financeiras from anon;
