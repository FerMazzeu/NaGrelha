# Na Grelha com Alan Xavier

Site do buffet de churrasco do Alan Xavier. Página única, Vite + React 19 +
Tailwind v4, feita para rodar em qualquer host estático.

O conteúdo veio do site antigo em Gamma
(`na-grelha-alan-xavier-pmeg8q4.gamma.site`), reescrito em português do Brasil
e sem travessão.

## Rodar

```bash
npm install
npm run imagens   # gera src/assets a partir de fotos/
npm run dev
```

`npm run imagens` precisa rodar pelo menos uma vez antes do `dev`: `src/assets/`
não vai para o git.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run imagens` | recorta e converte `fotos/` para `src/assets/` |
| `npm run build` | imagens + type-check + build de produção em `dist/` |
| `npm run verificar` | renderiza a página inteira em Node e confere o conteúdo |
| `npm run type-check` | só o TypeScript |

## Como o projeto está organizado

```
fotos/                 fotos originais do cliente. Fonte, entra no git.
scripts/imagens.mjs    recorta as fotos. É a fonte da verdade de src/assets.
scripts/render-check.tsx  smoke test de renderização
scripts/screenshot.mjs captura a página inteira para conferência visual
scripts/auditoria.mjs   mede contraste, títulos, peso e layout por largura
src/conteudo.ts        todo o texto do site
src/componentes/       uma seção por arquivo
src/assets/            GERADO. Não edite nada aqui.
```

### Texto

Tudo em `src/conteudo.ts`. Para trocar uma frase, um telefone ou um item do
cardápio, é o único arquivo que precisa ser tocado.

Duas regras de escrita, verificadas pelo `npm run verificar`:

- **sem travessão**, que vira marca d'água de texto gerado. Vírgula, dois
  períodos ou dois-pontos resolvem.
- **português do Brasil**. O material original misturava as duas normas.

### Imagens

O recorte acontece no build, não no CSS. `object-fit: cover` recorta na hora de
desenhar, então o navegador baixa e decodifica a imagem inteira, inclusive a
metade que o recorte joga fora.

Para mudar uma foto, edite a lista `alvos` em `scripts/imagens.mjs` e rode
`npm run imagens`. Cada alvo tem `w`, `h` e um `focoY` que reproduz o
`object-position`.

O script nunca amplia: se a origem for menor que a caixa, ele entrega no
tamanho que dá e **avisa no final quais fotos estão abaixo do necessário**.
Hoje o aviso aparece para o topo, a faixa de fogo e a foto do Alan, porque as
fotos do site antigo vieram em resolução de tela. Vale pedir os originais ao
cliente e substituir em `fotos/`.

### Ícones

SVG escrito à mão em `src/componentes/Icones.tsx`, sem biblioteca. Biblioteca de
ícones costuma conflitar por peer dependency no React 19, e para este punhado de
símbolos não compensa.

## Verificação

`npm run build` passando não é teste: build não pega erro de ordem de hook nem
de variável usada antes da inicialização, que matam a tela em runtime.

- `npm run verificar` renderiza a árvore inteira de verdade e falha se algum
  componente estourar, se faltar texto esperado, se alguma imagem estiver sem
  `alt` ou sem `width`/`height`, ou se aparecer travessão.
- `node scripts/screenshot.mjs <url> <saida.png> [largura] [altura]` captura a
  página inteira. Ele rola a página antes de capturar, porque **screenshot de
  página inteira não dispara lazy loading** e sem isso metade das fotos sai em
  branco. E captura em faixas mantendo o viewport no tamanho real, porque
  esticar o viewport para caber a página faz `100svh` virar um bloco de
  20000px.

- `node scripts/auditoria.mjs <url>` mede o que não dá para julgar no olho:
  contraste de cada cor de texto sobre o fundo real, hierarquia de títulos,
  textos alternativos repetidos, imagens servidas maiores do que aparecem,
  peso total e rolagem horizontal em sete larguras.

Última medição: 3660 kB em 59 requisições, contraste entre 6,9 e 17 (mínimo AA
é 4,5), um único `h1` sem salto de nível, nenhuma imagem quebrada e nenhuma
rolagem horizontal em 360, 414, 768, 1024, 1280, 1440 e 1920px.

## Contatos no site

| Quem | Para quê | Número |
|---|---|---|
| Érica | orçamentos e agenda | (35) 98863-8687 |
| Alan Xavier | consultoria técnica | (35) 98821-8023 |

Instagram: [@nagrelha_alanxavier](https://instagram.com/nagrelha_alanxavier)

## Decisões de edição

O material do Gamma é uma apresentação de slides, onde repetir é normal. Num
site vira página longa à toa, então três blocos foram cortados:

- **"Vitrine gastronômica" saiu inteira.** Os três cartões dela repetiam, com
  outras palavras, o cardápio, a seção de cortes e a do burguer. A citação do
  Alan, que era a única coisa própria ali, passou a abrir a seção de técnica.
- **"Macarrão à sua escolha" foi absorvido por "Massas".** Diziam a mesma coisa.
- **"Guarnições na hora" saiu do cardápio**, porque existe uma seção própria e
  mais detalhada logo abaixo. Antes as guarnições apareciam três vezes.

A seção de cortes deixou de repetir a lista de carnes e passou a ser sobre a
técnica, que é o que o cardápio não cobre.

Resultado: a página caiu de 19014px para 17671px no desktop e de 29236px para
25909px no celular, sem perder nenhuma informação.

## Pendente

- **`srcset`.** Hoje o celular baixa exatamente o mesmo arquivo que o desktop,
  e imagem é 3202 dos 3660 kB da página. É o maior ganho ainda disponível.
- **Prerender no build.** O site é renderizado só no cliente. Como o
  `renderToString` já funciona no `npm run verificar`, gerar o HTML estático
  é barato e resolve indexação e primeira pintura.
- Cidade e região atendida, faixa de preço, FAQ e depoimentos. Dependem de
  informação que só o cliente tem.
- Link de pular para o conteúdo.
- Fotos em resolução maior para o topo e para o retrato do Alan.
- Domínio de produção. O `canonical` e o `og:image` em `index.html` estão
  apontando para `nagrelhaalanxavier.com.br`, que é palpite e precisa ser
  confirmado antes de publicar.
