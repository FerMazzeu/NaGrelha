/**
 * Teste de fluxo no navegador de verdade.
 *
 * Os testes unitarios cobrem a conta, mas nao cobrem a tela: ordem de hook,
 * campo controlado que nao deixa digitar, RLS que devolve vazio, estado que
 * nao persiste. Build e `tsc` verdes nao pegam nada disso.
 *
 * Uso:
 *   node scripts/fluxo.mjs <url>                      so a tela de entrada
 *   node scripts/fluxo.mjs <url> <email> <senha>      o fluxo inteiro, logado
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5190/';
const email = process.argv[3];
const senha = process.argv[4];

const nav = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((c) => existsSync(c));
if (!nav) throw new Error('nenhum navegador encontrado');

const porta = 9500 + Math.floor(Math.random() * 90);
const chrome = spawn(
  nav,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    `--remote-debugging-port=${porta}`,
    `--user-data-dir=${process.env.TEMP}/fluxo-${porta}`,
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
const erros = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id !== undefined) {
    pend.get(m.id)?.(m.result);
    pend.delete(m.id);
    return;
  }
  if (m.method === 'Runtime.exceptionThrown') {
    erros.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  }
};

const cdp = (metodo, params = {}) =>
  new Promise((ok, erro) => {
    const i = ++id;
    const limite = setTimeout(() => erro(new Error(`${metodo} travou`)), 45000);
    pend.set(i, (r) => {
      clearTimeout(limite);
      ok(r);
    });
    ws.send(JSON.stringify({ id: i, method: metodo, params }));
  });

const js = async (expr) => {
  const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'erro no script');
  return r.result?.value;
};

/**
 * React nao escuta atribuicao direta em .value: ele guarda o setter nativo e
 * so reage ao evento de input. Sem isso o campo muda na tela e o estado nao.
 */
const AJUDA = `
window.__digitar = (seletor, valor) => {
  const el = document.querySelector(seletor);
  if (!el) throw new Error('nao achei ' + seletor);
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, valor);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
};
window.__clicarTexto = (texto) => {
  const alvo = [...document.querySelectorAll('button, a')].find(
    (b) => (b.innerText || '').trim().toLowerCase() === texto.toLowerCase(),
  );
  if (!alvo) throw new Error('nao achei botao "' + texto + '"');
  alvo.click();
  return true;
};
window.__texto = () => document.body.innerText;
true;
`;

const passos = [];
const conferir = (nome, condicao, detalhe = '') => {
  passos.push({ nome, ok: !!condicao });
  console.log(`${condicao ? '  ok  ' : ' FALHA'} ${nome}${detalhe ? '  ' + detalhe : ''}`);
};

/**
 * Comparacao sem caixa: `innerText` devolve o texto como ele e DESENHADO, e
 * varias classes do app aplicam `text-transform: uppercase`. Comparar com a
 * string do codigo da falso negativo em todo titulo e rotulo.
 */
const contem = (texto, alvo) => texto.toLowerCase().includes(alvo.toLowerCase());

try {
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url });
  await espera(5000);
  await js(AJUDA);

  const entrada = await js('window.__texto()');
  conferir('a tela de entrada aparece', contem(entrada, 'Entrar'));
  conferir('tem campo de e-mail e senha', (await js('document.querySelectorAll("input").length')) >= 2);

  if (!email || !senha) {
    console.log('\n(sem credenciais: o fluxo logado nao foi testado)');
    console.log('rode assim: node scripts/fluxo.mjs <url> <email> <senha>');
  } else {
    await js(`window.__digitar('input[type=email]', ${JSON.stringify(email)})`);
    await js(`window.__digitar('input[type=password]', ${JSON.stringify(senha)})`);
    await js(`window.__clicarTexto('Entrar')`);
    await espera(6000);
    await js(AJUDA);

    const dentro = await js('window.__texto()');
    conferir('entrou no app', contem(dentro, 'Orçamentos') && !contem(dentro, 'Ainda não tenho conta'));
    conferir('o perfil foi aprovado', !contem(dentro, 'Falta o dono liberar'));
    conferir('a navegação carregou', contem(dentro, 'Agenda') && contem(dentro, 'Catálogo'));

    await js(`window.__clicarTexto('Catálogo')`);
    await espera(1500);
    await js(AJUDA);
    const catalogo = await js('window.__texto()');
    conferir('o catálogo veio do banco', contem(catalogo, 'Picanha') && contem(catalogo, 'Costela'));

    await js(`window.__clicarTexto('Orçamentos')`);
    await espera(1200);
    await js(AJUDA);
    await js(`window.__clicarTexto('Novo orçamento')`);
    await espera(3000);
    await js(AJUDA);

    const editor = await js('window.__texto()');
    conferir('abre o editor do orçamento', contem(editor, 'Cliente') && contem(editor, 'Preço fechado'));

    await js(`window.__digitar('input[placeholder="Nome de quem contrata"]', 'Teste automatizado')`);
    await espera(400);
    await js(`window.__digitar('input[inputmode="decimal"]', '60')`);
    await espera(1500);

    await js(`window.__clicarTexto('Cardápio')`);
    await espera(1200);
    await js(AJUDA);
    const cardapio = await js('window.__texto()');
    conferir('calcula quanto comprar', /comprar\s+[\d,]+\s*kg/i.test(cardapio));

    await js(`window.__clicarTexto('Voltar')`);
    await espera(2500);
    await cdp('Page.navigate', { url });
    await espera(6000);
    await js(AJUDA);
    const depois = await js('window.__texto()');
    conferir('o orçamento sobreviveu ao recarregar', contem(depois, 'Teste automatizado'));
  }

  conferir('nenhuma exceção no console', erros.length === 0, erros[0] ?? '');
} finally {
  await cdp('Browser.close').catch(() => {});
  ws.close();
  chrome.unref();
}

const falhas = passos.filter((p) => !p.ok);
console.log(`\n${passos.length - falhas.length}/${passos.length} passos ok`);
if (falhas.length) process.exitCode = 1;
