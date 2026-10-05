-- Litro como terceira unidade, ao lado de quilo e unidade.
--
-- Entrou pelo chopp: o Alan compra barril de 30 e de 50 litros, e com o item
-- "por unidade" ele fazia a conta de cabeça. Só alarga o que o banco aceita:
-- nenhum item existente muda.

alter table public.itens_catalogo drop constraint if exists itens_catalogo_unidade_check;
alter table public.itens_catalogo
  add constraint itens_catalogo_unidade_check check (unidade in ('kg', 'un', 'l'));

alter table public.evento_itens drop constraint if exists evento_itens_unidade_check;
alter table public.evento_itens
  add constraint evento_itens_unidade_check check (unidade in ('kg', 'un', 'l'));
