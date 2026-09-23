/**
 * Confere se as edge functions ao menos compilam.
 *
 * Elas rodam em Deno, no servidor da Supabase, e nenhuma ferramenta local as
 * enxerga: `tsc` ignora a pasta e o build do Vite tambem. Ja aconteceu de uma
 * crase perdida dentro de um prompt derrubar o deploy, e so o bundler remoto
 * avisar.
 *
 * Duas armadilhas ja pegas aqui, as duas do Windows:
 *
 * 1. Glob no package.json nao expande no cmd.exe, e o esbuild recebia o padrao
 *    literal. A checagem passava sem olhar arquivo nenhum.
 * 2. `spawnSync('npx.cmd')` morre com EINVAL desde o Node 20.
 *
 * Por isso a API do esbuild entra direto, sem shell e sem subprocesso.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const RAIZ = 'supabase/functions';

if (!existsSync(RAIZ)) {
  console.log('nenhuma edge function neste projeto');
  process.exit(0);
}

const funcoes = readdirSync(RAIZ, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => `${RAIZ}/${d.name}/index.ts`)
  .filter(existsSync);

if (!funcoes.length) {
  console.error('nenhum index.ts em', RAIZ);
  process.exit(1);
}

let falhou = false;

for (const arquivo of funcoes) {
  try {
    await transform(readFileSync(arquivo, 'utf8'), { loader: 'ts', format: 'esm' });
    console.log(`  ok   ${arquivo}`);
  } catch (e) {
    falhou = true;
    console.log(` FALHA ${arquivo}`);
    for (const erro of e.errors ?? [{ text: String(e) }]) {
      const onde = erro.location ? ` (linha ${erro.location.line})` : '';
      console.error(`        ${erro.text}${onde}`);
    }
  }
}

console.log(`\n${funcoes.length} ${funcoes.length === 1 ? 'função conferida' : 'funções conferidas'}`);
if (falhou) process.exitCode = 1;
