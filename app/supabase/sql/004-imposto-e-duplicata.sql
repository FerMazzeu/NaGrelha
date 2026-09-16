-- ============================================================================
-- Na Grelha — imposto por percentual e trava contra gravação duplicada
--
-- JA APLICADO no projeto NaGrelha (idwmchjvcmzdxljkaqdq), pelas migrations
-- `servico_por_percentual` e `travar_duplicata_nas_linhas_do_evento`. Fica aqui
-- porque o banco tem que ser reconstruivel a partir do repositorio.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. SERVICO COBRADO POR PERCENTUAL
--
-- O Alan pediu: "imposto sobre tudo", 7% do que ele cobra. Isso e diferente de
-- 7% do custo, porque o imposto entra no total sobre o qual ele incide. Quem
-- paga 7% sobre 100 fica com 93; entao o imposto de um orcamento de 100 e 7, e
-- nao 7% de 93.
--
-- A circularidade e resolvida no app (src/dominio/calculo.ts): com `base`
-- sendo tudo que nao e percentual e `f` a soma das fracoes,
--
--     total = base / (1 - f)
--
-- Aqui so guardamos a taxa. Zero significa valor fixo, que e como todo servico
-- funcionava ate agora.
-- ----------------------------------------------------------------------------

alter table public.servicos_catalogo add column if not exists percentual numeric not null default 0;
alter table public.evento_servicos  add column if not exists percentual numeric not null default 0;

comment on column public.servicos_catalogo.percentual is
  'Percentual sobre o total do orcamento. Zero usa valor_padrao como valor fixo.';
comment on column public.evento_servicos.percentual is
  'Percentual sobre o total do orcamento. Zero usa quantidade x valor.';

update public.servicos_catalogo set percentual = 7 where papel = 'imposto';


-- ----------------------------------------------------------------------------
-- 2. TRAVA CONTRA GRAVACAO DUPLICADA
--
-- Gravar um orcamento e apagar as linhas e reescrever todas. Quando duas
-- gravacoes se atropelam, as duas apagam antes de qualquer uma escrever, e o
-- evento fica com tudo em dobro. Foi o que aconteceu com o evento da ANA: 168
-- linhas para 84 itens, e o cliente viu o cardapio duplicado na lista de
-- compras.
--
-- O app agora enfileira as gravacoes (src/gravacao.ts), mas codigo novo esquece
-- disso. Aqui o banco recusa: `ordem` e a posicao da linha dentro do evento, e
-- duas linhas na mesma posicao nao existem. Numa corrida, a segunda gravacao
-- falha com erro visivel em vez de duplicar em silencio.
-- ----------------------------------------------------------------------------

create unique index if not exists evento_itens_ordem_unica
  on public.evento_itens (evento_id, ordem);

create unique index if not exists evento_servicos_ordem_unica
  on public.evento_servicos (evento_id, ordem);

create unique index if not exists evento_faixas_ordem_unica
  on public.evento_faixas (evento_id, ordem);


-- ----------------------------------------------------------------------------
-- CONFERENCIA
-- ----------------------------------------------------------------------------

-- o imposto ficou em 7%?
select nome, papel, percentual, valor_padrao from public.servicos_catalogo where percentual > 0;

-- algum evento ainda esta com linha em dobro?
select e.cliente,
       count(ei.*) as linhas,
       count(distinct ei.nome || '|' || ei.grupo) as itens_distintos
from public.eventos e
left join public.evento_itens ei on ei.evento_id = e.id
group by e.id, e.cliente
having count(ei.*) <> count(distinct ei.nome || '|' || ei.grupo);

-- as travas existem?
select indexname from pg_indexes
where schemaname = 'public' and indexname like '%_ordem_unica'
order by indexname;
