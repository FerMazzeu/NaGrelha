import { useMemo, useState } from 'react';
import { financeiro } from '../../dados/financeiro';
import { hojeIso, inicioDoControle, type Conta } from '../../dominio/financeiro';
import type { Orcamento } from '../../dominio/tipos';
import { mensagemDe } from '../../erro';
import { dataCurta, inteiro, real } from '../../formato';
import { lerArquivoDeCaixa, planejarImportacao, type CaixaLido } from '../../planilha-de-caixa';
import { CampoNumero } from '../Campos';
import { Arquivo } from '../Icones';
import type { DadosDoCaixa } from './Caixa';

/**
 * Trazer a planilha de caixa do Alan para dentro do app.
 *
 * Nada é gravado antes de a pessoa ver o resumo: quantos eventos entram,
 * quantos já existiam, quanto vira recebido e quanto vira pró-labore. A
 * planilha tem anos de histórico, e importar errado é desfazer lançamento por
 * lançamento.
 */
export default function ImportarCaixa({
  dados,
  aoSalvarEvento,
  aoMudarConta,
  aoTerminar,
}: {
  dados: DadosDoCaixa;
  aoSalvarEvento: (o: Orcamento) => Promise<void>;
  aoMudarConta: (c: Conta) => void;
  aoTerminar: () => Promise<void>;
}) {
  const hoje = hojeIso();
  const [lido, setLido] = useState<CaixaLido | null>(null);
  const [nome, setNome] = useState('');
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const [pronto, setPronto] = useState('');
  const [progresso, setProgresso] = useState('');
  const [contaId, setContaId] = useState(() => dados.contas.find((c) => c.tipo === 'banco')?.id ?? dados.contas[0]?.id ?? '');
  const [usarSaldos, setUsarSaldos] = useState(true);
  const [saldosEditados, setSaldosEditados] = useState<Record<string, number>>({});
  const [mostrarLinhas, setMostrarLinhas] = useState(false);

  /** O saldo da planilha que cabe em cada conta, pelo tipo dela. */
  const sugeridos = useMemo(() => {
    if (!lido?.saldos) return {} as Record<string, number>;
    const r: Record<string, number> = {};
    const porTipo = { banco: lido.saldos.banco, especie: lido.saldos.especie, investimento: lido.saldos.investido };
    for (const tipo of ['banco', 'especie', 'investimento'] as const) {
      const conta = dados.contas.find((c) => c.ativo && c.tipo === tipo);
      if (conta) r[conta.id] = porTipo[tipo];
    }
    return r;
  }, [lido, dados.contas]);
  const saldosFinais = { ...sugeridos, ...saldosEditados };

  // Com saldo novo, o controle começa hoje; senão, no começo que já existe.
  const inicio = usarSaldos && lido?.saldos ? hoje : inicioDoControle(dados.contas, hoje);
  const conta = dados.contas.find((c) => c.id === contaId);

  const plano = useMemo(
    () =>
      lido && conta
        ? planejarImportacao(lido, dados.orcamentos, dados.lancamentos, conta, dados.categorias, inicio, hoje)
        : [],
    [lido, conta, dados.orcamentos, dados.lancamentos, dados.categorias, inicio, hoje],
  );

  const novos = plano.filter((p) => p.novo);
  const lancamentos = plano.flatMap((p) => p.lancamentos);
  const recebido = lancamentos.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0);
  const prolaborePago = lancamentos.filter((l) => l.tipo === 'saida' && l.pagoEm).reduce((s, l) => s + l.valor, 0);
  const prolaborePrevisto = lancamentos.filter((l) => l.tipo === 'saida' && !l.pagoEm).reduce((s, l) => s + l.valor, 0);
  const comAviso = plano.filter((p) => p.avisos.length);

  const abrir = async (arquivo?: File) => {
    if (!arquivo) return;
    setErro('');
    setPronto('');
    setLendo(true);
    setNome(arquivo.name);
    try {
      setLido(await lerArquivoDeCaixa(arquivo));
      setSaldosEditados({});
    } catch (e) {
      setLido(null);
      setErro(mensagemDe(e));
    } finally {
      setLendo(false);
    }
  };

  const importar = async () => {
    setErro('');
    let etapa = 'saldos';
    try {
      if (usarSaldos && lido?.saldos) {
        for (const c of dados.contas) {
          if (!(c.id in saldosFinais)) continue;
          const nova = { ...c, saldoInicial: saldosFinais[c.id], saldoInicialEm: hoje };
          await financeiro.salvarConta(nova);
          aoMudarConta(nova);
        }
      }
      etapa = 'eventos';
      let i = 0;
      for (const p of novos) {
        setProgresso(`Criando eventos: ${inteiro(++i)} de ${inteiro(novos.length)}`);
        await aoSalvarEvento(p.novo!);
      }
      etapa = 'lançamentos';
      setProgresso(`Gravando ${inteiro(lancamentos.length)} lançamentos...`);
      // Em blocos: uma chamada por lançamento seria lenta, e uma só gigante
      // pode passar do limite do corpo da requisição.
      for (let de = 0; de < lancamentos.length; de += 200) {
        await financeiro.criarLancamentos(lancamentos.slice(de, de + 200));
      }
      setPronto(
        `Importado: ${inteiro(novos.length)} eventos novos, ${inteiro(lancamentos.length)} lançamentos${usarSaldos && lido?.saldos ? ', saldos das contas atualizados' : ''}.`,
      );
      setLido(null);
      setNome('');
      await aoTerminar();
    } catch (e) {
      setErro(
        `Parou ao gravar ${etapa}: ${mensagemDe(e)}. O que já entrou ficou salvo; subindo a planilha de novo, evento e lançamento repetidos não são criados outra vez.`,
      );
    } finally {
      setProgresso('');
    }
  };

  return (
    <div className="mt-3 space-y-3">
      {erro && <p className="rounded-xl border border-brasa/50 bg-brasa/10 p-3 text-sm text-brasa-clara">{erro}</p>}
      {pronto && <p className="rounded-xl border border-verde/50 bg-verde/10 p-3 text-sm text-verde">{pronto}</p>}

      {!lido && (
        <label className={`cartao flex items-center gap-3 p-4 ${lendo ? 'opacity-60' : 'cursor-pointer hover:border-dourado/40'}`}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-carvao-3 text-dourado">
            <Arquivo className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{lendo ? 'Lendo a planilha...' : 'Escolher a planilha de caixa'}</span>
            <span className="block truncate text-sm text-fumaca">{nome || 'CONTROLE CAIXA NA GRELHA.xlsx'}</span>
          </span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            disabled={lendo}
            onChange={(e) => {
              void abrir(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
      )}

      {lido && (
        <div className="cartao space-y-4 p-4">
          <p className="font-semibold">{nome}</p>

          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Linha rotulo="Eventos na planilha" valor={`${inteiro(plano.length)} (${inteiro(novos.length)} novos)`} />
            <Linha rotulo="Já recebido" valor={real(recebido)} />
            <Linha rotulo="Pró-labore pago" valor={real(prolaborePago)} />
            <Linha rotulo="Pró-labore previsto" valor={real(prolaborePrevisto)} />
          </div>

          <label className="block text-sm">
            <span className="rotulo mb-1.5">Os recebimentos entram na conta</span>
            <select className="campo" value={contaId} onChange={(e) => setContaId(e.target.value)}>
              {dados.contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>

          {lido.saldos && (
            <div className="space-y-2">
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" className="h-5 w-5 accent-[#c4261d]" checked={usarSaldos} onChange={(e) => setUsarSaldos(e.target.checked)} />
                <span>
                  Usar o dinheiro em caixa da aba "{lido.saldos.aba}" como saldo de hoje ({dataCurta(hoje)})
                  <span className="block text-xs text-fumaca">
                    Confira com o extrato antes: o que estiver na planilha vira o ponto de partida das contas.
                  </span>
                </span>
              </label>
              {usarSaldos && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {dados.contas
                    .filter((c) => c.id in sugeridos)
                    .map((c) => (
                      <label key={c.id} className="block text-sm">
                        <span className="rotulo mb-1.5">{c.nome}</span>
                        <CampoNumero
                          valor={saldosFinais[c.id] ?? 0}
                          aoMudar={(v) => setSaldosEditados((a) => ({ ...a, [c.id]: v }))}
                          sufixo="R$"
                        />
                      </label>
                    ))}
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-fumaca">
            Todo pagamento importado fica datado antes do início do controle ({dataCurta(inicio)}): ele aparece no
            evento e no resultado do ano, mas não soma de novo no saldo, que já tem esse dinheiro dentro. Pró-labore de
            evento que ainda vai acontecer entra como previsto, em "A pagar".
          </p>

          {(comAviso.length > 0 || lido.ignoradas.length > 0) && (
            <details className="text-sm">
              <summary className="cursor-pointer text-dourado">
                {inteiro(comAviso.length + lido.ignoradas.length)} pontos para conferir
              </summary>
              <ul className="mt-2 space-y-1 text-fumaca">
                {comAviso.map((p) => (
                  <li key={`${p.origem.aba}-${p.origem.linha}`}>
                    {p.origem.cliente} ({dataCurta(p.origem.data)}): {p.avisos.join('; ')}
                  </li>
                ))}
                {lido.ignoradas.map((x) => (
                  <li key={x.onde}>
                    {x.onde}: {x.motivo}, ficou de fora
                  </li>
                ))}
              </ul>
            </details>
          )}

          <button type="button" className="text-sm text-fumaca underline-offset-4 hover:text-creme hover:underline" onClick={() => setMostrarLinhas((m) => !m)}>
            {mostrarLinhas ? 'Esconder eventos' : 'Ver evento por evento'}
          </button>
          {mostrarLinhas && (
            <div className="max-h-96 overflow-auto">
              <table className="w-full min-w-[40rem] text-xs">
                <thead className="text-left text-fumaca">
                  <tr>
                    <th className="py-1">Evento</th>
                    <th className="py-1">Data</th>
                    <th className="py-1 text-right">Valor</th>
                    <th className="py-1 text-right">Recebido</th>
                    <th className="py-1">No app</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borda">
                  {plano.map((p) => (
                    <tr key={`${p.origem.aba}-${p.origem.linha}`}>
                      <td className="py-1 pr-2">{p.origem.cliente}</td>
                      <td className="py-1 pr-2">{dataCurta(p.origem.data)}</td>
                      <td className="py-1 text-right">{real(p.origem.total)}</td>
                      <td className="py-1 text-right">
                        {real(p.lancamentos.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0))}
                      </td>
                      <td className="py-1 pl-2 text-fumaca">{p.existente ? `já existe (${p.existente.cliente})` : 'novo'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" className="botao botao-brasa" disabled={!!progresso || !conta} onClick={() => void importar()}>
              {progresso || `Importar ${inteiro(plano.length)} eventos`}
            </button>
            <button type="button" className="botao botao-linha" disabled={!!progresso} onClick={() => setLido(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl bg-carvao-3 p-3">
      <p className="text-xs text-fumaca">{rotulo}</p>
      <p className="mt-0.5 font-semibold">{valor}</p>
    </div>
  );
}
