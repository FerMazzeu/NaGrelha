import type { Item } from './dominio/tipos';

/**
 * Leitura da planilha do Alan.
 *
 * O formato não é um formato: é o jeito que ele monta a planilha dele, e muda
 * de arquivo para arquivo. Na planilha de 30 pessoas o total está na coluna G,
 * na de 80 está na H. Fixar a coluna quebraria no segundo arquivo.
 *
 * Então a âncora é a UNIDADE, que é a única coisa estável: toda linha de item
 * tem "und.", "kg", "PC" ou "DZ" numa célula, com a quantidade logo à esquerda
 * e o preço logo à direita. Isso vale nos dois arquivos que ele já mandou.
 *
 * O que sai daqui não vira catálogo sozinho. Vai para uma tela de conferência
 * primeiro, porque planilha de terceiro tem erro de digitação, e aplicar direto
 * seria trocar o catálogo do cliente por um palpite.
 */

/**
 * Por que a linha ficou de fora, ou o que faltou nela.
 *
 * "Nao foi lida" sozinho e inutil: o cliente subiu uma planilha com 105 linhas
 * recusadas e nem ele nem eu tinhamos como saber o motivo sem abrir o arquivo.
 */
export type Motivo = 'sem-unidade' | 'sem-quantidade' | 'sem-preco' | 'sem-nada' | 'fora-de-preparo';

export const EXPLICACAO: Record<Motivo, string> = {
  'sem-unidade': 'não achei a unidade (kg, und.) nessa linha',
  'sem-quantidade': 'sem quantidade, entra zerado para você preencher',
  'sem-preco': 'sem preço, entra zerado para você preencher',
  'sem-nada': 'só o nome, entra zerado para você preencher',
  'fora-de-preparo': 'está antes de qualquer preparo, então não sei onde encaixar',
};

export type LinhaLida = {
  nome: string;
  /** O preparo: "PÃO DE ALHO", "CHURRASCO", "MAIONESE". */
  grupo: string;
  unidade: Item['unidade'];
  /** Quantidade para o evento inteiro, não por pessoa. */
  quantidade: number;
  /** Preço por quilo ou por unidade. Zero quando a planilha não trouxe. */
  preco: number;
  /** O que faltou nesta linha, quando faltou. Aparece na conferência. */
  falta?: Motivo;
  /** Em que linha da planilha isso estava, para a conferência. */
  linha: number;
};

export type PlanilhaLida = {
  /**
   * Quantas pessoas o modelo atende.
   *
   * É o que transforma "26 pães" em "0,33 pão por pessoa". Sai do cabeçalho
   * quando ele escreveu, e quando não, a tela pergunta.
   */
  pessoas: number | null;
  itens: LinhaLida[];
  /** Linhas recusadas, com o motivo. Aparecem na conferência. */
  ignoradas: { linha: number; texto: string; motivo: Motivo }[];
};

/** Unidades que aparecem na planilha dele, em qualquer caixa e com ou sem ponto. */
const UNIDADES = ['und', 'un', 'kg', 'g', 'pc', 'dz', 'pct', 'l', 'ml', 'cx', 'lt'];

/**
 * O catálogo só tem quilo e unidade.
 *
 * Pacote, dúzia e caixa viram unidade porque é assim que se compra: "3 pacotes"
 * é uma quantidade de pacotes, e o preço na planilha é o preço do pacote.
 */
function normalizarUnidade(bruto: string): Item['unidade'] | null {
  // Tira qualquer pontuacao do fim, e nao so o ponto: no arquivo dele existe
  // "und." numa linha e "und," na outra, e a virgula fazia o item sumir sem
  // aviso nenhum.
  const limpo = bruto.trim().toLowerCase().replace(/[^a-z]+$/, '');
  if (!limpo) return null;
  if (limpo === 'kg' || limpo === 'quilo' || limpo === 'k') return 'kg';
  return UNIDADES.includes(limpo) ? 'un' : null;
}

/** Linhas de fechamento e de serviço, que não são item de compra. */
const NAO_E_ITEM =
  /^(total|observa|valor|descri|quantidade|convidado|adulto|crian[çc]a|data|cliente|frete|loca|gar[çc]|aux|cozinha|assistente|organiza|churrasqueiro|das|caixa|imposto)/i;

const numero = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    // "R$ 1.234,56" e "1,2" convivem no mesmo arquivo.
    const limpo = v.replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
    const n = Number(limpo);
    return limpo !== '' && Number.isFinite(n) ? n : null;
  }
  return null;
};

const texto = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: unknown };
    if (o.richText) return o.richText.map((r) => r.text).join('');
    if ('result' in o) return texto(o.result);
    if ('text' in o) return String(o.text);
    return '';
  }
  return String(v);
};

/**
 * Cabeçalho de preparo.
 *
 * Na planilha dele o nome do preparo é escrito repetido nas células mescladas
 * da linha, e nunca tem quantidade. É isso que separa "CHURRASCO" de "Chorizo".
 */
function ehCabecalho(celulas: string[]) {
  const cheias = celulas.filter(Boolean);
  if (cheias.length < 2) return false;
  const primeira = cheias[0].trim();
  if (!primeira || NAO_E_ITEM.test(primeira)) return false;
  // Todas iguais: é o mesmo texto espalhado pelas colunas mescladas.
  return cheias.slice(0, 4).every((c) => c.trim() === primeira);
}

/**
 * Lê uma aba já aberta pelo exceljs.
 *
 * Recebe as linhas como matriz de valores crus para poder ser testada sem
 * navegador e sem arquivo: o que importa aqui é a interpretação, não o parser
 * de xlsx.
 */
export function lerLinhas(linhas: unknown[][]): PlanilhaLida {
  const itens: LinhaLida[] = [];
  const ignoradas: { linha: number; texto: string; motivo: Motivo }[] = [];
  let grupo = '';
  let pessoas: number | null = null;
  // Nem toda planilha dele diz "MODELO 30 PESSOAS" no titulo. Todas tem as
  // linhas de adultos e criancas, que servem de segunda fonte.
  let adultos: number | null = null;
  let criancas: number | null = null;

  for (let i = 0; i < linhas.length; i++) {
    const celulas = (linhas[i] ?? []).map(texto);
    const numeroDaLinha = i + 1;
    const juntas = celulas.join(' ').trim();
    if (!juntas) continue;

    // O cabeçalho do modelo traz quantas pessoas ele atende.
    if (pessoas === null) {
      const achado = /modelo\s+(\d{1,4})\s*pessoas/i.exec(juntas);
      if (achado) pessoas = Number(achado[1]);
    }

    const primeiraCelula = celulas.find(Boolean)?.trim() ?? '';
    if (adultos === null && /^adultos?$/i.test(primeiraCelula)) {
      adultos = celulas.map(numero).find((n) => n !== null) ?? null;
    }
    if (criancas === null && /^crian[çc]as?$/i.test(primeiraCelula)) {
      criancas = celulas.map(numero).find((n) => n !== null) ?? null;
    }

    // Depois das observações vem serviço e equipe, que não são compra.
    if (/^observa[çc]/i.test(celulas.find(Boolean)?.trim() ?? '')) break;

    if (ehCabecalho(celulas)) {
      grupo = celulas.find(Boolean)!.trim();
      continue;
    }

    const nome = celulas.find((c) => c.trim())?.trim() ?? '';
    if (!nome || NAO_E_ITEM.test(nome)) continue;

    /*
      Nome que é só um número não é ingrediente.

      A planilha dele tem linhas de subtotal soltas, com o valor numa coluna do
      fim e nada mais. Desde que a leitura passou a aceitar linha sem unidade,
      essas viravam um item chamado "3745.97" dentro do último preparo.
    */
    if (numero(nome) !== null) continue;

    // A unidade é a âncora: quantidade à esquerda, preço à direita.
    const posicaoUnidade = celulas.findIndex((c, j) => j > 0 && normalizarUnidade(c) !== null);

    /*
      Linha sem unidade nenhuma.

      É o que acontece na planilha de receita: o Alan manda os ingredientes do
      tutu de feijão e nada mais, porque a gramatura ele preenche depois. Antes
      isso derrubava o arquivo inteiro, e a tela só dizia "não foi lida".

      Só vale dentro de um preparo. Antes do primeiro cabeçalho estão título,
      data e número de convidados, que não são ingrediente de nada.
    */
    if (posicaoUnidade < 0) {
      if (!grupo) {
        ignoradas.push({ linha: numeroDaLinha, texto: nome, motivo: 'fora-de-preparo' });
        continue;
      }
      itens.push({
        nome,
        grupo,
        unidade: 'un',
        quantidade: 0,
        preco: 0,
        linha: numeroDaLinha,
        falta: 'sem-nada',
      });
      continue;
    }

    const unidade = normalizarUnidade(celulas[posicaoUnidade])!;
    const quantidade = numero(celulas[posicaoUnidade - 1]) ?? 0;
    const preco = celulas.slice(posicaoUnidade + 1).map(numero).find((n) => n !== null) ?? 0;

    if (!grupo) {
      ignoradas.push({ linha: numeroDaLinha, texto: nome, motivo: 'fora-de-preparo' });
      continue;
    }

    /*
      Falta de número não recusa mais a linha.

      Recusar era jogar fora o trabalho da pessoa: o ingrediente existe, só o
      número que não veio. Entra zerado, marcado, e a tela mostra o que falta
      para alguém preencher.
    */
    const falta: Motivo | undefined =
      quantidade <= 0 && preco <= 0
        ? 'sem-nada'
        : quantidade <= 0
          ? 'sem-quantidade'
          : preco <= 0
            ? 'sem-preco'
            : undefined;

    itens.push({
      nome,
      grupo,
      unidade,
      quantidade: Math.max(0, quantidade),
      preco: Math.max(0, preco),
      linha: numeroDaLinha,
      falta,
    });
  }

  /*
    O titulo ganha da soma.

    Na planilha de 80 pessoas as duas fontes discordam: o titulo diz 80 e as
    linhas dizem 70 adultos mais 15 criancas, que sao 85. O titulo e o que ele
    escreveu de proposito, entao vale mais. De qualquer jeito o numero aparece
    editavel na tela antes de mudar qualquer coisa.
  */
  const somadas = (adultos ?? 0) + (criancas ?? 0);
  return { pessoas: pessoas ?? (somadas > 0 ? somadas : null), itens, ignoradas };
}

/**
 * Abre o arquivo e lê a primeira aba que tiver item.
 *
 * O exceljs entra por import dinâmico: são quase mil kilobytes que só fazem
 * sentido baixar quando alguém realmente vai importar uma planilha.
 */
export async function lerArquivo(arquivo: File): Promise<PlanilhaLida> {
  const { default: ExcelJS } = await import('exceljs');
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.load(await arquivo.arrayBuffer());

  let melhor: PlanilhaLida = { pessoas: null, itens: [], ignoradas: [] };

  for (const aba of livro.worksheets) {
    const linhas: unknown[][] = [];
    aba.eachRow({ includeEmpty: true }, (linha, n) => {
      const valores: unknown[] = [];
      linha.eachCell({ includeEmpty: true }, (c, col) => {
        valores[col - 1] = c.value;
      });
      linhas[n - 1] = valores;
    });

    const lida = lerLinhas(linhas);
    if (lida.itens.length > melhor.itens.length) melhor = lida;
  }

  return melhor;
}
