import { adivinhar } from './adivinha';
import type { Item } from './dominio/tipos';
import type { LinhaLida } from './planilha';

/**
 * O que a planilha muda no catálogo.
 *
 * Isto existe separado da tela porque é a parte que pode dar prejuízo: aplicar
 * uma planilha direto no catálogo do cliente é trocar o preço de oitenta itens
 * com base num arquivo que ninguém conferiu. Aqui a mudança vira uma lista, a
 * tela mostra, e só depois alguém aprova.
 */

export type MudancaDePreco = {
  item: Item;
  de: number;
  para: number;
  linha: number;
};

export type MudancaDeQuantidade = {
  item: Item;
  de: number;
  para: number;
  linha: number;
};

export type ItemNovo = {
  nome: string;
  grupo: string;
  unidade: Item['unidade'];
  preco: number;
  /** Palpite pelo nome e pelo preparo. A tela deixa trocar antes de aplicar. */
  categoria: Item['categoria'];
  rendimento: number;
  porPessoa: number;
  linha: number;
};

export type Comparacao = {
  precos: MudancaDePreco[];
  quantidades: MudancaDeQuantidade[];
  novos: ItemNovo[];
  /** Estava na planilha e no catálogo, sem nada para mudar. */
  iguais: number;
};

export type Opcoes = {
  /** Quantas pessoas o modelo atende. Divide a quantidade para virar por pessoa. */
  pessoas: number;
  atualizarPrecos: boolean;
  atualizarQuantidades: boolean;
  criarNovos: boolean;
};

/**
 * Compara nome ignorando caixa, acento e espaço sobrando.
 *
 * "Pão Frances", "PÃO FRANCES" e "pao frances " são a mesma coisa para quem
 * digita planilha. Tratar como itens diferentes criaria duplicata a cada
 * importação, que é justamente o problema que o cliente já reclamou uma vez.
 */
export const chave = (nome: string, grupo: string) => `${normalizar(nome)}|${normalizar(grupo)}`;

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    // Escapado, e não o caractere combinante em si: no editor ele é invisível
    // e alguém apaga sem ver.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Duas casas: preço de planilha tem centavo, e comparar float cru acusa mudança que não existe. */
const perto = (a: number, b: number) => Math.abs(a - b) < 0.005;

/*
  Quantidade compara por proporção, e não por centavo.

  A planilha arredonda em 100 g, que é como se compra carne. Com 150 g por
  pessoa e 72% de aproveitamento, a compra é 16,666 kg e sai escrita como 16,7.
  Reimportar esse arquivo devolve 150,3 g, e com tolerância de centavo isso
  aparecia como mudança: subir o arquivo sem editar nada mexia no catálogo.

  Um por cento é fino o bastante para pegar erro de digitação e grosso o
  bastante para engolir o arredondamento do próprio formato.
*/
const pertoQuantidade = (a: number, b: number) => Math.abs(a - b) <= Math.max(a, b, 0.001) * 0.01;

/**
 * Quantidade da planilha vira quantidade por pessoa.
 *
 * A pegadinha está no aproveitamento, e ela custa dinheiro de verdade.
 *
 * A planilha do Alan diz o que ele COMPRA: 8 kg de chorizo. O catálogo guarda o
 * que vai NO PRATO, e calcula a compra de volta dividindo pelo aproveitamento.
 * Copiar 8 kg direto como se fosse prato, e depois dar 72% de aproveitamento à
 * picanha, faria o app mandar comprar 11 kg onde ele compra 8.
 *
 * Por isso a conversão multiplica pelo aproveitamento: o prato sai de
 * `compra x aproveitamento`, e a conta de compra devolve exatamente o número
 * que já estava na planilha dele.
 *
 * Em quilo guarda gramas, porque é assim que se fala de carne por pessoa. Em
 * unidade guarda a fração mesmo: 26 pães para 80 pessoas são 0,325 por pessoa.
 */
export function porPessoaDe(linha: LinhaLida, pessoas: number, rendimento = 1) {
  if (pessoas <= 0) return 0;
  const aproveita = rendimento > 0 ? Math.min(1, rendimento) : 1;
  const bruto = (linha.quantidade * aproveita) / pessoas;
  return linha.unidade === 'kg' ? arredondar(bruto * 1000, 1) : arredondar(bruto, 3);
}

const arredondar = (n: number, casas: number) => {
  const f = 10 ** casas;
  return Math.round(n * f) / f;
};

export function compararComCatalogo(lidos: LinhaLida[], catalogo: Item[], opcoes: Opcoes): Comparacao {
  const porChave = new Map(catalogo.map((i) => [chave(i.nome, i.grupo), i]));

  const precos: MudancaDePreco[] = [];
  const quantidades: MudancaDeQuantidade[] = [];
  const novos: ItemNovo[] = [];
  let iguais = 0;

  // A planilha pode repetir o mesmo item em preparos diferentes, e isso é
  // legítimo. O que não pode é a MESMA chave entrar duas vezes como novidade.
  const jaVistos = new Set<string>();

  for (const linha of lidos) {
    const k = chave(linha.nome, linha.grupo);
    const existente = porChave.get(k);

    if (!existente) {
      if (opcoes.criarNovos && !jaVistos.has(k)) {
        jaVistos.add(k);
        const palpite = adivinhar(linha.nome, linha.grupo);
        novos.push({
          nome: linha.nome,
          grupo: linha.grupo,
          unidade: linha.unidade,
          preco: linha.preco,
          categoria: palpite.categoria,
          rendimento: palpite.rendimento,
          /*
            Sem saber o tamanho do modelo, não dá para dizer quanto vai por
            pessoa. Zero é honesto: a tela marca como "falta a quantidade" e
            alguém preenche. Dividir por uma pessoa daria 5,7 kg de chorizo por
            convidado e ninguém desconfiaria olhando a lista.
          */
          porPessoa: opcoes.atualizarQuantidades ? porPessoaDe(linha, opcoes.pessoas, palpite.rendimento) : 0,
          linha: linha.linha,
        });
      }
      continue;
    }

    let mudou = false;

    /*
      Falta de dado não é mudança.

      A planilha de receita vem sem preço, e sem esta guarda o app propunha
      trocar o preço do catálogo por zero: subir um cardápio novo zeraria o
      preço de tudo que já existe. O mesmo vale para a quantidade.
    */
    if (opcoes.atualizarPrecos && linha.preco > 0 && !perto(existente.preco, linha.preco)) {
      precos.push({ item: existente, de: existente.preco, para: linha.preco, linha: linha.linha });
      mudou = true;
    }

    if (opcoes.atualizarQuantidades && linha.quantidade > 0) {
      // O aproveitamento do item que já existe, e não um palpite: é o que
      // mantém a compra igual à da planilha dele.
      const novoPorPessoa = porPessoaDe(linha, opcoes.pessoas, existente.rendimento);
      if (!pertoQuantidade(existente.porPessoa, novoPorPessoa)) {
        quantidades.push({
          item: existente,
          de: existente.porPessoa,
          para: novoPorPessoa,
          linha: linha.linha,
        });
        mudou = true;
      }
    }

    if (!mudou) iguais++;
  }

  return { precos, quantidades, novos, iguais };
}

/**
 * Junta as mudanças de um mesmo item numa gravação só.
 *
 * Preço e quantidade podem ter mudado os dois. Gravar duas vezes o mesmo item
 * é o caminho conhecido para a linha em dobro, e já custou isso uma vez.
 */
export function itensAlterados(c: Comparacao): Item[] {
  const porId = new Map<string, Item>();

  for (const p of c.precos) {
    porId.set(p.item.id, { ...(porId.get(p.item.id) ?? p.item), preco: p.para });
  }
  for (const q of c.quantidades) {
    porId.set(q.item.id, { ...(porId.get(q.item.id) ?? q.item), porPessoa: q.para });
  }

  return [...porId.values()];
}

export const totalDeMudancas = (c: Comparacao) => c.precos.length + c.quantidades.length + c.novos.length;
