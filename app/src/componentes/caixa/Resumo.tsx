import { useMemo, useState } from 'react';
import {
  aPagar,
  hojeIso,
  inicioDoControle,
  porMes,
  recebiveis,
  resultadoPorGrupo,
  resumir,
  ROTULO_GRUPO,
  ultimosMeses,
} from '../../dominio/financeiro';
import { dataCurta, real } from '../../formato';
import type { AcoesDoCaixa, DadosDoCaixa } from './Caixa';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const nomeDoMes = (aaaamm: string) => `${MESES[Number(aaaamm.slice(5, 7)) - 1]}/${aaaamm.slice(2, 4)}`;

/*
  Cores do gráfico. Validadas contra o fundo do app (#1a1512) para daltonismo
  e contraste: verde contra vermelho, que seria o óbvio, falha para quem não
  distingue os dois. Azul para o que entra, a brasa da marca para o que sai.
*/
const COR_ENTRADA = '#3987e5';
const COR_SAIDA = '#e0402f';

export default function Resumo({
  dados,
  acoes,
  irPara,
}: {
  dados: DadosDoCaixa;
  acoes: AcoesDoCaixa;
  irPara: (aba: 'livro' | 'receber' | 'pagar' | 'ajustes') => void;
}) {
  const hoje = hojeIso();
  const r = useMemo(
    () => resumir(dados.contas, dados.lancamentos, dados.orcamentos, dados.escalas, dados.membros, hoje),
    [dados, hoje],
  );
  const semSaldoInicial = dados.contas.every((c) => c.saldoInicial === 0) && !dados.lancamentos.length;

  // Próximos 30 dias: o que vence para receber e para pagar.
  const daqui30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const proximosRecebimentos = recebiveis(dados.orcamentos, dados.lancamentos, hoje)
    .filter((x) => x.restante > 0 && x.vencimento && x.vencimento <= daqui30)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const proximosPagamentos = aPagar(
    dados.lancamentos,
    dados.escalas,
    dados.membros,
    dados.orcamentos,
    hoje,
    inicioDoControle(dados.contas, hoje),
  ).filter(
    (p) => p.vencimento <= daqui30,
  );

  return (
    <div className="space-y-6">
      {semSaldoInicial && (
        <div className="cartao border-dourado/50 p-4 text-sm">
          <p className="font-semibold text-dourado">Comece pelo saldo de hoje</p>
          <p className="mt-1 text-fumaca">
            Informe quanto tem no banco, em espécie e investido, ou importe a planilha de controle de caixa do Alan,
            que já traz isso e os eventos de 2025 em diante.
          </p>
          <button type="button" className="botao botao-brasa mt-3" onClick={() => irPara('ajustes')}>
            Contas e importar
          </button>
        </div>
      )}

      {/* O número que o Alan procurava no fim da planilha: o "CAIXA". */}
      <div className="cartao p-5">
        <p className="rotulo">Caixa livre</p>
        <p className={`metrica mt-1 ${r.caixaLivre < 0 ? 'text-brasa-clara' : ''}`}>{real(r.caixaLivre)}</p>
        <p className="mt-2 text-sm text-fumaca">
          {real(r.saldoTotal)} em caixa, menos {real(r.adiantado)} já recebidos de eventos que ainda vão acontecer,
          menos o que falta pagar fora desses eventos.
          {r.caixaLivre < 0 && ' Negativo: tem mais dinheiro comprometido do que em caixa.'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Bloco titulo="Em caixa" valor={r.saldoTotal} aoClicar={() => irPara('livro')}>
          {r.porConta.map((x) => (
            <span key={x.conta.id} className="flex justify-between gap-2">
              <span className="truncate">{x.conta.nome}</span>
              <span className={x.saldo < 0 ? 'text-brasa-clara' : 'text-creme'}>{real(x.saldo)}</span>
            </span>
          ))}
        </Bloco>
        <Bloco titulo="A receber" valor={r.aReceber} aoClicar={() => irPara('receber')}>
          {r.aReceberAtrasado > 0 ? (
            <span className="text-brasa-clara">⚠ {real(r.aReceberAtrasado)} atrasado</span>
          ) : (
            <span>Nada atrasado</span>
          )}
        </Bloco>
        <Bloco titulo="A pagar" valor={r.aPagar} aoClicar={() => irPara('pagar')}>
          {r.aPagarAtrasado > 0 ? (
            <span className="text-brasa-clara">⚠ {real(r.aPagarAtrasado)} vencido</span>
          ) : (
            <span>Nada vencido</span>
          )}
        </Bloco>
        <Bloco titulo="Adiantado de eventos futuros" valor={r.adiantado}>
          <span>Está no caixa, mas é para gastar nesses eventos.</span>
        </Bloco>
      </div>

      <GraficoMensal dados={dados} hoje={hoje} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="cartao p-4">
          <h2 className="titulo text-lg text-dourado">Para receber em 30 dias</h2>
          {!proximosRecebimentos.length && <p className="mt-2 text-sm text-fumaca">Nada vencendo.</p>}
          <ul className="mt-2 divide-y divide-borda">
            {proximosRecebimentos.slice(0, 8).map((x) => (
              <li key={x.evento.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{x.evento.cliente || 'Sem nome'}</span>
                  <span className={x.atrasado ? 'text-brasa-clara' : 'text-fumaca'}>
                    {x.atrasado ? '⚠ venceu ' : 'vence '}
                    {dataCurta(x.vencimento)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span>{real(x.restante)}</span>
                  <button
                    type="button"
                    className="botao botao-linha !min-h-8 !px-2 text-xs"
                    onClick={() =>
                      acoes.novo('entrada', {
                        valor: x.restante,
                        eventoId: x.evento.id,
                        categoriaId: dados.categorias.find((c) => c.grupo === 'receita' && c.tipo === 'entrada')?.id ?? null,
                        descricao: `${x.recebido > 0 ? 'Restante' : 'Pagamento'} ${x.evento.cliente}`,
                      })
                    }
                  >
                    Recebi
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="cartao p-4">
          <h2 className="titulo text-lg text-dourado">Para pagar em 30 dias</h2>
          {!proximosPagamentos.length && <p className="mt-2 text-sm text-fumaca">Nada vencendo.</p>}
          <ul className="mt-2 divide-y divide-borda">
            {proximosPagamentos.slice(0, 8).map((p) => (
              <li
                key={p.origem === 'cache' ? `c-${p.escala.id}` : p.lancamento.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {p.origem === 'cache'
                      ? `Cachê ${p.membro?.nome ?? ''}, ${p.evento.cliente}`
                      : p.lancamento.descricao || 'Sem descrição'}
                  </span>
                  <span className={p.atrasado ? 'text-brasa-clara' : 'text-fumaca'}>
                    {p.atrasado ? '⚠ venceu ' : 'vence '}
                    {dataCurta(p.vencimento)}
                  </span>
                </span>
                <span className="shrink-0">{real(p.valor)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <ResultadoDoPeriodo dados={dados} hoje={hoje} />
    </div>
  );
}

function Bloco({
  titulo,
  valor,
  aoClicar,
  children,
}: {
  titulo: string;
  valor: number;
  aoClicar?: () => void;
  children: React.ReactNode;
}) {
  const conteudo = (
    <>
      <span className="rotulo block">{titulo}</span>
      <span className={`mt-1 block font-display text-2xl uppercase ${valor < 0 ? 'text-brasa-clara' : 'text-creme'}`}>
        {real(valor)}
      </span>
      <span className="mt-2 block space-y-0.5 text-xs text-fumaca">{children}</span>
    </>
  );
  return aoClicar ? (
    <button type="button" onClick={aoClicar} className="cartao p-4 text-left transition-colors hover:border-dourado/40">
      {conteudo}
    </button>
  ) : (
    <div className="cartao p-4">{conteudo}</div>
  );
}

/**
 * Entradas e saídas dos últimos 12 meses, lado a lado.
 *
 * Barras agrupadas e um eixo só: entrada e saída são a mesma medida (reais),
 * e é a diferença de altura entre as duas que se quer ver. O resultado do mês
 * vai em texto embaixo de cada par, porque um terceiro conjunto de barras (ou
 * uma linha num segundo eixo) faria o olho comparar coisas diferentes.
 */
function GraficoMensal({ dados, hoje }: { dados: DadosDoCaixa; hoje: string }) {
  const meses = useMemo(() => porMes(dados.lancamentos, ultimosMeses(12, hoje)), [dados.lancamentos, hoje]);
  const [foco, setFoco] = useState<number | null>(null);
  const [tabela, setTabela] = useState(false);
  const maximo = Math.max(1, ...meses.flatMap((m) => [m.entradas, m.saidas]));

  // Escala com degraus redondos, para a grade cair em número que se lê.
  const passo = (() => {
    const bruto = maximo / 4;
    const potencia = 10 ** Math.floor(Math.log10(bruto));
    return [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? bruto;
  })();
  const topo = passo * Math.ceil(maximo / passo);

  const L = 760;
  const A = 220;
  const margem = { esq: 56, dir: 8, cima: 10, baixo: 26 };
  const larguraUtil = L - margem.esq - margem.dir;
  const alturaUtil = A - margem.cima - margem.baixo;
  const faixa = larguraUtil / meses.length;
  const barra = Math.min(18, (faixa - 10) / 2);
  const y = (v: number) => margem.cima + alturaUtil - (v / topo) * alturaUtil;
  const k = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)} mil` : String(Math.round(v)));

  const total = meses.reduce((s, m) => ({ e: s.e + m.entradas, s: s.s + m.saidas }), { e: 0, s: 0 });

  return (
    <section className="cartao p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="titulo text-lg text-dourado">Últimos 12 meses</h2>
        <div className="flex items-center gap-4 text-xs text-fumaca">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_ENTRADA }} /> Entradas {real(total.e)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_SAIDA }} /> Saídas {real(total.s)}
          </span>
          <button type="button" className="underline-offset-4 hover:text-creme hover:underline" onClick={() => setTabela((t) => !t)}>
            {tabela ? 'Ver gráfico' : 'Ver tabela'}
          </button>
        </div>
      </div>

      {tabela ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-fumaca">
              <tr>
                <th className="py-1 font-semibold">Mês</th>
                <th className="py-1 text-right font-semibold">Entradas</th>
                <th className="py-1 text-right font-semibold">Saídas</th>
                <th className="py-1 text-right font-semibold">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {meses.map((m) => (
                <tr key={m.mes}>
                  <td className="py-1.5">{nomeDoMes(m.mes)}</td>
                  <td className="py-1.5 text-right">{real(m.entradas)}</td>
                  <td className="py-1.5 text-right">{real(m.saidas)}</td>
                  <td className={`py-1.5 text-right ${m.resultado < 0 ? 'text-brasa-clara' : ''}`}>{real(m.resultado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // No celular o gráfico rola de lado dentro do cartão, em vez de
        // encolher até a letra do eixo ficar ilegível.
        <div className="relative mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${L} ${A}`} className="w-full min-w-[40rem]" role="img" aria-label="Entradas e saídas por mês nos últimos 12 meses">
            {Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => i * passo).map((v) => (
              <g key={v}>
                <line x1={margem.esq} x2={L - margem.dir} y1={y(v)} y2={y(v)} stroke="#302419" strokeWidth={1} />
                <text x={margem.esq - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#a89a8a">
                  {k(v)}
                </text>
              </g>
            ))}
            {meses.map((m, i) => {
              const x0 = margem.esq + i * faixa + faixa / 2 - barra - 1;
              const base = y(0);
              const coluna = (valor: number, x: number, cor: string) => {
                const h = Math.max(0, base - y(valor));
                if (h <= 0) return null;
                const raio = Math.min(4, h, barra / 2);
                // Só o topo arredondado: a base fica presa no zero.
                return (
                  <path
                    d={`M${x},${base} V${base - h + raio} Q${x},${base - h} ${x + raio},${base - h} H${x + barra - raio} Q${x + barra},${base - h} ${x + barra},${base - h + raio} V${base} Z`}
                    fill={cor}
                    opacity={foco === null || foco === i ? 1 : 0.45}
                  />
                );
              };
              return (
                <g key={m.mes}>
                  {coluna(m.entradas, x0, COR_ENTRADA)}
                  {coluna(m.saidas, x0 + barra + 2, COR_SAIDA)}
                  <text x={margem.esq + i * faixa + faixa / 2} y={A - 8} textAnchor="middle" fontSize={11} fill="#a89a8a">
                    {nomeDoMes(m.mes)}
                  </text>
                  {/* Área de toque da faixa inteira, maior que as barras. */}
                  <rect
                    x={margem.esq + i * faixa}
                    y={margem.cima}
                    width={faixa}
                    height={alturaUtil}
                    fill="transparent"
                    onMouseEnter={() => setFoco(i)}
                    onMouseLeave={() => setFoco(null)}
                    onClick={() => setFoco(foco === i ? null : i)}
                  />
                </g>
              );
            })}
          </svg>
          {foco !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 rounded-lg border border-borda bg-carvao-3 px-3 py-2 text-xs shadow-lg"
              style={{
                left: `${((margem.esq + foco * faixa + faixa / 2) / L) * 100}%`,
                transform: foco > 8 ? 'translateX(-105%)' : 'translateX(8px)',
              }}
            >
              <p className="font-semibold text-creme">{nomeDoMes(meses[foco].mes)}</p>
              <p className="mt-1 flex items-center gap-1.5 text-fumaca">
                <span className="h-2 w-2 rounded-sm" style={{ background: COR_ENTRADA }} />
                Entradas <span className="ml-auto pl-3 text-creme">{real(meses[foco].entradas)}</span>
              </p>
              <p className="flex items-center gap-1.5 text-fumaca">
                <span className="h-2 w-2 rounded-sm" style={{ background: COR_SAIDA }} />
                Saídas <span className="ml-auto pl-3 text-creme">{real(meses[foco].saidas)}</span>
              </p>
              <p className="mt-1 border-t border-borda pt-1 text-fumaca">
                Resultado{' '}
                <span className={meses[foco].resultado < 0 ? 'text-brasa-clara' : 'text-creme'}>
                  {real(meses[foco].resultado)}
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** O resultado do mês ou do ano, por grupo: quanto entrou, para onde foi, quanto sobrou. */
function ResultadoDoPeriodo({ dados, hoje }: { dados: DadosDoCaixa; hoje: string }) {
  const [periodo, setPeriodo] = useState<'mes' | 'ano'>('mes');
  const de = periodo === 'mes' ? `${hoje.slice(0, 7)}-01` : `${hoje.slice(0, 4)}-01-01`;
  const ate = periodo === 'mes' ? `${hoje.slice(0, 7)}-31` : `${hoje.slice(0, 4)}-12-31`;
  const r = resultadoPorGrupo(dados.lancamentos, dados.categorias, de, ate);

  return (
    <section className="cartao p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="titulo text-lg text-dourado">Resultado {periodo === 'mes' ? 'do mês' : `de ${hoje.slice(0, 4)}`}</h2>
        <div className="flex gap-1">
          {(['mes', 'ano'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodo(p)}
              aria-pressed={periodo === p}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${periodo === p ? 'bg-carvao-3 text-dourado' : 'text-fumaca hover:text-creme'}`}
            >
              {p === 'mes' ? 'Mês' : 'Ano'}
            </button>
          ))}
        </div>
      </div>
      {!r.grupos.length ? (
        <p className="mt-2 text-sm text-fumaca">Nada pago neste período ainda.</p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <tbody className="divide-y divide-borda">
            {r.grupos.map((g) => (
              <tr key={g.grupo}>
                <td className="py-1.5">{ROTULO_GRUPO[g.grupo]}</td>
                <td className="py-1.5 text-right">
                  {g.entradas > 0 && <span>+ {real(g.entradas)}</span>}
                  {g.entradas > 0 && g.saidas > 0 && ' '}
                  {g.saidas > 0 && <span className="text-fumaca">− {real(g.saidas)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-borda font-semibold">
              <td className="pt-2">Sobrou</td>
              <td className={`pt-2 text-right ${r.resultado < 0 ? 'text-brasa-clara' : 'text-creme'}`}>{real(r.resultado)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}
