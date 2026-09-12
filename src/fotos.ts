/**
 * Índice das imagens geradas por scripts/imagens.mjs.
 *
 * O glob é eager de propósito: são poucas dezenas de arquivos, todos usados na
 * mesma página, e assim um nome errado estoura no build em vez de virar
 * imagem quebrada em produção.
 */
import manifesto from './assets/_gerado.json';

const arquivos = import.meta.glob('./assets/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const porNome: Record<string, string> = {};
for (const [caminho, url] of Object.entries(arquivos)) {
  const nome = caminho.replace('./assets/', '').replace('.webp', '');
  porNome[nome] = url;
}

export type Dimensao = { largura: number; altura: number };

/**
 * As dimensões saem do manifesto que o script de imagens escreve, não de
 * número digitado no componente. Assim `width` e `height` no HTML nunca
 * divergem do arquivo de verdade, que é o que segura o layout enquanto carrega.
 */
const dimensoes: Record<string, Dimensao> = {};
for (const f of manifesto.fotos) {
  const [largura, altura] = f.para.split('x').map(Number);
  dimensoes[f.nome] = { largura, altura };
}

export function foto(nome: string): string {
  const url = porNome[nome];
  if (!url) throw new Error(`foto "${nome}" nao existe em src/assets. Rode: npm run imagens`);
  return url;
}

export function dimensao(nome: string): Dimensao {
  const d = dimensoes[nome];
  if (!d) throw new Error(`foto "${nome}" nao esta no manifesto. Rode: npm run imagens`);
  return d;
}

export const nomesDaGaleria = Object.keys(porNome)
  .filter((n) => n.startsWith('galeria-'))
  .sort();

export { default as logoEscura } from './assets/logo-escuro.png';
