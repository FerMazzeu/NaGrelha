import { eventoExterno } from './dominio/evento-externo';
import { centavos, diasAntes, lancamentoNovo, type Categoria, type Conta, type Lancamento } from './dominio/financeiro';
import type { Orcamento } from './dominio/tipos';
import { normalizar } from './formato';
import { lerData } from './planilha-de-eventos';
import { numero, texto } from './planilha';

/*
  A planilha "CONTROLE CAIXA NA GRELHA" do Alan.

  Uma aba por ano ("CAIXA 2025", "CAIXA 2026"...). Em cada uma, uma linha por
  evento com NOMES, DATA EVENTO, VALOR TOTAL, VALOR DA ENTRADA, VALOR
  RESTANTE, STATUS e uma coluna por sócio (ALAN, ERICA) com quanto cada um
  tirou do evento. Embaixo, "DINHEIRO EM CAIXA": banco, espécie, investido.

  Importar é trazer isso para o caixa sem inventar nada:

  - o evento que ainda não está no app entra como evento de fora, com o valor;
  - o que já foi recebido vira entrada ligada ao evento;
  - a parte de cada sócio vira pró-labore ligado ao evento: pago se o evento
    já passou, previsto se ainda vai acontecer;
  - o dinheiro em caixa vira o saldo inicial das contas.

  Todo pagamento importado é datado ANTES do saldo inicial. O dinheiro que
  entrou no passado já está no saldo do banco de hoje; se contasse de novo,
  o caixa mostraria o dobro.
*/

export type LinhaDoCaixa = {
  aba: string;
  linha: number;
  cliente: string;
  data: string;
  total: number;
  entrada: number;
  /** Nulo quando a célula está vazia: aí não dá para saber se quitou. */
  restante: number | null;
  status: string;
  /** Uma por coluna de sócio, com o nome do cabeçalho: ALAN, ERICA. */
  socios: { pessoa: string; valor: number }[];
};

export type CaixaLido = {
  linhas: LinhaDoCaixa[];
  /** O "DINHEIRO EM CAIXA" da aba mais recente que tem algum valor. */
  saldos: { banco: number; especie: number; investido: number; aba: string } | null;
  ignoradas: { onde: string; motivo: string }[];
  /**
   * Valor solto no resumo de baixo que não é saldo nem total: "BASF 13000".
   * Ninguém além do Alan sabe o que é, então vira pendência para ele.
   */
  outros: { aba: string; rotulo: string; valor: number }[];
  /** Coluna sem título com números dentro: alguma marcação que só ele conhece. */
  colunasSemTitulo: { aba: string; coluna: string; linhas: number }[];
};

const semFormula = (v: unknown): unknown =>
  v && typeof v === 'object' && !(v instanceof Date) && 'result' in v ? (v as { result: unknown }).result : v;

/** "ERICA" vira "Érica", "ALAN" vira "Alan": é o nome que aparece no app. */
function nomeDoSocio(cabecalho: string) {
  const t = cabecalho.trim().toLowerCase();
  if (t === 'erica') return 'Érica';
  return t.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

const COLUNAS_FIXAS = /^(nomes?|data evento|data|valor total|valor da entrada|entrada|valor restante|restante|status)$/;

/** Rótulos do resumo de baixo que são conta da própria planilha, não dúvida. */
const RESUMO_CONHECIDO = /^(total|(valor )?a receber|dinheiro|caixa$|adiantamento|banco|investido)/;

const letraDaColuna = (j: number) => String.fromCharCode(65 + j);

export function lerAbaDoCaixa(nome: string, linhas: unknown[][]): CaixaLido {
  const resultado: LinhaDoCaixa[] = [];
  const ignoradas: CaixaLido['ignoradas'] = [];
  const outros: CaixaLido['outros'] = [];
  const semTitulo = new Map<number, number>();

  // O cabeçalho é a linha com NOMES e VALOR TOTAL.
  let inicio = -1;
  const col: Record<string, number> = {};
  const socios: { coluna: number; pessoa: string }[] = [];
  for (let i = 0; i < Math.min(linhas.length, 15); i++) {
    const celulas = (linhas[i] ?? []).map((c) => normalizar(texto(c)).replace(/\s+/g, ' '));
    const pos = (re: RegExp) => celulas.findIndex((c) => re.test(c));
    if (pos(/^nomes?$/) >= 0 && pos(/^valor total$/) >= 0) {
      inicio = i;
      col.nome = pos(/^nomes?$/);
      col.data = pos(/^data/);
      col.total = pos(/^valor total$/);
      col.entrada = pos(/entrada/);
      col.restante = pos(/restante/);
      col.status = pos(/^status$/);
      celulas.forEach((c, j) => {
        // Toda coluna com título depois do STATUS que não é fixa é de sócio.
        if (c && j > col.total && !COLUNAS_FIXAS.test(c)) {
          socios.push({ coluna: j, pessoa: nomeDoSocio(texto((linhas[i] ?? [])[j])) });
        }
      });
      break;
    }
  }
  if (inicio < 0) {
    return {
      linhas: [],
      saldos: null,
      ignoradas: [{ onde: `aba "${nome}"`, motivo: 'sem a linha de títulos (NOMES, VALOR TOTAL)' }],
      outros: [],
      colunasSemTitulo: [],
    };
  }
  const titulos = (linhas[inicio] ?? []).map((c) => texto(c).trim());
  const ultimaComTitulo = titulos.reduce((m, t, j) => (t ? j : m), 0);

  let saldos: CaixaLido['saldos'] = null;
  const saldo = { banco: 0, especie: 0, investido: 0 };
  let achouSaldo = false;
  // Depois de "TOTAL DE VALORES" vem o resumo ("A RECEBER", "BASF"...), que
  // tem nome e valor como se fosse evento. Dali para baixo só o saldo conta.
  let fimDosEventos = false;

  for (let i = inicio + 1; i < linhas.length; i++) {
    const brutas = (linhas[i] ?? []).map(semFormula);
    const rotulo = normalizar(texto(brutas.find((c) => texto(c).trim()) ?? ''));

    // O bloco de baixo: dinheiro em caixa. O valor está logo à direita.
    const valorAoLado = () => {
      const pos = brutas.findIndex((c) => texto(c).trim());
      return brutas.slice(pos + 1).map(numero).find((n) => n !== null) ?? 0;
    };
    if (/^banco/.test(rotulo)) {
      saldo.banco = valorAoLado();
      achouSaldo = true;
      continue;
    }
    if (/^dinheiro em especie/.test(rotulo)) {
      saldo.especie = valorAoLado();
      achouSaldo = true;
      continue;
    }
    if (/^investido/.test(rotulo)) {
      saldo.investido = valorAoLado();
      achouSaldo = true;
      continue;
    }

    // O bloco do dinheiro também encerra, para aba sem a linha de total.
    if (/^(total|dinheiro em caixa|dinheiro utilizado)/.test(rotulo)) fimDosEventos = true;
    if (fimDosEventos) {
      const pos = brutas.findIndex((c) => texto(c).trim());
      const valor = pos >= 0 ? brutas.slice(pos + 1).map(numero).find((n) => n !== null) : undefined;
      if (rotulo && !RESUMO_CONHECIDO.test(rotulo) && valor && numero(brutas[pos]) === null) {
        outros.push({ aba: nome, rotulo: texto(brutas[pos]).trim(), valor });
      }
      continue;
    }

    // Número em coluna sem título, entre as colunas do evento: conta para avisar.
    brutas.forEach((c, j) => {
      if (j > col.total && j <= ultimaComTitulo + 3 && !titulos[j] && (numero(c) ?? 0) !== 0) {
        semTitulo.set(j, (semTitulo.get(j) ?? 0) + 1);
      }
    });

    const cliente = texto(brutas[col.nome]).trim();
    const data = lerData(brutas[col.data]) ?? '';
    const total = numero(brutas[col.total]) ?? 0;
    const entrada = col.entrada >= 0 ? (numero(brutas[col.entrada]) ?? 0) : 0;
    const restanteBruto = col.restante >= 0 ? numero(brutas[col.restante]) : null;
    const valoresDosSocios = socios.map((s) => ({ pessoa: s.pessoa, valor: numero(brutas[s.coluna]) ?? 0 }));

    if (!cliente) {
      // Linha da semana sem evento é comum (só o número e a data). Com valor e
      // sem nome, alguém esqueceu de escrever o cliente: avisa, não some.
      // Sem data também é a linha de subtotal das colunas dos sócios.
      if (data && (total > 0 || entrada > 0 || valoresDosSocios.some((s) => s.valor > 0))) {
        ignoradas.push({ onde: `aba "${nome}", linha ${i + 1}`, motivo: 'tem valor mas não tem nome de cliente' });
      }
      continue;
    }

    if (total <= 0 && entrada <= 0 && valoresDosSocios.every((s) => s.valor <= 0)) {
      ignoradas.push({ onde: `aba "${nome}", linha ${i + 1}`, motivo: `${cliente}: sem valor nenhum` });
      continue;
    }

    resultado.push({
      aba: nome,
      linha: i + 1,
      cliente,
      data,
      total: centavos(total),
      entrada: centavos(entrada),
      restante: restanteBruto === null ? null : centavos(restanteBruto),
      status: col.status >= 0 ? texto(brutas[col.status]).trim() : '',
      socios: valoresDosSocios.filter((s) => s.valor > 0).map((s) => ({ ...s, valor: centavos(s.valor) })),
    });
  }

  if (achouSaldo && (saldo.banco || saldo.especie || saldo.investido)) saldos = { ...saldo, aba: nome };
  return {
    linhas: resultado,
    saldos,
    ignoradas,
    outros,
    colunasSemTitulo: [...semTitulo].map(([j, n]) => ({ aba: nome, coluna: letraDaColuna(j), linhas: n })),
  };
}

/** Todas as abas de caixa. O saldo vale o da aba de ano mais alto que tiver. */
export function lerCaixa(abas: { nome: string; linhas: unknown[][] }[]): CaixaLido {
  const lidas = abas.map((a) => lerAbaDoCaixa(a.nome, a.linhas));
  const comSaldo = lidas
    .map((l, i) => ({ saldos: l.saldos, ano: Number(/(\d{4})/.exec(abas[i].nome)?.[1] ?? 0) }))
    .filter((x) => x.saldos)
    .sort((a, b) => b.ano - a.ano);
  return {
    linhas: lidas.flatMap((l) => l.linhas),
    saldos: comSaldo[0]?.saldos ?? null,
    ignoradas: lidas.flatMap((l) => l.ignoradas),
    outros: lidas.flatMap((l) => l.outros),
    colunasSemTitulo: lidas.flatMap((l) => l.colunasSemTitulo),
  };
}

export async function lerArquivoDeCaixa(arquivo: File): Promise<CaixaLido> {
  const { default: ExcelJS } = await import('exceljs');
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.load(await arquivo.arrayBuffer());
  const abas = livro.worksheets.map((aba) => {
    const linhas: unknown[][] = [];
    aba.eachRow({ includeEmpty: true }, (linha, n) => {
      const valores: unknown[] = [];
      linha.eachCell({ includeEmpty: true }, (c, col) => {
        valores[col - 1] = c.value;
      });
      linhas[n - 1] = valores;
    });
    return { nome: aba.name, linhas };
  });
  const lido = lerCaixa(abas);
  if (!lido.linhas.length) {
    throw new Error('Não achei eventos na planilha. Ela precisa da linha de títulos com NOMES e VALOR TOTAL.');
  }
  return lido;
}

// -------------------------------------------------------------- o plano ---

export type ItemDoPlano = {
  origem: LinhaDoCaixa;
  /** Evento que já existe no app, quando casou. */
  existente: Orcamento | null;
  /** Evento a criar, quando não casou. */
  novo: Orcamento | null;
  lancamentos: Lancamento[];
  avisos: string[];
};

/**
 * Mesmo evento, escrito diferente: "ARIELE" na planilha de caixa e "ARIELLE"
 * no orçamento. Mesma data e o começo do nome bate.
 */
function mesmoEvento(o: Orcamento, l: LinhaDoCaixa) {
  if (!l.data || o.data !== l.data) return false;
  const a = normalizar(o.cliente).replace(/[^a-z0-9]/g, '');
  const b = normalizar(l.cliente).replace(/[^a-z0-9]/g, '');
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a) || a.slice(0, 5) === b.slice(0, 5);
}

/**
 * O que a importação vai fazer, linha a linha, antes de fazer.
 *
 * `inicioDoControle` é a data do saldo inicial: todo pagamento importado
 * fica no dia anterior a ela (ou no dia do evento, se for antes), para não
 * somar de novo o que já está no saldo.
 */
export function planejarImportacao(
  lido: CaixaLido,
  existentes: Orcamento[],
  lancamentosExistentes: Lancamento[],
  contaDosRecebimentos: Conta,
  categorias: Categoria[],
  inicioDoControle: string,
  hoje: string,
): ItemDoPlano[] {
  const categoria = (grupo: Categoria['grupo'], tipo: Categoria['tipo']) =>
    categorias.find((c) => c.ativo && c.grupo === grupo && c.tipo === tipo)?.id ?? null;
  const catEvento = categoria('receita', 'entrada');
  const catProlabore = categoria('prolabore', 'saida');
  const vespera = diasAntes(inicioDoControle, 1);
  const pagoEm = (data: string) => (data && data < vespera ? data : vespera);

  return lido.linhas.map((origem) => {
    const avisos: string[] = [];
    const existente = existentes.find((o) => mesmoEvento(o, origem)) ?? null;
    const passou = !!origem.data && origem.data < hoje;
    const realizado = /realiz|^ok$/i.test(origem.status) || passou;

    const novo = existente
      ? null
      : {
          ...eventoExterno({
            cliente: origem.cliente,
            data: origem.data,
            convidados: 0,
            valor: origem.total,
            situacao: realizado ? 'realizado' : 'confirmado',
            observacoes: `Importado do controle de caixa, aba "${origem.aba}".`,
          }),
        };
    const eventoId = existente?.id ?? novo!.id;
    if (!origem.data) avisos.push('sem data');
    if (origem.total <= 0) avisos.push('sem valor total na planilha');
    if (existente && Math.abs((existente.valorFechado ?? origem.total) - origem.total) > 0.01 && existente.valorFechado != null) {
      avisos.push(`no app o valor é outro`);
    }

    /*
      Quanto já entrou. A planilha diz a entrada; quando o restante está
      zerado e o evento já passou, foi pago inteiro. Restante zerado em evento
      futuro é só célula sem fórmula, e vale a entrada.
    */
    // Restante vazio em evento que aconteceu também é quitado: nas abas antigas
    // a coluna nem sempre foi preenchida, e o status diz "ok".
    const quitado = origem.total > 0 && (origem.restante === null || origem.restante <= 0.009) && realizado;
    const recebido = quitado ? origem.total : origem.entrada;

    const jaTemEntrada = lancamentosExistentes.some((l) => l.eventoId === eventoId && l.tipo === 'entrada');
    const jaTemProlabore = lancamentosExistentes.some(
      (l) => l.eventoId === eventoId && l.tipo === 'saida' && l.categoriaId === catProlabore,
    );

    const lancamentos: Lancamento[] = [];
    if (recebido > 0 && !jaTemEntrada) {
      lancamentos.push(
        lancamentoNovo('entrada', {
          descricao: `${quitado ? 'Pagamento' : 'Entrada'} ${origem.cliente}`,
          valor: recebido,
          vencimento: pagoEm(origem.data),
          pagoEm: pagoEm(origem.data),
          contaId: contaDosRecebimentos.id,
          categoriaId: catEvento,
          eventoId,
          observacoes: 'Importado do controle de caixa.',
        }),
      );
    } else if (recebido > 0) {
      avisos.push('recebimento já lançado, não repete');
    }

    if (!jaTemProlabore) {
      for (const s of origem.socios) {
        lancamentos.push(
          lancamentoNovo('saida', {
            descricao: `Pró-labore ${s.pessoa}, ${origem.cliente}`,
            valor: s.valor,
            vencimento: origem.data || hoje,
            pagoEm: passou ? pagoEm(origem.data) : '',
            contaId: passou ? contaDosRecebimentos.id : null,
            categoriaId: catProlabore,
            eventoId,
            pessoa: s.pessoa,
            observacoes: 'Importado do controle de caixa.',
          }),
        );
      }
    } else if (origem.socios.length) {
      avisos.push('pró-labore já lançado, não repete');
    }

    return { origem, existente, novo, lancamentos, avisos };
  });
}

// ------------------------------------------------------------ pendências ---

export type PendenciaNova = { titulo: string; detalhe: string; eventoId: string | null; valor: number | null };

/**
 * O que a importação não sabe resolver sozinha, como lista para o Alan
 * conferir e responder dentro do app. Antes isso ia por mensagem e se perdia.
 */
export function pendenciasDaImportacao(lido: CaixaLido, plano: ItemDoPlano[], nomeDoArquivo: string, hoje: string): PendenciaNova[] {
  const r: PendenciaNova[] = [];
  const quando = (d: string) => (d ? d.split('-').reverse().join('/') : 'sem data');
  const real = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  if (lido.saldos) {
    r.push({
      titulo: 'Conferir os saldos das contas com o extrato',
      detalhe: `Vieram da aba "${lido.saldos.aba}" da planilha: banco ${real(lido.saldos.banco)}, espécie ${real(lido.saldos.especie)}, investido ${real(lido.saldos.investido)}. Se o extrato de hoje mostrar outro número, use "Conferir com o extrato" em Contas e importar.`,
      eventoId: null,
      valor: null,
    });
  }

  for (const o of lido.outros) {
    r.push({
      titulo: `O que é "${o.rotulo}" (${real(o.valor)})?`,
      detalhe: `Está no resumo da aba "${o.aba}" e é descontado do caixa na planilha, mas não é evento nem saldo. Se for uma conta a pagar ou um dinheiro reservado, lance em "A pagar" para o caixa livre ficar certo.`,
      eventoId: null,
      valor: o.valor,
    });
  }

  for (const c of lido.colunasSemTitulo) {
    r.push({
      titulo: `O que marca a coluna ${c.coluna} da aba "${c.aba}"?`,
      detalhe: `É uma coluna sem título com números em ${c.linhas} linhas. Ela não foi importada.`,
      eventoId: null,
      valor: null,
    });
  }

  for (const p of plano) {
    const eventoId = p.existente?.id ?? p.novo?.id ?? null;
    const recebido = p.lancamentos.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0);
    const falta = centavos(p.origem.total - recebido);
    if (p.origem.data && p.origem.data < hoje && falta > 0.009 && p.origem.total > 0) {
      r.push({
        titulo: `${p.origem.cliente} (${quando(p.origem.data)}) pagou o restante?`,
        detalhe: `O evento já aconteceu e a planilha mostra ${real(falta)} ainda a receber. Se foi pago, registre o recebimento em "A receber"; se não, é cobrança atrasada.`,
        eventoId,
        valor: falta,
      });
    }
    if (p.origem.total <= 0) {
      r.push({
        titulo: `${p.origem.cliente} (${quando(p.origem.data)}) está sem valor total`,
        detalhe: `A planilha tem entrada de ${real(p.origem.entrada)}, mas o valor do evento está zerado. Abra o evento e preencha o valor fechado.`,
        eventoId,
        valor: null,
      });
    }
    for (const a of p.avisos.filter((x) => /valor é outro/.test(x))) {
      r.push({ titulo: `${p.origem.cliente} (${quando(p.origem.data)}): ${a}`, detalhe: 'Confira qual dos dois valores vale.', eventoId, valor: null });
    }
  }

  for (const x of lido.ignoradas) {
    r.push({
      titulo: `Ficou de fora: ${x.motivo}`,
      detalhe: `Na planilha: ${x.onde}. Se era um evento de verdade, lance pelo app.`,
      eventoId: null,
      valor: null,
    });
  }

  return r.map((p) => ({ ...p, detalhe: `${p.detalhe} (Importação de "${nomeDoArquivo}".)` }));
}
