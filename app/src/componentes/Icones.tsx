import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function Enviar(props: Props) {
  return (
    <Base {...props}>
      <path d="M12 19V5" />
      <path d="m6 11 6-6 6 6" />
    </Base>
  );
}

export function Parar(props: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <rect x="7" y="7" width="10" height="10" rx="2" />
    </svg>
  );
}

export function Imagem(props: Props) {
  return (
    <Base {...props}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="8.8" cy="9.6" r="1.4" />
      <path d="m4 17 4.5-4.2a2 2 0 0 1 2.7 0L15 16" />
      <path d="m14 15 1.8-1.7a2 2 0 0 1 2.7 0L21 15.5" />
    </Base>
  );
}

export function Texto(props: Props) {
  return (
    <Base {...props}>
      <path d="M5 7V5h14v2" />
      <path d="M12 5v14" />
      <path d="M9.5 19h5" />
    </Base>
  );
}

export function Recomecar(props: Props) {
  return (
    <Base {...props}>
      <path d="M3 12a9 9 0 1 0 2.6-6.4" />
      <path d="M3 4v5h5" />
    </Base>
  );
}

export function Recibo(props: Props) {
  return (
    <Base {...props}>
      <path d="M6 3h12a1 1 0 0 1 1 1v16.5l-3.2-1.8-3.4 1.8-3.4-1.8L5 20.5V4a1 1 0 0 1 1-1Z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </Base>
  );
}

export function Calendario(props: Props) {
  return (
    <Base {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M7.5 14.5h3v3h-3z" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function Pessoas(props: Props) {
  return (
    <Base {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16.5 5.6a3.2 3.2 0 0 1 0 5.8" />
      <path d="M17.5 14.4A6 6 0 0 1 21 20" />
    </Base>
  );
}

export function Lista(props: Props) {
  return (
    <Base {...props}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.6" cy="6" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="4.6" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="4.6" cy="18" r="1.4" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function Faisca(props: Props) {
  return (
    <Base {...props}>
      <path d="M12 3 13.8 9 19.8 10.8 13.8 12.6 12 18.6 10.2 12.6 4.2 10.8 10.2 9Z" />
      <path d="M18.4 16.6 19 18.6 21 19.2 19 19.8 18.4 21.8 17.8 19.8 15.8 19.2 17.8 18.6Z" />
    </Base>
  );
}

export function Lupa(props: Props) {
  return (
    <Base {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.4 15.4 4.1 4.1" />
    </Base>
  );
}
