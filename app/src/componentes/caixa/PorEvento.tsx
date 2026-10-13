import { useState } from 'react';
import { hojeIso, resultadoPorEvento } from '../../dominio/financeiro';
import { ROTULO_SITUACAO } from '../../dominio/tipos';
import { dataCurta, inteiro, real } from '../../formato';
import type { DadosDoCaixa } from './Caixa';

/**
 * O espelho da planilha do Alan: os eventos fechados de um ano, um por linha,
 * com valor, quanto entrou, quanto falta, quanto cada sócio tirou, e o que
 * sobrou para a empresa depois dos custos lançados.
 */
export default function PorEvento({ dados }: { dados: DadosDoCaixa }) {
  const anos = [
    ...new Set([
      hojeIso().slice(0, 4),
      ...dados.orcamentos
        .filter((o) => o.data && (o.situacao === 'confirmado' || o.situacao === 'realizado'))
        .map((o) => o.data.slice(0, 4)),
    ]),
  ].sort();
  const [ano, setAno] = useState(hojeIso().slice(0, 4));

  const linhas = resultadoPorEvento(dados.orcamentos, dados.lancamentos, dados.categorias, ano);
  // Uma coluna por sócio que aparece no ano, na ordem em que aparece.
  const socios = [...new Set(linhas.flatMap((l) => l.prolabore.map((p) => p.pessoa)))];
  const soma = (f: (l: (typeof linhas)[number]) => number) => linhas.reduce((s, l) => s + f(l), 0);
  const realizados = linhas.filter((l) => l.evento.situacao === 'realizado');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {anos.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAno(a)}
            aria-pressed={ano === a}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${ano === a ? 'bg-carvao-3 text-dourado' : 'text-fumaca hover:text-creme'}`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Numero rotulo={`${inteiro(linhas.length)} eventos`} valor={soma((l) => l.total)} />
        <Numero rotulo="Realizados" valor={realizados.reduce((s, l) => s + l.total, 0)} />
        <Numero rotulo="Recebido" valor={soma((l) => l.recebido)} />
        <Numero rotulo="A receber" valor={soma((l) => l.restante)} />
      </div>

      {!linhas.length ? (
        <p className="cartao p-6 text-sm text-fumaca">Nenhum evento fechado em {ano}.</p>
      ) : (
        <div className="cartao overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="border-b border-borda text-left text-xs text-fumaca">
              <tr>
                <th className="px-3 py-2 font-semibold">Cliente</th>
                <th className="px-3 py-2 font-semibold">Data</th>
                <th className="px-3 py-2 text-right font-semibold">Valor</th>
                <th className="px-3 py-2 text-right font-semibold">Recebido</th>
                <th className="px-3 py-2 text-right font-semibold">Restante</th>
                <th className="px-3 py-2 font-semibold">Situação</th>
                {socios.map((s) => (
                  <th key={s} className="px-3 py-2 text-right font-semibold">
                    {s}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-semibold">Custos</th>
                <th className="px-3 py-2 text-right font-semibold">Sobra</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {linhas.map((l) => (
                <tr key={l.evento.id}>
                  <td className="max-w-48 truncate px-3 py-2 font-semibold">{l.evento.cliente || 'Sem nome'}</td>
                  <td className="px-3 py-2 text-fumaca">{dataCurta(l.evento.data)}</td>
                  <td className="px-3 py-2 text-right">{real(l.total)}</td>
                  <td className="px-3 py-2 text-right">{real(l.recebido)}</td>
                  <td className={`px-3 py-2 text-right ${l.restante > 0.009 ? 'text-dourado' : 'text-fumaca'}`}>{real(l.restante)}</td>
                  <td className="px-3 py-2 text-fumaca">{ROTULO_SITUACAO[l.evento.situacao]}</td>
                  {socios.map((s) => (
                    <td key={s} className="px-3 py-2 text-right">
                      {real(l.prolabore.find((p) => p.pessoa === s)?.valor ?? 0)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right text-fumaca">{real(l.custos)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${l.sobra < 0 ? 'text-brasa-clara' : ''}`}>{real(l.sobra)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-borda font-semibold">
              <tr>
                <td className="px-3 py-2" colSpan={2}>
                  Total
                </td>
                <td className="px-3 py-2 text-right">{real(soma((l) => l.total))}</td>
                <td className="px-3 py-2 text-right">{real(soma((l) => l.recebido))}</td>
                <td className="px-3 py-2 text-right">{real(soma((l) => l.restante))}</td>
                <td />
                {socios.map((s) => (
                  <td key={s} className="px-3 py-2 text-right">
                    {real(soma((l) => l.prolabore.find((p) => p.pessoa === s)?.valor ?? 0))}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">{real(soma((l) => l.custos))}</td>
                <td className="px-3 py-2 text-right">{real(soma((l) => l.sobra))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="text-xs text-fumaca">
        Custos e pró-labore são os lançamentos ligados a cada evento, pagos ou previstos. Sobra é o valor do evento
        menos isso: quanto mais completo o lançamento, mais perto da margem de verdade.
      </p>
    </div>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="cartao p-3">
      <p className="rotulo">{rotulo}</p>
      <p className="mt-1 font-display text-xl uppercase text-creme">{real(valor)}</p>
    </div>
  );
}
