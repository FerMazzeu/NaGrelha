-- ============================================================================
-- Na Grelha — pendente de aplicar no Supabase
--
-- Cole isto no SQL Editor do projeto NaGrelha (idwmchjvcmzdxljkaqdq) e rode.
-- Foi escrito para ser idempotente: rodar duas vezes nao quebra nada.
--
-- Duas coisas:
--   1. o e-mail na tela de liberar acesso
--   2. o cron diario que impede a tabela de log do cron de crescer sem fim
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. E-MAIL NO PERFIL
--
-- A tela de liberar acesso mostra quem esta pendente, e quem libera precisa
-- reconhecer a pessoa. `auth.users` nao e legivel pelo navegador, entao o
-- e-mail e copiado para `perfis` no momento do cadastro.
-- ----------------------------------------------------------------------------

alter table public.perfis add column if not exists email text not null default '';

-- Preenche quem ja existe.
update public.perfis p
set email = u.email
from auth.users u
where u.id = p.id and p.email = '';

-- O trigger de cadastro passa a gravar o e-mail junto.
create or replace function public.ao_criar_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  primeiro boolean;
begin
  select count(*) = 0 into primeiro from public.perfis;

  insert into public.perfis (id, nome, email, papel, aprovado)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email,
    -- O primeiro vira dono e ja entra liberado, senao ninguem consegue
    -- aprovar ninguem e o app nasce trancado.
    case when primeiro then 'dono' else 'equipe' end,
    primeiro
  );

  return new;
end;
$$;

revoke execute on function public.ao_criar_usuario() from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- 2. CRON DIARIO DE LIMPEZA
--
-- O pg_cron registra CADA execucao em `cron.job_run_details`, e nunca apaga
-- nada sozinho. Um job de minuto em minuto enche isso com meio milhao de
-- linhas por ano, e ai a tabela comeca a pesar nas consultas do proprio cron.
--
-- Este job roda uma vez por dia e joga fora o que tem mais de 7 dias. Sete
-- dias e o suficiente para investigar uma falha de fim de semana.
-- ----------------------------------------------------------------------------

create extension if not exists pg_cron with schema extensions;

-- Remove a versao anterior antes de recriar, para nao duplicar o agendamento.
select cron.unschedule('limpar-log-do-cron')
where exists (select 1 from cron.job where jobname = 'limpar-log-do-cron');

-- 06:00 UTC = 03:00 em Brasilia, quando ninguem esta orcando.
select cron.schedule(
  'limpar-log-do-cron',
  '0 6 * * *',
  $$ delete from cron.job_run_details where end_time < now() - interval '7 days' $$
);


-- ----------------------------------------------------------------------------
-- CONFERENCIA
--
-- Cron que falha o faz em silencio: o agendamento existe, a execucao quebra, e
-- ninguem descobre. Rode as duas consultas abaixo amanha para confirmar que
-- ele rodou de verdade, em vez de confiar que foi agendado.
-- ----------------------------------------------------------------------------

-- o job existe e esta ativo?
select jobid, jobname, schedule, active from cron.job where jobname = 'limpar-log-do-cron';

-- rodou? (`status` tem que ser 'succeeded')
select jobid, status, start_time, return_message
from cron.job_run_details
where command like '%job_run_details%'
order by start_time desc
limit 5;

-- quanto o log esta ocupando hoje
select count(*) as linhas_no_log,
       pg_size_pretty(pg_total_relation_size('cron.job_run_details')) as tamanho
from cron.job_run_details;
