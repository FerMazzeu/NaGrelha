import { useMemo, useState } from 'react';
import { CATEGORIAS, ROTULO_CATEGORIA } from '../dominio/catalogo';
import type { Categoria, Item } from '../dominio/tipos';
import { casaBusca, inteiro, real } from '../formato';
import type { Comparacao } from '../importacao';
import { Lupa } from './Icones';

/**
 * Tudo que a planilha vai mudar, numa tabela só.
 *
 * Eram três blocos separados: preço, quantidade e item novo. Quem conferia
 * tinha que rolar três listas e entender por que o mesmo item aparecia em duas
 * delas. Agora é uma linha por item, dizendo o que muda nele, e a linha abre
 * para editar no lugar.
 *
 * O que dá para corrigir depende do que é: num item que já existe, só o valor
 * novo, porque nome e preparo são do catálogo. Num item novo, tudo.
 */

export type Rascunho = {
  nome: string;
  preco: number;
  porPessoa: number;
  categoria: Categoria;
  rendimento: number;
  unidade: Item['unidade'];
};

/** Uma linha da tabela, já resolvida: de onde veio, o que muda, o que editar. */
export type Mudanca = {
  chave: string;
  nome: string;
  preparo: string;
  unidade: Item['unidade'];
  /** `novo` cria item; `precoENota` altera um que já existe. */
  tipo: 'novo' | 'existente';
  /** Preço de agora no catálogo, quando existe. */
  precoAtual: number | null;
  porPessoaAtual: number | null;
  rascunho: Rascunho;
};

export const incompleto = (m: Mudanca) =>
  m.tipo === 'novo' && (m.rascunho.preco <= 0 || m.rascunho.porPessoa <= 0);

/** Descreve em uma linha o que muda, para a lista fechada. */
function resumo(m: Mudanca) {
  if (m.tipo === 'novo') return null;
  const mudaPreco = m.precoAtual !== null && Math.abs(m.precoAtual - m.rascunho.preco) > 0.005;
  const mudaQuantidade =
    m.porPessoaAtual !== null && Math.abs(m.porPessoaAtual - m.rascunho.porPessoa) > 0.005;
  return { mudaPreco, mudaQuantidade };
}

export default function Mudancas({
  comparacao,
  rascunhos,
  recusados,
  aoAlternar,
  aoMudar,
  montarLinhas,
}: {
  comparacao: Comparacao;
  rascunhos: Record<string, Rascunho>;
  recusados: Set<string>;
  aoAlternar: (chave: string) => void;
  aoMudar: (chave: string, r: Rascunho) => void;
  montarLinhas: (c: Comparacao, rascunhos: Record<string, Rascunho>) => Mudanca[];
}) {
  const [busca, setBusca] = useState('');
  const [soFaltantes, setSoFaltantes] = useState(false);

  const todas = useMemo(
    () => montarLinhas(comparacao, rascunhos),
    [comparacao, rascunhos, montarLinhas],
  );

  const marcada = (m: Mudanca) => !recusados.has(m.chave);
  const faltam = todas.filter((m) => marcada(m) && incompleto(m));

  const visiveis = todas.filter((m) => {
    if (soFaltantes && !incompleto(m)) return false;
    if (!busca.trim()) return true;
    return casaBusca(busca, m.nome) || casaBusca(busca, m.preparo);
  });

  const porPreparo = useMemo(() => {
    const mapa = new Map<string, Mudanca[]>();
    for (const m of visiveis) {
      const chave = m.preparo || 'Sem preparo';
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(m);
    }
    return [...mapa.entries()];
  }, [visiveis]);

  const marcadas = todas.filter(marcada).length;

  if (!todas.length) {
    return (
      <p className="cartao p-4 text-sm text-fumaca">
        Nada para mudar: a planilha está igual ao catálogo.
      </p>
    );
  }

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="titulo text-base text-dourado">O que vai mudar</h3>
        <span className="shrink-0 text-xs text-fumaca">
          {marcadas} de {todas.length}
        </span>
      </div>

      {faltam.length > 0 && (
        <div className="mt-2 rounded-xl border border-dourado/40 bg-dourado/10 p-3">
          <p className="text-sm text-dourado">
            <strong>
              {inteiro(faltam.length)} {faltam.length === 1 ? 'item falta' : 'itens faltam'} preencher
            </strong>{' '}
            preço ou quantidade. Toque na linha para preencher, ou desmarque.
          </p>
          <button
            type="button"
            className="botao botao-linha mt-2 w-full !min-h-9 text-xs"
            onClick={() => setSoFaltantes((v) => !v)}
          >
            {soFaltantes ? 'Mostrar tudo' : 'Mostrar só os que faltam'}
          </button>
        </div>
      )}

      <div className="relative mt-2">
        <input
          type="search"
          className="campo pl-10"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Procurar item ou preparo"
          aria-label="Procurar nas mudanças"
        />
        <Lupa className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fumaca" />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca('')}
            aria-label="Limpar busca"
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-fumaca hover:text-creme"
          >
            ×
          </button>
        )}
      </div>

      {(busca || soFaltantes) && (
        <p className="mt-2 text-sm text-fumaca">
          {visiveis.length === 0
            ? 'Nenhum item com esse nome.'
            : `${inteiro(visiveis.length)} na lista abaixo. Os outros continuam marcados.`}
        </p>
      )}

      <div className="mt-2 space-y-2">
        {porPreparo.map(([preparo, doPreparo]) => {
          const faltamAqui = doPreparo.filter(incompleto).length;
          return (
            <details key={preparo} className="cartao p-3" open={!!busca || soFaltantes || faltamAqui > 0}>
              <summary className="flex cursor-pointer items-center justify-between gap-3">
                <span className="min-w-0 truncate font-semibold">{preparo}</span>
                <span className="shrink-0 text-xs">
                  {faltamAqui > 0 ? (
                    <span className="text-dourado">{faltamAqui} a preencher</span>
                  ) : (
                    <span className="text-fumaca">
                      {doPreparo.filter(marcada).length} de {doPreparo.length}
                    </span>
                  )}
                </span>
              </summary>

              <div className="mt-3 space-y-2">
                {doPreparo.map((m) => (
                  <Linha
                    key={m.chave}
                    mudanca={m}
                    marcada={marcada(m)}
                    aoAlternar={() => aoAlternar(m.chave)}
                    aoMudar={(r) => aoMudar(m.chave, r)}
                  />
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function Linha({
  mudanca,
  marcada,
  aoAlternar,
  aoMudar,
}: {
  mudanca: Mudanca;
  marcada: boolean;
  aoAlternar: () => void;
  aoMudar: (r: Rascunho) => void;
}) {
  const [aberta, setAberta] = useState(false);
  const r = mudanca.rascunho;
  const falta = incompleto(mudanca);
  const novo = mudanca.tipo === 'novo';
  const oQueMuda = resumo(mudanca);

  const unidadeCurta = r.unidade === 'kg' ? 'kg' : 'un';
  const custo = r.unidade === 'kg' ? (r.porPessoa / 1000) * r.preco : r.porPessoa * r.preco;

  const numero = (
    valor: number,
    aoDigitar: (v: number) => void,
    rotulo: string,
    sufixo: string,
    destaque = false,
  ) => (
    <div className="min-w-0 flex-1">
      <label className="block text-[0.6rem] uppercase tracking-wide text-fumaca">{rotulo}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          className={`campo w-full ${destaque ? '!border-dourado/60 text-base font-semibold' : '!min-h-9 text-sm'}`}
          value={valor || ''}
          placeholder="0"
          onChange={(e) => aoDigitar(Number(e.target.value) || 0)}
          aria-label={`${rotulo} de ${r.nome}`}
        />
        <span className="shrink-0 text-[0.65rem] text-fumaca">{sufixo}</span>
      </div>
    </div>
  );

  return (
    <div
      className={`overflow-hidden rounded-xl ${
        falta && marcada ? 'bg-dourado/10 ring-1 ring-dourado/40' : 'bg-carvao-3'
      }`}
    >
      <div className="flex items-center gap-3 p-3">
        <input
          type="checkbox"
          checked={marcada}
          onChange={aoAlternar}
          className="h-5 w-5 shrink-0 accent-[#c4261d]"
          aria-label={`Aplicar ${r.nome}`}
        />

        {/* O alvo é a linha inteira: no celular, botão pequeno é desistência. */}
        <button
          type="button"
          onClick={() => setAberta((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={aberta}
          aria-label={`Editar ${r.nome}`}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{r.nome}</span>
            <span className="block truncate text-xs text-fumaca">
              {novo ? 'novo' : 'já existe'} · {ROTULO_CATEGORIA[r.categoria]}
              {r.rendimento < 1 ? ` · aproveita ${Math.round(r.rendimento * 100)}%` : ''}
            </span>
          </span>

          <span className="shrink-0 text-right text-sm">
            {oQueMuda?.mudaPreco && mudanca.precoAtual !== null ? (
              <span className="block">
                <span className="text-fumaca line-through">{real(mudanca.precoAtual)}</span>{' '}
                <span className="font-semibold">{real(r.preco)}</span>
              </span>
            ) : (
              <span className={`block ${r.preco > 0 ? 'font-semibold' : 'text-xs text-dourado'}`}>
                {r.preco > 0 ? real(r.preco) : 'falta o preço'}
              </span>
            )}

            <span className={`block text-xs ${r.porPessoa > 0 ? 'text-fumaca' : 'text-dourado'}`}>
              {r.porPessoa > 0
                ? `${r.porPessoa} ${r.unidade === 'kg' ? 'g' : 'un'} por pessoa`
                : novo
                  ? 'falta a quantidade'
                  : ''}
            </span>
          </span>

          <span className={`shrink-0 text-fumaca transition-transform ${aberta ? 'rotate-90' : ''}`}>›</span>
        </button>
      </div>

      {aberta && (
        <div className="border-t border-borda/60 p-3">
          <div className="flex items-end gap-2">
            {numero(r.preco, (v) => aoMudar({ ...r, preco: v }), 'Preço', `/${unidadeCurta}`, r.preco <= 0)}
            {numero(
              r.porPessoa,
              (v) => aoMudar({ ...r, porPessoa: v }),
              'Por pessoa',
              r.unidade === 'kg' ? 'g' : 'un',
              novo && r.porPessoa <= 0,
            )}
            {novo && (
              <button
                type="button"
                onClick={() => aoMudar({ ...r, unidade: r.unidade === 'kg' ? 'un' : 'kg' })}
                className="h-11 shrink-0 rounded-xl border border-borda px-3 text-sm text-fumaca transition-colors hover:border-dourado/50 hover:text-dourado"
                aria-label={`Unidade de ${r.nome}`}
                title="Trocar entre quilo e unidade"
              >
                {unidadeCurta}
              </button>
            )}
          </div>

          <p className="mt-2 text-xs text-fumaca">
            {falta ? (
              <span className="text-dourado">Preencha os dois para ver quanto custa por convidado.</span>
            ) : (
              <>
                Custa <strong className="text-creme">{real(custo)}</strong> por convidado
                {!novo && mudanca.precoAtual !== null && (
                  <>
                    , contra{' '}
                    {real(
                      r.unidade === 'kg'
                        ? ((mudanca.porPessoaAtual ?? r.porPessoa) / 1000) * mudanca.precoAtual
                        : (mudanca.porPessoaAtual ?? r.porPessoa) * mudanca.precoAtual,
                    )}{' '}
                    hoje
                  </>
                )}
                .
              </>
            )}
          </p>

          {/*
            Nome, categoria e aproveitamento só valem para item novo: em quem já
            existe, isso é do catálogo, e mexer aqui esconderia a mudança num
            lugar que ninguém vai procurar depois.
          */}
          {novo && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-fumaca">
                Nome, categoria e aproveitamento
              </summary>
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  className="campo !min-h-9 w-full text-sm"
                  value={r.nome}
                  onChange={(e) => aoMudar({ ...r, nome: e.target.value })}
                  aria-label={`Nome de ${r.nome}`}
                />
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-[2]">
                    <label className="block text-[0.6rem] uppercase tracking-wide text-fumaca">
                      Categoria
                    </label>
                    <select
                      className="campo !min-h-9 w-full text-sm"
                      value={r.categoria}
                      onChange={(e) => aoMudar({ ...r, categoria: e.target.value as Categoria })}
                      aria-label={`Categoria de ${r.nome}`}
                    >
                      {CATEGORIAS.map((c) => (
                        <option key={c} value={c}>
                          {ROTULO_CATEGORIA[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                  {numero(
                    Math.round(r.rendimento * 100),
                    (v) => aoMudar({ ...r, rendimento: Math.min(1, Math.max(0.01, v / 100)) }),
                    'Aproveita',
                    '%',
                  )}
                </div>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
