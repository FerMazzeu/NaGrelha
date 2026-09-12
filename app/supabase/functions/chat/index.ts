// Na Grelha — chat conversacional via OpenRouter, com streaming.
//
// Imports por https://esm.sh de proposito. Deploy por MCP nao resolve `jsr:`
// nem `npm:`: a funcao sobe com status 200 e morre no boot com 500, sem stack.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODELO_PADRAO = 'google/gemini-2.5-flash';
const MAX_HISTORICO = 20;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const INSTRUCOES = `Voce e o assistente interno do Na Grelha com Alan Xavier, um buffet de churrasco
de Minas Gerais que atende de 15 a 300 convidados.

Voce ajuda a equipe (Alan, Erica, Andre e Isabelle) a orcar evento, calcular quanto comprar,
escrever mensagem para cliente e resolver duvida de operacao.

Como responder:
- Portugues do Brasil, direto, sem enrolacao.
- NUNCA use travessao. Use virgula, dois-pontos ou dois periodos.
- Markdown quando ajudar a ler: lista, tabela, negrito.
- Numero de dinheiro em reais, peso em kg ou g.

O que voce sabe do negocio:
- Peso no prato nao e peso de compra. Cada corte tem um aproveitamento, que e a fracao do que
  se compra e chega ao prato depois do osso, da gordura aparada e da perda na brasa.
  Costela com osso aproveita perto de 50%, linguica 85%, picanha 72%, coxa e sobrecoxa 62%.
- A conta e: comprar = (gramas no prato x pessoas) / aproveitamento.
- Crianca conta como meia pessoa.
- Carvao sai do peso de carne crua, perto de 0,5 kg de carvao por kg de carne.
- O padrao da casa e 350 a 400 g de carne por pessoa quando ha guarnicao.

Quando o usuario estiver com um evento aberto, os numeros reais dele vem no contexto abaixo.
Use esses numeros, nao invente outros. Se faltar dado para responder, diga o que falta.`;

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

    const { conversaId, mensagem, contexto, modelo } = await req.json();
    if (!conversaId || typeof mensagem !== 'string' || !mensagem.trim()) {
      return json({ error: 'requisicao_invalida' }, 400);
    }

    // A RLS ja garante que a conversa e desta pessoa. Se nao for, o insert
    // falha aqui mesmo, e nao depois.
    const { error: erroInsert } = await supabase
      .from('mensagens')
      .insert({ conversa_id: conversaId, papel: 'user', conteudo: mensagem });
    if (erroInsert) return json({ error: 'conversa_invalida', message: erroInsert.message }, 403);

    const { data: historico } = await supabase
      .from('mensagens')
      .select('papel, conteudo')
      .eq('conversa_id', conversaId)
      .order('criado_em', { ascending: true })
      .limit(MAX_HISTORICO);

    const mensagens = [
      { role: 'system', content: contexto ? `${INSTRUCOES}\n\n## Evento aberto\n${contexto}` : INSTRUCOES },
      ...(historico ?? []).map((m: { papel: string; conteudo: string }) => ({
        role: m.papel,
        content: m.conteudo,
      })),
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
        // Sem isto nao existe conversa sobre custo de IA, so palpite.
        usage: { include: true },
      }),
    });

    if (!resposta.ok || !resposta.body) {
      const texto = await resposta.text().catch(() => '');
      return json({ error: 'openrouter', message: texto.slice(0, 300) || `HTTP ${resposta.status}` }, 502);
    }

    let completo = '';
    let motivoDeParada = '';
    let custo: number | null = null;
    let entrada: number | null = null;
    let saida: number | null = null;

    const fluxo = new ReadableStream({
      async start(controle) {
        const leitor = resposta.body!.getReader();
        const decodificador = new TextDecoder();
        const codificador = new TextEncoder();
        let sobra = '';

        const enviar = (obj: unknown) => controle.enqueue(codificador.encode(`data: ${JSON.stringify(obj)}\n\n`));

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
                const pedaco = evento?.choices?.[0]?.delta?.content;
                if (typeof pedaco === 'string' && pedaco) {
                  completo += pedaco;
                  enviar({ tipo: 'texto', texto: pedaco });
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
          enviar({ tipo: 'erro', mensagem: String(e) });
        } finally {
          controle.close();
        }
      },
    });

    return new Response(fluxo, {
      headers: { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  } catch (e) {
    return json({ error: 'inesperado', message: String(e) }, 500);
  }
});
