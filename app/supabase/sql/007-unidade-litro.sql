-- Como se consome e como se compra, separados.
--
-- 1. Litro como terceira unidade, ao lado de quilo e unidade. Entrou pelo
--    chopp, que se bebe em litro.
-- 2. `embalagens`: os tamanhos em que o item é vendido, na unidade do preço.
--    O chopp vem em barril de 30 e de 50 L: `{30,50}`. Vazio é "compra o
--    quanto precisar", que é como todo item existente continua.
--
-- Só alarga o que o banco aceita e acrescenta coluna com padrão vazio:
-- nenhum item existente muda de valor.

alter table public.itens_catalogo drop constraint if exists itens_catalogo_unidade_check;
alter table public.itens_catalogo
  add constraint itens_catalogo_unidade_check check (unidade in ('kg', 'un', 'l'));

alter table public.evento_itens drop constraint if exists evento_itens_unidade_check;
alter table public.evento_itens
  add constraint evento_itens_unidade_check check (unidade in ('kg', 'un', 'l'));

alter table public.itens_catalogo add column if not exists embalagens numeric[] not null default '{}';
alter table public.evento_itens add column if not exists embalagens numeric[] not null default '{}';
