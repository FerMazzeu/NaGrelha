-- Evento fechado fora do app.
--
-- O Alan fechou festa pela planilha e pelo WhatsApp antes de o app existir.
-- Esses eventos entram só com o que se sabe: quem, quando, quantos e por
-- quanto. Não há cardápio para calcular o preço, então ele fica guardado.
--
-- `valor_fechado` nulo é o orçamento montado no app, cujo preço é a conta.
-- Preenchido, é o valor combinado com o cliente, e manda no lugar da conta.
--
-- Rodar ANTES de publicar o app novo: a função 008 ignora a chave nova, e o
-- evento externo seria gravado sem valor.

alter table public.eventos
  add column if not exists valor_fechado numeric
  check (valor_fechado is null or valor_fechado >= 0);

comment on column public.eventos.valor_fechado is
  'Preço combinado no evento fechado fora do app. Nulo: orçamento montado no app, preço calculado.';

-- A mesma função da 008, gravando também `valor_fechado`.

create or replace function public.salvar_orcamento(p jsonb, p_versao timestamptz default null)
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid := (p->'evento'->>'id')::uuid;
  v_atual timestamptz;
  v_nova timestamptz;
begin
  if v_id is null then
    raise exception 'orçamento sem id';
  end if;

  -- Trava a linha: duas gravações do mesmo orçamento esperam uma pela outra.
  select atualizado_em into v_atual from eventos where id = v_id for update;

  -- Tinha versão e a linha sumiu: foi excluído. Gravar agora o recriaria.
  if p_versao is not null and v_atual is null then
    raise exception 'ORCAMENTO_EXCLUIDO'
      using hint = 'Este orçamento foi excluído.';
  end if;

  if p_versao is not null and v_atual <> p_versao then
    raise exception 'ORCAMENTO_ALTERADO'
      using hint = 'Este orçamento foi alterado em outro aparelho.';
  end if;

  insert into eventos (
    id, cliente, contato, data, hora, local, observacoes, situacao, tipo_evento,
    adultos, criancas, apetite, duracao_horas, margem, fator_carvao, preco_carvao,
    valor_fechado
  )
  select
    id, cliente, contato, data, hora, local, observacoes, situacao, tipo_evento,
    adultos, criancas, apetite, duracao_horas, margem, fator_carvao, preco_carvao,
    valor_fechado
  from jsonb_populate_record(null::eventos, p->'evento')
  on conflict (id) do update set
    cliente = excluded.cliente,
    contato = excluded.contato,
    data = excluded.data,
    hora = excluded.hora,
    local = excluded.local,
    observacoes = excluded.observacoes,
    situacao = excluded.situacao,
    tipo_evento = excluded.tipo_evento,
    adultos = excluded.adultos,
    criancas = excluded.criancas,
    apetite = excluded.apetite,
    duracao_horas = excluded.duracao_horas,
    margem = excluded.margem,
    fator_carvao = excluded.fator_carvao,
    preco_carvao = excluded.preco_carvao,
    -- App antigo (aba aberta antes da atualização) não manda a chave. Sem
    -- este cuidado, ele apagaria o valor do evento externo ao gravar.
    valor_fechado = case
      when p->'evento' ? 'valor_fechado' then excluded.valor_fechado
      else eventos.valor_fechado
    end,
    atualizado_em = now()
  returning atualizado_em into v_nova;

  delete from evento_itens where evento_id = v_id;
  insert into evento_itens (
    evento_id, item_id, nome, grupo, categoria, unidade, por_pessoa,
    rendimento, preco, embalagens, selecionado, ordem
  )
  select
    v_id, item_id, nome, grupo, categoria, unidade, por_pessoa,
    rendimento, preco, coalesce(embalagens, '{}'), selecionado, ordem
  from jsonb_populate_recordset(null::evento_itens, coalesce(p->'itens', '[]'));

  delete from evento_custos where evento_id = v_id;
  insert into evento_custos (evento_id, descricao, valor)
  select v_id, descricao, valor
  from jsonb_populate_recordset(null::evento_custos, coalesce(p->'custos', '[]'));

  delete from evento_servicos where evento_id = v_id;
  insert into evento_servicos (
    evento_id, servico_id, nome, papel, pessoa, quantidade, valor,
    percentual, valor_manual, ordem
  )
  select
    v_id, servico_id, nome, papel, pessoa, quantidade, valor,
    percentual, valor_manual, ordem
  from jsonb_populate_recordset(null::evento_servicos, coalesce(p->'servicos', '[]'));

  delete from evento_faixas where evento_id = v_id;
  insert into evento_faixas (evento_id, faixa_id, nome, percentual, quantidade, ordem)
  select v_id, faixa_id, nome, percentual, quantidade, ordem
  from jsonb_populate_recordset(null::evento_faixas, coalesce(p->'faixas', '[]'));

  return v_nova;
end;
$$;

revoke all on function public.salvar_orcamento(jsonb, timestamptz) from public, anon;
grant execute on function public.salvar_orcamento(jsonb, timestamptz) to authenticated;
