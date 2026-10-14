import { useEffect, useState } from 'react';
import { cpfFormatado, moeda, dataBr } from '../../supabase/functions/_shared/contrato';
import { contratanteVazio, contratos, linkDoContrato, type Contrato } from '../dados/contratos';
import { conteudoDoContrato, opcoesIniciais, type OpcoesDoContrato } from '../dominio/contrato-do-orcamento';
import { precoDoEvento } from '../dominio/evento-externo';
import type { Orcamento, Resultado } from '../dominio/tipos';
import { mensagemDe } from '../erro';
import { baixar, linkDoWhatsApp } from '../pdf-da-proposta';
import { pdfDoContrato } from '../pdf-do-contrato';
import { BotaoCopiar, Campo, CampoDinheiro, CampoTexto, Segmentado } from './Campos';

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

/**
 * O contrato do evento, na aba Resultado.
 *
 * Gera o link (com as opções que mudam de contrato para contrato), mostra se
 * o cliente já abriu e se assinou, e baixa o PDF assinado com o comprovante.
 * O contrato congela o orçamento no momento do link: se o orçamento mudar
 * depois, a tela avisa para gerar outro.
 */
export default function ContratoDoEvento({
  orcamento,
  resultado,
  aoMudar,
}: {
  orcamento: Orcamento;
  resultado: Resultado;
  /** O contrato em aberto, para a proposta poder mandar o link junto. */
  aoMudar: (c: Contrato | null) => void;
}) {
  const [lista, setLista] = useState<Contrato[] | null>(null);
  const [erro, setErro] = useState('');
  const [gerando, setGerando] = useState(false);
  const [opcoes, setOpcoes] = useState<OpcoesDoContrato>(() => opcoesIniciais(orcamento, resultado));
  const [gravando, setGravando] = useState(false);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);

  const carregar = () =>
    contratos
      .doEvento(orcamento.id)
      .then(setLista)
      .catch((e) => setErro(mensagemDe(e)));

  useEffect(() => {
    void carregar();
    // Recarrega ao voltar para a aba: o cliente pode ter assinado nesse meio-tempo.
    const aoVoltar = () => document.visibilityState === 'visible' && void carregar();
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orcamento.id]);

  const ativo = lista?.find((c) => c.situacao !== 'cancelado') ?? null;
  useEffect(() => aoMudar(ativo), [ativo, aoMudar]);

  const gerar = async () => {
    setGravando(true);
    setErro('');
    try {
      const representante = await contratos.meuNome();
      const novo = await contratos.criar(orcamento.id, conteudoDoContrato(orcamento, resultado, opcoes, representante));
      setLista((l) => [novo, ...(l ?? [])]);
      setGerando(false);
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setGravando(false);
    }
  };

  const verComoFica = async () => {
    const representante = await contratos.meuNome();
    baixar(await pdfDoContrato(conteudoDoContrato(orcamento, resultado, opcoes, representante), contratanteVazio(), null));
  };

  const baixarAssinado = async (c: Contrato) => {
    baixar(
      await pdfDoContrato(
        c.conteudo,
        c.contratante,
        c.assinadoEm && c.hash
          ? {
              assinadoEm: c.assinadoEm,
              hash: c.hash,
              email: c.assinatura?.email ?? c.contratante.email,
              ip: c.assinatura?.ip ?? '',
              dispositivo: c.assinatura?.dispositivo,
              enviadoEm: c.enviadoEm,
            }
          : null,
      ),
    );
  };

  const cancelar = async (c: Contrato) => {
    setErro('');
    try {
      await contratos.cancelar(c.id);
      setLista((l) => (l ?? []).map((x) => (x.id === c.id ? { ...x, situacao: 'cancelado' } : x)));
      setConfirmandoCancelar(false);
    } catch (e) {
      setErro(mensagemDe(e));
    }
  };

  if (!lista) {
    return (
      <div className="cartao p-4 text-sm text-fumaca">
        <p className="rotulo">Contrato</p>
        <p className="mt-1">{erro || 'Carregando...'}</p>
      </div>
    );
  }

  // O orçamento mudou depois do link? Valor e data são o que pesa no contrato.
  const mudou =
    ativo?.situacao === 'enviado' &&
    (Math.abs(ativo.conteudo.valorTotal - precoDoEvento(orcamento, resultado)) > 0.009 || ativo.conteudo.evento.data !== orcamento.data);

  const link = ativo ? linkDoContrato(ativo.token) : '';
  const primeiroNome = orcamento.cliente.trim().split(' ')[0];
  const recado = `Olá${primeiroNome ? `, ${primeiroNome}` : ''}! Segue o contrato do seu evento para conferir e assinar: ${link}\nVocê preenche seus dados, recebe um código no e-mail e assina pelo celular mesmo.`;

  return (
    <div className="cartao p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="rotulo">Contrato</p>
          {!ativo && (
            <p className="mt-1 text-sm text-fumaca">
              O cliente recebe um link com o contrato já preenchido com este orçamento, coloca nome, CPF e endereço, e assina
              com um código que chega no e-mail dele.
            </p>
          )}
          {ativo?.situacao === 'enviado' && (
            <p className="mt-1 text-sm">
              <span className="font-semibold text-dourado">Aguardando assinatura</span>
              <span className="text-fumaca">
                {' '}
                · gerado em {quando(ativo.enviadoEm)}
                {ativo.visualizadoEm ? ` · o cliente abriu em ${quando(ativo.visualizadoEm)}` : ' · o cliente ainda não abriu'}
              </span>
            </p>
          )}
          {ativo?.situacao === 'assinado' && (
            <p className="mt-1 text-sm">
              <span className="font-semibold text-verde">✓ Assinado em {quando(ativo.assinadoEm!)}</span>
              <span className="block text-fumaca">
                {ativo.contratante.nome} · CPF {cpfFormatado(ativo.contratante.cpf)} · {ativo.assinatura?.email}
              </span>
            </p>
          )}
        </div>
        {!ativo && !gerando && (
          <button type="button" className="botao botao-brasa" onClick={() => setGerando(true)}>
            Gerar contrato
          </button>
        )}
      </div>

      {mudou && (
        <p className="mt-3 rounded-xl border border-dourado/50 bg-dourado/10 p-3 text-sm text-dourado">
          O orçamento mudou depois que o contrato foi gerado (o contrato diz {moeda(ativo!.conteudo.valorTotal)}
          {ativo!.conteudo.evento.data ? ` para ${dataBr(ativo!.conteudo.evento.data)}` : ''}). Cancele e gere outro para o cliente
          assinar o atualizado.
        </p>
      )}

      {!ativo && gerando && (
        <div className="mt-4 space-y-4">
          <Campo rotulo="Evento, como aparece no contrato" dica='"…para o evento de Casamento da CONTRATANTE"'>
            <CampoTexto valor={opcoes.descricao} aoMudar={(descricao) => setOpcoes({ ...opcoes, descricao })} placeholder="Casamento, Aniversário de 15 anos" />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Carnes">
              <Segmentado
                valor={opcoes.carnes}
                aoMudar={(carnes) => setOpcoes({ ...opcoes, carnes })}
                opcoes={[
                  { valor: 'buffet', rotulo: 'O buffet fornece' },
                  { valor: 'contratante', rotulo: 'O cliente fornece' },
                ]}
              />
            </Campo>
            <Campo rotulo="Bebidas">
              <Segmentado
                valor={opcoes.bebidas}
                aoMudar={(bebidas) => setOpcoes({ ...opcoes, bebidas })}
                opcoes={[
                  { valor: 'buffet', rotulo: 'As do orçamento, pelo buffet' },
                  { valor: 'contratante', rotulo: 'Por conta do cliente' },
                ]}
              />
            </Campo>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Valor da entrada (opcional)" dica="Em branco, o contrato diz só “sinal pago no ato”, como o modelo de vocês.">
              <CampoDinheiro valor={opcoes.valorEntrada} aoMudar={(valorEntrada) => setOpcoes({ ...opcoes, valorEntrada })} />
            </Campo>
            <label className="flex items-center gap-3 self-end pb-3 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[#c4261d]"
                checked={opcoes.incluiEstrutura}
                onChange={(e) => setOpcoes({ ...opcoes, incluiEstrutura: e.target.checked })}
              />
              Inclui louças, pratos, copos e talheres
            </label>
          </div>
          <p className="text-sm text-fumaca">
            Valor no contrato: <strong className="text-creme">{moeda(precoDoEvento(orcamento, resultado))}</strong>
            {orcamento.data ? ` · evento em ${dataBr(orcamento.data)}` : ' · sem data no orçamento'}. Gerar o link vale como o
            aceite do buffet, em seu nome.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="botao botao-brasa" disabled={gravando} onClick={() => void gerar()}>
              {gravando ? 'Gerando...' : 'Gerar o link do contrato'}
            </button>
            <button type="button" className="botao botao-linha" onClick={() => void verComoFica().catch((e) => setErro(mensagemDe(e)))}>
              Ver como fica (PDF)
            </button>
            <button type="button" className="botao botao-linha !text-fumaca" onClick={() => setGerando(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {ativo && (
        <div className="mt-4 space-y-3">
          {ativo.situacao === 'enviado' && (
            <>
              <p className="campo flex items-center truncate text-sm select-all">{link}</p>
              <div className="flex flex-wrap gap-2">
                <a className="botao botao-brasa" href={linkDoWhatsApp(orcamento.contato, recado)} target="_blank" rel="noopener noreferrer">
                  Mandar no WhatsApp
                </a>
                <BotaoCopiar texto={link} rotulo="Copiar link" />
                <a className="botao botao-linha" href={link} target="_blank" rel="noopener noreferrer">
                  Abrir
                </a>
                {confirmandoCancelar ? (
                  <>
                    <button type="button" className="botao botao-linha !border-brasa !text-brasa-clara" onClick={() => void cancelar(ativo)}>
                      Sim, cancelar este link
                    </button>
                    <button type="button" className="botao botao-linha !text-fumaca" onClick={() => setConfirmandoCancelar(false)}>
                      Voltar
                    </button>
                  </>
                ) : (
                  <button type="button" className="botao botao-linha !text-fumaca" onClick={() => setConfirmandoCancelar(true)}>
                    Cancelar e gerar outro
                  </button>
                )}
              </div>
            </>
          )}
          {ativo.situacao === 'assinado' && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="botao botao-brasa" onClick={() => void baixarAssinado(ativo).catch((e) => setErro(mensagemDe(e)))}>
                Baixar o contrato assinado (PDF)
              </button>
              <BotaoCopiar texto={link} rotulo="Copiar link do cliente" />
            </div>
          )}
        </div>
      )}

      {erro && <p className="mt-3 text-sm text-brasa-clara">{erro}</p>}
    </div>
  );
}
