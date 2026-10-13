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
  /** Linha na planilha, para quem confere achar no arquivo. */
  linha: number;
  dados: DadosDoEventoExterno;
  /** O que veio estranho e merece um olho antes de importar. */
  avisos: string[];
};

export type EventosLidos = {
  eventos: EventoLido[];
  /** Linhas com conteúdo que não viraram evento, e por quê. */
  ignoradas: { linha: number; texto: string; motivo: string }[];
  /** Colunas que o cabeçalho tinha. Ajuda a explicar o que faltou. */
  colunas: Coluna[];
};

/** Nenhuma linha parecia cabeçalho: a tela explica o formato esperado. */
export class SemCabecalho extends Error {
  constructor() {
    super(
      'Não achei o cabeçalho. A planilha precisa de uma linha com os títulos das colunas, pelo menos "Cliente" e "Valor" ou "Data".',
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
      ignoradas.push({ linha: numeroDaLinha, texto: juntas.slice(0, 60), motivo: 'sem nome de cliente' });
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
      linha: numeroDaLinha,
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

/** Abre .xlsx ou .csv e lê a primeira aba que tiver cabeçalho de eventos. */
export async function lerArquivoDeEventos(arquivo: File): Promise<EventosLidos> {
  if (/\.csv$/i.test(arquivo.name) || arquivo.type === 'text/csv') {
    return lerLinhasDeEventos(lerCsv(await arquivo.text()));
  }

  const { default: ExcelJS } = await import('exceljs');
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.load(await arquivo.arrayBuffer());

  let melhor: EventosLidos | null = null;
  for (const aba of livro.worksheets) {
    const linhas: unknown[][] = [];
    aba.eachRow({ includeEmpty: true }, (linha, n) => {
      const valores: unknown[] = [];
      linha.eachCell({ includeEmpty: true }, (c, col) => {
        valores[col - 1] = c.value;
      });
      linhas[n - 1] = valores;
    });
    try {
      const lida = lerLinhasDeEventos(linhas);
      if (!melhor || lida.eventos.length > melhor.eventos.length) melhor = lida;
    } catch (e) {
      if (!(e instanceof SemCabecalho)) throw e;
    }
  }
  if (!melhor) throw new SemCabecalho();
  return melhor;
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
