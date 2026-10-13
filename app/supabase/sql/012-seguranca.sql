-- Revisão de segurança de 13/10/2026.
--
-- 1. AUTOAPROVAÇÃO. O cadastro é aberto e a policy `perfis_edita_o_proprio`
--    deixava a pessoa mudar o próprio perfil desde que o papel ficasse igual.
--    Ela travava o papel, mas não o `aprovado`: qualquer um criava conta,
--    mandava {"aprovado": true} para o próprio perfil e virava membro, lendo
--    clientes, catálogo com preço e equipe. Agora só dono muda `aprovado` e
--    `papel`, e isso é conferido num trigger, que vale para qualquer policy.
--
-- 2. Funções de trigger com SECURITY DEFINER executáveis por anon. Não dá
--    para chamá-las por RPC na prática, mas não há motivo para o grant.
--
-- 3. Pedido público: os campos livres que ainda não tinham limite.
--
-- 4. Bucket de mídia sem limite de tamanho.
--
-- 5. Anon com grant amplo nas tabelas internas (padrão do Supabase). A RLS já
--    barrava; tirar o grant é a segunda tranca. Fica só o que a página pública
--    do pedido usa.

-- ------------------------------------------------------------- perfis ---
create or replace function public.protege_perfil()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Quem chama pelo app (anon/authenticated) e não é dono não muda o que dá
  -- acesso: aprovação, papel, id, e-mail. O painel e o service role passam.
  if current_user in ('anon', 'authenticated') and not public.e_dono() then
    if new.aprovado is distinct from old.aprovado
      or new.papel is distinct from old.papel
      or new.id is distinct from old.id
      or new.email is distinct from old.email
      or new.criado_em is distinct from old.criado_em then
      raise exception 'só quem é dono muda aprovação e papel'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protege_perfil on public.perfis;
create trigger protege_perfil before update on public.perfis
  for each row execute function public.protege_perfil();

-- A policy também passa a exigir o `aprovado` de antes: duas trancas.
drop policy if exists perfis_edita_o_proprio on public.perfis;
create policy perfis_edita_o_proprio on public.perfis
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and papel = (select p.papel from public.perfis p where p.id = auth.uid())
    and aprovado = (select p.aprovado from public.perfis p where p.id = auth.uid())
  );

-- ------------------------------------------------- funções de trigger ---
revoke execute on function public.freia_pedidos() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.protege_perfil() from public, anon, authenticated;

-- ------------------------------------------------------------- pedidos ---
-- Cada criança: um uuid de faixa e uma quantidade plausível. Sem isto, um
-- elemento podia ter megabytes ou quantidade 1e308.
create or replace function public.criancas_validas(c jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(bool_and(
    jsonb_typeof(e) = 'object'
    and (e->>'faixa_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and jsonb_typeof(e->'quantidade') = 'number'
    and (e->>'quantidade')::numeric between 0 and 1000
  ), true)
  from jsonb_array_elements(c) e;
$$;

alter table public.pedidos drop constraint if exists pedido_criancas_validas;
alter table public.pedidos add constraint pedido_criancas_validas
  check (pg_column_size(criancas) < 4000 and public.criancas_validas(criancas)) not valid;

alter table public.pedidos drop constraint if exists pedido_data_plausivel;
alter table public.pedidos add constraint pedido_data_plausivel
  check (data is null or data between date '2024-01-01' and date '2035-12-31') not valid;

-- ------------------------------------------------------------- mídia ---
-- 25 MB por arquivo: foto de celular, áudio longo e planilha cabem com folga.
update storage.buckets set file_size_limit = 25 * 1024 * 1024 where id = 'midias';

-- ---------------------------------------------------- grants de anon ---
revoke all on all tables in schema public from anon;
grant insert on public.pedidos to anon;
