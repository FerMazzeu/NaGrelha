// Na Grelha — gera um título curto para a conversa, via OpenRouter.
//
// Mesma ideia do `title` do lid-ia: lê o começo da conversa e pede um resumo
// de poucas palavras, que vira o nome no histórico.
//
// É best-effort de propósito: se falhar, a conversa fica com o título
// provisório (o começo da primeira pergunta) e ninguém perde nada. Por isso o
// front chama e ignora o erro.
//
// Imports por https://esm.sh: deploy por MCP não resolve `jsr:` nem `npm:`, e
// a função sobe com status 200 e morre no boot com 500, sem stack.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Modelo barato e rápido: título não é lugar de gastar com modelo grande.
const MODELO = 'google/gemini-2.5-flash';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/*
  A primeira versão deste prompt dizia:

    "Contexto: e um buffet de churrasco falando de orcamento, cardapio,
     compras e clientes."

  E o modelo devolvia, para toda conversa, "Buffet de Churrasco: Orçamento e
  Clientes". Ele não estava desobedecendo: eu tinha escrito a resposta na
  pergunta, e ele copiou a frase mais parecida com um título que existia no
  prompt.

  Agora o prompt não descreve o negócio. Ele proíbe o genérico pelo nome e
  mostra três exemplos, que é o que faz um modelo pequeno acertar formato.
*/
const INSTRUCOES = `Voce nomeia conversas. Leia a conversa e devolva SO o titulo, mais nada.

Regras:
- No maximo 5 palavras, em portugues do Brasil.
- O titulo nomeia o assunto ESPECIFICO: o que a pessoa quis, o nome do cliente, a data, o prato.
- E ERRADO devolver titulo generico. "Buffet de churrasco", "Orcamento e cardapio", "Conversa
  sobre churrasco", "Duvida do cliente" e "Post para Instagram" servem para qualquer conversa,
  entao nao servem para nenhuma. Se voce escreveu um titulo que caberia em outra conversa
  qualquer, escreva outro.
- Se a conversa e sobre um evento, use o que identifica aquele evento.
- Sem aspas, sem ponto final, sem markdown.

Exemplos:

Conversa: a pessoa pergunta quanto de picanha comprar para 80 pessoas
Titulo: Picanha para 80 pessoas

Conversa: a pessoa pede um post do aniversario da Alice com tema Among Us
Titulo: Aniversario da Alice, Among Us

Conversa: a pessoa manda audio perguntando se da para trocar costela por fraldinha na festa da ANA
Titulo: Trocar costela na festa da ANA`;

/** Descreve o anexo quando a mensagem veio sem texto, tipo um recado de voz. */
function descreverAnexos(anexos: unknown): string {
  if (!Array.isArray(anexos) || !anexos.length) return '';
  const tipos = anexos.map((a: { mime?: string }) => {
    const mime = String(a?.mime ?? '');
    if (mime.startsWith('audio/')) return 'um audio';
    if (mime.startsWith('image/')) return 'uma foto';
    return 'um arquivo';
  });
  return `(mandou ${tipos.join(' e ')})`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const chave = Deno.env.get('OPENROUTER_API_KEY');
    if (!chave) return json({ error: 'sem_chave' }, 503);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });

    const { data: usuario } = await supabase.auth.getUser();
    if (!usuario.user) return json({ error: 'nao_autorizado' }, 401);

    const { conversaId } = await req.json();
    if (!conversaId) return json({ error: 'requisicao_invalida' }, 400);

    // A RLS garante que só volta mensagem de conversa desta pessoa.
    const { data: mensagens } = await supabase
      .from('mensagens')
      .select('papel, conteudo, anexos')
      .eq('conversa_id', conversaId)
      .order('criado_em', { ascending: true })
      .limit(6);

    const fonte = (mensagens ?? [])
      .map((m: { papel: string; conteudo: string; anexos: unknown }) => {
        // Recado de voz chega com texto vazio. Sem esta linha, a primeira
        // mensagem da conversa some do prompt e o titulo sai do nada.
        const corpo = m.conteudo?.trim() || descreverAnexos(m.anexos);
        return corpo ? `${m.papel === 'user' ? 'Pessoa' : 'Assistente'}: ${corpo}` : '';
      })
      .filter(Boolean)
      .join('\n')
      .slice(0, 2000);

    if (!fonte.trim()) return json({ error: 'conversa_vazia' }, 400);

    const resposta = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${chave}`,
        'Content-Type': 'application/json',
        'X-Title': 'Na Grelha',
      },
      body: JSON.stringify({
        model: MODELO,
        messages: [
          { role: 'system', content: INSTRUCOES },
          { role: 'user', content: `Conversa:\n\n${fonte}\n\nTitulo:` },
        ],
        max_tokens: 30,
        usage: { include: true },
      }),
    });

    if (!resposta.ok) {
      const texto = await resposta.text().catch(() => '');
      console.error('openrouter recusou', resposta.status, texto.slice(0, 400));
      return json({ error: 'openrouter', message: texto.slice(0, 200) }, 502);
    }

    const saida = await resposta.json();
    if (saida?.error) {
      console.error('openrouter respondeu 200 com erro', JSON.stringify(saida.error).slice(0, 400));
      return json({ error: 'openrouter', message: saida.error.message ?? 'provider recusou' }, 502);
    }

    let titulo: string = saida?.choices?.[0]?.message?.content ?? '';

    // O modelo às vezes devolve com aspas, asterisco, ponto final ou o rótulo
    // "Titulo:" na frente, mesmo mandado não fazer. Limpar aqui é mais barato
    // que insistir no prompt.
    titulo = titulo
      .trim()
      .replace(/^t[ií]tulo\s*:\s*/i, '')
      .replace(/[*_`~#]/g, '')
      .replace(/^["'“”\s]+|["'“”.\s]+$/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 60);

    if (!titulo) return json({ error: 'titulo_vazio' }, 502);

    const { error } = await supabase.from('conversas').update({ titulo }).eq('id', conversaId);
    if (error) return json({ error: 'nao_gravou', message: error.message }, 403);

    return json({ titulo, custo: saida?.usage?.cost ?? null });
  } catch (e) {
    console.error('inesperado', String(e));
    return json({ error: 'inesperado', message: String(e) }, 500);
  }
});
