import { situacaoPelaData, type DadosDoEventoExterno } from './dominio/evento-externo';
import type { Orcamento, Situacao, TipoDeEvento } from './dominio/tipos';
import { baixar } from './excel';
import { normalizar } from './formato';
import { numero, texto } from './planilha';

/**
 * Leitura da planilha de eventos já fechados.
 *
 * Ao contrário da planilha de orçamento do Alan, esta é uma lista: uma linha
 * por evento, uma coluna por informação. O que muda de arquivo para arquivo é
 * o NOME e a ORDEM das colunas ("Valor" numa, "Total" na outra; "Pessoas" ou
 * "Convidados"). Então a coluna é achada pelo cabeçalho, e não pela posição.
 *
 * Nada daqui vira evento sozinho: a tela mostra cada linha para conferir antes.
 */

export type Coluna =
  | 'cliente'
  | 'data'
  | 'hora'
  | 'convidados'
  | 'valor'
  | 'tipo'
  | 'situacao'
  | 'local'
  | 'contato'
  | 'observacoes';

/**
 * Os nomes que cada coluna costuma ter, já sem acento e em minúscula.
 *
 * A ordem das colunas aqui é a do modelo para baixar. A primeira coluna da
 * planilha que casar com um campo fica com ele: "Data" antes de "Data do
 * pagamento" é a data do evento.
 */
const NOMES: Record<Coluna, string[]> = {
  cliente: ['cliente', 'nome', 'contratante', 'nome do cliente'],
  data: ['data', 'data do evento', 'dia'],
  hora: ['hora', 'horario'],
  convidados: ['convidados', 'pessoas', 'qtd', 'qtde', 'quantidade', 'n de pessoas', 'numero de convidados', 'adultos'],
  valor: ['valor', 'total', 'preco', 'valor fechado', 'valor total', 'preco final', 'faturamento'],
  tipo: ['tipo', 'tipo de evento', 'evento'],
  situacao: ['situacao', 'status'],
  local: ['local', 'endereco', 'cidade'],
  contato: ['contato', 'telefone', 'whatsapp', 'celular', 'fone'],
  observacoes: ['observacoes', 'observacao', 'obs'],
};

export const COLUNAS_DO_MODELO: { coluna: Coluna; titulo: string; largura: number }[] = [
  { coluna: 'cliente', titulo: 'Cliente', largura: 28 },
  { coluna: 'data', titulo: 'Data', largura: 12 },
  { coluna: 'hora', titulo: 'Hora', largura: 8 },
  { coluna: 'convidados', titulo: 'Convidados', largura: 12 },
  { coluna: 'valor', titulo: 'Valor', largura: 14 },
  { coluna: 'tipo', titulo: 'Tipo', largura: 16 },
  { coluna: 'situacao', titulo: 'Situação', largura: 14 },
  { coluna: 'local', titulo: 'Local', largura: 24 },
  { coluna: 'contato', titulo: 'Contato', largura: 18 },
  { coluna: 'observacoes', titulo: 'Observações', largura: 40 },
];

function colunaDoTitulo(bruto: string): Coluna | null {
  // "Nº de pessoas", "Valor (R$)": pontuação fora, para casar com a lista.
  const t = normalizar(bruto).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  for (const [coluna, nomes] of Object.entries(NOMES) as [Coluna, string[]][]) {
    if (nomes.some((n) => t === n || t.startsWith(`${n} `))) return coluna;
  }
  return null;
}

export type EventoLido = {
  /** Identifica o evento na conferência, mesmo com vários arquivos juntos. */
  chave: string;
  /** Onde ele estava, para quem confere achar no arquivo: "linha 4", "aba X". */
  origem: string;
  dados: DadosDoEventoExterno;
  /** O que veio estranho e merece um olho antes de importar. */
  avisos: string[];
};

export type EventosLidos = {
  eventos: EventoLido[];
  /** Linhas com conteúdo que não viraram evento, e por quê. */
  ignoradas: { onde: string; texto: string; motivo: string }[];
  /** Colunas que o cabeçalho tinha. Ajuda a explicar o que faltou. */
  colunas: Coluna[];
};

/** Nenhuma linha parecia cabeçalho: a tela explica o formato esperado. */
export class SemCabecalho extends Error {
  constructor() {
    super(
      'Não reconheci a planilha. Ela precisa ser uma lista com uma linha de títulos (pelo menos "Cliente" e "Valor" ou "Data"), ou o orçamento do Alan com as linhas de adultos e de valor total.',
    );
  }
}

const ISO = (ano: number, mes: number, dia: number) => {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  // 31/02 vira 03/03 no Date: aqui isso é data errada, e não outra data.
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return d.toISOString().slice(0, 10);
};

/**
 * Data em qualquer dos jeitos que aparece numa planilha brasileira.
 *
 * Célula de data chega do exceljs como `Date` em UTC. Célula de data que
 * perdeu a formatação chega como o número de série do Excel (dias desde
 * 30/12/1899). E texto chega como texto: "15/03/2024", "15/3/24", "2024-03-15".
 */
export function lerData(v: unknown): string | null {
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : ISO(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  }
  if (typeof v === 'number') {
    // De 1955 a 2118. Fora disso não é data, é outro número na coluna errada.
    if (v < 20000 || v > 80000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  const t = texto(v).trim();
  if (!t) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (iso) return ISO(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t);
  if (br) {
    const ano = br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3]);
    return ISO(ano, Number(br[2]), Number(br[1]));
  }
  return null;
}

/** "19:30", "19h", "19h30" ou a hora que o Excel guarda como fração do dia. */
export function lerHora(v: unknown): string {
  const doisDigitos = (n: number) => String(n).padStart(2, '0');
  if (v instanceof Date) return `${doisDigitos(v.getUTCHours())}:${doisDigitos(v.getUTCMinutes())}`;
  if (typeof v === 'number' && v >= 0 && v < 1) {
    const minutos = Math.round(v * 24 * 60);
    return `${doisDigitos(Math.floor(minutos / 60) % 24)}:${doisDigitos(minutos % 60)}`;
  }
  const h = /^(\d{1,2})\s*(?:[:h]\s*(\d{2})?)?$/i.exec(texto(v).trim());
  if (!h || Number(h[1]) > 23) return '';
  return `${doisDigitos(Number(h[1]))}:${h[2] ?? '00'}`;
}

function lerTipo(bruto: string): TipoDeEvento | null {
  const t = normalizar(bruto);
  if (!t) return null;
  if (/casamento|15|quinze|debut|bodas/.test(t)) return 'casamento';
  return 'aniversario';
}

function lerSituacao(bruto: string): Situacao | null {
  const t = normalizar(bruto);
  if (!t) return null;
  if (/realiz|feito|conclu|finaliz|aconteceu/.test(t)) return 'realizado';
  if (/perd|cancel|desist/.test(t)) return 'perdido';
  if (/confirm|fechad|pago|contrat/.test(t)) return 'confirmado';
  if (/orcad|proposta|aguard/.test(t)) return 'orcado';
  return null;
}

/**
 * Célula com fórmula chega do exceljs como `{ formula, result }`. O que
 * interessa é o resultado: o total que alguém somou na planilha é um número.
 */
function semFormula(v: unknown): unknown {
  if (v && typeof v === 'object' && !(v instanceof Date) && 'result' in v) return (v as { result: unknown }).result;
  return v;
}

/** Linha de soma no fim da lista, que não é evento de ninguém. */
const NAO_E_CLIENTE = /^(total|soma|subtotal)\b/i;

/**
 * Lê a matriz de células crua.
 *
 * Separado do arquivo pelo mesmo motivo de `planilha.ts`: o que importa testar
 * é a interpretação, e isso roda sem navegador.
 */
export function lerLinhasDeEventos(linhas: unknown[][], hoje = new Date().toISOString().slice(0, 10)): EventosLidos {
  // O cabeçalho é a primeira linha (das vinte primeiras) que tem cliente e mais
  // alguma coisa útil. Antes dele pode haver título, logo, linha em branco.
  let inicio = -1;
  let mapa = new Map<Coluna, number>();
  for (let i = 0; i < Math.min(linhas.length, 20); i++) {
    const achadas = new Map<Coluna, number>();
    (linhas[i] ?? []).forEach((c, j) => {
      const coluna = colunaDoTitulo(texto(c));
      if (coluna && !achadas.has(coluna)) achadas.set(coluna, j);
    });
    if (achadas.has('cliente') && (achadas.has('valor') || achadas.has('data'))) {
      inicio = i;
      mapa = achadas;
      break;
    }
  }
  if (inicio < 0) throw new SemCabecalho();

  const celula = (linha: unknown[], coluna: Coluna) => {
    const j = mapa.get(coluna);
    return j === undefined ? undefined : semFormula(linha[j]);
  };

  const eventos: EventoLido[] = [];
  const ignoradas: EventosLidos['ignoradas'] = [];

  for (let i = inicio + 1; i < linhas.length; i++) {
    const linha = linhas[i] ?? [];
    const numeroDaLinha = i + 1;
    const juntas = linha.map(texto).join(' ').trim();
    if (!juntas) continue;

    const cliente = texto(celula(linha, 'cliente')).trim();
    if (!cliente) {
      ignoradas.push({ onde: `linha ${numeroDaLinha}`, texto: juntas.slice(0, 60), motivo: 'sem nome de cliente' });
      continue;
    }
    if (NAO_E_CLIENTE.test(cliente)) continue;

    const avisos: string[] = [];

    const brutoData = celula(linha, 'data');
    const data = lerData(brutoData) ?? '';
    if (!data && texto(brutoData).trim()) avisos.push(`não entendi a data "${texto(brutoData).trim()}"`);
    if (!data) avisos.push('sem data');

    const valor = numero(celula(linha, 'valor'));
    if (valor === null || valor <= 0) avisos.push('sem valor');

    const convidados = numero(celula(linha, 'convidados'));
    if (convidados === null || convidados <= 0) avisos.push('sem número de convidados');

    const brutoSituacao = texto(celula(linha, 'situacao'));
    const situacao = lerSituacao(brutoSituacao);
    if (brutoSituacao.trim() && !situacao) avisos.push(`situação "${brutoSituacao.trim()}" não reconhecida`);

    eventos.push({
      chave: `linha-${numeroDaLinha}`,
      origem: `linha ${numeroDaLinha}`,
      avisos,
      dados: {
        cliente,
        data,
        hora: lerHora(celula(linha, 'hora')),
        convidados: Math.max(0, Math.round(convidados ?? 0)),
        valor: Math.max(0, valor ?? 0),
        tipoEvento: lerTipo(texto(celula(linha, 'tipo'))) ?? 'aniversario',
        situacao: situacao ?? situacaoPelaData(data, hoje),
        local: texto(celula(linha, 'local')).trim(),
        contato: texto(celula(linha, 'contato')).trim(),
        observacoes: texto(celula(linha, 'observacoes')).trim(),
      },
    });
  }

  return { eventos, ignoradas, colunas: [...mapa.keys()] };
}

/**
 * Já tem no app um evento do mesmo cliente na mesma data.
 *
 * É o que acontece ao subir a mesma planilha duas vezes, ou uma planilha que
 * tem um evento que alguém já lançou à mão. Sem data não dá para saber, e não
 * conta como repetido.
 */
export function jaExiste(dados: DadosDoEventoExterno, existentes: Orcamento[]) {
  if (!dados.data) return false;
  const nome = normalizar(dados.cliente);
  return existentes.some((o) => o.data === dados.data && normalizar(o.cliente) === nome);
}

/** Texto de CSV em matriz. Ponto e vírgula é o padrão do Excel em português. */
export function lerCsv(conteudo: string): string[][] {
  const semBom = conteudo.replace(/^﻿/, '');
  const primeira = semBom.split(/\r?\n/, 1)[0] ?? '';
  const separador = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ';' : ',';

  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = '';
  let aspas = false;
  for (let i = 0; i < semBom.length; i++) {
    const c = semBom[i];
    if (aspas) {
      if (c === '"' && semBom[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === separador) {
      linha.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && semBom[i + 1] === '\n') i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else campo += c;
  }
  if (campo || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}

/*
  O orçamento do Alan, um arquivo por evento.

  É o mesmo formato que `planilha.ts` lê para o catálogo: título com o nome do
  cliente repetido nas células mescladas, depois "ADULTOS 100", "CRIANÇAS 0",
  "Valor total" e "Data", e embaixo os insumos por preparo e a equipe. Para o
  evento de fora só interessa o cabeçalho e os totais: o cardápio fica na
  planilha, e o que entra no app é quem, quando, quantos e por quanto.

  Um arquivo costuma ter mais de um orçamento, uma aba por versão
  ("ORÇAMENTO MODELO", "ORÇAMENTO ATUALIZADO 14.06"). Vale a última, que é a
  que o cliente fechou.
*/

export type Aba = { nome: string; linhas: unknown[][] };

/** Os números de uma linha depois do rótulo, já sem fórmula. */
const numerosDaLinha = (celulas: unknown[]) =>
  celulas.map(semFormula).map(numero).filter((n): n is number => n !== null);

/** "Na grelha com Alan Xavier ARIELLE 22.05.27.xlsx" → cliente e data. */
export function dadosDoNomeDoArquivo(nome: string) {
  const base = nome.replace(/\.[^.]+$/, '');
  const achada = /(\d{1,2})[.\-_](\d{1,2})[.\-_](\d{2}|\d{4})\s*$/.exec(base);
  const data = achada ? lerData(`${achada[1]}/${achada[2]}/${achada[3]}`) : null;
  const cliente = (achada ? base.slice(0, achada.index) : base)
    .replace(/^na\s*grelha(\s+com\s+alan\s+xavier)?/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  return { cliente, data };
}

type OrcamentoDaAba = {
  cliente: string;
  adultos: number | null;
  criancas: number;
  valor: number | null;
  data: string | null;
  duracao: number | null;
  insumos: number | null;
  servico: number | null;
  pagamentos: { data: string | null; valor: number }[];
};

function lerAbaDoAlan(linhas: unknown[][]): OrcamentoDaAba | null {
  const o: OrcamentoDaAba = {
    cliente: '',
    adultos: null,
    criancas: 0,
    valor: null,
    data: null,
    duracao: null,
    insumos: null,
    servico: null,
    pagamentos: [],
  };
  let totalGeral: number | null = null;
  // Coluna do VALOR no bloco "PAGAMENTO", quando a planilha tem um.
  let colunaPagamento = -1;
  let colunaDataPagamento = -1;
  let dentroDoPagamento = false;

  for (let i = 0; i < linhas.length; i++) {
    const brutas = (linhas[i] ?? []).map(semFormula);
    const celulas = brutas.map((c) => texto(c).trim());
    const primeira = celulas.findIndex(Boolean);
    if (primeira < 0) continue;
    const rotulo = normalizar(celulas[primeira]);
    const depois = brutas.slice(primeira + 1);

    // Título: o nome do cliente repetido nas células mescladas, antes dos adultos.
    if (!o.cliente && o.adultos === null) {
      const cheias = celulas.filter(Boolean);
      if (cheias.length >= 2 && cheias.every((c) => c === cheias[0]) && !/modelo\s+\d+\s*pessoas/i.test(cheias[0])) {
        o.cliente = cheias[0];
      }
    }

    if (o.adultos === null && /^adultos?\b/.test(rotulo)) {
      o.adultos = numerosDaLinha([celulas[primeira].replace(/\D+/g, ' ').trim() || null, ...depois])[0] ?? null;
    } else if (/^criancas?\b/.test(rotulo)) {
      o.criancas = numerosDaLinha([celulas[primeira].replace(/\D+/g, ' ').trim() || null, ...depois])[0] ?? 0;
    } else if (o.valor === null && /^valor total/.test(rotulo)) {
      o.valor = numerosDaLinha(depois)[0] ?? null;
    } else if (o.data === null && rotulo === 'data') {
      o.data = depois.map(lerData).find(Boolean) ?? null;
    } else if (/^total geral/.test(rotulo)) {
      totalGeral = numerosDaLinha(depois).at(-1) ?? null;
    } else if (/^total insumos/.test(rotulo)) {
      o.insumos = numerosDaLinha(depois).at(-1) ?? null;
    } else if (/^total servico/.test(rotulo)) {
      o.servico = numerosDaLinha(depois).at(-1) ?? null;
    }

    const duracao = /dura[çc][ãa]o de (\d+)\s*hora/i.exec(celulas.join(' '));
    if (duracao && o.duracao === null) o.duracao = Number(duracao[1]);

    /*
      O bloco de pagamento fica ao lado do cabeçalho, nas colunas H e I:
      "PAGAMENTO", depois "DATA | VALOR", e uma linha por parcela recebida.
      Termina na primeira linha sem valor nessa coluna.
    */
    const posPagamento = celulas.findIndex((c) => /^pagamento/i.test(c));
    if (posPagamento >= 0) dentroDoPagamento = true;
    if (dentroDoPagamento && colunaPagamento < 0) {
      const posValor = celulas.findIndex((c, j) => j > 0 && /^valor\s*$/i.test(c));
      if (posValor >= 0 && celulas.some((c) => /^data$/i.test(c))) {
        colunaPagamento = posValor;
        colunaDataPagamento = celulas.findIndex((c) => /^data$/i.test(c));
        continue;
      }
    }
    if (colunaPagamento >= 0) {
      const valor = numero(brutas[colunaPagamento]);
      if (valor === null || valor <= 0) {
        colunaPagamento = -1;
        dentroDoPagamento = false;
      } else {
        o.pagamentos.push({ data: lerData(brutas[colunaDataPagamento]), valor });
      }
    }
  }

  o.valor = o.valor ?? totalGeral;
  if (o.adultos === null || o.valor === null) return null;
  return o;
}

/**
 * Lê o arquivo de orçamento do Alan como um evento fechado.
 *
 * Devolve nulo quando nenhuma aba tem a cara do orçamento dele: aí o arquivo é
 * outra coisa, e quem chamou explica o formato esperado.
 */
export function lerOrcamentoDoAlan(
  abas: Aba[],
  nomeDoArquivo: string,
  hoje = new Date().toISOString().slice(0, 10),
): EventoLido | null {
  const lidas = abas
    .map((aba) => ({ aba, o: lerAbaDoAlan(aba.linhas) }))
    .filter((x): x is { aba: Aba; o: OrcamentoDaAba } => x.o !== null);
  if (!lidas.length) return null;

  const { aba, o } = lidas[lidas.length - 1];
  const doNome = dadosDoNomeDoArquivo(nomeDoArquivo);
  const avisos: string[] = [];

  const cliente = o.cliente || doNome.cliente;
  const data = o.data ?? doNome.data ?? '';
  if (!data) avisos.push('sem data');
  if (o.valor === null || o.valor <= 0) avisos.push('sem valor');
  if (lidas.length > 1) {
    avisos.push(`o arquivo tem ${lidas.length} orçamentos; usei o último, da aba "${aba.nome.trim()}"`);
  }

  /*
    O que a planilha sabe e o app ainda não guarda em campo próprio vai para as
    observações: o que já foi pago e o custo. É o que o financeiro vai pedir,
    e assim não se perde até lá.
  */
  const notas = [`Importado da planilha "${nomeDoArquivo}", aba "${aba.nome.trim()}".`];
  if (o.pagamentos.length) {
    const pago = o.pagamentos.reduce((s, p) => s + p.valor, 0);
    // Parcela por parcela só quando acrescenta algo: uma só e sem data é o total.
    const detalhar = o.pagamentos.length > 1 || o.pagamentos.some((p) => p.data);
    const parcelas = o.pagamentos
      .map((p) => `${moeda(p.valor)}${p.data ? ` em ${p.data.split('-').reverse().join('/')}` : ''}`)
      .join(', ');
    notas.push(`Já pago: ${moeda(pago)}${detalhar ? ` (${parcelas})` : ''}.`);
  }
  if (o.insumos !== null || o.servico !== null) {
    notas.push(
      `Custo na planilha: insumos ${moeda(o.insumos ?? 0)}, serviço ${moeda(o.servico ?? 0)}.`,
    );
  }

  return {
    chave: 'orcamento',
    origem: `aba "${aba.nome.trim()}"`,
    avisos,
    dados: {
      cliente,
      data,
      convidados: Math.round((o.adultos ?? 0) + o.criancas),
      // A soma do Excel vem com resto de ponto flutuante: 15489.400000000001.
      valor: Math.max(0, Math.round((o.valor ?? 0) * 100) / 100),
      situacao: situacaoPelaData(data, hoje),
      tipoEvento: 'aniversario',
      observacoes: notas.join('\n'),
      duracaoHoras: o.duracao ?? undefined,
    },
  };
}

const moeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/** Todas as abas do .xlsx como matriz de valores crus. */
async function abasDoArquivo(arquivo: File): Promise<Aba[]> {
  const { default: ExcelJS } = await import('exceljs');
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.load(await arquivo.arrayBuffer());
  return livro.worksheets.map((aba) => {
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
}

/**
 * Abre .xlsx ou .csv nos dois formatos que existem: a lista de eventos (uma
 * linha por evento) e o orçamento do Alan (um arquivo por evento).
 *
 * As chaves saem prefixadas com o nome do arquivo, para dar para subir vários
 * de uma vez sem dois eventos com a mesma chave.
 */
export async function lerArquivoDeEventos(arquivo: File): Promise<EventosLidos> {
  const comArquivo = (lidos: EventosLidos): EventosLidos => ({
    ...lidos,
    eventos: lidos.eventos.map((e) => ({ ...e, chave: `${arquivo.name}#${e.chave}` })),
  });

  if (/\.csv$/i.test(arquivo.name) || arquivo.type === 'text/csv') {
    return comArquivo(lerLinhasDeEventos(lerCsv(await arquivo.text())));
  }

  const abas = await abasDoArquivo(arquivo);

  let melhor: EventosLidos | null = null;
  for (const aba of abas) {
    try {
      const lida = lerLinhasDeEventos(aba.linhas);
      if (!melhor || lida.eventos.length > melhor.eventos.length) melhor = lida;
    } catch (e) {
      if (!(e instanceof SemCabecalho)) throw e;
    }
  }
  if (melhor) return comArquivo(melhor);

  const orcamento = lerOrcamentoDoAlan(abas, arquivo.name);
  if (orcamento) return comArquivo({ eventos: [orcamento], ignoradas: [], colunas: [] });

  throw new SemCabecalho();
}

/** A planilha em branco, com as colunas que a leitura reconhece de primeira. */
export async function baixarModeloDeEventos() {
  const { Workbook } = await import('exceljs');
  const livro = new Workbook();
  const aba = livro.addWorksheet('Eventos');
  aba.columns = COLUNAS_DO_MODELO.map((c) => ({ header: c.titulo, width: c.largura }));
  aba.getRow(1).font = { bold: true };
  aba.getColumn(2).numFmt = 'dd/mm/yyyy';
  aba.getColumn(5).numFmt = 'R$ #,##0.00';
  const buffer = await livro.xlsx.writeBuffer();
  baixar(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    'Na Grelha - modelo de eventos.xlsx',
  );
}
