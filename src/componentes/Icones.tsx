/**
 * Ícones desenhados à mão em SVG, sem dependência.
 *
 * Biblioteca de ícones costuma travar a instalação em projeto React 19 por
 * peer dependency, e para um punhado de símbolos não compensa. Inline aqui é
 * zero dependência, zero conflito e bundle menor.
 */
import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      // 2.1 e não 1.6: em 24px dentro de um círculo de 48, traço fino some na
      // leitura rápida, que é a única leitura que esses ícones recebem.
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function Fogo(props: Props) {
  return (
    <Base {...props}>
      <path d="M12 3c.6 3 2.4 3.9 3.7 5.6A6.7 6.7 0 0 1 17 12.8 5 5 0 0 1 12 18a5 5 0 0 1-5-5.2c0-1.3.4-2.3 1.1-3.3.4.9 1 1.5 1.8 1.8.2-2.7.9-5.6 2.1-8.3Z" />
      <path d="M12 21c2.8 0 5-1.3 6.3-3.3" opacity={0.45} />
      <path d="M12 21c-2.8 0-5-1.3-6.3-3.3" opacity={0.45} />
    </Base>
  );
}

export function Carne(props: Props) {
  return (
    <Base {...props}>
      <path d="M4.6 13.7a6.8 6.8 0 0 1 9.4-9.3c2.8 1.8 5 4.3 5.9 6.7.7 1.9.2 3.6-1.2 4.8-1.5 1.3-3.2 1.5-5 1.2-2.6-.4-5.4-1.5-7.2-2.6a2 2 0 0 1-.9-.8Z" />
      <circle cx="9.3" cy="10.6" r="2.6" />
      <path d="M5.5 16.9c-1 .8-2 1.5-3.1 2" />
    </Base>
  );
}

export function Festa(props: Props) {
  return (
    <Base {...props}>
      <path d="M3.4 20.6 8 9.6l6.4 6.4-11 4.6Z" />
      <path d="m10.4 7.2 6.4 6.4" />
      <path d="M15 3.6c.9.5 1.2 1.5.8 2.4M19 5.4c.5 1 .2 2.1-.7 2.7M20.6 9.7c-.6.8-1.7 1-2.6.5" />
      <path d="M17.6 2.2v.1M21.8 6.4v.1M21 13.2v.1" />
    </Base>
  );
}

export function Caminhao(props: Props) {
  return (
    <Base {...props}>
      <path d="M2.8 6.4h10v9.2h-10z" />
      <path d="M12.8 9.6h3.6l3.8 3.4v2.6h-7.4z" />
      <circle cx="7" cy="18" r="1.9" />
      <circle cx="17" cy="18" r="1.9" />
      <path d="M8.9 18h6.2M2.8 15.6h1.3M19 15.6h2.2" />
    </Base>
  );
}

export function Brilho(props: Props) {
  return (
    <Base {...props}>
      <path d="M12 3.2 13.7 9 19.5 10.7 13.7 12.4 12 18.2 10.3 12.4 4.5 10.7 10.3 9Z" />
      <path d="M18.4 16.3 19.2 18.7 21.6 19.5 19.2 20.3 18.4 22.7 17.6 20.3 15.2 19.5 17.6 18.7Z" />
    </Base>
  );
}

export function Balanca(props: Props) {
  return (
    <Base {...props}>
      <path d="M12 4.2v15.4M7.6 19.6h8.8" />
      <path d="M4 8.6h16" />
      <path d="M4 8.6 1.8 14a2.6 2.6 0 0 0 4.4 0Z" />
      <path d="M20 8.6 17.8 14a2.6 2.6 0 0 0 4.4 0Z" />
      <circle cx="12" cy="6" r="1.5" />
    </Base>
  );
}

export function Chopp(props: Props) {
  return (
    <Base {...props}>
      <path d="M5.2 8.4h9.4v11.4H5.2z" />
      <path d="M14.6 10.4h2.6a2.4 2.4 0 0 1 0 4.8h-2.6" />
      <path d="M5.2 8.4c0-2.4 1.6-4.2 4.7-4.2s4.7 1.8 4.7 4.2" />
      <path d="M8 12.2v4.4M11.8 12.2v4.4" opacity={0.5} />
    </Base>
  );
}

export function Refrigerante(props: Props) {
  return (
    <Base {...props}>
      <path d="M6.4 7.6h11.2l-1.1 12.2H7.5z" />
      <path d="M6.4 7.6 7.2 4h9.6l.8 3.6" />
      <path d="M7.1 11.6h9.8" opacity={0.5} />
    </Base>
  );
}

export function Agua(props: Props) {
  return (
    <Base {...props}>
      <path d="M12 3.2c3.4 4 6 7 6 10.2a6 6 0 0 1-12 0c0-3.2 2.6-6.2 6-10.2Z" />
      <path d="M9.2 14.2a2.9 2.9 0 0 0 2.4 3" opacity={0.55} />
    </Base>
  );
}

export function Telefone(props: Props) {
  return (
    <Base {...props}>
      <path d="M6.2 3.6h3.1l1.6 4-2 1.4a11.6 11.6 0 0 0 5.3 5.3l1.4-2 4 1.6v3.1a1.8 1.8 0 0 1-2 1.8C10.4 19.9 4.1 13.6 3.4 5.6a1.8 1.8 0 0 1 1.8-2Z" />
    </Base>
  );
}

export function Chef(props: Props) {
  return (
    <Base {...props}>
      <path d="M7 14.4a4 4 0 1 1 1.1-7.8 4.2 4.2 0 0 1 7.8 0A4 4 0 1 1 17 14.4Z" />
      <path d="M7 14.4h10v4.2a1.4 1.4 0 0 1-1.4 1.4H8.4A1.4 1.4 0 0 1 7 18.6Z" />
      <path d="M10.2 17h3.6" opacity={0.5} />
    </Base>
  );
}

export function Zap(props: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.1-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5v-.5l-.8-1.8c-.2-.4-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.6 4 5.3 5.3 0 0 0 3.2.6 2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}

export function Instagram(props: Props) {
  return (
    <Base {...props}>
      <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="5" />
      <circle cx="12" cy="12" r="3.9" />
      <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function Seta(props: Props) {
  return (
    <Base {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Base>
  );
}

export function Menu(props: Props) {
  return (
    <Base {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Base>
  );
}

export function Fechar(props: Props) {
  return (
    <Base {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Base>
  );
}

export function Aspas(props: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M9.4 5.6c-3.2 1.6-5 4.2-5 7.6 0 3.2 1.8 5.2 4.3 5.2 2.1 0 3.7-1.5 3.7-3.5 0-1.9-1.3-3.3-3.1-3.3-.4 0-.8 0-1 .2.4-1.7 1.7-3.2 3.5-4.2Zm9.8 0c-3.2 1.6-5 4.2-5 7.6 0 3.2 1.8 5.2 4.3 5.2 2.1 0 3.7-1.5 3.7-3.5 0-1.9-1.3-3.3-3.1-3.3-.4 0-.8 0-1 .2.4-1.7 1.7-3.2 3.5-4.2Z" />
    </svg>
  );
}

/** Usado pelo conteúdo, que guarda o ícone por nome. */
export const porNome = {
  fogo: Fogo,
  carne: Carne,
  festa: Festa,
  caminhao: Caminhao,
  brilho: Brilho,
  balanca: Balanca,
  chopp: Chopp,
  refri: Refrigerante,
  agua: Agua,
  telefone: Telefone,
  chef: Chef,
} as const;

export type NomeDeIcone = keyof typeof porNome;
