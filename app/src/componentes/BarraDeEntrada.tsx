import { useEffect, useRef, useState } from 'react';
import type { AnexoLocal } from '../midia';
import { ehAudio, ehImagem, paraWav, prepararAnexo, tamanhoLegivel } from '../midia';
import { Arquivo, Clipe, Enviar, Fechar, Imagem, Microfone, Parar, Som } from './Icones';

/**
 * Barra de digitação do assistente.
 *
 * Cinco decisões que mudam como ela se usa:
 *
 * 1. **Pílula flutuante.** A barra não é uma faixa colada no rodapé: é um
 *    cartão com desfoque por cima da conversa, e o texto passa por baixo dela.
 *
 * 2. **O campo cresce com o texto.** Textarea de altura fixa obriga a pessoa a
 *    rolar dentro de um campo de uma linha para reler o que escreveu.
 *
 * 3. **Enviar vira parar.** Enquanto a resposta chega, o mesmo botão
 *    interrompe. Geração longa sem botão de parar é uma tela travada.
 *
 * 4. **Gerar imagem arma o próximo envio, e não dispara na hora.**
 *    Esse botão já errou duas vezes antes: primeiro era um modo que ficava
 *    ligado e surpreendia a pessoa na pergunta seguinte, depois virou uma ação
 *    que mandava sozinha antes de terminar de escrever. Agora ele acende uma
 *    etiqueta visível, você escreve com calma, e só o envio dispara.
 *
 * 5. **Anexo e microfone ficam na mesma linha do resto.** O preparo do arquivo
 *    acontece no momento de anexar, e não no de enviar: se a foto for grande
 *    demais, a pessoa descobre enquanto ainda está escrevendo.
 */
export default function BarraDeEntrada({
  valor,
  aoMudar,
  aoEnviar,
  anexos,
  aoAnexar,
  aoRemoverAnexo,
  armadoParaImagem,
  aoArmarImagem,
  qualidade,
  aoMudarQualidade,
  aoParar,
  aoErro,
  ocupado,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  /** Dispara o envio. Quem decide se é texto ou imagem é o estado armado. */
  aoEnviar: () => void;
  anexos: AnexoLocal[];
  aoAnexar: (novos: AnexoLocal[]) => void;
  aoRemoverAnexo: (indice: number) => void;
  armadoParaImagem: boolean;
  aoArmarImagem: (armado: boolean) => void;
  qualidade: 'alta' | 'rapida';
  aoMudarQualidade: (q: 'alta' | 'rapida') => void;
  aoParar: () => void;
  /** Falha de preparo de arquivo aparece na conversa, junto dos outros erros. */
  aoErro: (mensagem: string) => void;
  ocupado: boolean;
}) {
  const campo = useRef<HTMLTextAreaElement>(null);
  const seletor = useRef<HTMLInputElement>(null);
  const [preparando, setPreparando] = useState(false);
  const { gravando, segundos, comecar, encerrar, cancelar } = useGravador(aoAnexar, aoErro);

  // Cresce até um teto e só então começa a rolar por dentro. Zerar a altura
  // antes de medir é obrigatório: sem isso o scrollHeight nunca diminui e o
  // campo fica grande para sempre depois de apagar o texto.
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [valor]);

  // Ao armar, o foco volta para o campo: o próximo passo é escrever.
  useEffect(() => {
    if (armadoParaImagem) campo.current?.focus();
  }, [armadoParaImagem]);

  const escolher = async (arquivos: FileList | null) => {
    if (!arquivos?.length) return;
    setPreparando(true);
    const prontos: AnexoLocal[] = [];
    for (const arquivo of Array.from(arquivos).slice(0, 6)) {
      try {
        prontos.push(await prepararAnexo(arquivo));
      } catch (e) {
        aoErro(e instanceof Error ? e.message : String(e));
      }
    }
    setPreparando(false);
    if (prontos.length) aoAnexar(prontos);
  };

  const temTexto = valor.trim().length > 0;
  const podeEnviar = (temTexto || anexos.length > 0) && !preparando && !gravando;

  return (
    <div className="pointer-events-none sticky z-30 px-3 pb-3" style={{ bottom: 'var(--altura-nav)' }}>
      <div
        className={`pointer-events-auto mx-auto max-w-3xl rounded-3xl border bg-carvao-2/80 p-2.5 shadow-2xl backdrop-blur-xl transition-colors ${
          armadoParaImagem ? 'border-dourado/60' : 'border-borda'
        }`}
      >
        {/* A etiqueta é a resposta para "o que vai acontecer quando eu enviar". */}
        {armadoParaImagem && (
          <div className="mb-2 rounded-2xl bg-dourado/12 px-3 py-2">
            <div className="flex items-center gap-2">
              <Imagem className="h-4 w-4 shrink-0 text-dourado" />
              <p className="min-w-0 flex-1 text-xs font-semibold text-dourado">
                Vai gerar uma imagem
                <span className="ml-1.5 font-normal text-dourado/70">{dica(anexos)}</span>
              </p>
              <button
                type="button"
                onClick={() => aoArmarImagem(false)}
                aria-label="Cancelar geração de imagem"
                className="shrink-0 rounded-full p-1 text-dourado/70 transition-colors hover:text-dourado"
              >
                <Fechar className="h-3.5 w-3.5" />
              </button>
            </div>

            {/*
              A qualidade alta custa perto de quatro vezes mais por imagem.
              Fica aqui, à vista no momento de gastar, e não escondida numa
              tela de configuração que ninguém abre.
            */}
            <div className="mt-2 flex items-center gap-1">
              <span className="mr-1 text-[0.65rem] uppercase tracking-wide text-dourado/60">Qualidade</span>
              {(
                [
                  ['alta', 'Alta', 'Melhor imagem, mais cara'],
                  ['rapida', 'Rápida', 'Mais barata, para ter uma ideia'],
                ] as const
              ).map(([valor, rotulo, titulo]) => (
                <button
                  key={valor}
                  type="button"
                  title={titulo}
                  aria-pressed={qualidade === valor}
                  onClick={() => aoMudarQualidade(valor)}
                  className={`rounded-full px-2.5 py-1 text-[0.7rem] font-semibold transition-colors ${
                    qualidade === valor
                      ? 'bg-dourado text-carvao'
                      : 'text-dourado/70 hover:bg-dourado/15 hover:text-dourado'
                  }`}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </div>
        )}

        {anexos.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {anexos.map((a, i) => (
              <Etiqueta key={`${a.nome}-${i}`} anexo={a} aoRemover={() => aoRemoverAnexo(i)} />
            ))}
          </div>
        )}

        {gravando ? (
          <div className="flex items-center gap-3 px-2 py-3">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-brasa" />
            <p className="min-w-0 flex-1 text-sm text-creme">
              Gravando <span className="tabular-nums text-fumaca">{relogio(segundos)}</span>
            </p>
            <button type="button" className="botao botao-linha !min-h-9 text-xs" onClick={cancelar}>
              Descartar
            </button>
            <button type="button" className="botao botao-brasa !min-h-9 text-xs" onClick={encerrar}>
              Anexar áudio
            </button>
          </div>
        ) : (
          <textarea
            ref={campo}
            rows={1}
            value={valor}
            onChange={(e) => aoMudar(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (podeEnviar && !ocupado) aoEnviar();
              }
              if (e.key === 'Escape' && armadoParaImagem) aoArmarImagem(false);
            }}
            onPaste={(e) => {
              // Print de tela colado com Ctrl+V vira anexo. É como a pessoa
              // manda um pedaço de planilha ou uma conversa do WhatsApp.
              const arquivos = Array.from(e.clipboardData.files);
              if (arquivos.length) {
                e.preventDefault();
                const balde = new DataTransfer();
                for (const f of arquivos) balde.items.add(f);
                escolher(balde.files);
              }
            }}
            placeholder={armadoParaImagem ? 'Descreva a imagem que você quer' : 'Pergunte alguma coisa'}
            disabled={ocupado}
            className="block max-h-44 w-full resize-none border-0 bg-transparent px-2 py-2 text-base leading-relaxed text-creme outline-none placeholder:text-fumaca/70 disabled:opacity-60"
          />
        )}

        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => aoArmarImagem(!armadoParaImagem)}
              disabled={ocupado || gravando}
              aria-pressed={armadoParaImagem}
              title={armadoParaImagem ? 'Voltar para texto' : 'O próximo envio vira uma imagem'}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
                armadoParaImagem
                  ? 'border-dourado/60 bg-dourado/12 text-dourado'
                  : 'border-borda text-fumaca hover:border-dourado/50 hover:text-dourado'
              }`}
            >
              <Imagem className="h-3.5 w-3.5" />
              Gerar imagem
            </button>

            <input
              ref={seletor}
              type="file"
              multiple
              accept="image/*,audio/*,text/*,.csv,.json,.md"
              className="hidden"
              onChange={(e) => {
                escolher(e.target.files);
                // Zerar deixa escolher o MESMO arquivo de novo depois de tirar.
                e.target.value = '';
              }}
            />
            <Redondo
              titulo="Anexar foto, áudio ou arquivo"
              onClick={() => seletor.current?.click()}
              desabilitado={ocupado || preparando || gravando}
              aceso={preparando}
            >
              <Clipe className="h-4 w-4" />
            </Redondo>

            <Redondo
              titulo={gravando ? 'Gravando' : 'Gravar um recado'}
              onClick={comecar}
              desabilitado={ocupado || preparando || gravando}
              aceso={gravando}
            >
              <Microfone className="h-4 w-4" />
            </Redondo>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-fumaca sm:block">
              {preparando ? 'preparando arquivo...' : ocupado ? 'gerando...' : 'Enter envia'}
            </span>

            {ocupado ? (
              <button
                type="button"
                onClick={aoParar}
                aria-label="Parar geração"
                title="Parar"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-carvao-3 text-creme transition-colors hover:bg-borda"
              >
                <Parar className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={aoEnviar}
                disabled={!podeEnviar}
                aria-label={armadoParaImagem ? 'Gerar imagem' : 'Enviar'}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all active:scale-95 disabled:bg-carvao-3 disabled:text-fumaca ${
                  armadoParaImagem
                    ? 'bg-dourado text-carvao hover:brightness-110'
                    : 'bg-brasa text-creme hover:bg-brasa-clara'
                }`}
              >
                {armadoParaImagem ? <Imagem className="h-5 w-5" /> : <Enviar className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Redondo({
  titulo,
  onClick,
  desabilitado,
  aceso,
  children,
}: {
  titulo: string;
  onClick: () => void;
  desabilitado: boolean;
  aceso: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      title={titulo}
      aria-label={titulo}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-40 ${
        aceso ? 'border-brasa/60 bg-brasa/12 text-brasa-clara' : 'border-borda text-fumaca hover:border-dourado/50 hover:text-dourado'
      }`}
    >
      {children}
    </button>
  );
}

/** Miniatura para foto, ícone para o resto. O nome sempre aparece. */
function Etiqueta({ anexo, aoRemover }: { anexo: AnexoLocal; aoRemover: () => void }) {
  const Icone = ehAudio(anexo.mime) ? Som : Arquivo;

  return (
    <div className="flex max-w-[15rem] items-center gap-2 rounded-xl border border-borda bg-carvao-3 py-1.5 pl-1.5 pr-1">
      {ehImagem(anexo.mime) ? (
        <img src={anexo.dados} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-carvao-2 text-dourado">
          <Icone className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-creme">{anexo.nome}</p>
        <p className="text-[0.65rem] text-fumaca">{tamanhoLegivel(anexo.bytes)}</p>
      </div>
      <button
        type="button"
        onClick={aoRemover}
        aria-label={`Tirar ${anexo.nome}`}
        className="shrink-0 rounded-full p-1 text-fumaca transition-colors hover:text-brasa-clara"
      >
        <Fechar className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const relogio = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** O que a etiqueta diz depender do que já está anexado. */
function dica(anexos: AnexoLocal[]) {
  if (anexos.some((a) => ehAudio(a.mime))) return 'a partir do seu recado de voz';
  if (anexos.some((a) => ehImagem(a.mime))) return 'usando as fotos anexadas como referência';
  return 'descreva, ou grave um recado, e envie';
}

/**
 * Gravação de recado pelo microfone.
 *
 * O navegador entrega webm/opus, que o modelo não lê, então a conversão para
 * WAV acontece aqui, antes de virar anexo. Fazer isso na hora de enviar
 * deixaria a pessoa esperando sem entender por quê.
 *
 * A trilha é encerrada sempre, inclusive ao descartar: microfone que continua
 * aberto deixa a luz da câmera acesa e assusta.
 */
function useGravador(aoAnexar: (novos: AnexoLocal[]) => void, aoErro: (mensagem: string) => void) {
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const gravador = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const descartar = useRef(false);

  useEffect(() => {
    if (!gravando) return;
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [gravando]);

  const soltarMicrofone = () => {
    for (const trilha of gravador.current?.stream.getTracks() ?? []) trilha.stop();
    gravador.current = null;
  };

  const comecar = async () => {
    try {
      const trilha = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(trilha);
      pedacos.current = [];
      descartar.current = false;

      rec.ondataavailable = (e) => {
        if (e.data.size) pedacos.current.push(e.data);
      };

      rec.onstop = async () => {
        soltarMicrofone();
        setGravando(false);
        if (descartar.current || !pedacos.current.length) return;
        try {
          const bruto = new Blob(pedacos.current, { type: rec.mimeType || 'audio/webm' });
          const wav = await paraWav(bruto);
          const leitor = new FileReader();
          leitor.onload = () =>
            aoAnexar([
              {
                nome: `recado-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.wav`,
                mime: 'audio/wav',
                dados: String(leitor.result),
                bytes: wav.size,
              },
            ]);
          leitor.readAsDataURL(wav);
        } catch (e) {
          aoErro(`Não consegui preparar o áudio: ${e instanceof Error ? e.message : String(e)}`);
        }
      };

      gravador.current = rec;
      setSegundos(0);
      setGravando(true);
      rec.start();
    } catch {
      aoErro('Não consegui abrir o microfone. Confira a permissão do navegador.');
    }
  };

  const encerrar = () => gravador.current?.stop();

  const cancelar = () => {
    descartar.current = true;
    gravador.current?.stop();
  };

  return { gravando, segundos, comecar, encerrar, cancelar };
}
