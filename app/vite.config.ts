import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/*
  A identidade desta versão do app.

  Na Vercel é o commit que está sendo publicado; fora dela, a hora do build.
  O mesmo valor vai para dentro do código (__VERSAO__) e para um arquivo
  público (/versao.json). O app aberto compara os dois: se o arquivo do
  servidor disser outra coisa, saiu versão nova e ele avisa.

  Existe porque quem deixa o app aberto continua na versão velha até
  recarregar. Foi assim que a correção da leitura dos orçamentos já estava no
  ar e o Alan, com a aba aberta desde antes, ainda via o cardápio vazio.
*/
const VERSAO = process.env.VERCEL_GIT_COMMIT_SHA ?? `local-${Date.now().toString(36)}`;

/** Publica /versao.json junto com o build, com a mesma versão do código. */
function arquivoDeVersao(): Plugin {
  return {
    name: 'na-grelha-versao',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'versao.json', source: JSON.stringify({ versao: VERSAO }) });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), arquivoDeVersao()],
  define: {
    __VERSAO__: JSON.stringify(VERSAO),
  },
});
