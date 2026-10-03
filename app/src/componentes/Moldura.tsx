import type { ReactElement, ReactNode } from 'react';
import { Calendario, Faisca, Lista, Pessoas, Recibo } from './Icones';

/**
 * A moldura do app: o menu e o lugar onde a tela acontece.
 *
 * O app nasceu só para celular, porque a primeira necessidade era conferir
 * compra no açougue com uma mão só. Aí apareceu quem usa de verdade: a Érica
 * atende cliente de casa, no computador, e é ela quem monta o orçamento. No
 * notebook a barra de abas no rodapé fica a meio metro de distância do olho e
 * sobra uma faixa de tela vazia dos dois lados.
 *
 * Então são duas formas, e não uma esticada:
 *
 * - celular: cabeçalho em cima, abas no rodapé, ao alcance do polegar;
 * - computador (>= 64rem): coluna fixa à esquerda, com o nome da tela por
 *   extenso e o rótulo sempre visível, do jeito que se usa sentado.
 *
 * Quem decide qual é o CSS, não o JavaScript: `--altura-nav` e
 * `--largura-menu` trocam de valor na media query e todo mundo que depende
 * delas se recoloca sozinho. Sem `matchMedia`, sem remontar componente, e sem
 * o assistente perder a resposta no meio por causa de um giro de tela.
 */

export type Aba = 'orcamentos' | 'agenda' | 'equipe' | 'catalogo' | 'assistente';

export const ABAS = [
  { id: 'orcamentos', rotulo: 'Orçamentos', Icone: Recibo },
  { id: 'agenda', rotulo: 'Agenda', Icone: Calendario },
  { id: 'equipe', rotulo: 'Equipe', Icone: Pessoas },
  { id: 'catalogo', rotulo: 'Catálogo', Icone: Lista },
  { id: 'assistente', rotulo: 'Assistente', Icone: Faisca },
] satisfies { id: Aba; rotulo: string; Icone: (p: { className?: string }) => ReactElement }[];

export default function Moldura({
  aba,
  aoTrocarAba,
  email,
  aoSair,
  children,
}: {
  aba: Aba;
  aoTrocarAba: (a: Aba) => void;
  email: string;
  aoSair: () => void;
  children: ReactNode;
}) {
  return (
    <>
      {/* ------------------------------------------------ computador ------ */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-borda bg-carvao-2 lg:flex"
        style={{ width: 'var(--largura-menu)' }}
      >
        <div className="border-b border-borda px-5 py-5">
          <p className="titulo text-lg text-dourado">Na Grelha</p>
          <p className="mt-0.5 text-xs text-fumaca">com Alan Xavier</p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {ABAS.map((a) => {
            const ativa = aba === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => aoTrocarAba(a.id)}
                aria-current={ativa ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                  ativa ? 'bg-carvao-3 text-dourado' : 'text-fumaca hover:bg-carvao-3/60 hover:text-creme'
                }`}
              >
                {/* O traço vive à esquerda aqui, e não em cima: numa coluna é
                    onde o olho procura a linha ativa. */}
                <span
                  className={`h-5 w-0.5 shrink-0 rounded-full transition-colors ${
                    ativa ? 'bg-dourado' : 'bg-transparent'
                  }`}
                />
                <a.Icone className="h-5 w-5 shrink-0" />
                <span className="truncate">{a.rotulo}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-borda p-3">
          <p className="truncate px-2 pb-2 text-xs text-fumaca" title={email}>
            {email}
          </p>
          <button type="button" className="botao botao-linha w-full !min-h-10 text-sm" onClick={aoSair}>
            Sair
          </button>
        </div>
      </aside>

      {/* ---------------------------------------------------- conteúdo ---- */}
      <div style={{ paddingLeft: 'var(--largura-menu)', paddingBottom: 'var(--altura-nav)' }}>
        {/* O cabeçalho só existe no celular: no computador o nome e o e-mail
            já estão na coluna, e repetir só come altura de tela. */}
        <header className="border-b border-borda lg:hidden">
          <div className="area flex items-center justify-between py-4">
            <div className="min-w-0">
              <p className="titulo text-lg text-dourado">Na Grelha</p>
              <p className="truncate text-xs text-fumaca">{email}</p>
            </div>
            <button type="button" className="botao botao-linha !min-h-10 !px-3 text-sm" onClick={aoSair}>
              Sair
            </button>
          </div>
        </header>

        {children}
      </div>

      {/* ------------------------------------------------------ celular --- */}
      {/*
        Navegação com ícone e rótulo, e alvo de toque cheio.
        A faixa só de texto miúdo era pequena demais para acertar com o dedo, e
        o rótulo sozinho não dá para reconhecer de relance.
      */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-borda bg-carvao/95 backdrop-blur lg:hidden">
        <div
          className="area flex items-stretch gap-1 py-1.5"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {ABAS.map((a) => {
            const ativa = aba === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => aoTrocarAba(a.id)}
                aria-current={ativa ? 'page' : undefined}
                className={`relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 pb-2 pt-2 transition-colors ${
                  ativa ? 'bg-carvao-3 text-dourado' : 'text-fumaca hover:text-creme'
                }`}
              >
                {/* traço em cima da aba ativa: dá para ver de relance em qual
                    tela a pessoa está, mesmo sem distinguir a cor */}
                <span
                  className={`absolute inset-x-4 top-0 h-0.5 rounded-full transition-colors ${
                    ativa ? 'bg-dourado' : 'bg-transparent'
                  }`}
                />
                <a.Icone className="h-5 w-5" />
                <span className="text-[0.65rem] font-semibold leading-none">{a.rotulo}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
