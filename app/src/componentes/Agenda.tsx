import { useMemo, useState } from 'react';
import { calcular, totalDeConvidados } from '../dominio/calculo';
import { ROTULO_SITUACAO, type Orcamento, type Situacao } from '../dominio/tipos';
import { inteiro, real } from '../formato';

const CORES: Record<Situacao, string> = {
  orcado: 'border-fumaca/40 text-fumaca',
  confirmado: 'border-verde/60 text-verde',
  realizado: 'border-dourado/60 text-dourado',
  perdido: 'border-brasa/50 text-brasa-clara',
};

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/**
 * Agenda por mês.
 *
 * Evento sem data não some: ele vai para um bloco próprio no fim, porque
 * orçamento sem data marcada é justamente o que precisa de follow-up.
 */
export default function Agenda({
  orcamentos,
  aoAbrir,
}: {
  orcamentos: Orcamento[];
  aoAbrir: (id: string) => void;
}) {
  const [filtro, setFiltro] = useState<Situacao | 'todos'>('todos');

  const { meses, semData } = useMemo(() => {
    const visiveis = filtro === 'todos' ? orcamentos : orcamentos.filter((o) => o.situacao === filtro);

    const comData = visiveis.filter((o) => o.data).sort((a, b) => (a.data < b.data ? -1 : 1));
    const grupos = new Map<string, Orcamento[]>();
    for (const o of comData) {
      const chave = o.data.slice(0, 7);
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave)!.push(o);
    }

    return { meses: [...grupos.entries()], semData: visiveis.filter((o) => !o.data) };
  }, [orcamentos, filtro]);

  const confirmados = orcamentos.filter((o) => o.situacao === 'confirmado');
  const receitaConfirmada = confirmados.reduce((s, o) => s + calcular(o).preco, 0);

  return (
    <div className="area py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="titulo text-2xl">Agenda</h1>
          <p className="mt-1 text-sm text-fumaca">
            {inteiro(confirmados.length)} confirmados, {real(receitaConfirmada)} em contratos
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(['todos', 'orcado', 'confirmado', 'realizado', 'perdido'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFiltro(s)}
            aria-pressed={filtro === s}
            className={`botao !min-h-9 !px-3 text-sm ${
              filtro === s ? 'botao-brasa' : 'botao-linha'
            }`}
          >
            {s === 'todos' ? 'Todos' : ROTULO_SITUACAO[s]}
          </button>
        ))}
      </div>

      {!meses.length && !semData.length && (
        <p className="cartao mt-6 p-6 text-sm text-fumaca">Nada por aqui com esse filtro.</p>
      )}

      <div className="mt-6 space-y-8">
        {meses.map(([chave, eventos]) => {
          const [ano, mes] = chave.split('-');
          return (
            <section key={chave}>
              <h2 className="titulo text-lg text-dourado">
                {MESES[Number(mes) - 1]} de {ano}
              </h2>
              <div className="mt-3 space-y-2">
                {eventos.map((o) => (
                  <CartaoDeEvento key={o.id} orcamento={o} aoAbrir={aoAbrir} />
                ))}
              </div>
            </section>
          );
        })}

        {semData.length > 0 && (
          <section>
            <h2 className="titulo text-lg text-fumaca">Sem data marcada</h2>
            <p className="mt-1 text-sm text-fumaca">É aqui que mora o follow-up.</p>
            <div className="mt-3 space-y-2">
              {semData.map((o) => (
                <CartaoDeEvento key={o.id} orcamento={o} aoAbrir={aoAbrir} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function CartaoDeEvento({ orcamento, aoAbrir }: { orcamento: Orcamento; aoAbrir: (id: string) => void }) {
  const r = calcular(orcamento);
  const pessoas = totalDeConvidados(orcamento);

  return (
    <button
      type="button"
      onClick={() => aoAbrir(orcamento.id)}
      className="cartao flex w-full items-center gap-4 p-4 text-left transition-colors hover:border-dourado/40"
    >
      <div className="w-14 shrink-0 text-center">
        {orcamento.data ? (
        <>
          <p className="titulo text-2xl text-creme">{orcamento.data.slice(8, 10)}</p>
          <p className="text-xs text-fumaca">{orcamento.hora || 'sem hora'}</p>
        </>
        ) : (
        <p className="text-xs text-fumaca">sem data</p>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{orcamento.cliente || 'Sem nome'}</p>
        <p className="truncate text-sm text-fumaca">
        {inteiro(pessoas)} convidados{orcamento.local ? ` · ${orcamento.local}` : ''}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="font-display text-lg uppercase text-dourado">{real(r.preco)}</p>
        <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-xs ${CORES[orcamento.situacao]}`}>
        {ROTULO_SITUACAO[orcamento.situacao]}
        </span>
      </div>
    </button>
  );
}
