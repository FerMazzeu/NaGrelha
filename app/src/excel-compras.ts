import type { ComprasJuntas } from './dominio/compras';
import { naUnidadeDoPreco, rotuloUnidade } from './dominio/unidade';
import { baixar } from './excel';
import { dataCurta } from './formato';
import { nomeDeArquivo } from './pdf-da-proposta';

/**
 * A lista de compras do mês em Excel.
 *
 * Uma coluna por evento, além do total: o total é o que vai para o carrinho,
 * e as colunas dos eventos dizem como separar depois. Quantidade na unidade
 * de compra (quilo, unidade, litro), que é como o mercado vende.
 */
export async function montarComprasJuntas(juntas: ComprasJuntas, titulo: string) {
  const { Workbook } = await import('exceljs');
  const livro = new Workbook();
  livro.creator = 'Na Grelha com Alan Xavier';
  const aba = livro.addWorksheet('Compras');
  const eventos = juntas.eventos;
  const NUM = '#,##0.0##';
  const MOEDA = 'R$ #,##0.00';

  aba.addRow([`Lista de compras - ${titulo}`]).font = { bold: true, size: 13 };
  aba.addRow([eventos.map((e) => `${e.data ? dataCurta(e.data) : 'sem data'} ${e.cliente || 'Sem nome'}`).join(' · ')]).font = {
    italic: true,
    size: 9,
  };
  aba.addRow([]);

  const cabecalho = aba.addRow([
    'Categoria',
    'Item',
    'Unidade',
    'Total',
    ...eventos.map((e) => `${e.data ? dataCurta(e.data).slice(0, 5) : ''} ${e.cliente.split(' ')[0] || 'Sem nome'}`.trim()),
    'Custo estimado',
  ]);
  cabecalho.font = { bold: true };
  cabecalho.eachCell((c) => {
    c.border = { bottom: { style: 'thin' } };
  });

  for (const [categoria, itens] of juntas.porCategoria) {
    for (const item of itens) {
      const linha = aba.addRow([
        categoria,
        item.nome,
        rotuloUnidade(item.unidade),
        naUnidadeDoPreco(item.unidade, item.comprar),
        ...eventos.map((e) => {
          const parte = item.porEvento.find((p) => p.eventoId === e.id);
          return parte ? naUnidadeDoPreco(item.unidade, parte.comprar) : null;
        }),
        item.custo,
      ]);
      linha.getCell(4).font = { bold: true };
      for (let c = 4; c < 5 + eventos.length; c++) linha.getCell(c).numFmt = NUM;
      linha.getCell(5 + eventos.length).numFmt = MOEDA;
    }
  }

  if (juntas.carvaoKg > 0) {
    const carvao = aba.addRow(['Carvão', 'Carvão', 'kg', juntas.carvaoKg, ...eventos.map(() => null), juntas.custoCarvao]);
    carvao.getCell(5 + eventos.length).numFmt = MOEDA;
  }
  aba.addRow([]);
  const total = aba.addRow(['', 'Custo estimado total', '', '', ...eventos.map(() => null), juntas.custoTotal]);
  total.font = { bold: true };
  total.getCell(5 + eventos.length).numFmt = MOEDA;

  aba.columns.forEach((col, i) => {
    col.width = i === 0 ? 16 : i === 1 ? 30 : i === 2 ? 8 : 12;
  });
  aba.views = [{ state: 'frozen', ySplit: 4, xSplit: 2 }];

  return livro.xlsx.writeBuffer();
}

export async function exportarComprasJuntas(juntas: ComprasJuntas, titulo: string) {
  const buffer = await montarComprasJuntas(juntas, titulo);
  baixar(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `Na Grelha - Compras - ${nomeDeArquivo(titulo)}.xlsx`,
  );
}
