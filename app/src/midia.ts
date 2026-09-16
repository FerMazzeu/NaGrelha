/**
 * Preparo de arquivo antes de mandar para o assistente.
 *
 * Tudo aqui existe por um motivo so: o que sai do celular nao serve como esta.
 * Foto de celular tem 4 MB e 4000 px de largura, e audio gravado pelo
 * navegador vem em webm, que o modelo nao le. Mandar cru custa caro, demora, e
 * na metade dos casos volta erro.
 */

/** Teto por arquivo depois do preparo. Acima disso a requisicao fica lenta demais. */
export const LIMITE_BYTES = 8 * 1024 * 1024;

/** O que o front carrega na mao ate a hora de enviar. */
export type AnexoLocal = {
  nome: string;
  mime: string;
  /** Data URL: `data:image/jpeg;base64,...`. E o que a edge function recebe. */
  dados: string;
  /** Tamanho depois do preparo, para mostrar na etiqueta. */
  bytes: number;
};

export const ehImagem = (mime: string) => mime.startsWith('image/');
export const ehAudio = (mime: string) => mime.startsWith('audio/');

export function tamanhoLegivel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const lerComoDataUrl = (blob: Blob) =>
  new Promise<string>((ok, erro) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(String(leitor.result));
    leitor.onerror = () => erro(new Error('nao consegui ler o arquivo'));
    leitor.readAsDataURL(blob);
  });

/** Base64 tem 4 caracteres para cada 3 bytes, e o cabecalho nao conta. */
const bytesDaDataUrl = (dataUrl: string) => Math.floor((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);

/**
 * Reduz a foto, sem nunca aumentar.
 *
 * PNG pequeno passa intacto de proposito: logo tem fundo transparente, e
 * converter para JPEG troca a transparencia por um retangulo branco. Quem
 * manda a logo para o assistente usar quer a logo, nao a logo em cima de um
 * quadrado.
 */
async function prepararImagem(arquivo: File): Promise<AnexoLocal> {
  const cabe = arquivo.size <= 900 * 1024;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(arquivo);
  } catch {
    // Formato que o navegador nao decodifica (heic de iPhone, por exemplo).
    // Vai cru: o modelo pode ate recusar, mas nao perdemos o arquivo aqui.
    const dados = await lerComoDataUrl(arquivo);
    return { nome: arquivo.name, mime: arquivo.type, dados, bytes: arquivo.size };
  }

  const maior = Math.max(bitmap.width, bitmap.height);
  if (cabe && maior <= 1600) {
    bitmap.close();
    const dados = await lerComoDataUrl(arquivo);
    return { nome: arquivo.name, mime: arquivo.type, dados, bytes: arquivo.size };
  }

  // Nunca aumentar: redimensionar para cima so inventa pixel e engorda o envio.
  const escala = Math.min(1, 1600 / maior);
  const tela = document.createElement('canvas');
  tela.width = Math.round(bitmap.width * escala);
  tela.height = Math.round(bitmap.height * escala);
  tela.getContext('2d')?.drawImage(bitmap, 0, 0, tela.width, tela.height);
  bitmap.close();

  const dados = tela.toDataURL('image/jpeg', 0.85);
  return { nome: trocarExtensao(arquivo.name, 'jpg'), mime: 'image/jpeg', dados, bytes: bytesDaDataUrl(dados) };
}

function trocarExtensao(nome: string, nova: string) {
  const ponto = nome.lastIndexOf('.');
  return `${ponto > 0 ? nome.slice(0, ponto) : nome}.${nova}`;
}

/**
 * Prepara qualquer arquivo escolhido pela pessoa.
 *
 * Lanca com mensagem em portugues quando nao cabe: erro tecnico no meio de um
 * evento nao ajuda ninguem.
 */
export async function prepararAnexo(arquivo: File): Promise<AnexoLocal> {
  const pronto = ehImagem(arquivo.type)
    ? await prepararImagem(arquivo)
    : {
        nome: arquivo.name,
        mime: arquivo.type || 'application/octet-stream',
        dados: await lerComoDataUrl(arquivo),
        bytes: arquivo.size,
      };

  if (pronto.bytes > LIMITE_BYTES) {
    throw new Error(`"${arquivo.name}" tem ${tamanhoLegivel(pronto.bytes)} e o limite e 8 MB.`);
  }
  return pronto;
}

/**
 * Converte o audio gravado para WAV mono de 16 kHz.
 *
 * A OpenRouter so aceita `wav` e `mp3`, e o MediaRecorder do Chrome grava em
 * webm/opus. Sem esta conversao o audio sobe, o modelo recusa, e o erro que
 * volta fala de formato de provider, que nao diz nada para quem usa.
 *
 * 16 kHz mono porque e o suficiente para voz e porque WAV nao tem compressao:
 * na taxa original um recado de um minuto passaria de 10 MB.
 */
export async function paraWav(blob: Blob, taxa = 16000): Promise<Blob> {
  const bytes = await blob.arrayBuffer();

  const contexto = new AudioContext();
  let decodificado: AudioBuffer;
  try {
    decodificado = await contexto.decodeAudioData(bytes);
  } finally {
    contexto.close();
  }

  const quadros = Math.ceil(decodificado.duration * taxa);
  const offline = new OfflineAudioContext(1, quadros, taxa);
  const fonte = offline.createBufferSource();
  fonte.buffer = decodificado;
  fonte.connect(offline.destination);
  fonte.start();

  const pronto = await offline.startRendering();
  return montarWav(pronto.getChannelData(0), taxa);
}

/** Cabecalho WAV de 44 bytes mais PCM 16 bits. */
function montarWav(amostras: Float32Array, taxa: number) {
  const buffer = new ArrayBuffer(44 + amostras.length * 2);
  const v = new DataView(buffer);
  const texto = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(pos + i, s.charCodeAt(i));
  };

  texto(0, 'RIFF');
  v.setUint32(4, 36 + amostras.length * 2, true);
  texto(8, 'WAVE');
  texto(12, 'fmt ');
  v.setUint32(16, 16, true); // tamanho do bloco fmt
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * 2, true); // bytes por segundo
  v.setUint16(32, 2, true); // alinhamento
  v.setUint16(34, 16, true); // bits por amostra
  texto(36, 'data');
  v.setUint32(40, amostras.length * 2, true);

  let pos = 44;
  for (let i = 0; i < amostras.length; i++) {
    const a = Math.max(-1, Math.min(1, amostras[i]));
    v.setInt16(pos, a < 0 ? a * 0x8000 : a * 0x7fff, true);
    pos += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
