import { useEffect, useRef, useState, type ReactNode } from 'react';

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
 * Campo de dinheiro: sempre com duas casas, preenchido da direita para a
 * esquerda, como na maquininha de cartão.
 *
 * Digitar 1, 2, 3, 4, 5 dá 0,01 → 0,12 → 1,23 → 12,34 → 123,45. Ninguém
 * precisa achar a vírgula no teclado do celular, e "15" nunca vira R$ 15,00
 * quando a pessoa queria R$ 0,15 (ou o contrário). Apagar tira o último
 * dígito. Selecionar tudo e digitar começa do zero. Colar "R$ 2.500,00"
 * entende o valor.
 *
 * A tecla vira conta sobre o valor, e não edição do texto: com o texto, um
 * clique no meio do número punha o dígito seguinte no lugar errado
 * ("25.000,07" virava "72.500,00").
 *
 * `permitirNegativo`: saldo de conta pode ficar no vermelho. O sinal de
 * menos troca o sinal.
 */
export function CampoDinheiro({
  valor,
  aoMudar,
  sufixo,
  permitirNegativo = false,
  destaque = false,
  className = '',
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
  const texto = `${centavos < 0 ? '-' : ''}${centavosFormatados.format(Math.abs(centavos) / 100)}`;

  const ref = useRef<HTMLInputElement>(null);
  // O ouvinte nativo é registrado uma vez; ele lê o valor e a função atuais daqui.
  const atual = useRef(centavos);
  atual.current = centavos;
  const avisar = useRef(aoMudar);
  avisar.current = aoMudar;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const tudoSelecionado = () => el.selectionStart === 0 && el.selectionEnd === el.value.length && el.value.length > 0;
    const emitir = (c: number) => avisar.current(Math.max(-TETO_EM_CENTAVOS, Math.min(TETO_EM_CENTAVOS, c)) / 100);

    /*
      `beforeinput`, e não `keydown`: no teclado do Android a tecla chega como
      "Unidentified", e só o `beforeinput` diz o que foi digitado. A edição
      do texto é cancelada e o valor é recalculado.
    */
    const antes = (e: InputEvent) => {
      const c = atual.current;
      let negativo = c < 0;
      let abs = tudoSelecionado() ? 0 : Math.abs(c);
      const tipo = e.inputType;

      if (tipo === 'insertText' || tipo === 'insertReplacementText') {
        for (const ch of e.data ?? '') {
          if (/\d/.test(ch) && abs * 10 + Number(ch) <= TETO_EM_CENTAVOS) abs = abs * 10 + Number(ch);
          else if (ch === '-' && permitirNegativo) negativo = !negativo;
        }
        e.preventDefault();
        emitir(negativo ? -abs : abs);
      } else if (tipo.startsWith('delete')) {
        e.preventDefault();
        if (tudoSelecionado()) emitir(0);
        else if (tipo === 'deleteContentBackward' || tipo === 'deleteContentForward') emitir((negativo ? -1 : 1) * Math.floor(abs / 10));
        else emitir(0);
      } else if (tipo === 'insertFromPaste' || tipo === 'insertFromDrop') {
        const colado = centavosDoTexto(e.dataTransfer?.getData('text') ?? e.data ?? '');
        e.preventDefault();
        if (colado !== null) emitir(permitirNegativo ? colado : Math.abs(colado));
      }
    };
    el.addEventListener('beforeinput', antes);
    return () => el.removeEventListener('beforeinput', antes);
  }, [permitirNegativo]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-fumaca">R$</span>
      <input
        ref={ref}
        className={`campo !pl-8 !pr-3 text-right tabular-nums ${sufixo ? '!pr-12' : ''} ${destaque ? '!border-dourado/60' : ''} ${className}`}
        inputMode="numeric"
        value={texto}
        // Plano B, para o teclado que não deixa cancelar a edição (composição
        // em alguns Android): lê os dígitos do texto como centavos.
        onChange={(e) => {
          const digitos = e.target.value.replace(/\D/g, '').slice(0, 12);
          const sinal = permitirNegativo && e.target.value.includes('-') ? -1 : 1;
          avisar.current((sinal * Number(digitos || '0')) / 100);
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
