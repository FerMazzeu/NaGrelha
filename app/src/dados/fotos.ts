import { ehImagem, prepararAnexo } from '../midia';
import { supabase } from '../integrations/supabase/client';

/**
 * Foto do item no cardápio do cliente.
 *
 * Bucket PÚBLICO `cardapio` (ver supabase/sql/014): o cliente abre o link sem
 * login, e link assinado ele não tem como pedir. O banco guarda o caminho, e a
 * URL se monta aqui.
 */

const BUCKET = 'cardapio';

/** A URL que o navegador abre. Vazio quando não tem foto. */
export function urlDaFoto(caminho: string | undefined) {
  if (!caminho) return '';
  return supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
}

/**
 * Sobe a foto e devolve o caminho para gravar no item.
 *
 * Passa pelo mesmo preparo das fotos do assistente: foto de celular tem 4 MB
 * e 4000 px, e o cliente abre o cardápio no 4G. O nome leva a hora, então
 * trocar a foto gera um arquivo novo e o celular não mostra a antiga do cache.
 */
export async function enviarFoto(itemId: string, arquivo: File): Promise<string> {
  if (!ehImagem(arquivo.type)) throw new Error('Escolha uma foto (JPG ou PNG).');
  const pronta = await prepararAnexo(arquivo);
  if (!/^image\/(jpeg|png|webp)$/.test(pronta.mime)) {
    // HEIC do iPhone, quando o navegador não converte sozinho.
    throw new Error('Esse formato de foto não abre no navegador. Mande em JPG ou PNG.');
  }
  const corpo = await (await fetch(pronta.dados)).blob();
  const extensao = pronta.mime === 'image/png' ? 'png' : pronta.mime === 'image/webp' ? 'webp' : 'jpg';
  const caminho = `${itemId}/${Date.now()}.${extensao}`;
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, corpo, { contentType: pronta.mime });
  if (error) throw error;
  return caminho;
}

/** Tira o arquivo antigo do bucket. Falhar aqui só deixa lixo, nunca quebra. */
export async function apagarFoto(caminho: string | undefined) {
  if (!caminho) return;
  await supabase.storage.from(BUCKET).remove([caminho]).catch(() => undefined);
}
