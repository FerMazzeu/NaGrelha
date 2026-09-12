/**
 * Auditoria da página: hierarquia de títulos, textos alternativos, contraste,
 * tamanho servido das imagens, peso da página e layout em várias larguras.
 *
 * Uso: node scripts/auditoria.mjs http://localhost:5188/
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5188/';
const LARGURAS = [360, 414, 768, 1024, 1280, 1440, 1920];

const nav = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((c) => existsSync(c));
if (!nav) throw new Error('nenhum navegador encontrado');

const porta = 9700 + Math.floor(Math.random() * 90);
const chrome = spawn(
  nav,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    `--remote-debugging-port=${porta}`,
    `--user-data-dir=${process.env.TEMP}/audit-${porta}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 60 && !wsUrl; i++) {
  try {
    const abas = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json();
    wsUrl = abas.find((a) => a.type === 'page')?.webSocketDebuggerUrl;
  } catch {
    // ainda subindo
  }
  if (!wsUrl) await espera(250);
}

const ws = new WebSocket(wsUrl);
await new Promise((ok) => (ws.onopen = ok));

let id = 0;
const pend = new Map();
const respostas = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id !== undefined) {
    pend.get(m.id)?.(m.result);
    pend.delete(m.id);
    return;
  }
  if (m.method === 'Network.responseReceived') {
    respostas.push({ url: m.params.response.url, tipo: m.params.type, status: m.params.response.status });
  }
  if (m.method === 'Network.loadingFinished') {
    const r = respostas[respostas.length - 1];
    if (r) r.bytes = m.params.encodedDataLength;
  }
};

const cdp = (metodo, params = {}) =>
  new Promise((ok) => {
    const i = ++id;
    pend.set(i, ok);
    ws.send(JSON.stringify({ id: i, method: metodo, params }));
  });

const js = async (expr) => (await cdp('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.value;

await cdp('Page.enable');
await cdp('Runtime.enable');
await cdp('Network.enable');

// ---------------------------------------------------------------- conteudo
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await cdp('Page.navigate', { url });
await espera(6000);

// rola para acordar o lazy antes de medir tamanho servido
const alturaTotal = await js('document.documentElement.scrollHeight');
for (let y = 0; y < alturaTotal; y += 700) {
  await js(`window.scrollTo(0,${y})`);
  await espera(60);
}
await js('window.scrollTo(0,0)');
await espera(1500);

const relatorio = await js(`(() => {
  const luz = (c) => {
    const [r,g,b] = c.match(/\\d+(\\.\\d+)?/g).slice(0,3).map(Number).map(v => {
      const s = v/255;
      return s <= 0.03928 ? s/12.92 : Math.pow((s+0.055)/1.055, 2.4);
    });
    return 0.2126*r + 0.7152*g + 0.0722*b;
  };
  const fundoReal = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && !bg.startsWith('rgba(0, 0, 0, 0)')) return bg;
      n = n.parentElement;
    }
    return 'rgb(18,16,14)';
  };
  const razao = (a,b) => { const l1 = luz(a), l2 = luz(b); const [x,y] = l1>l2 ? [l1,l2] : [l2,l1]; return (x+0.05)/(y+0.05); };

  // titulos
  const titulos = [...document.querySelectorAll('h1,h2,h3,h4')].map(h => h.tagName + ' ' + h.innerText.replace(/\\s+/g,' ').slice(0,52));
  let saltos = [];
  const niveis = [...document.querySelectorAll('h1,h2,h3,h4')].map(h => +h.tagName[1]);
  for (let i=1;i<niveis.length;i++) if (niveis[i] - niveis[i-1] > 1) saltos.push(titulos[i-1] + '  ->  ' + titulos[i]);

  // alt
  const alts = [...document.images].map(i => i.alt);
  const contagem = {};
  for (const a of alts) contagem[a] = (contagem[a]||0)+1;
  const altRepetido = Object.entries(contagem).filter(([,n]) => n > 1).map(([a,n]) => n + 'x  "' + a.slice(0,60) + '"');

  // imagens: servido vs exibido
  const superDimensionadas = [...document.images]
    .filter(i => i.naturalWidth && i.clientWidth)
    .map(i => ({ alt: i.alt.slice(0,34), nat: i.naturalWidth, mostrado: Math.round(i.clientWidth), fator: +(i.naturalWidth/(i.clientWidth*2)).toFixed(2) }))
    .filter(i => i.fator > 1.35 || i.fator < 0.55);

  // amostras de contraste
  const amostras = [];
  const seletores = [
    ['corpo do texto', '.corpo'],
    ['selo dourado', '.selo'],
    ['nota pequena', 'footer p'],
    ['rodape do hero', 'section#topo p.text-sm'],
    ['numeros nota', 'section#topo .text-xs'],
  ];
  for (const [nome, sel] of seletores) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const cs = getComputedStyle(el);
    amostras.push({ nome, cor: cs.color, fundo: fundoReal(el), tamanho: cs.fontSize, razao: +razao(cs.color, fundoReal(el)).toFixed(2) });
  }

  // alvos de toque pequenos
  const pequenos = [...document.querySelectorAll('a,button')]
    .map(e => ({ t: (e.innerText||e.getAttribute('aria-label')||'').replace(/\\s+/g,' ').slice(0,30), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) }))
    .filter(e => e.h > 0 && (e.h < 44 || e.w < 44));

  // links sem nome acessivel
  const semNome = [...document.querySelectorAll('a,button')].filter(e => !(e.innerText||'').trim() && !e.getAttribute('aria-label')).length;

  return JSON.stringify({
    totalTitulos: titulos.length,
    h1: titulos.filter(t => t.startsWith('H1')).length,
    saltosDeNivel: saltos,
    altRepetido,
    altVazio: alts.filter(a => !a.trim()).length,
    superDimensionadas,
    contraste: amostras,
    alvosPequenos: pequenos,
    semNomeAcessivel: semNome,
    temSkipLink: !!document.querySelector('a[href^="#"]') && (document.body.innerText||'').toLowerCase().includes('pular'),
    idioma: document.documentElement.lang,
  }, null, 1);
})()`);

console.log('=============== CONTEUDO E ACESSIBILIDADE ===============');
console.log(relatorio);

// ---------------------------------------------------------------- peso
const porTipo = {};
for (const r of respostas) {
  if (!r.bytes) continue;
  porTipo[r.tipo] = (porTipo[r.tipo] ?? 0) + r.bytes;
}
const total = Object.values(porTipo).reduce((a, b) => a + b, 0);
console.log('\n=============== PESO ===============');
for (const [t, b] of Object.entries(porTipo).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${t.padEnd(12)} ${(b / 1024).toFixed(0).padStart(6)} kB`);
}
console.log(`  ${'TOTAL'.padEnd(12)} ${(total / 1024).toFixed(0).padStart(6)} kB em ${respostas.length} requisicoes`);

// ---------------------------------------------------------------- larguras
console.log('\n=============== LAYOUT POR LARGURA ===============');
for (const largura of LARGURAS) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: largura, height: 900, deviceScaleFactor: 1, mobile: false });
  await espera(900);
  const r = await js(`(() => {
    const de = document.documentElement;
    const vazando = [...document.querySelectorAll('body *')]
      .filter(e => e.getBoundingClientRect().right > de.clientWidth + 2 || e.getBoundingClientRect().left < -2)
      .slice(0,4)
      .map(e => e.tagName.toLowerCase() + '.' + (e.className||'').toString().split(' ').slice(0,2).join('.'));
    return JSON.stringify({ h: de.scrollHeight, estoura: de.scrollWidth > de.clientWidth, vazando });
  })()`);
  const d = JSON.parse(r);
  console.log(
    `  ${String(largura).padStart(4)}px  altura ${String(d.h).padStart(6)}px  rolagem lateral: ${d.estoura ? 'SIM' : 'nao'}${d.vazando.length ? '  vazando: ' + d.vazando.join(', ') : ''}`,
  );
}

await cdp('Browser.close');
ws.close();
chrome.unref();
