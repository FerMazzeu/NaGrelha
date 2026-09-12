/**
 * Gera src/assets/ a partir de fotos/.
 *
 * Regra do projeto: o recorte acontece aqui, no build, e nao no CSS.
 * `object-fit: cover` faz o navegador baixar e decodificar a foto inteira,
 * inclusive a metade que o recorte joga fora. Entao cada arquivo sai daqui
 * ja no enquadramento final, e o CSS so precisa de `object-cover`.
 *
 * src/assets/ e gerado. Nao edite nada la dentro na mao.
 */
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEM = `${raiz}/fotos`;
const DESTINO = `${raiz}/src/assets`;
const PUBLICO = `${raiz}/public`;

/** Cores da marca, lidas da logo original. */
const VERMELHO = { r: 0xc4, g: 0x26, b: 0x1d };
const VERDE = { r: 0x1f, g: 0x7a, b: 0x3d };
const CREME = { r: 0xf7, g: 0xf2, b: 0xea };

/**
 * foco vai de 0 a 1 e reproduz o `object-position`: 0.5 e o centro,
 * 0 encosta no topo ou na esquerda, 1 no rodape ou na direita.
 */
const alvos = [
  // topo e faixas largas
  { arq: '36.jpg', nome: 'hero', w: 1600, h: 1000, focoY: 0.42 },
  { arq: '40.jpg', nome: 'faixa-fogo', w: 1600, h: 640, focoY: 0.5 },

  // gente. quem e quem saiu do proprio site do cliente, nao de palpite
  { arq: '08.jpg', nome: 'alan', w: 1100, h: 1375, focoY: 0.3 },
  { arq: '29.jpg', nome: 'erica', w: 1100, h: 1375, focoY: 0.3 },
  { arq: '18.jpg', nome: 'erica-ambiente', w: 1200, h: 900, focoY: 0.45 },
  { arq: '27.jpg', nome: 'andre', w: 1100, h: 1375, focoY: 0.25 },
  { arq: '37.jpg', nome: 'equipe', w: 1600, h: 1000, focoY: 0.35 },
  { arq: '04.jpg', nome: 'equipe-costas', w: 1600, h: 900, focoY: 0.45 },

  // cardapio
  // cardapio. O primeiro cartão é largo no layout, então recebe uma imagem
  // mais panorâmica; os outros quatro são 4:3.
  { arq: '24.jpg', nome: 'entradas', w: 1100, h: 700 },
  { arq: '02.jpg', nome: 'cortes', w: 760, h: 570 },
  { arq: '16.jpg', nome: 'massas', w: 760, h: 570 },
  { arq: '28.jpg', nome: 'ilha', w: 760, h: 570, focoY: 0.4 },
  { arq: '22.jpg', nome: 'frios', w: 760, h: 570 },

  // guarnicoes feitas no local
  { arq: '31.jpg', nome: 'arroz', w: 620, h: 620, focoY: 0.8 },
  { arq: '34.jpg', nome: 'farofa', w: 620, h: 620 },
  { arq: '09.jpg', nome: 'maionese', w: 620, h: 620 },
  { arq: '17.jpg', nome: 'salada', w: 620, h: 620 },

  // burguer e cortes
  { arq: '01.jpg', nome: 'burguer', w: 1200, h: 860 },
  { arq: '05.jpg', nome: 'costela', w: 900, h: 1125 },

  /*
    Galeria em mosaico: cada foto sai na proporção que ela tem de verdade, sem
    recorte. É o que dá variedade à grade e o que faz prato alto parecer prato
    alto. `manterProporcao` deixa o script derivar a altura da origem.
  */
  ...['21', '07', '26', '30', '33', '25', '42', '11', '38', '41', '23', '39', '03', '10', '12', '20'].map(
    (arq, i) => ({
      arq: `${arq}.jpg`,
      nome: `galeria-${String(i + 1).padStart(2, '0')}`,
      w: 700,
      manterProporcao: true,
    }),
  ),
];

/** Reproduz o object-position do CSS na hora de extrair. */
function caixa(W, H, w, h, focoX = 0.5, focoY = 0.5) {
  const alvo = w / h;
  if (W / H > alvo) {
    const largura = Math.round(H * alvo);
    return { left: Math.round((W - largura) * focoX), top: 0, width: largura, height: H };
  }
  const altura = Math.round(W / alvo);
  return { left: 0, top: Math.round((H - altura) * focoY), width: W, height: altura };
}

async function foto({ arq, nome, w, h, focoX, focoY, manterProporcao }) {
  const origem = `${ORIGEM}/${arq}`;
  if (!existsSync(origem)) throw new Error(`foto faltando: ${arq} (alvo "${nome}")`);

  // .rotate() sem argumento vem primeiro: foto de celular guarda a orientacao
  // no EXIF, e sem isso o recorte sai calculado sobre a imagem deitada.
  const base = sharp(origem).rotate();

  // metadata() devolve a dimensao do arquivo, nao a de depois do auto-rotate.
  // Em foto retrato de celular os dois vem trocados, e o extract estoura.
  const meta = await base.metadata();
  const deitada = meta.orientation >= 5;
  const width = meta.autoOrient?.width ?? (deitada ? meta.height : meta.width);
  const height = meta.autoOrient?.height ?? (deitada ? meta.width : meta.height);

  // Sem recorte nenhum quando a proporção original é para ser mantida: a foto
  // só é reduzida. É o caso da galeria em mosaico.
  if (manterProporcao) {
    const largura = Math.min(w, width);
    const info = await base
      .clone()
      .resize({ width: largura })
      .webp({ quality: 78, effort: 5 })
      .toFile(`${DESTINO}/${nome}.webp`);
    return {
      nome,
      origem: arq,
      de: `${width}x${height}`,
      para: `${info.width}x${info.height}`,
      kb: Math.round(info.size / 1024),
      densidade: Number((largura / w).toFixed(2)),
    };
  }

  const recorte = caixa(width, height, w, h, focoX, focoY);

  // Mira no dobro da caixa em que a imagem aparece, para tela retina, mas
  // nunca passa do que o recorte tem de verdade. Ampliar nao inventa detalhe,
  // so engorda o arquivo e deixa a foto borrada.
  const saidaW = Math.min(w * 2, recorte.width);
  const saidaH = Math.round((saidaW * h) / w);

  const info = await base
    .clone()
    .extract(recorte)
    .resize({ width: saidaW, height: saidaH, fit: 'fill' })
    .webp({ quality: 78, effort: 5 })
    .toFile(`${DESTINO}/${nome}.webp`);

  return {
    nome,
    origem: arq,
    de: `${width}x${height}`,
    para: `${info.width}x${info.height}`,
    kb: Math.round(info.size / 1024),
    // 1 = deu para servir a caixa em densidade dupla. Abaixo de 0.5 a foto
    // chega menor que a caixa e vai aparecer mole na tela.
    densidade: Number((saidaW / (w * 2)).toFixed(2)),
  };
}

/**
 * A logo veio como JPEG sobre fundo branco. Em vez de recortar na mao, o alfa
 * sai do proprio pixel: fundo branco tem min(r,g,b) alto, tinta tem min baixo.
 * Depois a tinta preta vira creme na versao que roda sobre fundo escuro, e o
 * vermelho e o verde da marca sao preservados.
 */
async function logo() {
  const origem = `${ORIGEM}/62.jpg`;
  if (!existsSync(origem)) throw new Error('logo faltando: fotos/62.jpg');

  const { data, info } = await sharp(origem)
    .resize(1080, 1080, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const n = info.width * info.height;
  const claro = Buffer.alloc(n * 4);
  const escuro = Buffer.alloc(n * 4);

  for (let i = 0; i < n; i++) {
    const p = i * info.channels;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const alfa = 255 - Math.min(r, g, b);
    const ehVermelho = r - Math.max(g, b) > 40;
    const ehVerde = g - r > 25 && g - b > 25;
    const tinta = ehVermelho ? VERMELHO : ehVerde ? VERDE : CREME;

    const q = i * 4;
    // clara: cores originais, so o fundo branco vira transparente
    claro[q] = r;
    claro[q + 1] = g;
    claro[q + 2] = b;
    claro[q + 3] = alfa;
    // escura: a tinta preta vira creme, marca preservada
    escuro[q] = tinta.r;
    escuro[q + 1] = tinta.g;
    escuro[q + 2] = tinta.b;
    escuro[q + 3] = alfa;
  }

  const cru = { raw: { width: info.width, height: info.height, channels: 4 } };

  await sharp(claro, cru).trim({ threshold: 1 }).png().toFile(`${DESTINO}/logo.png`);
  await sharp(escuro, cru).trim({ threshold: 1 }).png().toFile(`${DESTINO}/logo-escuro.png`);
  await sharp(origem).resize(512, 512, { fit: 'cover' }).png().toFile(`${PUBLICO}/favicon.png`);

  // og:image precisa de fundo: transparencia vira preto em varios leitores
  const marca = await sharp(escuro, cru).trim({ threshold: 1 }).resize({ height: 380 }).png().toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#12100e' } })
    .composite([{ input: marca, gravity: 'center' }])
    .jpeg({ quality: 88 })
    .toFile(`${PUBLICO}/og.jpg`);

  return ['logo.png', 'logo-escuro.png', 'public/favicon.png', 'public/og.jpg'];
}

mkdirSync(DESTINO, { recursive: true });
mkdirSync(PUBLICO, { recursive: true });

const feitos = [];
for (const alvo of alvos) feitos.push(await foto(alvo));
const daLogo = await logo();

const total = feitos.reduce((s, f) => s + f.kb, 0);
console.log(`${feitos.length} fotos + ${daLogo.length} arquivos de marca`);
console.log(`peso total das fotos: ${total} kB (media ${Math.round(total / feitos.length)} kB)`);

const pesadas = feitos.filter((f) => f.kb > 200);
if (pesadas.length) console.log('acima de 200 kB:', pesadas.map((f) => `${f.nome} ${f.kb}kB`).join(', '));

// As fotos vieram do site antigo, em resolucao de tela. Onde a origem nao dava
// para a caixa, o aviso fica registrado em vez de virar upscale silencioso.
const molhes = feitos.filter((f) => f.densidade < 0.55);
if (molhes.length) {
  console.log(`\norigem pequena para a caixa (pedir a foto original ao cliente):`);
  for (const f of molhes) console.log(`  ${f.nome.padEnd(20)} ${f.origem} ${f.de} -> ${f.para}`);
}

writeFileSync(
  `${DESTINO}/_gerado.json`,
  JSON.stringify({ geradoEm: new Date().toISOString(), fotos: feitos }, null, 2),
);
