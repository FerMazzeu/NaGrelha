import { useEffect, useMemo, useState } from 'react';
import { repositorio } from '../dados/supabase';
import { EXTRAS_SUGERIDOS, ROTULO_CATEGORIA } from '../dominio/catalogo';
import { calcular, redistribuirCarnes } from '../dominio/calculo';
import {
  ROTULO_SITUACAO,
  type Apetite,
  type Categoria,
  type Escala,
  type Membro,
  type Orcamento,
  type Situacao,
} from '../dominio/tipos';
import { decimal, inteiro, novoId, quantidade, real } from '../formato';
import { textoDaListaDeCompras, textoDaProposta } from '../texto';
import { BotaoCopiar, Campo, CampoNumero, CampoTexto, Segmentado } from './Campos';

const CATEGORIAS: Categoria[] = ['carne', 'entrada', 'guarnicao'];
const METAS_DE_CARNE = [300, 350, 400, 450, 500];

export default function EditorDeOrcamento({
  orcamento,
  membros,
  aoMudar,
  aoVoltar,
  aoRemover,
}: {
  orcamento: Orcamento;
  membros: Membro[];
  aoMudar: (o: Orcamento) => void;
  aoVoltar: () => void;
  aoRemover: () => void;
}) {
  const [aba, setAba] = useState<'evento' | 'cardapio' | 'equipe' | 'custos' | 'resultado'>('evento');
  const resultado = useMemo(() => calcular(orcamento), [orcamento]);

  const mudar = (parcial: Partial<Orcamento>) =>
    aoMudar({ ...orcamento, ...parcial, atualizadoEm: new Date().toISOString() });

  const alternarItem = (id: string) =>
    mudar({
      selecionados: orcamento.selecionados.includes(id)
        ? orcamento.selecionados.filter((s) => s !== id)
        : [...orcamento.selecionados, id],
    });

  return (
    <div className="pb-32">
      <div className="sticky top-0 z-20 border-b border-borda bg-carvao/95 backdrop-blur">
        <div className="area flex items-center gap-3 py-3">
          <button type="button" onClick={aoVoltar} className="botao botao-linha !min-h-10 !px-3">
            Voltar
          </button>
          <p className="min-w-0 flex-1 truncate font-semibold">{orcamento.cliente || 'Orçamento sem nome'}</p>
          <button
            type="button"
            onClick={aoRemover}
            className="botao botao-linha !min-h-10 !px-3 text-sm !text-fumaca hover:!border-brasa hover:!text-brasa-clara"
          >
            Excluir
          </button>
        </div>

        <div className="area flex gap-1 overflow-x-auto pb-2">
          {(
            [
              ['evento', 'Evento'],
              ['cardapio', 'Cardápio'],
              ['equipe', 'Equipe'],
              ['custos', 'Custos'],
              ['resultado', 'Resultado'],
            ] as const
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAba(id)}
              aria-pressed={aba === id}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                aba === id ? 'bg-carvao-3 text-dourado' : 'text-fumaca hover:text-creme'
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="area py-6">
        {aba === 'evento' && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Cliente">
                <CampoTexto valor={orcamento.cliente} aoMudar={(v) => mudar({ cliente: v })} placeholder="Nome de quem contrata" />
              </Campo>
              <Campo rotulo="Contato">
                <CampoTexto valor={orcamento.contato} aoMudar={(v) => mudar({ contato: v })} placeholder="WhatsApp" inputMode="tel" />
              </Campo>
              <Campo rotulo="Data do evento">
                <input type="date" className="campo" value={orcamento.data} onChange={(e) => mudar({ data: e.target.value })} />
              </Campo>
              <Campo rotulo="Hora de servir">
                <input type="time" className="campo" value={orcamento.hora} onChange={(e) => mudar({ hora: e.target.value })} />
              </Campo>
              <Campo rotulo="Local">
                <CampoTexto valor={orcamento.local} aoMudar={(v) => mudar({ local: v })} placeholder="Cidade, chácara, salão" />
              </Campo>
            </div>

            <Campo rotulo="Situação" dica="É o que separa a agenda entre proposta e contrato fechado.">
              <Segmentado<Situacao>
                valor={orcamento.situacao}
                aoMudar={(v) => mudar({ situacao: v })}
                opcoes={(['orcado', 'confirmado', 'realizado', 'perdido'] as const).map((v) => ({
                  valor: v,
                  rotulo: ROTULO_SITUACAO[v],
                }))}
              />
            </Campo>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Adultos">
                <CampoNumero valor={orcamento.adultos} aoMudar={(v) => mudar({ adultos: v })} sufixo="pes." />
              </Campo>
              <Campo rotulo="Crianças" dica="Conta como meio adulto no cálculo.">
                <CampoNumero valor={orcamento.criancas} aoMudar={(v) => mudar({ criancas: v })} sufixo="pes." />
              </Campo>
            </div>

            <Campo rotulo="Apetite" dica="Ajusta tudo de uma vez, sem mexer item por item.">
              <Segmentado<Apetite>
                valor={orcamento.apetite}
                aoMudar={(v) => mudar({ apetite: v })}
                opcoes={[
                  { valor: 'leve', rotulo: 'Leve' },
                  { valor: 'normal', rotulo: 'Normal' },
                  { valor: 'forte', rotulo: 'Forte' },
                ]}
              />
            </Campo>

            <Campo rotulo="Observações" dica="Entra no fim da proposta enviada ao cliente.">
              <textarea
                className="campo min-h-24 py-3"
                value={orcamento.observacoes}
                onChange={(e) => mudar({ observacoes: e.target.value })}
                placeholder="Combinações, restrições, horário de servir"
              />
            </Campo>

            <p className="cartao p-4 text-sm text-fumaca">
              O cálculo usa <strong className="text-creme">{decimal(resultado.pessoasEquivalentes)} pessoas</strong>{' '}
              equivalentes, somando adultos, metade de cada criança e o apetite.
            </p>
          </div>
        )}

        {aba === 'cardapio' && (
          <div className="space-y-6">
            <div className="cartao p-4">
              <p className="rotulo">Carne por pessoa, no prato</p>
              <p className="metrica mt-1">{inteiro(resultado.carnePorPessoa)} g</p>
              <p className="mt-2 text-sm text-fumaca">
                São {decimal(resultado.carneCrua)} kg de carne crua para comprar. A diferença é osso, gordura e perda
                na brasa.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {METAS_DE_CARNE.map((meta) => (
                  <button
                    key={meta}
                    type="button"
                    className="botao botao-linha !min-h-9 !px-3 text-sm"
                    onClick={() =>
                      mudar({ itens: redistribuirCarnes(orcamento.itens, orcamento.selecionados, meta) })
                    }
                  >
                    {meta} g
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-fumaca">
                Redistribui entre os cortes marcados, mantendo a proporção entre eles.
              </p>
            </div>

            {CATEGORIAS.map((categoria) => (
              <section key={categoria}>
                <h2 className="titulo text-lg text-dourado">{ROTULO_CATEGORIA[categoria]}</h2>
                <div className="mt-3 space-y-2">
                  {orcamento.itens
                    .filter((i) => i.categoria === categoria)
                    .map((item) => {
                      const marcado = orcamento.selecionados.includes(item.id);
                      const linha = resultado.linhas.find((l) => l.item.id === item.id);
                      return (
                        <div
                          key={item.id}
                          className={`cartao p-3 transition-colors ${marcado ? '' : 'opacity-55'}`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => alternarItem(item.id)}
                              className="h-6 w-6 shrink-0 accent-[#c4261d]"
                              aria-label={`Incluir ${item.nome}`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold">{item.nome}</p>
                              {linha && (
                                <p className="text-sm text-fumaca">
                                  comprar {quantidade(linha.comprar, item.unidade)} · {real(linha.custo)}
                                </p>
                              )}
                            </div>
                            <div className="w-24 shrink-0">
                              <CampoNumero
                                valor={item.porPessoa}
                                aoMudar={(v) =>
                                  mudar({
                                    itens: orcamento.itens.map((i) =>
                                      i.id === item.id ? { ...i, porPessoa: v } : i,
                                    ),
                                  })
                                }
                                sufixo={item.unidade === 'kg' ? 'g' : 'un'}
                                aria-label={`${item.nome}, por pessoa`}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </section>
            ))}
          </div>
        )}

        {aba === 'custos' && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Carvão por kg de carne" dica="Quilos de carvão para cada quilo de carne crua.">
                <CampoNumero valor={orcamento.fatorCarvao} aoMudar={(v) => mudar({ fatorCarvao: v })} sufixo="kg" />
              </Campo>
              <Campo rotulo="Preço do carvão">
                <CampoNumero valor={orcamento.precoCarvao} aoMudar={(v) => mudar({ precoCarvao: v })} sufixo="R$/kg" />
              </Campo>
            </div>

            <p className="cartao p-4 text-sm text-fumaca">
              {inteiro(resultado.carvaoKg)} kg de carvão, {real(resultado.custoCarvao)}. Sai do peso de carne crua, e
              não do número de convidados, porque quem gasta brasa é quilo de carne na grelha.
            </p>

            <section>
              <div className="flex items-center justify-between">
                <h2 className="titulo text-lg text-dourado">Outros custos</h2>
                <button
                  type="button"
                  className="botao botao-linha !min-h-9 !px-3 text-sm"
                  onClick={() =>
                    mudar({
                      custosExtras: [...orcamento.custosExtras, { id: novoId(), descricao: '', valor: 0 }],
                    })
                  }
                >
                  Adicionar
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {orcamento.custosExtras.map((custo) => (
                  <div key={custo.id} className="cartao flex items-center gap-2 p-3">
                    <CampoTexto
                      valor={custo.descricao}
                      aoMudar={(v) =>
                        mudar({
                          custosExtras: orcamento.custosExtras.map((c) =>
                            c.id === custo.id ? { ...c, descricao: v } : c,
                          ),
                        })
                      }
                      placeholder="Descrição"
                      aria-label="Descrição do custo"
                    />
                    <div className="w-28 shrink-0">
                      <CampoNumero
                        valor={custo.valor}
                        aoMudar={(v) =>
                          mudar({
                            custosExtras: orcamento.custosExtras.map((c) =>
                              c.id === custo.id ? { ...c, valor: v } : c,
                            ),
                          })
                        }
                        sufixo="R$"
                        aria-label="Valor do custo"
                      />
                    </div>
                    <button
                      type="button"
                      aria-label={`Remover ${custo.descricao || 'custo'}`}
                      onClick={() =>
                        mudar({ custosExtras: orcamento.custosExtras.filter((c) => c.id !== custo.id) })
                      }
                      className="botao botao-linha !min-h-10 !w-10 shrink-0 !px-0 !text-fumaca"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {!orcamento.custosExtras.length && (
                  <p className="text-sm text-fumaca">Nada além das compras e do carvão.</p>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {EXTRAS_SUGERIDOS.filter(
                  (s) => !orcamento.custosExtras.some((c) => c.descricao === s),
                ).map((sugestao) => (
                  <button
                    key={sugestao}
                    type="button"
                    className="botao botao-linha !min-h-9 !px-3 text-sm"
                    onClick={() =>
                      mudar({
                        custosExtras: [...orcamento.custosExtras, { id: novoId(), descricao: sugestao, valor: 0 }],
                      })
                    }
                  >
                    + {sugestao}
                  </button>
                ))}
              </div>
            </section>

            <Campo
              rotulo="Margem sobre o custo"
              dica={`Custo mais ${inteiro(orcamento.margem)}%. Na venda isso vira ${decimal(
                resultado.margemSobrePreco,
              )}% de margem sobre o preço.`}
            >
              <CampoNumero valor={orcamento.margem} aoMudar={(v) => mudar({ margem: v })} sufixo="%" />
            </Campo>
          </div>
        )}

        {aba === 'equipe' && <EscalaDoEvento eventoId={orcamento.id} membros={membros} />}

        {aba === 'resultado' && <Resultado orcamento={orcamento} resultado={resultado} />}
      </div>

      {/* Barra fixa: o preço é o número que se olha o tempo todo, em qualquer aba. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-carvao/95 backdrop-blur">
        <div className="area flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="rotulo whitespace-nowrap">Preço fechado</p>
            <p className="metrica">{real(resultado.preco)}</p>
          </div>
          <div className="text-right text-sm text-fumaca">
            <p>{real(resultado.precoPorPessoa)} por pessoa</p>
            <p>
              custo {real(resultado.custoTotal)} · lucro{' '}
              <strong className={resultado.lucro >= 0 ? 'text-verde' : 'text-brasa-clara'}>
                {real(resultado.lucro)}
              </strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Resultado({
  orcamento,
  resultado,
}: {
  orcamento: Orcamento;
  resultado: ReturnType<typeof calcular>;
}) {
  const proposta = textoDaProposta(orcamento, resultado);
  const compras = textoDaListaDeCompras(orcamento, resultado);
  const zap = orcamento.contato.replace(/\D/g, '');

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="cartao p-4">
          <p className="rotulo">Preço fechado</p>
          <p className="metrica mt-1">{real(resultado.preco)}</p>
          <p className="mt-1 text-sm text-fumaca">{real(resultado.precoPorPessoa)} por pessoa</p>
        </div>
        <div className="cartao p-4">
          <p className="rotulo">Custo total</p>
          <p className="metrica mt-1 !text-creme">{real(resultado.custoTotal)}</p>
          <p className="mt-1 text-sm text-fumaca">{real(resultado.custoPorPessoa)} por pessoa</p>
        </div>
      </div>

      <div className="cartao divide-y divide-borda">
        {[
          ['Compras', real(resultado.custoItens)],
          ['Carvão', `${inteiro(resultado.carvaoKg)} kg · ${real(resultado.custoCarvao)}`],
          ['Outros custos', real(resultado.custosExtras)],
          ['Lucro', real(resultado.lucro)],
          ['Margem sobre o preço', `${decimal(resultado.margemSobrePreco)}%`],
          ['Carne crua', `${decimal(resultado.carneCrua)} kg`],
          ['Carne por pessoa, no prato', `${inteiro(resultado.carnePorPessoa)} g`],
        ].map(([rotulo, valor]) => (
          <div key={rotulo} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-fumaca">{rotulo}</span>
            <span className="font-semibold">{valor}</span>
          </div>
        ))}
      </div>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="titulo text-lg text-dourado">Proposta para o cliente</h2>
          <div className="flex gap-2">
            <BotaoCopiar texto={proposta} />
            {zap.length >= 10 && (
              <a
                className="botao botao-brasa"
                href={`https://wa.me/${zap.length <= 11 ? `55${zap}` : zap}?text=${encodeURIComponent(proposta)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Enviar no WhatsApp
              </a>
            )}
          </div>
        </div>
        <pre className="cartao mt-3 overflow-x-auto p-4 text-sm whitespace-pre-wrap font-sans text-creme">
          {proposta}
        </pre>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="titulo text-lg text-dourado">Lista de compras</h2>
          <BotaoCopiar texto={compras} />
        </div>
        <pre className="cartao mt-3 overflow-x-auto p-4 text-sm whitespace-pre-wrap font-sans text-creme">
          {compras}
        </pre>
      </section>
    </div>
  );
}

/**
 * Quem trabalha neste evento.
 *
 * O cachê entra aqui e não nos custos extras de propósito: é a escala que
 * decide quanto de mão de obra o evento tem, e digitar o mesmo número em dois
 * lugares é como planilha começa a mentir. O total aparece com um atalho para
 * jogar de uma vez nos custos.
 */
function EscalaDoEvento({ eventoId, membros }: { eventoId: string; membros: Membro[] }) {
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    repositorio
      .listarEscalas(eventoId)
      .then((e) => vivo && setEscalas(e))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [eventoId]);

  const recarregar = async () => setEscalas(await repositorio.listarEscalas(eventoId));

  const escalados = new Set(escalas.map((e) => e.membroId));
  const disponiveis = membros.filter((m) => !escalados.has(m.id));
  const totalCache = escalas.reduce((s, e) => s + e.cache, 0);

  if (carregando) return <p className="text-sm text-fumaca">Carregando escala...</p>;

  return (
    <div className="space-y-5">
      {!membros.length && (
        <p className="cartao p-4 text-sm text-fumaca">
          Nenhum membro cadastrado ainda. Cadastre a equipe na aba Equipe da tela inicial.
        </p>
      )}

      {escalas.length > 0 && (
        <div className="cartao p-4">
          <p className="rotulo">Mão de obra deste evento</p>
          <p className="metrica mt-1">{real(totalCache)}</p>
          <p className="mt-2 text-sm text-fumaca">
            {inteiro(escalas.length)} {escalas.length === 1 ? 'pessoa escalada' : 'pessoas escaladas'}. Lance este
            valor em Custos para ele entrar no preço.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {escalas.map((e) => {
          const membro = membros.find((m) => m.id === e.membroId);
          return (
            <div key={e.id} className="cartao flex items-center gap-3 p-3">
              <button
                type="button"
                onClick={async () => {
                  await repositorio.atualizarEscala({ ...e, confirmado: !e.confirmado });
                  await recarregar();
                }}
                aria-pressed={e.confirmado}
                className={`h-6 w-6 shrink-0 rounded-md border-2 ${
                  e.confirmado ? 'border-verde bg-verde/25 text-verde' : 'border-borda'
                }`}
                title={e.confirmado ? 'Confirmado' : 'Ainda não confirmou'}
              >
                {e.confirmado ? '✓' : ''}
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{membro?.nome ?? 'Membro removido'}</p>
                <p className="truncate text-sm text-fumaca">{e.funcao || membro?.funcao || 'sem função'}</p>
              </div>

              <div className="w-24 shrink-0">
                <CampoNumero
                  valor={e.cache}
                  aoMudar={async (v) => {
                    setEscalas((atuais) => atuais.map((x) => (x.id === e.id ? { ...x, cache: v } : x)));
                    await repositorio.atualizarEscala({ ...e, cache: v });
                  }}
                  sufixo="R$"
                  aria-label={`Cachê de ${membro?.nome ?? 'membro'}`}
                />
              </div>

              <button
                type="button"
                aria-label="Tirar da escala"
                className="botao botao-linha !min-h-10 !w-10 shrink-0 !px-0 !text-fumaca"
                onClick={async () => {
                  await repositorio.desescalar(e.id);
                  await recarregar();
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {disponiveis.length > 0 && (
        <div>
          <p className="rotulo mb-2">Escalar</p>
          <div className="flex flex-wrap gap-2">
            {disponiveis.map((m) => (
              <button
                key={m.id}
                type="button"
                className="botao botao-linha !min-h-9 !px-3 text-sm"
                onClick={async () => {
                  await repositorio.escalar(eventoId, m.id, m.funcao, m.cachePadrao);
                  await recarregar();
                }}
              >
                + {m.nome}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
