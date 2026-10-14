-- Contrato com assinatura eletrônica por código no e-mail.
--
-- O link vai para o cliente junto com a proposta. Ele abre, vê o contrato já
-- com os dados do orçamento, preenche nome, CPF e endereço, recebe um código
-- de 6 dígitos no e-mail e assina. É assinatura eletrônica simples (MP
-- 2.200-2/2001, art. 10, § 2º; Lei 14.063/2020): o que a sustenta são as
-- evidências guardadas aqui, e o texto exato que foi assinado, com o hash.
--
-- Quem é de fora NUNCA lê esta tabela direto: o cliente fala com a edge
-- function `contrato`, que usa a service role e só devolve o contrato do
-- token que ele tem. Por isso não há policy para anon.

create table if not exists public.contratos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos (id) on delete cascade,
  -- O link do cliente. Gerado no banco, nunca no navegador: 24 bytes
  -- aleatórios, impossível de adivinhar ou de enumerar.
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  situacao text not null default 'enviado' check (situacao in ('enviado', 'assinado', 'cancelado')),

  -- Os dados do orçamento congelados no envio: mudar o orçamento depois não
  -- muda o contrato que o cliente está lendo.
  conteudo jsonb not null,
  -- O que o cliente preencheu: nome, CPF, endereço, e-mail, telefone.
  contratante jsonb not null default '{}',

  enviado_por uuid default auth.uid(),
  enviado_em timestamptz not null default now(),
  visualizado_em timestamptz,

  -- Código de assinatura: só o hash fica guardado, com validade e tentativas.
  codigo_hash text,
  codigo_email text,
  codigo_expira timestamptz,
  codigo_tentativas int not null default 0,
  codigos_enviados int not null default 0,
  ultimo_codigo_em timestamptz,

  -- As evidências da assinatura.
  assinado_em timestamptz,
  assinatura jsonb,
  texto_assinado text,
  hash_documento text,

  constraint conteudo_e_objeto check (jsonb_typeof(conteudo) = 'object')
);

create index if not exists contratos_evento on public.contratos (evento_id);

alter table public.contratos enable row level security;

-- A equipe acompanha a situação do contrato do evento.
drop policy if exists contratos_equipe_le on public.contratos;
create policy contratos_equipe_le on public.contratos
  for select to authenticated using (public.e_membro());

-- Gerar e cancelar é de quem responde pelo buffet: o envio vale como aceite.
drop policy if exists contratos_dono_cria on public.contratos;
create policy contratos_dono_cria on public.contratos
  for insert to authenticated with check (public.e_dono() and enviado_por = auth.uid());

drop policy if exists contratos_dono_cancela on public.contratos;
create policy contratos_dono_cancela on public.contratos
  for update to authenticated using (public.e_dono()) with check (public.e_dono());

revoke all on public.contratos from anon;
-- Pelo app, o dono só cancela: o resto da linha é escrito pela função.
revoke update, delete, truncate on public.contratos from authenticated;
grant update (situacao) on public.contratos to authenticated;

-- Assinado não volta atrás: nem o dono cancela um contrato já assinado.
create or replace function public.protege_contrato()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.situacao = 'assinado' and current_user in ('anon', 'authenticated') then
    raise exception 'contrato assinado não pode ser alterado nem apagado'
      using errcode = 'insufficient_privilege';
  end if;
  -- No delete, devolver `new` (nulo) cancelaria em silêncio.
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists protege_contrato on public.contratos;
create trigger protege_contrato before update or delete on public.contratos
  for each row execute function public.protege_contrato();

revoke execute on function public.protege_contrato() from public, anon, authenticated;
