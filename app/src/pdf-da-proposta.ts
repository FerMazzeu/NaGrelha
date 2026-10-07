/**
 * A proposta vira um ARQUIVO PDF, para ir anexada no WhatsApp.
 *
 * A primeira versão usava só `window.print()` e "Salvar como PDF". Funciona no
 * notebook, mas no celular do Alan o caminho até o arquivo é escondido, e o
 * que acabava indo para o cliente era o texto da proposta colado na conversa.
 * O cliente não consegue imprimir uma conversa para mostrar ao chefe dele, e
 * foi exatamente o que o Alan pediu: o orçamento em PDF, para poder imprimir.
 *
 * A folha é desenhada a partir da mesma `.proposta` da tela, sempre na
 * largura de uma A4 (mesmo no celular, onde a tela mostra a versão estreita),
 * e cortada em páginas sem partir uma linha do cardápio ou da tabela no meio.
 *
 * As duas bibliotecas só carregam quando a proposta abre: são pesadas, e quem
 * só mexe no orçamento não precisa delas.
 */

/** Largura de uma A4 a 96 dpi, que é como o navegador mede 21 cm. */
const LARGURA_A4 = 794;
const ESCALA = 2;
const MARGEM_MM = 10;

/** Onde dá para cortar a página: o fim de cada coisa que não pode partir. */
const INTEIROS = 'header, h1, h2, h3, li, tr, p, dl > div, .proposta-grupo';

/*
  As fontes que a proposta usa.

  O PDF da Érica saiu com "Costelade boi", "coxae sobrecoxa", "Farofana
  grelha". Não era ortografia: era fonte. O html2canvas monta uma CÓPIA da
  página num documento à parte, mede onde cada palavra começa ali, e depois
  desenha a palavra com a fonte do documento PRINCIPAL. Quando a cópia não
  tinha a Inter carregada (rede lenta, Safari, celular), ela media com a fonte
  reserva, que é mais estreita, e o desenho saía em Inter, que é mais larga.
  Cada palavra começava no lugar certo e terminava em cima do espaço seguinte.

  Reproduzido de propósito, com a mesma saída da foto, antes de consertar.
*/
const FONTES = ['400 16px Inter', '500 16px Inter', '600 16px Inter', '700 16px Inter', '400 16px Anton'];

/** Fonte que existe em todo celular e computador, para quando a Inter não vem. */
const FONTE_SEGURA = 'Arial, Helvetica, sans-serif';

const comPrazo = <T,>(promessa: Promise<T>, ms: number) =>
  Promise.race([promessa, new Promise<undefined>((ok) => setTimeout(() => ok(undefined), ms))]);

async function carregarFontes(doc: Document) {
  // A folha do Google é um <link> comum: na cópia ela carrega de novo, e
  // pedir a fonte antes dela chegar não pede nada.
  const folhas = [...doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href*="fonts.googleapis"]')];
  await comPrazo(
    Promise.all(
      folhas.map((l) =>
        l.sheet ? Promise.resolve() : new Promise<void>((ok) => l.addEventListener('load', () => ok(), { once: true })),
      ),
    ),
    4000,
  );
  await comPrazo(Promise.all(FONTES.map((f) => doc.fonts.load(f).catch(() => []))), 4000);
  await comPrazo(doc.fonts.ready, 2000);
  return FONTES.every((f) => temFace(doc, f));
}

/*
  Se existe uma face daquela família e peso CARREGADA no documento.

  Não dá para usar `fonts.check()`: ele responde "sim" quando nenhuma fonte
  com aquele nome está registrada, porque supõe que seja fonte do sistema. Foi
  assim que o primeiro conserto passou no cenário que devia falhar — o teste
  pegou, e o PDF continuou saindo com "Costelade boi".
*/
function temFace(doc: Document, descricao: string) {
  const [peso, , familia] = descricao.split(' ');
  return [...doc.fonts].some(
    (f) => f.family.replace(/["']/g, '') === familia && f.status === 'loaded' && pesoCobre(f.weight, Number(peso)),
  );
}

/** "400" ou faixa variável "100 900". */
function pesoCobre(peso: string, alvo: number) {
  const [min, max = min] = peso.split(' ').map(Number);
  return alvo >= min && alvo <= max;
}

/**
 * Deixa medida e desenho com a MESMA fonte, aconteça o que acontecer.
 *
 * Com a Inter nos dois lados, a folha sai com a fonte da marca. Se um dos
 * dois não conseguir a Inter, a cópia inteira passa para Arial: o nome que o
 * canvas vai desenhar é o mesmo que a cópia mediu, e o espaço entre as
 * palavras não some. Feio, nunca. Errado, nunca.
 */
async function alinharFontes(doc: Document, principalTemAFonte: boolean) {
  const copiaTemAFonte = await carregarFontes(doc);
  if (principalTemAFonte && copiaTemAFonte) return 'marca';
  const estilo = doc.createElement('style');
  estilo.textContent = `.proposta, .proposta * { font-family: ${FONTE_SEGURA} !important; }`;
  doc.head.appendChild(estilo);
  return 'segura';
}

/**
 * Fotografa a folha. Separado do PDF para dar para ver a imagem em teste.
 *
 * `simularCopiaSemFonte` só existe para o teste: tira a folha do Google da
 * cópia, que é o cenário que estragou o PDF da Érica.
 */
export async function capturarProposta(elemento: HTMLElement, opcoes: { simularCopiaSemFonte?: boolean } = {}) {
  const { default: html2canvas } = await import('html2canvas-pro');
  const principalTemAFonte = await carregarFontes(document);

  let cortes: number[] = [];
  let fonte: 'marca' | 'segura' = 'marca';
  const canvas = await html2canvas(elemento, {
    scale: ESCALA,
    logging: false,
    backgroundColor: '#ffffff',
    // Janela larga o bastante para a regra de celular do CSS não valer: o
    // PDF é sempre a folha de notebook, com duas colunas de cardápio.
    windowWidth: 1100,
    // A biblioteca espera o que o onclone devolver, apesar do tipo dizer void.
    onclone: (async (doc: Document, copia: HTMLElement) => {
      if (opcoes.simularCopiaSemFonte) {
        doc.querySelectorAll('link[href*="fonts.googleapis"]').forEach((l) => l.remove());
      }
      fonte = await alinharFontes(doc, principalTemAFonte);
      copia.style.width = `${LARGURA_A4}px`;
      copia.style.margin = '0';
      copia.style.boxShadow = 'none';
      // Mede DEPOIS de acertar a fonte: com a fonte trocada, as linhas mudam
      // de altura, e os pontos de corte de página mudam junto.
      const topo = copia.getBoundingClientRect().top;
      cortes = [...copia.querySelectorAll(INTEIROS)]
        .map((el) => Math.round((el.getBoundingClientRect().bottom - topo) * ESCALA))
        .sort((a, b) => a - b);
    }) as unknown as (doc: Document, copia: HTMLElement) => void,
  });
  return { canvas, cortes, fonte };
}

export async function gerarPdfDaProposta(elemento: HTMLElement, nomeDoArquivo: string): Promise<File> {
  const [{ jsPDF }, { canvas, cortes }] = await Promise.all([import('jspdf'), capturarProposta(elemento)]);

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const larguraMm = pdf.internal.pageSize.getWidth();
  const alturaMm = pdf.internal.pageSize.getHeight();

  // A primeira página não tem margem em cima: a própria folha já tem respiro.
  // Da segunda em diante, a margem evita texto colado na borda do papel.
  const pxPorMm = canvas.width / larguraMm;
  const alturaPagina = (n: number) => Math.floor((alturaMm - (n === 0 ? MARGEM_MM : MARGEM_MM * 2)) * pxPorMm);

  let inicio = 0;
  for (let pagina = 0; inicio < canvas.height; pagina++) {
    const limite = inicio + alturaPagina(pagina);
    let fim = canvas.height;
    if (limite < canvas.height) {
      const corte = cortes.filter((c) => c > inicio + 40 && c <= limite).pop();
      fim = corte ?? limite;
    }

    const fatia = document.createElement('canvas');
    fatia.width = canvas.width;
    fatia.height = fim - inicio;
    const ctx = fatia.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, fatia.width, fatia.height);
    ctx.drawImage(canvas, 0, inicio, canvas.width, fatia.height, 0, 0, canvas.width, fatia.height);

    if (pagina > 0) pdf.addPage();
    pdf.addImage(
      fatia.toDataURL('image/jpeg', 0.92),
      'JPEG',
      0,
      pagina === 0 ? 0 : MARGEM_MM,
      larguraMm,
      fatia.height / pxPorMm,
    );
    inicio = fim;
  }

  return new File([pdf.output('blob')], nomeDoArquivo, { type: 'application/pdf' });
}

/**
 * Nome de arquivo sem acento.
 *
 * Um PDF de cliente chegou no WhatsApp do Alan como "OrÃ§amento Na Grelha":
 * o "ç" passou por um lado que lê o nome como UTF-8 e por outro que lê como
 * Latin-1. Não dá para consertar o WhatsApp de cada um; dá para não mandar
 * acento no nome do arquivo. Dentro do PDF o texto continua acentuado.
 */
export function nomeDeArquivo(texto: string) {
  return texto
    .normalize('NFD')
    // Escapado, e não o acento solto: no editor ele é invisível.
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "Orcamento Na Grelha - Fulana - 12-10.pdf": é o nome que o cliente vê no WhatsApp. */
export function nomeDoPdf(cliente: string, data: string) {
  const quem = nomeDeArquivo(cliente) || 'cliente';
  const quando = data ? ` - ${data.slice(8, 10)}-${data.slice(5, 7)}` : '';
  return `Orcamento Na Grelha - ${quem}${quando}.pdf`;
}

/** O celular (e o Windows) sabem compartilhar arquivo direto para o WhatsApp. */
export function podeCompartilhar(arquivo: File) {
  return typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [arquivo] });
}

export function baixar(arquivo: File) {
  const url = URL.createObjectURL(arquivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = arquivo.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** wa.me com DDI do Brasil quando o número veio só com DDD. */
export function linkDoWhatsApp(contato: string, texto: string) {
  const zap = contato.replace(/\D/g, '');
  const numero = zap.length >= 10 ? (zap.length <= 11 ? `55${zap}` : zap) : '';
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
