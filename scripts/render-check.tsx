/**
 * Smoke test de renderização.
 *
 * `vite build` e `tsc` passam com tela quebrada: eles não pegam erro de ordem
 * de hook nem de variável usada antes da inicialização, que são erros de
 * runtime e deixam a página em branco. Este script renderiza a árvore inteira
 * de verdade e falha se algum componente estourar.
 *
 * O que ele NÃO cobre: efeito, scroll, clique e qualquer coisa visual. Para
 * isso é preciso abrir a página no navegador.
 */
import { renderToString } from 'react-dom/server';
import App from '../src/App';

const html = renderToString(<App />);

const exigidos = [
  'Na Grelha',
  'O sabor da grelha',
  'Alan Xavier',
  'Érica',
  'André',
  'Isabelle',
  'Cortes nobres',
  'wa.me/5535988638687',
  'wa.me/5535988218023',
  'nagrelha_alanxavier',
];

const faltando = exigidos.filter((t) => !html.includes(t));

const imagens = (html.match(/<img/g) ?? []).length;
const semAlt = (html.match(/<img(?![^>]*\balt=)[^>]*>/g) ?? []).length;
const semDimensao = (html.match(/<img(?![^>]*\bwidth=)[^>]*>/g) ?? []).length;
const travessoes = (html.match(/[—–]/g) ?? []).length;

console.log(`html renderizado: ${(html.length / 1024).toFixed(1)} kB`);
console.log(`imagens: ${imagens} (sem alt: ${semAlt}, sem width/height: ${semDimensao})`);
console.log(`travessões no texto: ${travessoes}`);

const problemas: string[] = [];
if (faltando.length) problemas.push(`texto esperado ausente: ${faltando.join(', ')}`);
if (semAlt) problemas.push(`${semAlt} imagem(ns) sem alt`);
if (semDimensao) problemas.push(`${semDimensao} imagem(ns) sem width/height, a página vai pular ao carregar`);
if (travessoes) problemas.push(`${travessoes} travessão(ões) no texto, use vírgula ou dois períodos`);

if (problemas.length) {
  console.error('\nFALHOU:');
  for (const p of problemas) console.error('  ' + p);
  process.exit(1);
}

console.log('\nOK: a árvore renderiza inteira e o conteúdo esperado está lá.');
