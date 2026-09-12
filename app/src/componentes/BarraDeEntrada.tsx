import { useEffect, useRef } from 'react';
import { Enviar, Imagem, Parar, Texto } from './Icones';

export type Modo = 'texto' | 'imagem';

/**
 * Barra de digitação do assistente.
 *
 * Três decisões que mudam como ela se usa:
 *
 * 1. **Pílula flutuante.** A barra não é uma faixa colada no rodapé: é um
 *    cartão com desfoque por cima da conversa, e o texto passa por baixo dela.
 *    Sem isso a última mensagem fica sempre escondida atrás da barra.
 *
 * 2. **O campo cresce com o texto.** Textarea de altura fixa obriga a pessoa a
 *    rolar dentro de um campo de uma linha para reler o que escreveu, que é o
 *    jeito mais rápido de fazer alguém desistir de escrever.
 *
 * 3. **Enviar vira parar.** Enquanto a resposta chega, o mesmo botão
 *    interrompe. Geração longa sem botão de parar é uma tela travada.
 */
export default function BarraDeEntrada({
  valor,
  aoMudar,
  aoEnviar,
  aoParar,
  ocupado,
  modo,
  aoMudarModo,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  aoEnviar: () => void;
  aoParar: () => void;
  ocupado: boolean;
  modo: Modo;
  aoMudarModo: (m: Modo) => void;
}) {
  const campo = useRef<HTMLTextAreaElement>(null);

  // Cresce até um teto e só então começa a rolar por dentro. Zerar a altura
  // antes de medir é obrigatório: sem isso o scrollHeight nunca diminui e o
  // campo fica grande para sempre depois de apagar o texto.
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [valor]);

  const temTexto = valor.trim().length > 0;

  return (
    <div className="pointer-events-none sticky z-30 px-3 pb-3" style={{ bottom: 'var(--altura-nav)' }}>
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-3xl border border-borda bg-carvao-2/80 p-2.5 shadow-2xl backdrop-blur-xl">
        <textarea
          ref={campo}
          rows={1}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (temTexto && !ocupado) aoEnviar();
            }
          }}
          placeholder={modo === 'texto' ? 'Pergunte alguma coisa' : 'Descreva a imagem que você quer'}
          disabled={ocupado}
          className="block max-h-44 w-full resize-none border-0 bg-transparent px-2 py-2 text-base leading-relaxed text-creme outline-none placeholder:text-fumaca/70 disabled:opacity-60"
        />

        <div className="mt-1 flex items-center justify-between gap-2">
          {/* O modo vive aqui em vez de virar um segundo botão de enviar:
              dois botões de ação lado a lado fazem a pessoa parar para
              escolher, e um deles sempre é o errado. */}
          <div className="flex rounded-full border border-borda p-0.5">
            {(
              [
                ['texto', 'Texto', Texto],
                ['imagem', 'Imagem', Imagem],
              ] as const
            ).map(([id, rotulo, Icone]) => (
              <button
                key={id}
                type="button"
                onClick={() => aoMudarModo(id)}
                aria-pressed={modo === id}
                disabled={ocupado}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  modo === id ? 'bg-carvao-3 text-dourado' : 'text-fumaca hover:text-creme'
                }`}
              >
                <Icone className="h-3.5 w-3.5" />
                {rotulo}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-fumaca sm:block">
              {ocupado ? 'gerando...' : 'Enter envia'}
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
                disabled={!temTexto}
                aria-label={modo === 'texto' ? 'Enviar' : 'Gerar imagem'}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brasa text-creme transition-all hover:bg-brasa-clara active:scale-95 disabled:bg-carvao-3 disabled:text-fumaca"
              >
                {modo === 'texto' ? <Enviar className="h-5 w-5" /> : <Imagem className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
