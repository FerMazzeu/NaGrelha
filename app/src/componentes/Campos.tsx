import { useEffect, useState, type ReactNode } from 'react';

export function Campo({ rotulo, dica, children }: { rotulo: string; dica?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="rotulo mb-1.5">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-xs text-fumaca">{dica}</span>}
    </label>
  );
}

export function CampoTexto({
  valor,
  aoMudar,
  ...resto
}: {
  valor: string;
  aoMudar: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return <input className="campo" value={valor} onChange={(e) => aoMudar(e.target.value)} {...resto} />;
}

/**
 * Campo numérico que dá para editar.
 *
 * O buffer de texto existe porque campo numérico controlado direto pelo número
 * é intragável: apagar tudo vira 0 na hora, "1," some antes de virar "1,5" e o
 * cursor pula. Aqui o texto é livre enquanto se digita e só o valor
 * interpretado sobe; quando o valor muda por fora, o texto é ressincronizado.
 */
export function CampoNumero({
  valor,
  aoMudar,
  sufixo,
  minimo = 0,
  ...resto
}: {
  valor: number;
  aoMudar: (v: number) => void;
  sufixo?: string;
  minimo?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [texto, setTexto] = useState(() => paraTexto(valor));

  useEffect(() => {
    if (interpretar(texto) !== valor) setTexto(paraTexto(valor));
    // só quando o valor externo muda, não a cada tecla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  return (
    <div className="relative">
      <input
        className={`campo ${sufixo ? 'pr-12' : ''}`}
        inputMode="decimal"
        value={texto}
        onChange={(e) => {
          const bruto = e.target.value.replace(/[^\d.,]/g, '');
          setTexto(bruto);
          const n = interpretar(bruto);
          if (n !== null) aoMudar(Math.max(minimo, n));
        }}
        onBlur={() => {
          const n = interpretar(texto);
          const final = n === null ? minimo : Math.max(minimo, n);
          aoMudar(final);
          setTexto(paraTexto(final));
        }}
        {...resto}
      />
      {sufixo && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-fumaca">
          {sufixo}
        </span>
      )}
    </div>
  );
}

function interpretar(texto: string): number | null {
  if (texto.trim() === '') return null;
  const n = Number(texto.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function paraTexto(valor: number) {
  if (!Number.isFinite(valor)) return '';
  return String(valor).replace('.', ',');
}

const centavosFormatados = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Maior valor aceito, em centavos: R$ 9.999.999.999,99. */
const TETO_EM_CENTAVOS = 999_999_999_999;

/** Texto colado ("R$ 2.500,00", "2500.5", "1.234") em centavos. Nulo se não for número. */
export function centavosDoTexto(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, '');
  if (!/\d/.test(limpo)) return null;
  const negativo = limpo.startsWith('-');
  const semSinal = limpo.replace(/-/g, '');
  // Com vírgula, ela é o decimal (jeito brasileiro) e o ponto é milhar.
  // Sem vírgula, ponto seguido de 3 dígitos é milhar; o resto é decimal.
  const normal = semSinal.includes(',')
    ? semSinal.replace(/\./g, '').replace(',', '.')
    : /\.\d{3}(\D|$)/.test(semSinal)
      ? semSinal.replace(/\./g, '')
      : semSinal;
  const n = Number(normal);
  if (!Number.isFinite(n)) return null;
  return Math.min(TETO_EM_CENTAVOS, Math.round(n * 100)) * (negativo ? -1 : 1);
}

/**
 * O que a pessoa digitou no campo de dinheiro, limpo: só número, uma vírgula
 * e no máximo duas casas depois dela. O ponto do teclado numérico vale como
 * vírgula quando vem seguido de até dois dígitos ("55.5"); com três, é milhar
 * ("1.500").
 */
export function textoDeDinheiro(texto: string, permitirNegativo = false) {
  const negativo = permitirNegativo && texto.includes('-');
  let limpo = texto.replace(/[^\d,.]/g, '');
  if (!limpo.includes(',')) limpo = limpo.replace(/\.(\d{0,2})$/, ',$1');
  const [inteira, ...resto] = limpo.split(',');
  const decimais = resto.join('').replace(/\./g, '').slice(0, 2);
  const corpo = resto.length ? `${inteira.replace(/\./g, '')},${decimais}` : inteira.replace(/\./g, '');
  return `${negativo ? '-' : ''}${corpo}`;
}

/**
 * Campo de dinheiro: digita-se como se escreve, e ele mostra sempre com duas
 * casas.
 *
 * "55" é R$ 55,00, "55,9" é R$ 55,90, e ao sair do campo o valor aparece
 * formatado ("1.234,56"). Colar "R$ 2.500,00" entende o valor.
 *
 * Era preenchido da direita para a esquerda, como na maquininha de cartão: "55"
 * dava R$ 0,55. Foi assim que o shoulder ficou no catálogo a R$ 0,55 o quilo, e
 * os orçamentos de uma semana saíram com a carne quase de graça.
 *
 * Ao entrar no campo o texto todo fica selecionado, então digitar troca o
 * valor em vez de emendar no que estava.
 *
 * `permitirNegativo`: saldo de conta pode ficar no vermelho.
 */
export function CampoDinheiro({
  valor,
  aoMudar,
  sufixo,
  permitirNegativo = false,
  destaque = false,
  className = '',
  onFocus,
  onBlur,
  ...resto
}: {
  valor: number;
  aoMudar: (v: number) => void;
  /** O que vem depois do número: "/kg", "/un". O "R$" já vem na frente. */
  sufixo?: string;
  permitirNegativo?: boolean;
  destaque?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const centavos = Math.round((Number.isFinite(valor) ? valor : 0) * 100);
  const formatado = `${centavos < 0 ? '-' : ''}${centavosFormatados.format(Math.abs(centavos) / 100)}`;
  // Enquanto se digita, o texto é o da pessoa; fora do campo, o formatado.
  const [digitando, setDigitando] = useState<string | null>(null);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-fumaca">R$</span>
      <input
        className={`campo !pl-8 !pr-3 text-right tabular-nums ${sufixo ? '!pr-12' : ''} ${destaque ? '!border-dourado/60' : ''} ${className}`}
        inputMode="decimal"
        value={digitando ?? formatado}
        onFocus={(e) => {
          setDigitando(formatado);
          e.currentTarget.select();
          onFocus?.(e);
        }}
        onChange={(e) => {
          const texto = textoDeDinheiro(e.target.value, permitirNegativo);
          setDigitando(texto);
          const c = centavosDoTexto(texto);
          aoMudar((c === null ? 0 : permitirNegativo ? c : Math.abs(c)) / 100);
        }}
        onBlur={(e) => {
          setDigitando(null);
          onBlur?.(e);
        }}
        {...resto}
      />
      {sufixo && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-fumaca">{sufixo}</span>
      )}
    </div>
  );
}

export function Segmentado<T extends string>({
  valor,
  opcoes,
  aoMudar,
}: {
  valor: T;
  opcoes: { valor: T; rotulo: string }[];
  aoMudar: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl border border-borda bg-carvao-3 p-1">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => aoMudar(o.valor)}
          aria-pressed={valor === o.valor}
          className={`flex-1 rounded-lg px-2 py-2.5 text-sm font-semibold transition-colors ${
            valor === o.valor ? 'bg-brasa text-creme' : 'text-fumaca hover:text-creme'
          }`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Botão de copiar que confirma na própria etiqueta. */
export function BotaoCopiar({ texto, rotulo = 'Copiar' }: { texto: string; rotulo?: string }) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(t);
  }, [copiado]);

  return (
    <button
      type="button"
      className={`botao ${copiado ? 'botao-linha !border-verde !text-verde' : 'botao-linha'}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
        } catch {
          // navegador sem permissão de área de transferência: o texto continua
          // na tela para seleção manual, então não vale quebrar nada aqui
          setCopiado(false);
        }
      }}
    >
      {copiado ? 'Copiado' : rotulo}
    </button>
  );
}
