import { ROTULO_CATEGORIA } from './dominio/catalogo';
import { ROTULO_PAPEL, type Orcamento, type Resultado } from './dominio/tipos';
import { dataCurta } from './formato';

/**
 * Exporta o orçamento em Excel, no formato que o cliente já usa.
 *
 * A planilha dele tem uma ordem específica: insumos por preparo, depois o
 * bloco de serviço, depois total geral e total por convidado. Manter essa
 * ordem é o que permite ele conferir o arquivo sem ter que reaprender a ler.
 *
 * O `exceljs` entra por import dinâmico: são quase 1 MB, e quem só está
 * orçando no celular não precisa baixar isso.
 */
export async function exportarOrcamento(orcamento: Orcamento, resultado: Resultado) {
  const buffer = await montarPlanilha(orcamento, resultado);
  const nome = `Na Grelha - ${orcamento.cliente || 'orcamento'}${orcamento.data ? ` - ${orcamento.data}` : ''}.xlsx`;
  baixar(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nome);
}

/**
 * Monta o arquivo e devolve os bytes.
 *
 * Separado do download de propósito: assim dá para testar o conteúdo da
 * planilha em Node, sem navegador. O que estava junto não dava para verificar.
 */
export async function montarPlanilha(orcamento: Orcamento, resultado: Resultado) {
  const { Workbook } = await import('exceljs');
  const livro = new Workbook();
  livro.creator = 'Na Grelha com Alan Xavier';
  livro.created = new Date();

  const MOEDA = 'R$ #,##0.00';
  const BRASA = 'FFC4261D';
  const CREME = 'FFF7F2EA';

  const aba = livro.addWorksheet('Orçamento', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true },
  });
  aba.columns = [
    { width: 34 },
    { width: 16 },
    { width: 10 },
    { width: 14 },
    { width: 14 },
  ];

  let linha = 1;

  const titulo = (texto: string) => {
    const l = aba.getRow(linha++);
    l.getCell(1).value = texto;
    l.getCell(1).font = { bold: true, size: 12, color: { argb: CREME } };
    l.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRASA } };
    aba.mergeCells(l.number, 1, l.number, 5);
    l.height = 20;
  };

  const cabecalho = (...celulas: string[]) => {
    const l = aba.getRow(linha++);
    celulas.forEach((c, i) => {
      l.getCell(i + 1).value = c;
      l.getCell(i + 1).font = { bold: true, size: 9 };
      l.getCell(i + 1).border = { bottom: { style: 'thin' } };
    });
  };

  const totalizador = (rotulo: string, valor: number) => {
    const l = aba.getRow(linha++);
    l.getCell(1).value = rotulo;
    l.getCell(1).font = { bold: true };
    l.getCell(5).value = valor;
    l.getCell(5).numFmt = MOEDA;
    l.getCell(5).font = { bold: true };
    l.getCell(5).border = { top: { style: 'thin' } };
  };

  const vazia = () => linha++;

  // ---------------------------------------------------------------- topo
  titulo('NA GRELHA COM ALAN XAVIER');
  aba.getRow(linha++).getCell(1).value = orcamento.cliente || 'Orçamento sem nome';
  aba.getRow(linha - 1).getCell(1).font = { bold: true, size: 14 };

  const dado = (rotulo: string, valor: string) => {
    if (!valor) return;
    const l = aba.getRow(linha++);
    l.getCell(1).value = rotulo;
    l.getCell(1).font = { size: 9, color: { argb: 'FF888888' } };
    l.getCell(2).value = valor;
  };
  dado('Data', orcamento.data ? `${dataCurta(orcamento.data)}${orcamento.hora ? ` às ${orcamento.hora}` : ''}` : '');
  dado('Local', orcamento.local);
  dado('Contato', orcamento.contato);
  dado('Duração', `${orcamento.duracaoHoras} horas`);
  vazia();

  // ---------------------------------------------------------- cobrança
  titulo('CONVIDADOS E VALORES');
  cabecalho('Quem', '', 'Qtd', 'Valor unitário', 'Total');
  for (const c of resultado.cobranca) {
    if (c.quantidade <= 0) continue;
    const l = aba.getRow(linha++);
    l.getCell(1).value = c.rotulo;
    l.getCell(3).value = c.quantidade;
    l.getCell(4).value = c.unitario;
    l.getCell(4).numFmt = MOEDA;
    l.getCell(5).value = c.total;
    l.getCell(5).numFmt = MOEDA;
  }
  totalizador('VALOR TOTAL', resultado.preco);
  vazia();

  // ------------------------------------------------------------ insumos
  titulo('INSUMOS');
  cabecalho('Item', 'Preparo', 'Qtd', 'Valor unitário', 'Total');

  const porGrupo = new Map<string, typeof resultado.linhas>();
  for (const l of resultado.linhas) {
    const chave = l.item.grupo || ROTULO_CATEGORIA[l.item.categoria];
    if (!porGrupo.has(chave)) porGrupo.set(chave, []);
    porGrupo.get(chave)!.push(l);
  }

  for (const [grupo, itens] of porGrupo) {
    const g = aba.getRow(linha++);
    g.getCell(1).value = grupo.toUpperCase();
    g.getCell(1).font = { bold: true, size: 10 };

    for (const item of itens) {
      const l = aba.getRow(linha++);
      l.getCell(1).value = `   ${item.item.nome}`;
      l.getCell(2).value = item.item.unidade === 'kg' ? 'kg' : 'un';
      l.getCell(3).value = item.item.unidade === 'kg' ? item.comprar / 1000 : item.comprar;
      l.getCell(3).numFmt = '0.00';
      l.getCell(4).value = item.item.preco;
      l.getCell(4).numFmt = MOEDA;
      l.getCell(5).value = item.custo;
      l.getCell(5).numFmt = MOEDA;
    }
  }

  if (resultado.carvaoKg > 0) {
    const l = aba.getRow(linha++);
    l.getCell(1).value = 'FOGO';
    l.getCell(1).font = { bold: true, size: 10 };
    const c = aba.getRow(linha++);
    c.getCell(1).value = '   Carvão';
    c.getCell(2).value = 'kg';
    c.getCell(3).value = resultado.carvaoKg;
    c.getCell(4).value = orcamento.precoCarvao;
    c.getCell(4).numFmt = MOEDA;
    c.getCell(5).value = resultado.custoCarvao;
    c.getCell(5).numFmt = MOEDA;
  }

  totalizador('TOTAL INSUMOS', resultado.custoItens + resultado.custoCarvao);
  vazia();

  // ------------------------------------------------------------ serviço
  titulo('SERVIÇO');
  cabecalho('Serviço', 'Quem', 'Qtd', 'Valor', 'Total');
  for (const x of resultado.servicos) {
    const l = aba.getRow(linha++);
    l.getCell(1).value = `${x.servico.nome} (${ROTULO_PAPEL[x.servico.papel]})`;
    l.getCell(2).value = x.servico.pessoa;
    l.getCell(3).value = x.servico.quantidade;
    l.getCell(4).value = x.servico.valor;
    l.getCell(4).numFmt = MOEDA;
    l.getCell(5).value = x.total;
    l.getCell(5).numFmt = MOEDA;
  }
  for (const c of orcamento.custosExtras) {
    const l = aba.getRow(linha++);
    l.getCell(1).value = c.descricao || 'Outro custo';
    l.getCell(5).value = c.valor;
    l.getCell(5).numFmt = MOEDA;
  }
  totalizador('TOTAL SERVIÇO', resultado.custoServicos + resultado.custosExtras);
  vazia();

  // -------------------------------------------------------------- resumo
  titulo('RESUMO');
  totalizador('TOTAL INSUMOS', resultado.custoItens + resultado.custoCarvao);
  totalizador('TOTAL SERVIÇO', resultado.custoServicos + resultado.custosExtras);
  totalizador('TOTAL GERAL', resultado.custoTotal);
  totalizador('VALOR COBRADO', resultado.preco);
  totalizador('POR CONVIDADO', resultado.precoPorPessoa);
  vazia();

  // ---------------------------------------------------------- condições
  titulo('OBSERVAÇÕES IMPORTANTES');
  const condicoes = [
    `O evento tem duração de ${orcamento.duracaoHoras} horas, contando a partir do início.`,
    'Chegamos sempre cedo para que tudo seja preparado com calma e no padrão Na Grelha de qualidade.',
    'Sobre o pagamento, pedimos uma entrada ao fechar o evento e o restante em até 4 dias antes.',
    'Por razões de segurança o buffet não disponibiliza alimentos preparados após o evento, mantendo sob sua propriedade as carnes cruas e insumos não utilizados.',
    'Nossa equipe é uniformizada e treinada para atender todos da melhor forma. Somos uma empresa familiar.',
  ];
  if (orcamento.observacoes.trim()) condicoes.push(orcamento.observacoes.trim());

  for (const c of condicoes) {
    const l = aba.getRow(linha++);
    l.getCell(1).value = c;
    l.getCell(1).alignment = { wrapText: true, vertical: 'top' };
    aba.mergeCells(l.number, 1, l.number, 5);
    l.height = 28;
  }

  // ------------------------------------------------- aba de compras
  const compras = livro.addWorksheet('Lista de compras');
  compras.columns = [{ width: 34 }, { width: 12 }, { width: 10 }, { width: 14 }];
  compras.addRow(['LISTA DE COMPRAS']).font = { bold: true, size: 12 };
  compras.addRow([orcamento.cliente || 'Evento', orcamento.data ? dataCurta(orcamento.data) : '']);
  compras.addRow([`${resultado.convidados} convidados`]);
  compras.addRow([]);
  compras.addRow(['Item', 'Unidade', 'Comprar', 'Custo']).font = { bold: true };

  for (const [grupo, itens] of porGrupo) {
    compras.addRow([grupo.toUpperCase()]).font = { bold: true };
    for (const item of itens) {
      const l = compras.addRow([
        `   ${item.item.nome}`,
        item.item.unidade,
        item.item.unidade === 'kg' ? item.comprar / 1000 : item.comprar,
        item.custo,
      ]);
      l.getCell(3).numFmt = '0.00';
      l.getCell(4).numFmt = MOEDA;
    }
  }

  return livro.xlsx.writeBuffer();
}

/** Dispara o download no navegador e limpa a URL temporária. */
function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revogar na hora corta o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
