/**
 * Captura a página inteira para conferência visual.
 *
 * Duas armadilhas que este script existe para evitar:
 *
 * 1. Screenshot de página inteira não dispara lazy loading. Se a captura sai
 *    direto, tudo que está abaixo da dobra aparece em branco e a conferência
 *    mente. Por isso ele rola a página até o fim antes de capturar.
 *
 * 2. Aumentar o viewport para caber a página inteira quebra o layout: `svh` e
 *    `vh` passam a valer a altura nova, e uma seção `min-h-[100svh]` vira um
 *    bloco de 14000px. Por isso o viewport fica em tamanho real e quem sai do
 *    viewport é a captura, com `captureBeyondViewport`.
 *
 * Uso: node scripts/screenshot.mjs <url> <saida.png> [largura] [altura]
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const [url = 'http://localhost:4173/', saida = 'captura.png', larguraArg, alturaArg] = process.argv.slice(2);
const largura = Number(larguraArg ?? 1440);
const altura = Number(alturaArg ?? 900);

const NAVEGADORES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

const navegador = NAVEGADORES.find((c) => existsSync(c));
if (!navegador) throw new Error('nenhum Chrome ou Edge encontrado');

const porta = 9333 + Math.floor(Math.random() * 300);
const perfil = resolve(process.env.TEMP ?? '/tmp', `captura-${porta}`);

const chrome = spawn(
  navegador,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--remote-debugging-port=${porta}`,
    `--user-data-dir=${perfil}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function alvo() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${porta}/json/list`);
      const abas = await r.json();
      const pagina = abas.find((a) => a.type === 'page' && a.webSocketDebuggerUrl);
      if (pagina) return pagina.webSocketDebuggerUrl;
    } catch {
      // o Chrome ainda não subiu a porta de debug
    }
    await espera(250);
  }
  throw new Error('Chrome nao abriu a porta de debug');
}

const etapa = (texto) => console.error(`  . ${texto}`);

etapa('procurando a aba do Chrome');
const endereco = await alvo();

etapa('conectando no CDP');
const ws = new WebSocket(endereco);
await new Promise((ok, erro) => {
  const limite = setTimeout(() => erro(new Error('timeout conectando no Chrome')), 15000);
  ws.onopen = () => {
    clearTimeout(limite);
    ok();
  };
  ws.onerror = () => {
    clearTimeout(limite);
    erro(new Error('falha ao conectar no Chrome'));
  };
});

let proximoId = 0;
const pendentes = new Map();
const eventos = [];

ws.onmessage = (evento) => {
  const msg = JSON.parse(evento.data);
  if (msg.id !== undefined) {
    const p = pendentes.get(msg.id);
    pendentes.delete(msg.id);
    if (msg.error) p.erro(new Error(`${p.metodo}: ${msg.error.message}`));
    else p.ok(msg.result);
  } else {
    eventos.push(msg.method);
  }
};

function cdp(metodo, params = {}) {
  const id = ++proximoId;
  return new Promise((ok, erro) => {
    // Sem prazo, um comando que o Chrome não responde trava o script para
    // sempre e a saída fica em branco, que foi exatamente o que aconteceu.
    const limite = setTimeout(() => {
      pendentes.delete(id);
      erro(new Error(`${metodo} nao respondeu em 90s`));
    }, 90000);
    pendentes.set(id, {
      ok: (r) => {
        clearTimeout(limite);
        ok(r);
      },
      erro: (e) => {
        clearTimeout(limite);
        erro(e);
      },
      metodo,
    });
    ws.send(JSON.stringify({ id, method: metodo, params }));
  });
}

const js = async (expressao) => {
  const r = await cdp('Runtime.evaluate', { expression: expressao, returnByValue: true, awaitPromise: true });
  return r.result?.value;
};

try {
  etapa('habilitando dominios');
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  // mobile: false de propósito. O que precisa ser testado é o layout na
  // largura do celular, e o modo mobile do CDP liga emulação de toque e
  // metaviewport que travam a captura sem mudar nada do que se quer ver.
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: largura,
    height: altura,
    deviceScaleFactor: 1,
    mobile: false,
  });

  etapa(`abrindo ${url}`);
  await cdp('Page.navigate', { url });
  for (let i = 0; i < 80 && !eventos.includes('Page.loadEventFired'); i++) await espera(100);
  await espera(700);
  etapa('rolando para carregar o lazy');

  // Rola de viewport em viewport: é isso que faz o lazy loading acontecer e as
  // animações de entrada dispararem. Sem esta parte a captura sai com buracos.
  const total = await js('document.documentElement.scrollHeight');
  const passo = Math.round(altura * 0.8);
  etapa(`altura ${total}px, ${Math.ceil(total / passo)} passos`);
  for (let y = 0, n = 0; y < total; y += passo, n++) {
    await js(`window.scrollTo(0, ${y})`);
    await espera(140);
    if (n % 10 === 0) etapa(`  rolou ate ${y}px`);
  }
  await js(`window.scrollTo(0, ${total})`);
  await espera(600);
  await js('window.scrollTo(0, 0)');
  await espera(400);

  // Espera todas as imagens terminarem de carregar.
  //
  // Aqui não serve `img.decode()`: no headless ele simplesmente não resolve
  // para imagem fora da viewport, e o script fica pendurado para sempre.
  // `complete` responde na hora e diz o que interessa.
  etapa('esperando as imagens');
  let pendendo = 0;
  for (let i = 0; i < 40; i++) {
    pendendo = await js('[...document.images].filter(i => !i.complete).length');
    if (pendendo === 0) break;
    await espera(250);
  }

  const alturaFinal = await js('document.documentElement.scrollHeight');

  // Uma captura só de uma página de 20000px estoura o limite do Chrome e o
  // comando nunca responde. Em faixas ele responde, e de quebra o arquivo
  // fica num tamanho que dá para abrir e olhar.
  const FAIXA = 2400;
  const faixas = Math.ceil(alturaFinal / FAIXA);
  mkdirSync(dirname(resolve(saida)), { recursive: true });
  const { writeFileSync } = await import('node:fs');
  const gerados = [];

  for (let i = 0; i < faixas; i++) {
    const y = i * FAIXA;
    const altura = Math.min(FAIXA, alturaFinal - y);
    if (altura < 8) break;
    etapa(`capturando faixa ${i + 1}/${faixas}`);
    const { data } = await cdp('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y, width: largura, height: altura, scale: 1 },
    });
    const arquivo = saida.replace(/\.png$/, `-${String(i + 1).padStart(2, '0')}.png`);
    writeFileSync(resolve(arquivo), Buffer.from(data, 'base64'));
    gerados.push(arquivo);
  }

  const imagens = await js('document.images.length');
  const quebradas = await js('[...document.images].filter(i => i.complete && i.naturalWidth === 0).length');
  const invisiveis = await js('document.querySelectorAll(\'[data-visivel="nao"]\').length');
  const rolagemLateral = await js('document.documentElement.scrollWidth > document.documentElement.clientWidth');

  console.log(`pagina: ${largura}x${alturaFinal} em ${gerados.length} faixas`);
  console.log(`imagens: ${imagens} (quebradas: ${quebradas}, nao decodificaram: ${pendendo})`);
  console.log(`blocos que nao apareceram: ${invisiveis}`);
  console.log(`rolagem horizontal: ${rolagemLateral ? 'SIM, isso e bug' : 'nao'}`);

  if (quebradas > 0 || rolagemLateral) process.exitCode = 1;
} finally {
  // Fecha pedindo pelo próprio protocolo, em vez de derrubar o processo.
  await cdp('Browser.close').catch(() => {});
  ws.close();
  chrome.unref();
}
