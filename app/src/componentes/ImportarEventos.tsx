import { useMemo, useState } from 'react';
import { eventoExterno } from '../dominio/evento-externo';
import { ROTULO_SITUACAO, ROTULO_TIPO_EVENTO, type Orcamento } from '../dominio/tipos';
import { mensagemDe } from '../erro';
import { dataCurta, inteiro, real } from '../formato';
import {
  baixarModeloDeEventos,
  jaExiste,
  lerArquivoDeEventos,
  type EventosLidos,
} from '../planilha-de-eventos';
import { Arquivo } from './Icones';

/**
 * Trazer para o app os eventos fechados fora dele.
 *
 * Dois caminhos: um evento por vez, que abre direto no editor, e a planilha,
 * para quem tem a lista dos eventos antigos. A planilha nunca entra direto:
 * cada linha aparece para conferir, e o que já existe no app vem desmarcado.
 */
export default function ImportarEventos({
  existentes,
  aoLancarUm,
  aoSalvar,
  aoVoltar,
}: {
  existentes: Orcamento[];
  aoLancarUm: () => void;
  /** Grava um evento. Erro sobe: a importação para e diz até onde foi. */
  aoSalvar: (o: Orcamento) => Promise<void>;
  aoVoltar: () => void;
}) {
  const [lidos, setLidos] = useState<EventosLidos | null>(null);
  const [nomeDoArquivo, setNomeDoArquivo] = useState('');
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [lendo, setLendo] = useState(false);
  const [importando, setImportando] = useState<{ feitos: number; total: number } | null>(null);
  const [erro, setErro] = useState('');
  const [pronto, setPronto] = useState('');

  const repetidos = useMemo(
    () => new Set((lidos?.eventos ?? []).filter((e) => jaExiste(e.dados, existentes)).map((e) => e.linha)),
    [lidos, existentes],
  );

  const abrir = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setErro('');
    setPronto('');
    setLendo(true);
    setNomeDoArquivo(arquivo.name);
    try {
      const lida = await lerArquivoDeEventos(arquivo);
      setLidos(lida);
      // Repetido começa desmarcado: subir a mesma planilha duas vezes não
      // pode dobrar a agenda.
      setMarcados(
        new Set(lida.eventos.filter((e) => !jaExiste(e.dados, existentes)).map((e) => e.linha)),
      );
    } catch (e) {
      setLidos(null);
      setErro(mensagemDe(e));
    } finally {
      setLendo(false);
    }
  };

  const escolhidos = (lidos?.eventos ?? []).filter((e) => marcados.has(e.linha));
  const somaEscolhida = escolhidos.reduce((s, e) => s + e.dados.valor, 0);

  const importar = async () => {
    setErro('');
    setImportando({ feitos: 0, total: escolhidos.length });
    let feitos = 0;
    try {
      // Um por vez, e não todos juntos: se o banco recusar um, os anteriores
      // estão gravados e a tela sabe dizer quais.
      for (const e of escolhidos) {
        await aoSalvar(eventoExterno(e.dados));
        feitos++;
        setImportando({ feitos, total: escolhidos.length });
      }
      setPronto(`${inteiro(feitos)} ${feitos === 1 ? 'evento importado' : 'eventos importados'}.`);
      setLidos(null);
      setNomeDoArquivo('');
    } catch (e) {
      setErro(
        `Parou no ${inteiro(feitos + 1)}º evento: ${mensagemDe(e)}. Os ${inteiro(feitos)} anteriores já estão no app; subindo a planilha de novo, eles aparecem como repetidos e vêm desmarcados.`,
      );
      // Os que entraram saem da lista marcada, para a próxima tentativa
      // continuar de onde parou.
      setMarcados((atual) => {
        const resto = new Set(atual);
        escolhidos.slice(0, feitos).forEach((x) => resto.delete(x.linha));
        return resto;
      });
    } finally {
      setImportando(null);
    }
  };

  const alternar = (linha: number) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(linha)) novo.delete(linha);
      else novo.add(linha);
      return novo;
    });

  return (
    <div className="area py-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="titulo text-2xl">Eventos fechados por fora</h1>
          <p className="mt-1 text-sm text-fumaca">
            Festa fechada pela planilha ou pelo WhatsApp entra com o valor combinado, sem precisar montar o cardápio.
          </p>
        </div>
        <button type="button" className="botao botao-linha shrink-0" onClick={aoVoltar} disabled={!!importando}>
          Voltar
        </button>
      </div>

      {erro && (
        <p className="mt-4 rounded-xl border border-brasa/50 bg-brasa/10 p-3 text-sm text-brasa-clara">{erro}</p>
      )}
      {pronto && (
        <p className="mt-4 rounded-xl border border-verde/50 bg-verde/10 p-3 text-sm text-verde">{pronto}</p>
      )}

      {!lidos && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="cartao p-4 text-left transition-colors hover:border-dourado/40"
            onClick={aoLancarUm}
          >
            <span className="block font-semibold">Lançar um evento</span>
            <span className="mt-1 block text-sm text-fumaca">
              Cliente, data, convidados e valor. Abre direto para preencher.
            </span>
          </button>

          <label
            className={`cartao flex items-center gap-3 p-4 transition-colors ${
              lendo ? 'opacity-60' : 'cursor-pointer hover:border-dourado/40'
            }`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-carvao-3 text-dourado">
              <Arquivo className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{lendo ? 'Lendo a planilha...' : 'Subir planilha de eventos'}</span>
              <span className="block truncate text-sm text-fumaca">
                {nomeDoArquivo || 'Excel (.xlsx) ou .csv, uma linha por evento'}
              </span>
            </span>
            <input
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              disabled={lendo}
              onChange={(e) => {
                void abrir(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>

          <div className="cartao p-4 text-sm text-fumaca sm:col-span-2">
            <p>
              A planilha precisa de uma linha de títulos. Os nomes podem variar ("Valor" ou "Total", "Pessoas" ou
              "Convidados"), mas precisa ter <strong className="text-creme">Cliente</strong> e mais{' '}
              <strong className="text-creme">Valor</strong> ou <strong className="text-creme">Data</strong>. Sem
              situação, evento com data passada entra como realizado, e o resto como confirmado.
            </p>
            <button
              type="button"
              className="mt-2 font-semibold text-dourado underline-offset-4 hover:underline"
              onClick={() => void baixarModeloDeEventos().catch((e) => setErro(mensagemDe(e)))}
            >
              Baixar planilha modelo
            </button>
          </div>
        </div>
      )}

      {lidos && (
        <div className="mt-6 space-y-4">
          <div className="cartao flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="text-sm">
              <p className="font-semibold">{nomeDoArquivo}</p>
              <p className="text-fumaca">
                {inteiro(lidos.eventos.length)} {lidos.eventos.length === 1 ? 'evento lido' : 'eventos lidos'}
                {repetidos.size > 0 && ` · ${inteiro(repetidos.size)} já no app, desmarcados`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="botao botao-linha"
                disabled={!!importando}
                onClick={() => {
                  setLidos(null);
                  setNomeDoArquivo('');
                }}
              >
                Trocar arquivo
              </button>
              <button
                type="button"
                className="botao botao-brasa"
                disabled={!escolhidos.length || !!importando}
                onClick={() => void importar()}
              >
                {importando
                  ? `Importando ${inteiro(importando.feitos)} de ${inteiro(importando.total)}...`
                  : `Importar ${inteiro(escolhidos.length)} · ${real(somaEscolhida)}`}
              </button>
            </div>
          </div>

          {!lidos.eventos.length && (
            <p className="cartao p-4 text-sm text-fumaca">Achei o cabeçalho, mas nenhuma linha com cliente embaixo dele.</p>
          )}

          <div className="space-y-2">
            {lidos.eventos.map((e) => {
              const repetido = repetidos.has(e.linha);
              const d = e.dados;
              return (
                <label
                  key={e.linha}
                  className={`cartao flex cursor-pointer items-start gap-3 p-3 ${marcados.has(e.linha) ? '' : 'opacity-60'}`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[#c4261d]"
                    checked={marcados.has(e.linha)}
                    disabled={!!importando}
                    onChange={() => alternar(e.linha)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="truncate font-semibold">{d.cliente}</span>
                      <span className="font-display text-lg uppercase text-dourado">{real(d.valor)}</span>
                    </span>
                    <span className="block text-sm text-fumaca">
                      {dataCurta(d.data ?? '')}
                      {d.hora ? ` ${d.hora}` : ''} · {inteiro(d.convidados)} convidados ·{' '}
                      {ROTULO_SITUACAO[d.situacao ?? 'confirmado']} · {ROTULO_TIPO_EVENTO[d.tipoEvento ?? 'aniversario']}
                      {d.local ? ` · ${d.local}` : ''}
                    </span>
                    {(repetido || e.avisos.length > 0) && (
                      <span className="mt-1 block text-xs text-brasa-clara">
                        {[repetido ? 'já existe no app' : '', ...e.avisos].filter(Boolean).join(' · ')}
                        <span className="text-fumaca"> · linha {inteiro(e.linha)}</span>
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>

          {lidos.ignoradas.length > 0 && (
            <details className="cartao p-4 text-sm">
              <summary className="cursor-pointer text-fumaca">
                {inteiro(lidos.ignoradas.length)} {lidos.ignoradas.length === 1 ? 'linha ficou' : 'linhas ficaram'} de fora
              </summary>
              <ul className="mt-2 space-y-1 text-fumaca">
                {lidos.ignoradas.map((l) => (
                  <li key={l.linha}>
                    Linha {inteiro(l.linha)}: "{l.texto}", {l.motivo}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
