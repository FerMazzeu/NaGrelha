-- Grupo do cardápio: em que aba do link do cliente a receita aparece.
--
-- O link era uma lista só, de entradas até bebidas, e com o café da manhã
-- (Cafezim) cadastrado ele ficou comprido e misturado. O Alan pediu abas,
-- "Churrasco, Sobremesa e Cafezin na Grelha", e que a equipe escolha no
-- catálogo em qual delas cada receita entra.
--
-- Fica no item, e não numa tabela de receitas, porque receita aqui não é
-- tabela: é o conjunto de itens com o mesmo preparo. A tela grava o mesmo
-- valor em todos os itens da receita. Vazio quer dizer "o padrão", que o app
-- decide pelo nome do preparo (doce vai para Sobremesa, Cafezim para Cafezin
-- na Grelha, o resto para Churrasco).

alter table public.itens_catalogo add column if not exists grupo_cardapio text;

-- O tipo de retorno muda, e `create or replace` não troca tipo de retorno.
drop function if exists public.cardapio_publico();

create function public.cardapio_publico()
returns table (id uuid, nome text, grupo text, categoria text, ordem int, foto text, grupo_cardapio text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select i.id, i.nome, i.grupo, i.categoria, i.ordem, i.foto, i.grupo_cardapio
  from public.itens_catalogo i
  where i.ativo and i.categoria not in ('estrutura', 'limpeza')
  order by i.ordem, i.nome;
$$;

revoke all on function public.cardapio_publico() from public;
grant execute on function public.cardapio_publico() to anon, authenticated;
