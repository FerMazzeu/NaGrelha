// Na Grelha — chat conversacional via OpenRouter, com streaming.
//
// Imports por https://esm.sh de proposito. Deploy por MCP nao resolve `jsr:`
// nem `npm:`: a funcao sobe com status 200 e morre no boot com 500, sem stack.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Gemini flash porque le imagem E audio na mesma chamada. Trocar por um modelo
// so de texto quebra anexo e transcricao sem dar erro: o modelo simplesmente
// ignora a parte que nao entende.
const MODELO_PADRAO = 'google/gemini-2.5-flash';
const MAX_HISTORICO = 20;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/**
 * Quem o assistente e.
 *
 * Isto e o site do Na Grelha resumido em briefing: a origem, a equipe, o
 * cardapio, o jeito de trabalhar e o tom de voz. Sem isso o assistente
 * responde como uma IA generica que por acaso sabe assar carne, e inventa
 * servico que a casa nao faz.
 *
 * Fonte: src/conteudo.ts do site. Mudou la, muda aqui.
 */
const MARCA = `# Quem voce e

Voce e o assistente interno do Na Grelha com Alan Xavier, um buffet de churrasco de Minas Gerais,
fundado em 2024, que atende de 15 a 300 convidados com estrutura completa no local.

Voce nao fala com o cliente final. Voce fala com a equipe da casa, e ajuda ela a orcar evento,
calcular compra, escrever mensagem para cliente, montar post e resolver duvida de operacao.
Quando a pessoa pedir um texto para o cliente, escreva o texto pronto para copiar e colar.

# A origem

Alan Xavier era o assador das reuniões de amigos. As feiras da cidade foram o primeiro palco
publico, as marmitas de domingo viraram ritual, e um evento de 50 pessoas foi o teste de fogo que
virou profissao. Hoje sao mais de 100 eventos realizados. E uma empresa familiar, e isso importa
no tom: contato proximo, as mesmas pessoas do primeiro contato ate o dia do evento.

# A equipe

- Alan Xavier, churrasqueiro-chefe. Escolhe o corte, comanda a brasa e da o ponto. Consultoria
  tecnica com o cliente: cortes, formato de servico, desenho do evento. WhatsApp (35) 98821-9023.
- Erica, atendimento, ambientacao e confeitaria. E quem atende desde o primeiro contato: orcamento,
  cardapio fechado, data reservada. Tambem cuida da ambientacao (local, mesas, cadeiras, toalhas,
  decoracao, ornamentacao) e da confeitaria da festa. WhatsApp (35) 98863-8687.
- Andre, preparacao e execucao, ao lado do Alan na grelha.
- Isabelle, organizacao e detalhes, junto da Erica.

Orcamento e agenda sao com a Erica. Duvida tecnica de cardapio e execucao e com o Alan.
Instagram: @nagrelha_alanxavier.

# O que a casa entrega

Quatro promessas, nesta ordem:
1. Voce na festa, nao na brasa. A casa assume da churrasqueira acesa ao ultimo corte.
2. Carne no ponto, sempre. Do primeiro ao ultimo convidado.
3. Brasa que chega ate voce. Carvao, grelha, estacao completa e acompanhamentos frescos.
4. Saida limpa. Recolhe tudo e deixa o espaco em ordem.

Cardapio: entradas na brasa (pao de alho com queijo, choripan com chimichurri, batata rustica),
cortes nobres Angus e Nelore (ancho, chorizo, costela, fraldinha, maminha, picanha), massas e
molhos artesanais feitos pela casa, ilha gastronomica e mesa de frios.

Guarnicoes: arroz soltinho, farofinha artesanal com abacaxi e bacon (marca registrada da casa),
maionese e salada tropical. Nada chega pronto de casa: tudo e preparado no local, durante o evento.

Burguer na grelha de carvao, no pao brioche tostado na propria grelha, servido finger food com a
batata rustica. Opcao principal ou complementar, forte em aniversario e festa de 15 anos.

Bebidas (chopp, refrigerante, agua) sao servico contratado a parte.

# Tom de voz da marca

- "Nao vendemos buffet de churrasco. Entregamos uma experiencia."
- "Comida boa feita com o coracao."
- "Isto nao e foto ilustrativa": todas as fotos do perfil sao pratos reais de eventos reais.
- "Cada grama calculada": a casa nao mede carne no olho, e o orcamento e fechado, sem custo oculto.
- Calor humano e familia, sem ser meloso. Confianca construida, presenca do comeco ao fim.

# Identidade visual

Carvao quase preto #12100e no fundo, brasa vermelha #c4261d na acao, dourado #e3a53f no destaque,
creme #f7f2ea no texto. Brasa viva, fumaca, madeira, tabua, ferro. Nada de neon, nada de pastel.

# Como escrever

- Portugues do Brasil, direto, sem enrolacao.
- NUNCA use travessao. Use virgula, dois-pontos ou dois periodos.
- Markdown quando ajudar a ler: lista, tabela, negrito.
- Dinheiro em reais, peso em kg ou g.
- Nao invente servico, preco ou prazo que a casa nao tem. Se nao souber, diga o que falta saber.`;

/**
 * O que ele consegue fazer sozinho.
 *
 * Sem este bloco o modelo se comporta como consultor de marketing: pede
 * briefing, escreve "descricao para o designer" e devolve duas mil palavras
 * para a pessoa colar num gerador de imagem, que e o pior prompt possivel.
 *
 * Declarar a ferramenta no corpo da chamada nao basta: o modelo precisa estar
 * instruido a chama-la em vez de descrever a imagem por escrito.
 */
const FERRAMENTAS = `# O que voce faz sozinho

Voce TEM uma ferramenta chamada gerar_imagem. Quando a pessoa pedir uma imagem, uma foto, uma arte,
um post ou disser "faz uma imagem", CHAME A FERRAMENTA. Nao descreva a imagem em texto, nao peca
para a pessoa apertar botao nenhum, e nunca escreva "descricao para o designer": nao existe
designer, existe voce e a ferramenta.

Como chamar bem:
- descricao: a cena, em no maximo 60 palavras, em frases diretas. Diga o que aparece, a luz e o
  enquadramento. Nada de codigo de cor, nada de lista de elementos, nada de justificativa.
- legenda: so quando a pessoa pediu um post. Ai escreva a legenda pronta para copiar, com as
  hashtags no fim. Se ela so pediu a imagem, deixe vazio.

Se o pedido for para MUDAR uma imagem que voce ja fez, escreva a cena inteira de novo, ja alterada.
A ferramenta nao viu a imagem anterior.

NAO chame a ferramenta quando ninguem pediu imagem. Conta de gramatura, texto para cliente, duvida
de operacao e escala de equipe se respondem por escrito. Cada imagem custa dinheiro de verdade da
casa, entao na duvida escreva a resposta e pergunte se a pessoa quer a imagem tambem.

Voce tambem le foto, audio e arquivo que a pessoa anexar. Audio voce entende direto: responda o que
foi falado, sem pedir para a pessoa repetir por escrito.

# Nao entreviste

Faca o trabalho com o que voce tem. Faltou detalhe, escolha o mais provavel, entregue pronto, e
diga em UMA linha no fim o que voce assumiu. Devolver uma lista de perguntas antes de comecar e a
pior resposta possivel: quem esta no meio de um evento nao para para responder formulario.
Pergunte so quando a resposta mudaria tudo, e mesmo assim entregue uma versao junto.

# Tamanho

Responda no tamanho da pergunta. Duvida rapida, resposta de duas linhas. Nao repita o pedido de
volta antes de responder, e nao feche com um resumo do que voce acabou de escrever.`;

const CONTA = `# A conta do churrasco

- Peso no prato nao e peso de compra. Cada corte tem um aproveitamento, a fracao do que se compra
  e chega ao prato depois do osso, da gordura aparada e da perda na brasa. Costela com osso
  aproveita perto de 50%, linguica 85%, picanha 72%, coxa e sobrecoxa 62%.
- comprar = (gramas no prato x pessoas) / aproveitamento.
- Crianca conta pela faixa etaria: o percentual da faixa vale para o quanto ela come E para o
  quanto ela paga.
- Carvao sai do peso de carne crua, perto de 0,5 kg de carvao por kg de carne.
- O padrao da casa e 350 a 400 g de carne por pessoa quando ha guarnicao.

A gramatura por pessoa e numero interno, de compra. Ela nao vai na proposta do cliente.

Quando houver um evento aberto, os numeros reais dele vem no contexto abaixo. Use esses numeros,
nao invente outros. Se faltar dado para responder, diga o que falta.`;

const INSTRUCOES = `${MARCA}\n\n${FERRAMENTAS}\n\n${CONTA}`;

/**
 * A ferramenta de imagem.
 *
 * E isto que tira o botao do caminho: em vez de a pessoa ter que armar o modo
 * antes de escrever, ela escreve "faz uma imagem da mesa de frios" e o modelo
 * decide chamar. O botao continua existindo para quando ela ja sabe que quer
 * uma imagem e nao quer gastar uma volta de conversa.
 */
const FERRAMENTA_IMAGEM = {
  type: 'function',
  function: {
    name: 'gerar_imagem',
    description:
      'Gera uma imagem para o Na Grelha. Use quando a pessoa pedir imagem, foto, arte ou post. ' +
      'Nao use para responder pergunta, calcular gramatura ou escrever texto.',
    parameters: {
      type: 'object',
      properties: {
        descricao: {
          type: 'string',
          description: 'A cena a desenhar, no maximo 60 palavras, em frases diretas.',
        },
        legenda: {
          type: 'string',
          description: 'Legenda do post com hashtags, quando a pessoa pediu um post. Senao, vazio.',
        },
      },
      required: ['descricao'],
    },
  },
};

/** Tipos que o modelo realmente le. O resto vira aviso, e nao anexo silencioso. */
const AUDIO = /^audio\//;
const IMAGEM = /^image\//;
const TEXTO = /^(text\/|application\/(json|csv))/;

type Anexo = { nome?: string; mime?: string; dados?: string };

/** Data URL para bytes, para gravar no bucket. */
function bytesDaDataUrl(dataUrl: string) {
  const virgula = dataUrl.indexOf(',');
  const binario = atob(dataUrl.slice(virgula + 1));
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

const so64 = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(',') + 1);

/**
 * O formato de audio que a OpenRouter aceita e so `wav` ou `mp3`.
 *
 * O navegador grava em webm/opus, entao o front converte antes de mandar. Se
 * chegar outro formato aqui, dizer isso e melhor que mandar e receber um erro
 * de provider que ninguem entende.
 */
function formatoDeAudio(mime: string) {
  if (mime.includes('wav') || mime.includes('wave')) return 'wav';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  return null;
}

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
      return json(
        { error: 'sem_chave', message: 'OPENROUTER_API_KEY nao foi configurada no projeto.' },
        503,
      );
    }

    const { conversaId, mensagem, contexto, modelo, anexos, qualidade } = await req.json();
    const texto = typeof mensagem === 'string' ? mensagem.trim() : '';
    const lista: Anexo[] = Array.isArray(anexos) ? anexos.slice(0, 6) : [];

    // Mandar so um audio, sem escrever nada, tem que funcionar: e como a
    // pessoa usa isso no celular, no meio do evento.
    if (!conversaId || (!texto && !lista.length)) return json({ error: 'requisicao_invalida' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Guarda os anexos antes de falar com o modelo: se o modelo falhar, o
    // arquivo que a pessoa mandou nao pode sumir junto.
    const guardados: { caminho: string; mime: string; nome: string; dados: string }[] = [];
    for (const a of lista) {
      if (typeof a?.dados !== 'string' || !a.dados.startsWith('data:')) continue;
      const mime = a.mime ?? 'application/octet-stream';
      const nome = (a.nome ?? 'arquivo').slice(0, 120);
      const caminho = `${usuario.user.id}/anexos/${Date.now()}-${guardados.length}-${nome.replace(/[^\w.-]/g, '_')}`;
      const { error } = await admin.storage
        .from('midias')
        .upload(caminho, bytesDaDataUrl(a.dados), { contentType: mime, upsert: false });
      if (!error) guardados.push({ caminho, mime, nome, dados: a.dados });
    }

    // A RLS ja garante que a conversa e desta pessoa. Se nao for, o insert
    // falha aqui mesmo, e nao depois.
    const { error: erroInsert } = await supabase.from('mensagens').insert({
      conversa_id: conversaId,
      papel: 'user',
      conteudo: texto,
      // O `dados` nao vai para o banco: o arquivo ja esta no bucket, e base64
      // dentro de uma linha de mensagem incharia a tabela sem necessidade.
      anexos: guardados.map(({ caminho, mime, nome }) => ({ caminho, mime, nome })),
    });
    if (erroInsert) return json({ error: 'conversa_invalida', message: erroInsert.message }, 403);

    const { data: recentes } = await supabase
      .from('mensagens')
      .select('papel, conteudo')
      .eq('conversa_id', conversaId)
      .order('criado_em', { ascending: false })
      .limit(MAX_HISTORICO);
    const historico = (recentes ?? []).reverse();

    // O historico vai so como texto. Reenviar toda imagem antiga a cada turno
    // multiplicaria o custo da conversa inteira; o anexo vale para o turno em
    // que foi mandado, e o assistente descreve o que viu na resposta.
    // A ultima e a que acabou de ser gravada: ela volta montada em partes,
    // com os arquivos, logo abaixo.
    const anteriores = historico.slice(0, -1).map((m: { papel: string; conteudo: string }) => ({
      role: m.papel,
      content: m.conteudo,
    }));

    /*
      A ultima mensagem e montada em partes porque so ela carrega arquivo.
      Imagem vai como `image_url`, audio como `input_audio` (o modelo transcreve
      e responde na mesma chamada, sem servico de transcricao separado), e
      arquivo de texto vai decodificado dentro do proprio prompt.
    */
    const partes: unknown[] = [];
    const recados: string[] = [];

    for (const g of guardados) {
      const bruto = g.dados;

      if (IMAGEM.test(g.mime)) {
        partes.push({ type: 'image_url', image_url: { url: bruto } });
        continue;
      }
      if (AUDIO.test(g.mime)) {
        const formato = formatoDeAudio(g.mime);
        if (!formato) {
          recados.push(`(o audio "${g.nome}" veio num formato que o modelo nao le)`);
          continue;
        }
        partes.push({ type: 'input_audio', input_audio: { data: so64(bruto), format: formato } });
        continue;
      }
      if (TEXTO.test(g.mime)) {
        const conteudo = new TextDecoder().decode(bytesDaDataUrl(bruto)).slice(0, 20000);
        recados.push(`Conteudo do arquivo "${g.nome}":\n\n${conteudo}`);
        continue;
      }
      recados.push(`(a pessoa anexou "${g.nome}", que este modelo nao consegue abrir)`);
    }

    const escrito = [texto, ...recados].filter(Boolean).join('\n\n');
    if (escrito) partes.push({ type: 'text', text: escrito });

    const mensagens = [
      { role: 'system', content: contexto ? `${INSTRUCOES}\n\n## Evento aberto\n${contexto}` : INSTRUCOES },
      ...anteriores,
      { role: 'user', content: partes.length > 1 || guardados.length ? partes : escrito },
    ];

    const usado = typeof modelo === 'string' && modelo ? modelo : MODELO_PADRAO;

    const resposta = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${chave}`,
        'Content-Type': 'application/json',
        'X-Title': 'Na Grelha',
      },
      body: JSON.stringify({
        model: usado,
        messages: mensagens,
        stream: true,
        tools: [FERRAMENTA_IMAGEM],
        // Sem isto nao existe conversa sobre custo de IA, so palpite.
        usage: { include: true },
      }),
    });

    if (!resposta.ok || !resposta.body) {
      const cru = await resposta.text().catch(() => '');
      console.error('openrouter recusou', resposta.status, cru.slice(0, 600));
      return json({ error: 'openrouter', message: cru.slice(0, 300) || `HTTP ${resposta.status}` }, 502);
    }

    let completo = '';
    let motivoDeParada = '';
    /** Argumentos da ferramenta chegam picados, e sao montados por indice. */
    const pedacosDaFerramenta = new Map<number, string>();
    let custo: number | null = null;
    let entrada: number | null = null;
    let saida: number | null = null;

    const fluxo = new ReadableStream({
      async start(controle) {
        const leitor = resposta.body!.getReader();
        const decodificador = new TextDecoder();
        const codificador = new TextEncoder();
        let sobra = '';

        /*
          Escrever na tela nao pode derrubar o trabalho.

          Quando a pessoa sai da conversa, o navegador fecha o fluxo, e o
          `enqueue` seguinte estoura. Antes esse estouro caia no catch la
          embaixo e pulava o insert: a resposta era gerada, paga pela casa, e
          jogada fora. Quem voltava para a conversa encontrava a propria
          pergunta sozinha.

          Agora o erro morre aqui. O modelo continua sendo lido ate o fim e a
          mensagem e gravada de qualquer jeito.
        */
        let clienteFoiEmbora = false;
        const enviar = (obj: unknown) => {
          if (clienteFoiEmbora) return;
          try {
            controle.enqueue(codificador.encode(`data: ${JSON.stringify(obj)}\n\n`));
          } catch {
            clienteFoiEmbora = true;
          }
        };

        try {
          while (true) {
            const { done, value } = await leitor.read();
            if (done) break;

            sobra += decodificador.decode(value, { stream: true });
            const linhas = sobra.split('\n');
            sobra = linhas.pop() ?? '';

            for (const linha of linhas) {
              const corte = linha.trim();
              if (!corte.startsWith('data:')) continue;
              const carga = corte.slice(5).trim();
              if (carga === '[DONE]') continue;

              try {
                const evento = JSON.parse(carga);
                // A OpenRouter tambem manda erro DENTRO do stream, ja com 200
                // na resposta. Sem isto a conversa termina em silencio.
                if (evento?.error) {
                  console.error('erro no meio do stream', JSON.stringify(evento.error).slice(0, 600));
                  enviar({ tipo: 'erro', mensagem: evento.error.message ?? 'o modelo falhou no meio da resposta' });
                  continue;
                }
                const pedaco = evento?.choices?.[0]?.delta?.content;
                if (typeof pedaco === 'string' && pedaco) {
                  completo += pedaco;
                  enviar({ tipo: 'texto', texto: pedaco });
                }

                for (const chamada of evento?.choices?.[0]?.delta?.tool_calls ?? []) {
                  const i = chamada.index ?? 0;
                  const parte = chamada.function?.arguments ?? '';
                  pedacosDaFerramenta.set(i, (pedacosDaFerramenta.get(i) ?? '') + parte);
                }
                const razao = evento?.choices?.[0]?.finish_reason;
                if (razao) motivoDeParada = razao;
                if (evento?.usage) {
                  custo = evento.usage.cost ?? null;
                  entrada = evento.usage.prompt_tokens ?? null;
                  saida = evento.usage.completion_tokens ?? null;
                }
              } catch {
                // pedaco de JSON partido entre dois chunks: a sobra resolve
              }
            }
          }

          // Estourar o teto de saida nao e erro: chega 200 e o texto corta no
          // meio. Quem le so o texto entrega resposta truncada como pronta.
          const truncou = motivoDeParada === 'length';
          if (truncou) {
            enviar({ tipo: 'truncado' });
          }

          /*
            O modelo pediu uma imagem.

            A geracao mora na funcao `imagem`, e nao aqui: ela ja sabe falar com
            o modelo certo, gravar no bucket privado e assinar o link. Chamar
            por HTTP custa uma volta de rede e evita duas copias da mesma coisa,
            que e o jeito garantido de uma delas ficar para tras.
          */
          const argumentos = [...pedacosDaFerramenta.values()].join('');
          if (argumentos.trim()) {
            let descricao = '';
            let legenda = '';
            try {
              const lido = JSON.parse(argumentos);
              descricao = String(lido?.descricao ?? '').trim();
              legenda = String(lido?.legenda ?? '').trim();
            } catch {
              console.error('argumentos da ferramenta vieram quebrados', argumentos.slice(0, 300));
            }

            if (descricao) {
              // A tela precisa saber que mudou de assunto: imagem demora bem
              // mais que texto, e sem aviso parece que travou.
              enviar({ tipo: 'gerando_imagem', descricao });

              try {
                const feita = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/imagem`, {
                  method: 'POST',
                  headers: { Authorization: autorizacao, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    conversaId,
                    prompt: descricao,
                    proporcao: '1:1',
                    qualidade,
                    // Se o modelo escreveu texto junto da chamada, ele vira a
                    // legenda: senao esse texto sumiria, porque quem grava a
                    // mensagem do assistente daqui em diante e a outra funcao.
                    legenda: legenda || completo.trim(),
                    // O pedido da pessoa ja virou mensagem aqui no chat.
                    semRegistroDoPedido: true,
                  }),
                });
                const corpo = await feita.json();
                if (!feita.ok) throw new Error(corpo?.message ?? `imagem falhou com HTTP ${feita.status}`);
                enviar({
                  tipo: 'imagem',
                  url: corpo.url,
                  legenda: legenda || completo.trim(),
                  custo: corpo.custo ?? null,
                });
              } catch (e) {
                console.error('ferramenta de imagem falhou', String(e));
                enviar({ tipo: 'erro', mensagem: e instanceof Error ? e.message : String(e) });
              }

              // A funcao `imagem` ja gravou a mensagem do assistente com a
              // imagem. Gravar outra aqui deixaria um balao vazio na conversa.
              enviar({ tipo: 'fim', custo, truncado: false });
              return;
            }
          }

          await supabase.from('mensagens').insert({
            conversa_id: conversaId,
            papel: 'assistant',
            conteudo: completo,
            modelo: usado,
            custo_usd: custo,
            tokens_entrada: entrada,
            tokens_saida: saida,
          });

          await supabase
            .from('conversas')
            .update({ atualizado_em: new Date().toISOString() })
            .eq('id', conversaId);

          enviar({ tipo: 'fim', custo, truncado: truncou });
        } catch (e) {
          console.error('quebrou durante o stream', String(e));
          enviar({ tipo: 'erro', mensagem: String(e) });

          // A resposta parcial vale mais que nada: sem isto, uma falha no meio
          // deixa a pergunta da pessoa sozinha na conversa.
          if (completo.trim()) {
            try {
              await supabase
                .from('mensagens')
                .insert({ conversa_id: conversaId, papel: 'assistant', conteudo: completo, modelo: usado });
            } catch {
              // nao ha mais o que fazer, e o log acima ja registrou
            }
          }
        } finally {
          try {
            controle.close();
          } catch {
            // ja fechado pelo navegador que foi embora
          }
        }
      },
    });

    return new Response(fluxo, {
      headers: { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  } catch (e) {
    console.error('inesperado', String(e));
    return json({ error: 'inesperado', message: String(e) }, 500);
  }
});
