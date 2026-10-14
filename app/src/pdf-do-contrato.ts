import {
  blocosDoContrato,
  cpfFormatado,
  TITULO_DO_CONTRATO,
  type ConteudoDoContrato,
  type Contratante,
} from '../supabase/functions/_shared/contrato';
import { nomeDeArquivo } from './pdf-da-proposta';

export type Comprovante = {
  assinadoEm: string;
  hash: string;
  email: string;
  ip: string;
  dispositivo?: string;
  enviadoEm?: string;
};

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'long', timeStyle: 'medium' });

/**
 * O contrato em PDF, gerado no navegador.
 *
 * Texto de verdade (jsPDF), e não foto da tela como a proposta: contrato é
 * documento para ser lido, copiado e conferido, e o texto precisa ser
 * selecionável. Com `comprovante`, ganha a página de assinatura com as
 * evidências e o código de verificação.
 */
export async function pdfDoContrato(
  conteudo: ConteudoDoContrato,
  contratante: Contratante,
  comprovante: Comprovante | null,
): Promise<File> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margem = 20;
  const largura = 210 - margem * 2;
  const fim = 297 - 20;
  let y = 22;

  const cabe = (altura: number) => {
    if (y + altura > fim) {
      doc.addPage();
      y = 20;
    }
  };
  const escrever = (texto: string, tamanho: number, negrito = false, recuo = 0, depois = 2) => {
    doc.setFont('helvetica', negrito ? 'bold' : 'normal');
    doc.setFontSize(tamanho);
    const linhas = doc.splitTextToSize(texto, largura - recuo) as string[];
    const alturaLinha = tamanho * 0.42;
    for (const linha of linhas) {
      cabe(alturaLinha);
      doc.text(linha, margem + recuo, y);
      y += alturaLinha;
    }
    y += depois;
  };

  doc.setTextColor(26, 21, 18);
  escrever(TITULO_DO_CONTRATO, 13, true, 0, 6);

  for (const b of blocosDoContrato(conteudo, contratante)) {
    if (b.titulo) {
      cabe(14);
      escrever(b.titulo, 10, true, 0, 1.5);
    }
    for (const p of b.paragrafos) escrever(p, 9.5, false, 0, 2);
    const numerada = b.titulo?.includes('PREÇO');
    for (const [i, item] of (b.lista ?? []).entries()) escrever(`${numerada ? `${i + 1}.` : '•'} ${item}`, 9.5, false, 4, 1.5);
    y += 2;
  }

  // ---------------------------------------------- página de assinatura ---
  doc.addPage();
  y = 22;
  escrever(comprovante ? 'ASSINATURAS ELETRÔNICAS' : 'ASSINATURAS', 12, true, 0, 6);

  escrever('CONTRATANTE', 10, true, 0, 1);
  escrever(`${contratante.nome.trim().toUpperCase() || '________________'}`, 10, false, 0, 1);
  escrever(`CPF ${contratante.cpf ? cpfFormatado(contratante.cpf) : '________________'}`, 9.5, false, 0, 1);
  if (comprovante) {
    escrever(`Assinado eletronicamente em ${quando(comprovante.assinadoEm)} (horário de Brasília).`, 9.5, false, 0, 1);
    escrever(`Método: código de 6 dígitos enviado ao e-mail ${comprovante.email} e confirmado no link do contrato.`, 9.5, false, 0, 1);
    escrever(`Endereço IP: ${comprovante.ip}`, 9.5, false, 0, 1);
    if (comprovante.dispositivo) escrever(`Dispositivo: ${comprovante.dispositivo}`, 8, false, 0, 1);
  } else {
    escrever('Ainda não assinado.', 9.5, false, 0, 1);
  }
  y += 6;

  escrever('CONTRATADA', 10, true, 0, 1);
  escrever(conteudo.contratada.nome, 10, false, 0, 1);
  escrever(`CNPJ ${conteudo.contratada.cnpj}`, 9.5, false, 0, 1);
  escrever(
    `Aceite manifestado pelo envio deste contrato por ${conteudo.representante}${comprovante?.enviadoEm ? ` em ${quando(comprovante.enviadoEm)}` : ''}.`,
    9.5,
    false,
    0,
    1,
  );
  y += 8;

  if (comprovante) {
    escrever('CÓDIGO DE VERIFICAÇÃO DO DOCUMENTO (SHA-256)', 9, true, 0, 1);
    doc.setFont('courier', 'normal');
    doc.setFontSize(8.5);
    for (const linha of doc.splitTextToSize(comprovante.hash, largura) as string[]) {
      cabe(4);
      doc.text(linha, margem, y);
      y += 4;
    }
    y += 3;
    escrever(
      'Este código é a impressão digital do texto integral do contrato no momento da assinatura, registrado pelo Na Grelha. Qualquer alteração em uma única letra do texto produziria outro código.',
      8.5,
      false,
      0,
      2,
    );
    escrever(
      'Assinatura eletrônica nos termos do art. 10, § 2º, da MP nº 2.200-2/2001 e da Lei nº 14.063/2020.',
      8.5,
      false,
      0,
      2,
    );
  }

  // Rodapé com página: contrato impresso solto precisa dizer de quantas folhas é.
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(122, 110, 98);
    doc.text(`${conteudo.contratada.nome} · página ${i} de ${paginas}`, margem, 290);
  }

  const nome = `Contrato Na Grelha - ${nomeDeArquivo(contratante.nome || 'cliente')}${conteudo.evento.data ? ` - ${conteudo.evento.data}` : ''}${comprovante ? ' - assinado' : ''}.pdf`;
  return new File([doc.output('blob')], nome, { type: 'application/pdf' });
}
