// Na Grelha — le a FOTO de uma planilha e devolve os itens.
//
// O Alan manda tabela por foto: ele fotografa a tela do Excel ou o papel e
// joga no grupo. Ate agora isso virava digitacao manual, ou a pessoa pedia o
// arquivo de volta e esperava.
//
// A leitura de .xlsx continua no navegador, onde e exata e de graca. Esta
// funcao e so para o que nao da para ler sem visao, e mora no servidor porque
// a chave da OpenRouter nunca pode ir para o navegador.
//
// Imports por https://esm.sh: deploy por MCP nao resolve `jsr:` nem `npm:`, e
// a funcao sobe com status 200 e morre no boot com 500, sem stack.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Le imagem e aceita saida estruturada, que e o que evita ficar caçando JSON
// dentro de texto solto.
const MODELO = 'google/gemini-2.5-flash';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const INSTRUCOES = `Voce le foto de planilha de um buffet de churrasco e devolve os itens.

Como a planilha dele e organizada:
- O PREPARO vem numa linha sozinha, quase sempre em caixa alta: PAO DE ALHO, CHURRASCO, MAIONESE,
  LOUCAS, PRODUTO DE LIMPEZA, FOGO. Todos os itens abaixo dele pertencem a esse preparo, ate
  aparecer o proximo.
- Cada ITEM tem nome, quantidade, unidade e preco. Nem sempre tem todos: receita costuma vir so
  com o nome.

Regras:
- Copie o nome EXATAMENTE como esta escrito, com os erros de digitacao dele. "Shouder", "BANDEIJA"
  e "Calabreza" entram assim, porque e assim que casa com o que ja esta no sistema.
- unidade: "kg" para o que se vende por peso, "un" para o resto, incluindo pacote, duzia e caixa.
  Quando a foto nao diz, use "un".
- quantidade e preco: use 0 quando a foto nao mostrar. Nao invente numero, e nao estime.
- Nao inclua linha de total, subtotal, observacao, data, cliente, nem a equipe (churrasqueiro,
  garcom, frete, imposto, caixa): nada disso e item de compra.
- pessoas: quantas pessoas o modelo atende, se estiver escrito. 0 quando nao estiver.

Se a foto estiver ilegivel ou nao for planilha, devolva a lista vazia.`;

const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['pessoas', 'itens'],
  properties: {
    pessoas: { type: 'number', description: 'Pessoas que o modelo atende, ou 0.' },
    itens: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nome', 'grupo', 'unidade', 'quantidade', 'preco'],
        properties: {
          nome: { type: 'string' },
          grupo: { type: 'string', description: 'O preparo a que o item pertence.' },
          unidade: { type: 'string', enum: ['kg', 'un'] },
          quantidade: { type: 'number' },
          preco: { type: 'number' },
        },
      },
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });

    const { data: usuario } = await supabase.auth.getUser();
    if (!usuario.user) return json({ error: 'nao_autorizado' }, 401);

    const chave = Deno.env.get('OPENROUTER_API_KEY');
    if (!chave) return json({ error: 'sem_chave', message: 'OPENROUTER_API_KEY nao configurada.' }, 503);

    const { imagens } = await req.json();
    const lista: string[] = (Array.isArray(imagens) ? imagens : [])
      .filter((i: unknown) => typeof i === 'string' && i.startsWith('data:image/'))
      .slice(0, 4);

    if (!lista.length) return json({ error: 'sem_imagem', message: 'Nenhuma foto veio no pedido.' }, 400);

    const partes: unknown[] = lista.map((url) => ({ type: 'image_url', image_url: { url } }));
    partes.push({
      type: 'text',
      text:
        lista.length > 1
          ? 'Sao partes da MESMA planilha, em ordem. Junte tudo numa lista so.'
          : 'Leia esta planilha.',
    });

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
          { role: 'user', content: partes },
        ],
        // Sem isto o modelo devolve JSON dentro de markdown, e a metade das
        // vezes com um comentario antes.
        response_format: { type: 'json_schema', json_schema: { name: 'planilha', strict: true, schema: ESQUEMA } },
        max_tokens: 8000,
        usage: { include: true },
      }),
    });

    if (!resposta.ok) {
      const cru = await resposta.text().catch(() => '');
      console.error('openrouter recusou', resposta.status, cru.slice(0, 600));
      return json({ error: 'openrouter', message: recado(cru) || `HTTP ${resposta.status}` }, 502);
    }

    const saida = await resposta.json();

    // A OpenRouter devolve 200 com `error` no corpo quando o provider recusa.
    if (saida?.error) {
      console.error('openrouter respondeu 200 com erro', JSON.stringify(saida.error).slice(0, 600));
      return json({ error: 'openrouter', message: saida.error.message ?? 'o provider recusou' }, 502);
    }

    const conteudo = saida?.choices?.[0]?.message?.content;
    if (typeof conteudo !== 'string' || !conteudo.trim()) {
      console.error('resposta vazia', JSON.stringify(saida?.choices?.[0] ?? {}).slice(0, 400));
      return json({ error: 'vazio', message: 'O modelo nao devolveu nada.' }, 502);
    }

    let lido: { pessoas?: number; itens?: unknown[] };
    try {
      lido = JSON.parse(conteudo);
    } catch {
      console.error('json quebrado', conteudo.slice(0, 400));
      return json({ error: 'json', message: 'A leitura veio malformada. Tenta outra foto.' }, 502);
    }

    /*
      Limpeza do que o modelo devolveu.

      Saida estruturada garante o FORMATO, e nao o conteudo: ainda vem nome
      vazio, quantidade negativa e preco em texto. O que sai daqui vai direto
      para a mesma tela de conferencia do .xlsx, entao precisa estar no mesmo
      formato e igualmente confiavel.
    */
    const numero = (v: unknown) => {
      const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
      return Number.isFinite(n) && n > 0 ? n : 0;
    };

    const itens = (Array.isArray(lido.itens) ? lido.itens : [])
      .map((i) => i as Record<string, unknown>)
      .map((i, indice) => ({
        nome: String(i.nome ?? '').trim().slice(0, 120),
        grupo: String(i.grupo ?? '').trim().slice(0, 120),
        unidade: i.unidade === 'kg' ? 'kg' : 'un',
        quantidade: numero(i.quantidade),
        preco: numero(i.preco),
        // A "linha" aqui e a ordem na foto: e o que a tela usa para localizar.
        linha: indice + 1,
      }))
      .filter((i) => i.nome && !/^\d[\d.,]*$/.test(i.nome));

    return json({
      pessoas: numero(lido.pessoas) || null,
      itens,
      ignoradas: [],
      custo: saida?.usage?.cost ?? null,
    });
  } catch (e) {
    console.error('inesperado', String(e));
    return json({ error: 'inesperado', message: String(e) }, 500);
  }
});

/** Tira a mensagem de dentro do JSON de erro da OpenRouter, quando da. */
function recado(cru: string) {
  try {
    const o = JSON.parse(cru);
    return typeof o?.error?.message === 'string' ? o.error.message : cru.slice(0, 300);
  } catch {
    return cru.slice(0, 300);
  }
}
