-- Foto no cardápio do cliente.
--
-- A Érica cadastrou as sobremesas uma a uma (bolo de 18, 25, 40 e 60 fatias,
-- brigadeiros, churros, beijinho) e o link mostrava só "Sobremesa
-- serendipiti". O Alan pediu foto junto: "isso aí é um item que muitas vezes
-- se vende pela imagem e não pelo nome".
--
-- A foto mora num bucket PÚBLICO, separado do `midias`. O `midias` é privado
-- e só abre por link assinado, que expira; o cliente sem login não tem como
-- assinar nada. E foto de brigadeiro não é segredo: ela está no Instagram.

-- --------------------------------------------------------------- coluna --
-- Caminho no bucket `cardapio`, e não URL: a URL pública se monta no app, e
-- trocar de domínio não deixa link quebrado no banco. Vazio é "sem foto".
alter table public.itens_catalogo add column if not exists foto text not null default '';

-- --------------------------------------------------------------- bucket --
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cardapio', 'cardapio', true, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Ler é público pelo próprio bucket. Escrever, só a equipe.
drop policy if exists "equipe envia foto do cardapio" on storage.objects;
create policy "equipe envia foto do cardapio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cardapio' and public.e_membro());

drop policy if exists "equipe troca foto do cardapio" on storage.objects;
create policy "equipe troca foto do cardapio" on storage.objects
  for update to authenticated
  using (bucket_id = 'cardapio' and public.e_membro())
  with check (bucket_id = 'cardapio' and public.e_membro());

drop policy if exists "equipe apaga foto do cardapio" on storage.objects;
create policy "equipe apaga foto do cardapio" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cardapio' and public.e_membro());

-- ----------------------------------------------------- cardápio público --
-- O tipo de retorno muda, e `create or replace` não troca tipo de retorno.
drop function if exists public.cardapio_publico();

create function public.cardapio_publico()
returns table (id uuid, nome text, grupo text, categoria text, ordem int, foto text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select i.id, i.nome, i.grupo, i.categoria, i.ordem, i.foto
  from public.itens_catalogo i
  where i.ativo and i.categoria not in ('estrutura', 'limpeza')
  order by i.ordem, i.nome;
$$;

revoke all on function public.cardapio_publico() from public;
grant execute on function public.cardapio_publico() to anon, authenticated;
