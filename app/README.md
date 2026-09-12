# Na Grelha | App de gestão

App interno do Alan. Orça evento sem planilha, mostra a agenda, guarda a
equipe, e tem um assistente de IA que conversa e gera imagem.

Vite + React 19 + Tailwind v4 + Supabase. Mesma paleta do site do cliente.

## Rodar

```bash
npm install
npm run dev
```

Não existe `.env`, e não deve existir. A configuração pública do Supabase está
escrita em [src/integrations/supabase/client.ts](src/integrations/supabase/client.ts):
clonar o repositório e rodar já funciona, e o host não precisa de nenhuma
variável configurada.

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm test` | 19 testes da conta |
| `npm run build` | type-check e build em `dist/` |
| `node scripts/fluxo.mjs <url> [email] [senha]` | dirige o app num navegador de verdade |

## O que tem

- **Orçamento e gramatura.** O núcleo: quantos convidados, quais cortes,
  quanto comprar, quanto custa, quanto cobrar.
- **Agenda.** Os mesmos eventos por mês, com funil (orçado, confirmado,
  realizado, perdido) e um bloco separado para os sem data, que é onde mora o
  follow-up.
- **Equipe.** Quem pode ser escalado, cachê padrão, e a escala por evento com
  confirmação individual.
- **Catálogo.** Adicionar, editar e tirar item, com preço e aproveitamento.
- **Assistente.** Chat com streaming e geração de imagem, via OpenRouter.

## A conta

A parte que a planilha erra é uma só: **peso no prato não é peso na nota
fiscal.** Cada item tem um aproveitamento, a fração do que se compra e chega no
prato depois do osso, da gordura aparada e da perda na brasa.

```
comprar = (porPessoa × pessoas) ÷ aproveitamento
```

Costela com osso aproveita perto de metade, então 110 g no prato são 220 g na
compra. Quem soma 400 g por pessoa e compra 400 g por pessoa fica sem carne na
metade da festa.

O resto decorre disso: criança conta 0,5, o apetite multiplica tudo, a compra
arredonda para cima, o carvão sai do peso de carne crua, e a margem é markup
sobre o custo (a tela mostra junto a margem sobre o preço, que é outro número).

## Supabase

Projeto **NaGrelha** (`idwmchjvcmzdxljkaqdq`). Nove tabelas:

| Tabela | Para que |
|---|---|
| `perfis` | quem entra, com `papel` e `aprovado` |
| `itens_catalogo` | a tabela de preços |
| `eventos` | o orçamento, que é também o item da agenda |
| `evento_itens` | cópia do catálogo no dia do orçamento |
| `evento_custos` | custos extras do evento |
| `membros` | a equipe |
| `escalas` | quem trabalha em qual evento |
| `conversas`, `mensagens` | o chat de IA, por pessoa |

### Acesso

Quem controla acesso é o **banco**, não a tela. Toda policy de negócio chama
`public.e_membro()`, que só devolve verdadeiro para perfil aprovado.

O primeiro usuário que se cadastrar vira **dono** e já entra aprovado. Do
segundo em diante o perfil nasce pendente e não enxerga nada até ser liberado.
Esconder botão não seria controle de acesso: quem soubesse o endereço receberia
o dado.

Verificação, que vale rodar sempre que alguém disser que o acesso está pronto:

```sql
select count(*) from pg_policies
where schemaname='public'
  and (coalesce(qual,'')||coalesce(with_check,'')) ilike '%e_membro%';
```

Hoje: 9 policies usando a função, 11 no total (as outras duas são o perfil
editando a si mesmo), nenhuma aberta a qualquer logado, nenhuma tabela sem RLS.

### Edge functions

`supabase/functions/chat` e `supabase/functions/imagem`, as duas no ar.

Os imports são por `https://esm.sh` de propósito: deploy por MCP não resolve
`jsr:` nem `npm:`, e a função sobe com status 200 e morre no boot com 500, sem
stack. Deploy ACTIVE não prova boot; o que prova é a função responder.

Detalhes que vieram de erro caro em outro projeto:

- `usage: { include: true }` no corpo, e o custo em dólar é gravado por
  mensagem. Sem isso não existe conversa sobre custo de IA, só palpite.
- `finish_reason: 'length'` é tratado. Estourar o teto de saída **não é erro**:
  chega 200 com o texto cortado no meio. Quando acontece, a resposta aparece
  marcada em vez de passar por completa.
- Geração de imagem precisa de `modalities: ['image','text']`, senão o modelo
  responde um texto descrevendo a imagem.

O contexto do evento é calculado no front e enviado pronto. Refazer a conta em
Deno criaria uma segunda implementação da mesma regra, e a que estaria errada
seria justamente a que ninguém testa.

## Falta ligar

**A chave do OpenRouter.** O chat e a imagem respondem `503` até que exista o
secret `OPENROUTER_API_KEY` no projeto. Não dá para configurar isso pelo MCP:
é no painel do Supabase, em Edge Functions, Secrets. O app mostra a mensagem
certa enquanto isso.

## Verificação

`npm run build` passando não é teste: build não pega erro de ordem de hook nem
campo controlado que não deixa digitar.

Feito até agora:

- 19 testes da conta, incluindo zero convidado, aproveitamento zerado e número
  negativo.
- RLS conferida por fora: leitura anônima das quatro tabelas de negócio volta
  vazia.
- As duas edge functions respondem `401` sem usuário, o que também prova que
  bootaram.
- A tela de entrada carrega sem nenhuma exceção no console.

Pendente, e só dá para fazer com uma conta de verdade:

```bash
node scripts/fluxo.mjs http://localhost:5190/ seu@email senha
```

Isso testa entrar, ler o catálogo do banco, criar orçamento, calcular e
recarregar para ver se persistiu.
