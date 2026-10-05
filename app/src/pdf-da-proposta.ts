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

export async function gerarPdfDaProposta(elemento: HTMLElement, nomeDoArquivo: string): Promise<File> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);

  let cortes: number[] = [];
  const canvas = await html2canvas(elemento, {
    scale: ESCALA,
    logging: false,
    backgroundColor: '#ffffff',
    // Janela larga o bastante para a regra de celular do CSS não valer: o
    // PDF é sempre a folha de notebook, com duas colunas de cardápio.
    windowWidth: 1100,
    onclone: (_doc, copia) => {
      copia.style.width = `${LARGURA_A4}px`;
      copia.style.margin = '0';
      copia.style.boxShadow = 'none';
      const topo = copia.getBoundingClientRect().top;
      cortes = [...copia.querySelectorAll(INTEIROS)]
        .map((el) => Math.round((el.getBoundingClientRect().bottom - topo) * ESCALA))
        .sort((a, b) => a - b);
    },
  });

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

/** "Orçamento - Maria Luiza - 12-10.pdf": é o nome que o cliente vê no WhatsApp. */
export function nomeDoPdf(cliente: string, data: string) {
  const quem = cliente.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ') || 'cliente';
  const quando = data ? ` - ${data.slice(8, 10)}-${data.slice(5, 7)}` : '';
  return `Orçamento Na Grelha - ${quem}${quando}.pdf`;
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
