import { useEffect, useRef, useState, type ReactNode } from 'react';
import { dimensao, foto } from '../fotos';
import { Aspas } from './Icones';

/** Rótulo de categoria que abre cada seção. */
export function Selo({ children, risco = true }: { children: ReactNode; risco?: boolean }) {
  return <span className={risco ? 'selo selo-risco' : 'selo'}>{children}</span>;
}

/**
 * Título de seção. Quando vem em duas linhas, a segunda recebe o dourado,
 * que é como a marca separa o que ela quer que fique na cabeça.
 */
export function TituloSecao({ texto, className = '' }: { texto: string | readonly string[]; className?: string }) {
  const linhas = typeof texto === 'string' ? [texto] : texto;
  return (
    <h2 className={`titulo-secao ${className}`}>
      {linhas.map((linha, i) => (
        <span key={linha} className={i === 1 ? 'block text-dourado' : 'block'}>
          {linha}
        </span>
      ))}
    </h2>
  );
}

/**
 * Abertura de seção.
 *
 * Existe em duas formas, alinhada e centrada, só para que catorze seções
 * seguidas não abram todas exatamente igual. A largura do texto de apoio é
 * limitada porque linha longa demais cansa antes de informar.
 */
export function AberturaDeSecao({
  selo,
  titulo,
  texto,
  centrada = false,
  className = '',
}: {
  selo: string;
  titulo: string | readonly string[];
  texto?: string;
  centrada?: boolean;
  className?: string;
}) {
  return (
    <div className={`${centrada ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl'} ${className}`}>
      <Selo risco={!centrada}>{selo}</Selo>
      <TituloSecao texto={titulo} className="mt-4" />
      {texto && <p className={`corpo mt-6 text-lg ${centrada ? 'mx-auto max-w-2xl' : ''}`}>{texto}</p>}
    </div>
  );
}

/**
 * Citação.
 *
 * Em fonte de texto, não no display. Anton é para frase curta: três linhas de
 * caixa alta pesada viram um bloco que o olho pula.
 */
export function Citacao({ texto, autor, className = '' }: { texto: string; autor?: string; className?: string }) {
  return (
    <figure className={`mx-auto max-w-2xl text-center ${className}`}>
      <Aspas className="mx-auto h-7 w-7 text-brasa" />
      <blockquote className="mt-4 text-[clamp(1.15rem,2.4vw,1.6rem)] leading-snug text-creme">{texto}</blockquote>
      {autor && <figcaption className="selo mt-5 justify-center">{autor}</figcaption>}
    </figure>
  );
}

/**
 * Anima a entrada do bloco quando ele chega na tela.
 *
 * Se o navegador não tiver IntersectionObserver, o conteúdo aparece na hora.
 * Animação nunca pode ser o motivo de um texto não ser lido.
 */
export function Revelar({
  children,
  atraso = 0,
  className = '',
}: {
  children: ReactNode;
  atraso?: number;
  className?: string;
}) {
  const alvo = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const elemento = alvo.current;
    if (!elemento || typeof IntersectionObserver === 'undefined') {
      setVisivel(true);
      return;
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) {
            setVisivel(true);
            observador.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    );

    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  return (
    <div
      ref={alvo}
      className={`revelar ${className}`}
      data-visivel={visivel ? 'sim' : 'nao'}
      style={atraso ? { transitionDelay: `${atraso}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Imagem já recortada no build.
 *
 * O CSS aqui só centraliza: o enquadramento e o tamanho vêm prontos de
 * scripts/imagens.mjs, então não existe pixel baixado para ser descartado.
 * width e height são obrigatórios para o navegador reservar o espaço e a
 * página não pular enquanto carrega.
 */
export function Foto({
  nome,
  alt,
  className = '',
  prioridade = false,
  preencher = true,
}: {
  nome: string;
  alt: string;
  className?: string;
  prioridade?: boolean;
  /** false na galeria em mosaico, onde a imagem manda na altura. */
  preencher?: boolean;
}) {
  const { largura, altura } = dimensao(nome);
  return (
    <img
      src={foto(nome)}
      alt={alt}
      width={largura}
      height={altura}
      loading={prioridade ? 'eager' : 'lazy'}
      decoding={prioridade ? 'sync' : 'async'}
      fetchPriority={prioridade ? 'high' : 'auto'}
      className={`${preencher ? 'h-full w-full object-cover object-center' : 'block h-auto w-full'} ${className}`}
    />
  );
}

/** Moldura padrão de foto: canto arredondado, borda fina e leve escurecida. */
export function Moldura({
  children,
  className = '',
  proporcao,
}: {
  children: ReactNode;
  className?: string;
  proporcao?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-cartao border border-borda bg-carvao-2 ${className}`}
      style={proporcao ? { aspectRatio: proporcao } : undefined}
    >
      {children}
    </div>
  );
}
