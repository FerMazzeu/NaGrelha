import { baixar } from './excel';
import { nomeDeArquivo } from './pdf-da-proposta';

export type LinhaParaExportar = {
  data: string;
  descricao: string;
  categoria: string;
  conta: string;
  evento: string;
  pessoa: string;
  forma: string;
  /** Com sinal: entrada positiva, saída negativa. */
  valor: number;
  saldo: number;
};

/**
 * O livro caixa em Excel, para mandar ao contador ou conferir com o banco.
 *
 * Valor com sinal numa coluna só, e não entrada e saída separadas: é o que
 * deixa somar a coluna e chegar no saldo, que é a primeira coisa que quem
 * recebe a planilha faz.
 */
export async function montarLivroCaixa(p: {
  titulo: string;
  saldoAnterior: number;
  saldoFinal: number;
  linhas: LinhaParaExportar[];
  /** Com filtro de tipo ou categoria o saldo da linha não fecha com a soma. */
  mostrarSaldo: boolean;
}) {
  const { Workbook } = await import('exceljs');
  const livro = new Workbook();
  livro.creator = 'Na Grelha com Alan Xavier';
  const aba = livro.addWorksheet('Livro caixa');
  const MOEDA = 'R$ #,##0.00;[Red]-R$ #,##0.00';

  aba.columns = [
    { width: 12 },
    { width: 40 },
    { width: 26 },
    { width: 22 },
    { width: 22 },
    { width: 18 },
    { width: 14 },
    { width: 15 },
    ...(p.mostrarSaldo ? [{ width: 15 }] : []),
  ];

  aba.addRow([p.titulo]).font = { bold: true, size: 13 };
  aba.addRow([]);
  const anterior = aba.addRow(['', 'Saldo anterior', '', '', '', '', '', p.saldoAnterior]);
  anterior.font = { italic: true };
  anterior.getCell(8).numFmt = MOEDA;

  const cabecalho = aba.addRow([
    'Data',
    'Descrição',
    'Categoria',
    'Conta',
    'Evento',
    'Pessoa',
    'Forma',
    'Valor',
    ...(p.mostrarSaldo ? ['Saldo'] : []),
  ]);
  cabecalho.font = { bold: true };
  cabecalho.eachCell((c) => {
    c.border = { bottom: { style: 'thin' } };
  });

  for (const l of p.linhas) {
    const [a, m, d] = l.data.split('-').map(Number);
    const linha = aba.addRow([
      new Date(Date.UTC(a, m - 1, d)),
      l.descricao,
      l.categoria,
      l.conta,
      l.evento,
      l.pessoa,
      l.forma,
      l.valor,
      ...(p.mostrarSaldo ? [l.saldo] : []),
    ]);
    linha.getCell(1).numFmt = 'dd/mm/yyyy';
    linha.getCell(8).numFmt = MOEDA;
    if (p.mostrarSaldo) linha.getCell(9).numFmt = MOEDA;
  }

  const total = aba.addRow(['', 'Total do período', '', '', '', '', '', p.linhas.reduce((s, l) => s + l.valor, 0)]);
  total.font = { bold: true };
  total.getCell(8).numFmt = MOEDA;
  total.getCell(8).border = { top: { style: 'thin' } };
  if (p.mostrarSaldo) {
    const final = aba.addRow(['', 'Saldo no fim', '', '', '', '', '', p.saldoFinal]);
    final.font = { bold: true };
    final.getCell(8).numFmt = MOEDA;
  }
  aba.views = [{ state: 'frozen', ySplit: 4 }];

  return livro.xlsx.writeBuffer();
}

export async function exportarLivroCaixa(p: Parameters<typeof montarLivroCaixa>[0]) {
  const buffer = await montarLivroCaixa(p);
  baixar(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `Na Grelha - ${nomeDeArquivo(p.titulo)}.xlsx`,
  );
}
