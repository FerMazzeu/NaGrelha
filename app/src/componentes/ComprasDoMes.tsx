import { useMemo, useState } from 'react';
import { juntarCompras, temCardapio } from '../dominio/compras';
import { COR_SITUACAO, ROTULO_SITUACAO, type Orcamento } from '../dominio/tipos';
import { mensagemDe } from '../erro';
import { exportarComprasJuntas } from '../excel-compras';
import { dataCurta, decimal, inteiro, quantidade, real } from '../formato';
import { textoDasComprasJuntas } from '../texto';
import { BotaoCopiar } from './Campos';

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function andarMes(mes: string, n: number) {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 7);
}

const nomeDoMes = (mes: string) => {
  const [a, m] = mes.split('-').map(Number);
  const nome = MESES[m - 1];
  return `${nome[0].toUpperCase()}${nome.slice(1)} de ${a}`;
};

/**
 * A lista de compras do mês: os eventos escolhidos, somados numa lista só.
 *
 * Pedido do Alan: "será que consigo juntar as listas de compras do mês". Ele
 * compra no atacado para o mês inteiro. O confirmado já vem marcado; orçado
 * entra se ele marcar (às vezes compra antes de o cliente fechar). Evento
 * fechado por fora não tem cardápio no app e aparece sem caixa de marcar.
 */
export default function ComprasDoMes({ orcamentos, aoVoltar }: { orcamentos: Orcamento[]; aoVoltar: () => void }) {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const doMes = useMemo(
    () =>
      orcamentos
        .filter((o) => o.data.startsWith(mes) && o.situacao !== 'perdido')
        .sort((a, b) => a.data.localeCompare(b.data)),
    [orcamentos, mes],
  );
  // Marcados por mês: trocar de mês começa com os confirmados daquele mês.
  const [escolha, setEscolha] = useState<Record<string, Set<string>>>({});
  const marcados =
    escolha[mes] ?? new Set(doMes.filter((o) => o.situacao === 'confirmado' && temCardapio(o)).map((o) => o.id));
  const alternar = (id: string) => {
    const novo = new Set(marcados);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setEscolha({ ...escolha, [mes]: novo });
  };

  const juntas = useMemo(() => juntarCompras(doMes.filter((o) => marcados.has(o.id))), [doMes, marcados]);
  const titulo = nomeDoMes(mes);
  const texto = textoDasComprasJuntas(juntas, titulo);
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [exportando, setExportando] = useState(false);

  return (
    <div className="area py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="titulo text-2xl">Lista de compras do mês</h1>
          <p className="mt-1 text-sm text-fumaca">Os eventos marcados viram uma lista só, somada item por item.</p>
        </div>
        <button type="button" className="botao botao-linha" onClick={aoVoltar}>
          Voltar para a agenda
        </button>
      </div>

      <div className="mt-5 flex items-center gap-2">
        <button type="button" className="botao botao-linha !min-h-10 !px-3" aria-label="Mês anterior" onClick={() => setMes(andarMes(mes, -1))}>
          ‹
        </button>
        <span className="min-w-44 text-center font-semibold">{titulo}</span>
        <button type="button" className="botao botao-linha !min-h-10 !px-3" aria-label="Próximo mês" onClick={() => setMes(andarMes(mes, 1))}>
          ›
        </button>
      </div>

      <section className="mt-5">
        <p className="rotulo mb-2">Eventos do mês</p>
        {!doMes.length && <p className="cartao p-4 text-sm text-fumaca">Nenhum evento em {titulo.toLowerCase()}.</p>}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {doMes.map((o) => {
            const pode = temCardapio(o);
            return (
              <label
                key={o.id}
                className={`cartao flex items-center gap-3 p-3 ${pode ? 'cursor-pointer' : 'opacity-60'} ${marcados.has(o.id) ? '' : 'opacity-75'}`}
              >
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 accent-[#c4261d]"
                  checked={marcados.has(o.id)}
                  disabled={!pode}
                  onChange={() => alternar(o.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{o.cliente || 'Sem nome'}</span>
                  <span className="block text-xs text-fumaca">
                    {dataCurta(o.data)} · {pode ? `${inteiro(o.adultos + o.faixas.reduce((s, f) => s + f.quantidade, 0))} convidados` : 'fechado por fora, sem cardápio no app'}
                  </span>
                </span>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold ${COR_SITUACAO[o.situacao]}`}>
                  {ROTULO_SITUACAO[o.situacao]}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {juntas.eventos.length > 0 && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Numero rotulo="Eventos" valor={inteiro(juntas.eventos.length)} />
            <Numero rotulo="Carne crua" valor={`${decimal(juntas.carneCruaKg)} kg`} />
            <Numero rotulo="Carvão" valor={`${inteiro(juntas.carvaoKg)} kg`} />
            <Numero rotulo="Custo estimado" valor={real(juntas.custoTotal)} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <BotaoCopiar texto={texto} rotulo="Copiar a lista" />
            <a className="botao botao-linha" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer">
              Mandar no WhatsApp
            </a>
            <button
              type="button"
              className="botao botao-brasa"
              disabled={exportando}
              onClick={async () => {
                setExportando(true);
                setErro('');
                try {
                  await exportarComprasJuntas(juntas, titulo);
                } catch (e) {
                  setErro(mensagemDe(e));
                } finally {
                  setExportando(false);
                }
              }}
            >
              {exportando ? 'Gerando...' : 'Exportar em Excel'}
            </button>
          </div>
          {erro && <p className="mt-2 text-sm text-brasa-clara">{erro}</p>}

          <div className="mt-6 space-y-6">
            {juntas.porCategoria.map(([categoria, itens]) => (
              <section key={categoria}>
                <h2 className="titulo text-lg text-dourado">{categoria}</h2>
                <div className="cartao mt-2 divide-y divide-borda">
                  {itens.map((item) => {
                    const chave = `${item.nome}|${item.unidade}`;
                    const varios = item.porEvento.length > 1;
                    return (
                      <div key={chave}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm"
                          onClick={() => setAberto(aberto === chave ? null : chave)}
                          aria-expanded={aberto === chave}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{item.nome}</span>
                            <span className="block text-xs text-fumaca">
                              {varios ? `${inteiro(item.porEvento.length)} eventos` : item.porEvento[0]?.cliente} · {real(item.custo)}
                            </span>
                          </span>
                          <span className="shrink-0 font-semibold">{quantidade(item.comprar, item.unidade, item.embalagens)}</span>
                        </button>
                        {aberto === chave && (
                          <ul className="space-y-1 px-4 pb-3 text-xs text-fumaca">
                            {item.porEvento.map((p) => (
                              <li key={p.eventoId} className="flex justify-between gap-3">
                                <span className="truncate">
                                  {p.data ? dataCurta(p.data).slice(0, 5) : 'sem data'} · {p.cliente}
                                </span>
                                <span className="shrink-0 text-creme">{quantidade(p.comprar, item.unidade)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <p className="mt-4 text-xs text-fumaca">
            Toque num item para ver quanto vai para cada evento. A quantidade de cada evento é a da lista de compras dele, já
            arredondada para o que se compra.
          </p>
        </>
      )}
    </div>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="cartao p-3">
      <p className="rotulo">{rotulo}</p>
      <p className="mt-1 font-display text-xl uppercase text-creme">{valor}</p>
    </div>
  );
}
