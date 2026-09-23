/**
 * Confere a conexao com o Supabase do jeito que o app se conecta.
 *
 * Nao usa painel nem ferramenta privilegiada de proposito: usa a URL e a chave
 * publicavel que estao no codigo. E a unica checagem que responde a pergunta
 * "o app consegue falar com o banco", em vez de "o banco existe".
 */
import { readFileSync } from 'node:fs';

const fonte = readFileSync('src/integrations/supabase/client.ts', 'utf8');
const URL_BASE = /SUPABASE_URL = '([^']+)'/.exec(fonte)?.[1];
const CHAVE = /SUPABASE_PUBLISHABLE_KEY = '([^']+)'/.exec(fonte)?.[1];

const passos = [];
const conferir = (nome, ok, detalhe = '') => {
  passos.push({ nome, ok: !!ok });
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${nome}${detalhe ? '  ' + detalhe : ''}`);
};

console.log('URL  :', URL_BASE);
console.log('chave:', CHAVE ? `${CHAVE.slice(0, 22)}...` : '(nenhuma)');
console.log('');

conferir('a URL está no código', !!URL_BASE);
conferir('a chave publicável está no código', !!CHAVE && CHAVE.startsWith('sb_publishable_'));
conferir(
  'NÃO é chave de serviço no front',
  !!CHAVE && !CHAVE.includes('service_role') && !CHAVE.startsWith('eyJ'),
  'chave secreta no navegador anularia a RLS',
);

const cabecalhos = { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` };

// ------------------------------------------------------------ auth ---------
try {
  const r = await fetch(`${URL_BASE}/auth/v1/health`, { headers: cabecalhos });
  const corpo = await r.text();
  conferir('o serviço de login responde', r.ok, `HTTP ${r.status} ${corpo.slice(0, 80)}`);
} catch (e) {
  conferir('o serviço de login responde', false, String(e));
}

// ------------------------------------------------------------ REST ---------
/*
  Consulta de tabela, e nao a raiz `/rest/v1/`.

  A raiz responde 401 com "Only secret API keys can be used for this endpoint",
  de proposito: ela expoe o OpenAPI do banco inteiro e so aceita chave secreta.
  Usar a raiz como teste de conexao acusa falha onde esta tudo certo.
*/
try {
  const r = await fetch(`${URL_BASE}/rest/v1/itens_catalogo?select=id&limit=1`, { headers: cabecalhos });
  conferir('a API do banco aceita a chave', r.status === 200, `HTTP ${r.status}`);
} catch (e) {
  conferir('a API do banco aceita a chave', false, String(e));
}

/*
  A prova que vale: anonimo nao enxerga dado de negocio.

  Com a chave publicavel e sem login, a RLS tem que devolver lista vazia. Se
  vier linha aqui, a chave no codigo publico seria um vazamento, e nao uma
  decisao de arquitetura.
*/
for (const tabela of ['eventos', 'itens_catalogo', 'perfis', 'conversas', 'mensagens', 'membros']) {
  try {
    const r = await fetch(`${URL_BASE}/rest/v1/${tabela}?select=id&limit=1`, { headers: cabecalhos });
    const corpo = await r.json().catch(() => null);
    const vazio = Array.isArray(corpo) && corpo.length === 0;
    const barrado = r.status === 401 || r.status === 403;
    conferir(
      `anônimo NÃO lê ${tabela}`,
      vazio || barrado,
      vazio ? 'lista vazia pela RLS' : barrado ? `HTTP ${r.status}` : `VAZOU: ${JSON.stringify(corpo).slice(0, 120)}`,
    );
  } catch (e) {
    conferir(`anônimo NÃO lê ${tabela}`, false, String(e));
  }
}

// ------------------------------------------------- escrita anonima ---------
try {
  const r = await fetch(`${URL_BASE}/rest/v1/itens_catalogo`, {
    method: 'POST',
    headers: { ...cabecalhos, 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: 'teste de intrusao', grupo: 'x', categoria: 'extra', unidade: 'un' }),
  });
  conferir('anônimo NÃO consegue gravar', !r.ok, `HTTP ${r.status}`);
} catch (e) {
  conferir('anônimo NÃO consegue gravar', false, String(e));
}

// -------------------------------------------------- edge functions ---------
for (const nome of ['chat', 'imagem', 'titulo']) {
  try {
    const r = await fetch(`${URL_BASE}/functions/v1/${nome}`, { method: 'OPTIONS' });
    conferir(`a função ${nome} está no ar`, r.status === 200, `HTTP ${r.status}`);
  } catch (e) {
    conferir(`a função ${nome} está no ar`, false, String(e));
  }
}

// Sem login, a funcao tem que recusar. 401 prova que ela bootou E que confere
// quem esta chamando.
try {
  const r = await fetch(`${URL_BASE}/functions/v1/chat`, {
    method: 'POST',
    headers: { ...cabecalhos, 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversaId: 'x', mensagem: 'oi' }),
  });
  const corpo = await r.text();
  conferir('a função recusa quem não está logado', r.status === 401, `HTTP ${r.status} ${corpo.slice(0, 60)}`);
} catch (e) {
  conferir('a função recusa quem não está logado', false, String(e));
}

const falhas = passos.filter((p) => !p.ok);
console.log(`\n${passos.length - falhas.length}/${passos.length} checagens ok`);
if (falhas.length) process.exitCode = 1;
