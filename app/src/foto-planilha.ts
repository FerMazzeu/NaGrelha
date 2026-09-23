import { funcao, supabase } from './integrations/supabase/client';
import type { Item } from './dominio/tipos';
import type { LinhaLida, Motivo, PlanilhaLida } from './planilha';

/**
 * Ler a planilha a partir de uma FOTO.
 *
 * O Alan manda tabela fotografada: ele bate a foto da tela do Excel, ou do
 * papel na mão, e joga no grupo. Até aqui isso virava alguém digitando item
 * por item, ou pedir o arquivo de volta e esperar.
 *
 * O `.xlsx` continua sendo lido no navegador, onde é exato e de graça. Isto
 * aqui é só para o que não dá para ler sem enxergar, e o trabalho acontece no
 * servidor porque a chave do modelo não pode ir para o navegador.
 *
 * O que sai daqui tem o mesmo formato do leitor de Excel de propósito: a tela
 * de conferência, a comparação e o "aplicar" não sabem por onde a planilha
 * entrou, e não precisam saber.
 *
 * Nada disso vira catálogo sozinho. Leitura por foto erra — eu mesmo li 1400
 * onde estava 1600 numa tabela de cachê meio tremida — então tudo passa pela
 * mesma tabela de conferência, onde dá para corrigir antes de confirmar.
 */

/** Teto de fotos por leitura. Acima disso a requisição fica lenta e cara. */
export const MAXIMO_DE_FOTOS = 4;

/*
  2200 px, e não os 1600 do assistente.

  O anexo do chat é foto de churrasco, onde detalhe fino não muda a resposta.
  Aqui o detalhe fino É a resposta: a diferença entre 1400 e 1600 são dois
  traços de tinta, e errar isso escreve o preço errado no catálogo. Os
  kilobytes a mais saem bem mais baratos que a conferência manual.
*/
const LADO_MAXIMO = 2200;
const QUALIDADE = 0.92;
const LIMITE_BYTES = 6 * 1024 * 1024;

const lerComoDataUrl = (blob: Blob) =>
  new Promise<string>((ok, erro) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(String(leitor.result));
    leitor.onerror = () => erro(new Error('não consegui ler o arquivo'));
    leitor.readAsDataURL(blob);
  });

const bytesDaDataUrl = (url: string) => Math.floor((url.length - url.indexOf(',') - 1) * 0.75);

/** Reduz a foto para caber no envio, sem nunca aumentar. */
async function prepararFoto(arquivo: File): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(arquivo);
  } catch {
    // Formato que o navegador não decodifica, tipo heic de iPhone. Vai cru: o
    // modelo pode recusar, mas perder o arquivo aqui seria pior.
    const cru = await lerComoDataUrl(arquivo);
    if (bytesDaDataUrl(cru) > LIMITE_BYTES) {
      throw new Error(`"${arquivo.name}" é grande demais e eu não consigo reduzir esse formato.`);
    }
    return cru;
  }

  const maior = Math.max(bitmap.width, bitmap.height);
  const escala = Math.min(1, LADO_MAXIMO / maior);
  const tela = document.createElement('canvas');
  tela.width = Math.round(bitmap.width * escala);
  tela.height = Math.round(bitmap.height * escala);
  tela.getContext('2d')?.drawImage(bitmap, 0, 0, tela.width, tela.height);
  bitmap.close();

  const dados = tela.toDataURL('image/jpeg', QUALIDADE);
  if (bytesDaDataUrl(dados) > LIMITE_BYTES) {
    throw new Error(`"${arquivo.name}" ficou grande demais mesmo reduzida. Tenta fotografar em pedaços.`);
  }
  return dados;
}

/**
 * O que faltou na linha, pelas mesmas regras do leitor de Excel.
 *
 * A função no servidor devolve 0 no que não conseguiu ler, e é aqui que 0 vira
 * um aviso na tela. Sem isto o item entra zerado calado, e alguém descobre na
 * hora de comprar.
 */
function oQueFalta(quantidade: number, preco: number): Motivo | undefined {
  if (quantidade <= 0 && preco <= 0) return 'sem-nada';
  if (quantidade <= 0) return 'sem-quantidade';
  if (preco <= 0) return 'sem-preco';
  return undefined;
}

type ItemDaFoto = {
  nome?: unknown;
  grupo?: unknown;
  unidade?: unknown;
  quantidade?: unknown;
  preco?: unknown;
  linha?: unknown;
};

const numero = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Manda as fotos e devolve a planilha lida.
 *
 * Aceita mais de uma foto porque tabela raramente cabe num enquadramento só: a
 * função é avisada de que são partes da mesma planilha, em ordem.
 */
export async function lerFotos(arquivos: File[]): Promise<PlanilhaLida> {
  const fotos = arquivos.filter((a) => a.type.startsWith('image/')).slice(0, MAXIMO_DE_FOTOS);
  if (!fotos.length) throw new Error('Isso não é uma foto.');

  const imagens = await Promise.all(fotos.map(prepararFoto));

  const { data: sessao } = await supabase.auth.getSession();
  if (!sessao.session) throw new Error('Sua sessão expirou. Entre de novo para ler a foto.');

  const resposta = await fetch(funcao('planilha'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessao.session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ imagens }),
  });

  const corpo = await resposta.json().catch(() => null);

  if (!resposta.ok || corpo?.error) {
    // A mensagem do servidor já vem em português e diz o que fazer. Só o
    // código cru sobraria para quem está com o celular na mão no meio do
    // evento, e isso não ajuda ninguém.
    throw new Error(corpo?.message ?? `A leitura falhou (HTTP ${resposta.status}).`);
  }

  const itens: LinhaLida[] = (Array.isArray(corpo.itens) ? (corpo.itens as ItemDaFoto[]) : [])
    .map((i, indice) => {
      const quantidade = numero(i.quantidade);
      const preco = numero(i.preco);
      return {
        nome: String(i.nome ?? '').trim(),
        grupo: String(i.grupo ?? '').trim() || 'SEM PREPARO',
        unidade: (i.unidade === 'kg' ? 'kg' : 'un') as Item['unidade'],
        quantidade,
        preco,
        // Na foto não existe "linha 37 da planilha". A ordem em que o item
        // aparece é o que a pessoa consegue conferir olhando a foto.
        linha: numero(i.linha) || indice + 1,
        falta: oQueFalta(quantidade, preco),
      };
    })
    .filter((i) => i.nome);

  return { pessoas: numero(corpo.pessoas) || null, itens, ignoradas: [] };
}
