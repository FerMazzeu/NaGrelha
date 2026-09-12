// Na Grelha — geracao de imagem via OpenRouter, salva no bucket `midias`.
//
// Serve para o que a Erica faz de ambientacao e para post de Instagram: gerar
// referencia visual de mesa, montagem de prato e arte de divulgacao.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODELO_PADRAO = 'google/gemini-2.5-flash-image';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** A imagem volta como data URL. Vira bytes para ir ao storage. */
function bytesDaDataUrl(dataUrl: string) {
  const virgula = dataUrl.indexOf(',');
  const mime = /data:(.*?);base64/.exec(dataUrl.slice(0, virgula))?.[1] ?? 'image/png';
  const binario = atob(dataUrl.slice(virgula + 1));
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return { bytes, mime };
}

const extensao = (mime: string) =>
  mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const autorizacao = req.headers.get('Authorization') ?? '';
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: autorizacao } },
    });

    const { data: usuario } = await supabase.auth.getUser();
    if (!usuario.user) return json({ error: 'nao_autorizado' }, 401);

    const chave = Deno.env.get('OPENROUTER_API_KEY');
    if (!chave) {
      return json({ error: 'sem_chave', message: 'OPENROUTER_API_KEY nao foi configurada.' }, 503);
    }

    const { conversaId, prompt, proporcao, modelo } = await req.json();
    if (typeof prompt !== 'string' || !prompt.trim()) return json({ error: 'prompt_vazio' }, 400);

    const usado = typeof modelo === 'string' && modelo ? modelo : MODELO_PADRAO;
    const pedido = proporcao ? `${prompt}\n\nProporcao desejada: ${proporcao}.` : prompt;

    const resposta = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${chave}`,
        'Content-Type': 'application/json',
        'X-Title': 'Na Grelha',
      },
      body: JSON.stringify({
        model: usado,
        messages: [{ role: 'user', content: pedido }],
        // sem isto o modelo responde texto descrevendo a imagem, nao a imagem
        modalities: ['image', 'text'],
        usage: { include: true },
      }),
    });

    if (!resposta.ok) {
      const texto = await resposta.text().catch(() => '');
      return json({ error: 'openrouter', message: texto.slice(0, 300) || `HTTP ${resposta.status}` }, 502);
    }

    const saida = await resposta.json();
    const mensagem = saida?.choices?.[0]?.message ?? {};
    const urls: string[] = Array.isArray(mensagem.images)
      ? mensagem.images
          .map((im: { image_url?: { url?: string }; url?: string }) => im?.image_url?.url ?? im?.url)
          .filter((u: unknown): u is string => typeof u === 'string')
      : [];

    if (!urls.length) return json({ error: 'sem_imagem', message: 'O modelo nao devolveu imagem.' }, 502);

    // Grava com a service role: o bucket e privado e o caminho ja separa por
    // usuario, entao a policy de leitura da equipe continua valendo.
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { bytes, mime } = bytesDaDataUrl(urls[0]);
    const caminho = `${usuario.user.id}/${Date.now()}.${extensao(mime)}`;

    const { error: erroUpload } = await admin.storage.from('midias').upload(caminho, bytes, {
      contentType: mime,
      upsert: false,
    });
    if (erroUpload) return json({ error: 'upload', message: erroUpload.message }, 500);

    // Bucket privado nao tem URL publica. O link assinado dura o suficiente
    // para a pessoa ver e baixar.
    const { data: assinada } = await admin.storage.from('midias').createSignedUrl(caminho, 60 * 60 * 24 * 7);

    if (conversaId) {
      await supabase.from('mensagens').insert({
        conversa_id: conversaId,
        papel: 'assistant',
        conteudo: typeof mensagem.content === 'string' ? mensagem.content : '',
        imagem_url: caminho,
        modelo: usado,
        custo_usd: saida?.usage?.cost ?? null,
      });
    }

    return json({ caminho, url: assinada?.signedUrl ?? null, custo: saida?.usage?.cost ?? null });
  } catch (e) {
    return json({ error: 'inesperado', message: String(e) }, 500);
  }
});
