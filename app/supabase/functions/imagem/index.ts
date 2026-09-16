// Na Grelha — geracao de imagem via OpenRouter, salva no bucket `midias`.
//
// Serve para o que a Erica faz de ambientacao e para post de Instagram: gerar
// referencia visual de mesa, montagem de prato e arte de divulgacao.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Modelos de imagem, do melhor para o mais barato.
 *
 * O padrao e o Pro porque o cliente reclamou da qualidade, e a diferenca e
 * visivel. Custa perto de quatro vezes mais por imagem, entao a tela deixa
 * escolher o rapido quando e so para ter uma ideia.
 */
const MODELOS_DE_IMAGEM: Record<string, string> = {
  alta: 'google/gemini-3-pro-image',
  rapida: 'google/gemini-2.5-flash-image',
};
const MODELO_PADRAO = MODELOS_DE_IMAGEM.alta;

/**
 * Nenhum modelo de imagem le audio: a entrada deles e imagem e texto.
 *
 * Entao um recado de voz passa antes por este, que ouve e escreve a cena. E o
 * que permite gravar "faz uma foto da mesa de frios com a mesa posta" e sair
 * imagem, em vez de o audio ser descartado em silencio.
 */
const MODELO_DE_ESCUTA = 'google/gemini-2.5-flash';

/** Quantas mensagens anteriores vao junto para o modelo entender o pedido. */
const MAX_HISTORICO = 8;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/**
 * O visual da marca, colado na frente de todo pedido.
 *
 * Sem isto sai imagem de banco de imagem: churrasco claro, fundo branco, tom
 * pastel. O Na Grelha e escuro, com brasa viva e madeira. As cores sao as
 * mesmas do site.
 */
const ESTILO = `Fotografia gastronomica real, do buffet de churrasco Na Grelha com Alan Xavier.
Luz quente de brasa, fundo escuro carvao (#12100e), vermelho de brasa (#c4261d) e dourado (#e3a53f)
nos brilhos, madeira, tabua, ferro e fumaca. Textura de carne selada, sem aparencia de plastico.
Nada de neon, nada de tom pastel, nada de banco de imagem.
Nao escreva texto nem letreiro na imagem, e nao invente logotipo, a nao ser que o pedido peca.
Responda com a imagem. Nao escreva resposta de conversa, nao explique e nao faca perguntas.`;

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

    const { conversaId, prompt, proporcao, modelo, qualidade, anexos, legenda, semRegistroDoPedido } =
      await req.json();

    const lista: { nome?: string; mime?: string; dados?: string }[] = Array.isArray(anexos) ? anexos : [];
    const audios = lista.filter((a) => String(a?.mime ?? '').startsWith('audio/') && a?.dados);
    const escrito = typeof prompt === 'string' ? prompt.trim() : '';

    // Mandar so o audio, sem escrever nada, tem que funcionar: e como a pessoa
    // usa isso no celular.
    if (!escrito && !audios.length) return json({ error: 'prompt_vazio' }, 400);

    const usado =
      typeof modelo === 'string' && modelo
        ? modelo
        : MODELOS_DE_IMAGEM[String(qualidade ?? '')] ?? MODELO_PADRAO;

    /*
      A conversa ate aqui, em texto.

      Sem isto o modelo de imagem recebia UMA frase solta. Quando a pessoa
      escrevia "nao gostei, quero um post nesse tema", ele nao tinha como saber
      qual tema, e devolvia ou uma imagem aleatoria ou um texto de conversa no
      lugar da imagem. Foi exatamente o que o cliente sentiu como "ele esquece
      o contexto".

      E lido ANTES de gravar o pedido novo, senao a ultima mensagem apareceria
      duas vezes: uma no historico e outra no pedido.
    */
    let conversa = '';
    if (conversaId) {
      const { data: recentes } = await supabase
        .from('mensagens')
        .select('papel, conteudo')
        .eq('conversa_id', conversaId)
        .order('criado_em', { ascending: false })
        .limit(MAX_HISTORICO);

      conversa = (recentes ?? [])
        .reverse()
        .map((m: { papel: string; conteudo: string }) => {
          const corpo = (m.conteudo ?? '').trim();
          return corpo ? `${m.papel === 'user' ? 'Pessoa' : 'Assistente'}: ${corpo}` : '';
        })
        .filter(Boolean)
        .join('\n')
        .slice(0, 3000);
    }

    // O assistente rotula o prompt que ele sugere, e a pessoa cola o rotulo
    // junto. Ele nao faz parte da cena a desenhar.
    let limpo = escrito.replace(/^prompt da imagem\s*:?\s*/i, '');

    /*
      Recado de voz vira descricao de cena, antes de chegar no modelo de imagem.

      Duas chamadas em vez de uma, mas nao ha alternativa: os modelos de imagem
      aceitam imagem e texto, e nada mais. A escuta e barata perto da geracao,
      entao o custo disso e ruido.
    */
    if (audios.length) {
      const ouvido = await ouvirAudio(chave, audios, limpo, conversa);
      if (!ouvido) {
        return json(
          { error: 'audio', message: 'Nao consegui entender o audio. Tenta de novo ou escreve o pedido.' },
          502,
        );
      }
      limpo = ouvido;
    }

    const pedido = [
      ESTILO,
      conversa ? `Conversa ate aqui, so para voce entender o pedido:\n${conversa}` : '',
      `Pedido: ${limpo}`,
      proporcao ? `Proporcao desejada: ${proporcao}.` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    // Grava com a service role: o bucket e privado e o caminho ja separa por
    // usuario, entao a policy de leitura da equipe continua valendo.
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    /*
      Imagem de referencia. E o que permite "usa esta logo", "deixa no estilo
      desta foto" ou "troca o fundo desta montagem": o modelo recebe a imagem
      junto do pedido e trabalha em cima dela, em vez de imaginar do zero.
    */
    const guardados: { caminho: string; mime: string; nome: string; dados: string }[] = [];
    for (const a of lista.slice(0, 5)) {
      if (typeof a?.dados !== 'string' || !a.dados.startsWith('data:')) continue;
      const mime = String(a.mime ?? '');
      // Imagem serve de referencia; audio nao serve, mas fica guardado para a
      // conversa mostrar o recado que gerou aquela imagem.
      if (!mime.startsWith('image/') && !mime.startsWith('audio/')) continue;
      const nome = String(a.nome ?? 'anexo').slice(0, 120);
      const caminho = `${usuario.user.id}/anexos/${Date.now()}-${guardados.length}-${nome.replace(/[^\w.-]/g, '_')}`;
      const { bytes } = bytesDaDataUrl(a.dados);
      const { error } = await admin.storage
        .from('midias')
        .upload(caminho, bytes, { contentType: mime, upsert: false });
      if (!error) guardados.push({ caminho, mime, nome, dados: a.dados });
    }
    const referencias = guardados.filter((g) => g.mime.startsWith('image/'));

    // O pedido da pessoa vira mensagem antes da chamada. Se o modelo falhar,
    // a conversa continua mostrando o que foi pedido, em vez de ficar um
    // buraco entre a pergunta anterior e o erro.
    // Quando quem chama e o proprio assistente, pela ferramenta, o pedido da
    // pessoa ja virou mensagem la no chat. Gravar de novo aqui duplicaria a
    // pergunta na conversa.
    if (conversaId && !semRegistroDoPedido) {
      await supabase.from('mensagens').insert({
        conversa_id: conversaId,
        papel: 'user',
        conteudo: `Gerar imagem: ${limpo}`,
        anexos: guardados.map(({ caminho, mime, nome }) => ({ caminho, mime, nome })),
      });
    }

    const partes: unknown[] = referencias.map((r) => ({ type: 'image_url', image_url: { url: r.dados } }));
    partes.push({ type: 'text', text: pedido });

    const resposta = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${chave}`,
        'Content-Type': 'application/json',
        'X-Title': 'Na Grelha',
      },
      body: JSON.stringify({
        model: usado,
        messages: [{ role: 'user', content: partes }],
        // sem isto o modelo responde texto descrevendo a imagem, nao a imagem
        modalities: ['image', 'text'],
        usage: { include: true },
      }),
    });

    if (!resposta.ok) {
      const cru = await resposta.text().catch(() => '');
      console.error('openrouter recusou', resposta.status, cru.slice(0, 800));
      return json({ error: 'openrouter', message: recado(cru) || `HTTP ${resposta.status}` }, 502);
    }

    const saida = await resposta.json();

    /*
      A OpenRouter devolve HTTP 200 com `error` no corpo quando o provider
      recusa: sem credito, limite de uso, pedido barrado por politica. Antes
      isto caia no "o modelo nao devolveu imagem", que esconde o motivo real e
      manda a pessoa procurar bug onde nao tem.
    */
    if (saida?.error) {
      console.error('openrouter respondeu 200 com erro', JSON.stringify(saida.error).slice(0, 800));
      return json({ error: 'openrouter', message: saida.error.message ?? 'o provider recusou o pedido' }, 502);
    }

    const mensagem = saida?.choices?.[0]?.message ?? {};
    const urls: string[] = Array.isArray(mensagem.images)
      ? mensagem.images
          .map((im: { image_url?: { url?: string }; url?: string }) => im?.image_url?.url ?? im?.url)
          .filter((u: unknown): u is string => typeof u === 'string')
      : [];

    if (!urls.length) {
      // O motivo de parada e o texto que veio no lugar da imagem sao o que
      // explica a recusa. Sem eles no log, so sobra adivinhar.
      console.error(
        'sem imagem na resposta',
        JSON.stringify({
          finish_reason: saida?.choices?.[0]?.finish_reason,
          texto: typeof mensagem.content === 'string' ? mensagem.content.slice(0, 400) : null,
          modelo: usado,
        }),
      );
      const explicacao =
        typeof mensagem.content === 'string' && mensagem.content.trim()
          ? `O modelo respondeu com texto em vez de imagem: ${mensagem.content.slice(0, 200)}`
          : `O modelo ${usado} nao devolveu imagem. Isso costuma ser falta de credito na OpenRouter ou pedido barrado.`;
      return json({ error: 'sem_imagem', message: explicacao }, 502);
    }

    const { bytes, mime } = bytesDaDataUrl(urls[0]);
    const caminho = `${usuario.user.id}/${Date.now()}.${extensao(mime)}`;

    const { error: erroUpload } = await admin.storage.from('midias').upload(caminho, bytes, {
      contentType: mime,
      upsert: false,
    });
    if (erroUpload) {
      console.error('upload falhou', erroUpload.message);
      return json({ error: 'upload', message: erroUpload.message }, 500);
    }

    // Bucket privado nao tem URL publica. O link assinado dura o suficiente
    // para a pessoa ver e baixar.
    const { data: assinada } = await admin.storage.from('midias').createSignedUrl(caminho, 60 * 60 * 24 * 7);

    if (conversaId) {
      await supabase.from('mensagens').insert({
        conversa_id: conversaId,
        papel: 'assistant',
        // A legenda do post, quando veio, e o texto que acompanha a imagem no
        // balao. O modelo de imagem as vezes tambem devolve texto solto, que
        // so serve quando nao ha legenda.
        conteudo:
          (typeof legenda === 'string' && legenda.trim()) ||
          (typeof mensagem.content === 'string' ? mensagem.content : ''),
        imagem_url: caminho,
        modelo: usado,
        custo_usd: saida?.usage?.cost ?? null,
      });
      await supabase
        .from('conversas')
        .update({ atualizado_em: new Date().toISOString() })
        .eq('id', conversaId);
    }

    return json({
      caminho,
      url: assinada?.signedUrl ?? null,
      custo: saida?.usage?.cost ?? null,
      // O front mostra o que foi realmente desenhado quando o pedido veio por
      // audio: sem isso a pessoa nao sabe o que ele entendeu.
      pedido: limpo,
    });
  } catch (e) {
    console.error('inesperado', String(e));
    return json({ error: 'inesperado', message: String(e) }, 500);
  }
});

/**
 * Ouve o recado e devolve a cena a desenhar, em uma frase.
 *
 * Devolve string vazia quando nao deu, e quem chama decide o que dizer: erro
 * tecnico de provider no meio de um evento nao ajuda ninguem.
 */
async function ouvirAudio(
  chave: string,
  audios: { nome?: string; mime?: string; dados?: string }[],
  escrito: string,
  conversa: string,
): Promise<string> {
  const partes: unknown[] = [];

  for (const a of audios.slice(0, 2)) {
    const dados = String(a.dados);
    const mime = String(a.mime ?? '');
    const formato = mime.includes('mpeg') || mime.includes('mp3') ? 'mp3' : 'wav';
    partes.push({ type: 'input_audio', input_audio: { data: dados.slice(dados.indexOf(',') + 1), format: formato } });
  }

  const pedidos = [
    conversa ? `Conversa ate aqui:\n${conversa}` : '',
    escrito ? `A pessoa tambem escreveu: ${escrito}` : '',
    'Escreva o que desenhar.',
  ]
    .filter(Boolean)
    .join('\n\n');
  partes.push({ type: 'text', text: pedidos });

  const resposta = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${chave}`,
      'Content-Type': 'application/json',
      'X-Title': 'Na Grelha',
    },
    body: JSON.stringify({
      model: MODELO_DE_ESCUTA,
      messages: [
        {
          role: 'system',
          content: `Voce ouve um recado de voz e escreve a CENA a ser desenhada por um modelo de imagem.
Responda com uma descricao visual de no maximo 60 palavras, em portugues do Brasil.
So a descricao: sem saudacao, sem "claro", sem explicar, sem perguntar nada.
Se o recado pedir alteracao de algo ja falado na conversa, descreva a cena inteira ja alterada,
porque o modelo de imagem nao viu o que veio antes.`,
        },
        { role: 'user', content: partes },
      ],
      max_tokens: 200,
    }),
  });

  if (!resposta.ok) {
    console.error('escuta falhou', resposta.status, (await resposta.text().catch(() => '')).slice(0, 400));
    return '';
  }

  const saida = await resposta.json();
  if (saida?.error) {
    console.error('escuta respondeu 200 com erro', JSON.stringify(saida.error).slice(0, 400));
    return '';
  }

  const texto = saida?.choices?.[0]?.message?.content;
  return typeof texto === 'string' ? texto.trim().slice(0, 1200) : '';
}

/** Tira a mensagem de dentro do JSON de erro da OpenRouter, quando da. */
function recado(cru: string) {
  try {
    const o = JSON.parse(cru);
    return typeof o?.error?.message === 'string' ? o.error.message : cru.slice(0, 300);
  } catch {
    return cru.slice(0, 300);
  }
}
