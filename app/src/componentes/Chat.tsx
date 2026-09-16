import { useCallback, useEffect, useRef, useState } from 'react';
import { repositorio } from '../dados/supabase';
import { ROTULO_CATEGORIA } from '../dominio/catalogo';
import { calcular, totalDeConvidados } from '../dominio/calculo';
import type { Conversa, Orcamento } from '../dominio/tipos';
import { decimal, inteiro, quantidade, real } from '../formato';
import { digitar } from '../digitacao';
import { funcao, supabase } from '../integrations/supabase/client';
import type { AnexoLocal } from '../midia';
import { ehAudio, ehImagem } from '../midia';
import BarraDeEntrada from './BarraDeEntrada';
import HistoricoDeConversas from './HistoricoDeConversas';
import { Lista } from './Icones';
import { Texto } from './Markdown';

type Mensagem = {
  id: string;
  papel: 'user' | 'assistant';
  conteudo: string;
  /** Já resolvida em link assinado, pronta para o <img>. */
  imagem?: string | null;
  /**
   * O que a pessoa mandou junto. Também já resolvido: enquanto a mensagem é
   * nova, a `url` é a própria data URL do arquivo que ainda está na memória;
   * quando vem do histórico, é um link assinado do bucket.
   */
  anexos?: { url: string; mime: string; nome: string }[];
};

const SUGESTOES = [
  'Quanto de picanha para 80 pessoas?',
  'Escreve a mensagem de follow-up pro cliente',
  'Monta um cardápio de aniversário de 15 anos',
];

/**
 * Monta o resumo do evento aberto para mandar ao modelo.
 *
 * O cálculo continua morando em `calculo.ts`: a edge function recebe o
 * resultado pronto em vez de refazer a conta em Deno. Duas implementações da
 * mesma regra divergem, e a que estaria errada seria justamente a que ninguém
 * testa.
 */
function contextoDoEvento(o: Orcamento | null) {
  if (!o) return '';
  const r = calcular(o);

  const linhas = [
    `Cliente: ${o.cliente || 'sem nome'}`,
    `Data: ${o.data || 'sem data'}`,
    `Local: ${o.local || 'nao informado'}`,
    `Convidados: ${inteiro(totalDeConvidados(o))} no total, sendo ${inteiro(o.adultos)} adultos`,
    ...o.faixas
      .filter((f) => f.quantidade > 0)
      .map((f) => `  - ${f.nome}: ${inteiro(f.quantidade)} criancas, pagam ${inteiro(f.percentual)}% do adulto`),
    `Peso de consumo: ${decimal(r.pessoasEquivalentes)} pessoas equivalentes, apetite ${o.apetite}`,
    `Carne por pessoa no prato: ${inteiro(r.carnePorPessoa)} g`,
    `Carne crua a comprar: ${decimal(r.carneCrua)} kg`,
    `Servicos: ${r.servicos.map((x) => `${x.servico.nome} ${real(x.total)}`).join(', ') || 'nenhum'}`,
    `Custo de servico: ${real(r.custoServicos)}`,
    `Custo total: ${real(r.custoTotal)}`,
    `Preco fechado: ${real(r.preco)} (${real(r.precoPorPessoa)} por pessoa)`,
    '',
    'Itens do evento:',
  ];

  for (const l of r.linhas) {
    linhas.push(
      `- ${l.item.nome} (${l.item.grupo || ROTULO_CATEGORIA[l.item.categoria]}): comprar ${quantidade(
        l.comprar,
        l.item.unidade,
      )}, custo ${real(l.custo)}`,
    );
  }

  return linhas.join('\n');
}

/** Título a partir da primeira pergunta. Barato, previsível e suficiente. */
function tituloDe(texto: string) {
  const limpo = texto.trim().replace(/\s+/g, ' ');
  return limpo.length > 46 ? `${limpo.slice(0, 46)}...` : limpo || 'Nova conversa';
}

export default function Chat({ eventoAberto }: { eventoAberto: Orcamento | null }) {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [entrada, setEntrada] = useState('');
  const [anexos, setAnexos] = useState<AnexoLocal[]>([]);
  const [parcial, setParcial] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [usarContexto, setUsarContexto] = useState(true);
  const [gavetaAberta, setGavetaAberta] = useState(false);
  /**
   * Qualidade da imagem.
   *
   * A alta custa perto de quatro vezes mais por imagem. Fica à vista, e não
   * escondida numa configuração, porque quem escolhe é quem paga.
   */
  const [qualidade, setQualidade] = useState<'alta' | 'rapida'>('alta');
  /**
   * A cena que o assistente decidiu desenhar, enquanto a imagem não chega.
   *
   * Imagem leva perto de meio minuto, contra dois segundos de texto. Sem este
   * aviso a tela parece travada, e a pessoa manda a mesma coisa de novo. Já
   * aconteceu, e custou duas imagens pelo preço de uma.
   */
  const [gerandoImagem, setGerandoImagem] = useState('');
  /**
   * O proximo envio vira imagem.
   *
   * Mora aqui, e nao dentro da barra, porque quem envia e o Chat: a barra so
   * mostra que esta armado e avisa quando a pessoa liga ou desliga.
   */
  const [armadoParaImagem, setArmadoParaImagem] = useState(false);

  const fim = useRef<HTMLDivElement>(null);
  const emCurso = useRef<AbortController | null>(null);
  const parcialRef = useRef('');
  /** Texto completo que já chegou do servidor. A tela corre atrás dele. */
  const alvo = useRef('');
  /**
   * Qual conversa está na tela agora.
   *
   * O estado do React só chega na próxima renderização, e a resposta pode
   * voltar antes disso. Sem esta referência, sair de uma conversa e abrir
   * outra fazia a resposta da primeira aparecer dentro da segunda.
   */
  const aberta = useRef<string | null>(null);

  useEffect(() => {
    parcialRef.current = parcial;
    fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensagens, parcial]);

  const recarregarConversas = useCallback(async () => {
    try {
      setConversas(await repositorio.listarConversas());
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    recarregarConversas();
  }, [recarregarConversas]);

  /** Abre uma conversa do histórico e traz as mensagens dela. */
  const abrir = async (id: string) => {
    setErro('');
    setGavetaAberta(false);
    setConversaId(id);
    aberta.current = id;
    setMensagens([]);
    // O que estava sendo escrito pertence à conversa anterior.
    setParcial('');
    setGerandoImagem('');
    try {
      const salvas = await repositorio.lerMensagens(id);
      // O bucket é privado, então o link da imagem é assinado na hora de
      // mostrar. Guardar o link no banco não adiantaria: ele expira.
      const resolvidas = await Promise.all(
        salvas.map(async (m) => ({
          id: m.id,
          papel: m.papel,
          conteudo: m.conteudo,
          imagem: m.imagemUrl ? await repositorio.urlDaImagem(m.imagemUrl) : null,
          anexos: (
            await Promise.all(
              m.anexos.map(async (a) => ({
                url: (await repositorio.urlDaImagem(a.caminho)) ?? '',
                mime: a.mime,
                nome: a.nome,
              })),
            )
          ).filter((a) => a.url),
        })),
      );
      setMensagens(resolvidas);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };

  const nova = () => {
    setConversaId(null);
    aberta.current = null;
    setMensagens([]);
    setEntrada('');
    setAnexos([]);
    setErro('');
    setGavetaAberta(false);
    setArmadoParaImagem(false);
  };

  /**
   * Troca o titulo provisorio pelo que a IA leu da conversa.
   *
   * E best-effort de proposito: se falhar, fica o comeco da primeira pergunta
   * e ninguem perde nada. Por isso o erro morre aqui dentro, em vez de virar
   * uma tarja vermelha por cima de uma resposta que deu certo.
   */
  /** O título ainda é o provisório, então vale tentar de novo. */
  const precisaDeTitulo = (id: string) => {
    const atual = conversas.find((c) => c.id === id)?.titulo ?? '';
    return !atual || atual === 'Nova conversa';
  };

  const gerarTitulo = async (id: string) => {
    try {
      const { data: sessao } = await supabase.auth.getSession();
      const resposta = await fetch(funcao('titulo'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessao.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conversaId: id }),
      });
      if (!resposta.ok) return;
      const { titulo } = await resposta.json();
      if (!titulo) return;
      setConversas((a) => a.map((c) => (c.id === id ? { ...c, titulo } : c)));
    } catch {
      /* titulo e enfeite: nunca atrapalha a conversa */
    }
  };

  /**
   * Cria a conversa na primeira mensagem, e a nomeia com ela.
   *
   * Devolve `criada` porque e o gatilho do titulo da IA: so a primeira troca
   * de mensagens paga esse modelo, e nao toda pergunta seguinte.
   */
  const garantirConversa = async (primeiraMensagem: string) => {
    if (conversaId) return { id: conversaId, criada: false };
    const c = await repositorio.criarConversa(tituloDe(primeiraMensagem), eventoAberto?.id ?? null);
    setConversaId(c.id);
    aberta.current = c.id;
    setConversas((a) => [c, ...a]);
    return { id: c.id, criada: true };
  };

  const enviar = async (texto: string, arquivos: AnexoLocal[] = []) => {
    const limpo = texto.trim();
    // Só um áudio, sem escrever nada, é envio válido: é assim que a pessoa
    // usa isso no celular, no meio do evento.
    if ((!limpo && !arquivos.length) || ocupado) return;

    setErro('');
    setEntrada('');
    setAnexos([]);
    setOcupado(true);
    setMensagens((m) => [
      ...m,
      {
        id: `tmp-${Date.now()}`,
        papel: 'user',
        conteudo: limpo,
        // A prévia usa o arquivo que ainda está na memória: não adianta pedir
        // link assinado de uma coisa que só vai existir no bucket depois.
        anexos: arquivos.map((a) => ({ url: a.dados, mime: a.mime, nome: a.nome })),
      },
    ]);

    // Fora do `try` porque o `catch` tambem precisa saber de qual conversa
    // era esta geracao, para nao avisar de erro na conversa errada.
    let id: string | null = null;

    try {
      const criacao = await garantirConversa(limpo);
      id = criacao.id;
      const { criada } = criacao;
      const { data: sessao } = await supabase.auth.getSession();

      const controlador = new AbortController();
      emCurso.current = controlador;

      const resposta = await fetch(funcao('chat'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessao.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        signal: controlador.signal,
        body: JSON.stringify({
          conversaId: id,
          mensagem: limpo,
          contexto: usarContexto ? contextoDoEvento(eventoAberto) : '',
          qualidade,
          anexos: arquivos.map(({ nome, mime, dados }) => ({ nome, mime, dados })),
        }),
      });

      if (!resposta.ok || !resposta.body) {
        const corpo = await resposta.json().catch(() => ({}));
        throw new Error(
          corpo?.message ??
            (resposta.status === 503
              ? 'A chave do OpenRouter ainda não foi configurada no Supabase.'
              : `Falhou com HTTP ${resposta.status}`),
        );
      }

      const leitor = resposta.body.getReader();
      const decodificador = new TextDecoder();
      let acumulado = '';
      let sobra = '';
      let truncado = false;
      /** Preenchido quando o assistente resolveu desenhar em vez de escrever. */
      let imagemFeita: { url: string; legenda: string } | null = null;

      // O digitador roda em paralelo com a leitura do fluxo.
      alvo.current = '';
      let chegouAoFim = false;
      const escrevendo = digitar(
        (t) => {
          if (aberta.current === id) setParcial(t);
        },
        () => alvo.current,
        () => chegouAoFim,
      );

      while (true) {
        const { done, value } = await leitor.read();
        if (done) break;

        sobra += decodificador.decode(value, { stream: true });
        const linhas = sobra.split('\n');
        sobra = linhas.pop() ?? '';

        for (const linha of linhas) {
          if (!linha.startsWith('data:')) continue;
          try {
            const evento = JSON.parse(linha.slice(5).trim());
            if (evento.tipo === 'texto') {
              acumulado += evento.texto;
              alvo.current = acumulado;
            }
            // O modelo bateu no teto de saída. Isso chega como 200 e texto
            // cortado no meio, então precisa aparecer para quem lê.
            if (evento.tipo === 'truncado') truncado = true;

            // O assistente decidiu sozinho que o pedido era de imagem.
            if (evento.tipo === 'gerando_imagem' && aberta.current === id) {
              setGerandoImagem(evento.descricao ?? '');
            }
            if (evento.tipo === 'imagem' && evento.url) {
              imagemFeita = { url: evento.url, legenda: evento.legenda ?? '' };
            }

            if (evento.tipo === 'erro') throw new Error(evento.mensagem);
          } catch {
            // fragmento de JSON partido entre dois chunks
          }
        }
      }

      // Espera a digitação terminar de mostrar o que já chegou, senão o fim da
      // resposta aparece de um golpe só.
      chegouAoFim = true;
      await escrevendo;

      await recarregarConversas();
      if (criada || precisaDeTitulo(id)) gerarTitulo(id);

      /*
        A pessoa pode ter saído para outra conversa enquanto isto rodava.

        A resposta já está gravada no banco pelo servidor, então ela aparece
        quando essa conversa for aberta de novo. O que não pode acontecer é
        ela cair dentro da conversa que está na tela agora.
      */
      if (aberta.current !== id) return;

      // Trocar a mensagem e limpar o parcial na mesma renderização: separados,
      // existe um quadro sem nenhum dos dois, e a resposta pisca na tela.
      setParcial('');
      setGerandoImagem('');
      setMensagens((m) => [
        ...m,
        imagemFeita
          ? {
              id: `i-${Date.now()}`,
              papel: 'assistant',
              conteudo: imagemFeita.legenda,
              imagem: imagemFeita.url,
            }
          : {
              id: `a-${Date.now()}`,
              papel: 'assistant',
              conteudo: truncado
                ? `${acumulado}\n\n_(a resposta foi cortada no limite do modelo)_`
                : acumulado,
            },
      ]);
    } catch (e) {
      // Abortar é escolha da pessoa, não falha. O que já chegou fica.
      if (aberta.current !== id) {
        // Falhou numa conversa que não está mais na tela: o aviso iria para o
        // lugar errado. O erro já está no log do servidor.
      } else if (e instanceof DOMException && e.name === 'AbortError') {
        setMensagens((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            papel: 'assistant',
            conteudo: `${parcialRef.current}\n\n_(interrompido)_`,
          },
        ]);
      } else {
        setErro(e instanceof Error ? e.message : String(e));
      }
      setParcial('');
      setGerandoImagem('');
    } finally {
      emCurso.current = null;
      setOcupado(false);
    }
  };

  const parar = () => emCurso.current?.abort();

  const gerarImagem = async (texto: string, arquivos: AnexoLocal[] = []) => {
    const pedido = texto.trim();

    /*
      Foto é referência visual, áudio é o pedido falado.

      Nenhum modelo de imagem lê áudio, então o recado é transcrito no servidor
      antes de virar imagem. Aqui os dois seguem juntos, e por isso gravar um
      recado e mandar, sem escrever nada, já gera a imagem.
    */
    const referencias = arquivos.filter((a) => ehImagem(a.mime) || ehAudio(a.mime));
    const falado = referencias.some((a) => ehAudio(a.mime));

    if ((!pedido && !falado) || ocupado) return;

    setErro('');
    setEntrada('');
    setAnexos([]);
    setOcupado(true);
    setMensagens((m) => [
      ...m,
      {
        id: `tmp-${Date.now()}`,
        papel: 'user',
        conteudo: pedido ? `Gerar imagem: ${pedido}` : 'Gerar imagem',
        anexos: referencias.map((a) => ({ url: a.dados, mime: a.mime, nome: a.nome })),
      },
    ]);

    try {
      const { id, criada } = await garantirConversa(pedido);
      const { data: sessao } = await supabase.auth.getSession();

      const resposta = await fetch(funcao('imagem'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessao.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversaId: id,
          prompt: pedido,
          proporcao: '1:1',
          qualidade,
          anexos: referencias.map(({ nome, mime, dados }) => ({ nome, mime, dados })),
        }),
      });

      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo?.message ?? `Falhou com HTTP ${resposta.status}`);

      setMensagens((m) => [
        ...m,
        {
          id: `i-${Date.now()}`,
          papel: 'assistant',
          // Quando o pedido veio por voz, mostra o que ele entendeu: sem isso
          // a pessoa vê a imagem errada e não sabe se errou a fala ou ele.
          conteudo: falado && corpo.pedido ? `_Entendi:_ ${corpo.pedido}` : '',
          imagem: corpo.url,
        },
      ]);
      await recarregarConversas();
      if (criada) gerarTitulo(id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };

  /**
   * O botao de enviar e um so. Quem escolhe entre texto e imagem e o estado
   * armado, e ele se apaga no envio: gerar imagem e um pedido pontual, e nao
   * um modo em que a pessoa entra e esquece que entrou.
   */
  const despachar = (texto: string) => {
    const arquivos = anexos;
    if (armadoParaImagem) {
      setArmadoParaImagem(false);
      gerarImagem(texto, arquivos);
      return;
    }
    enviar(texto, arquivos);
  };

  const historico = (
    <HistoricoDeConversas
      conversas={conversas}
      abertaId={conversaId}
      aoAbrir={abrir}
      aoNova={nova}
      aoRenomear={async (id, titulo) => {
        setConversas((a) => a.map((c) => (c.id === id ? { ...c, titulo } : c)));
        await repositorio.renomearConversa(id, titulo);
      }}
      aoRemover={async (id) => {
        setConversas((a) => a.filter((c) => c.id !== id));
        if (id === conversaId) nova();
        await repositorio.removerConversa(id);
      }}
      aoFechar={() => setGavetaAberta(false)}
    />
  );

  return (
    <div className="flex">
      {/* Coluna fixa no desktop. */}
      <aside
        className="hidden w-72 shrink-0 border-r border-borda lg:block"
        style={{ height: 'calc(100svh - var(--altura-nav))', position: 'sticky', top: 0 }}
      >
        {historico}
      </aside>

      {/* Gaveta no celular, por cima da conversa. */}
      {gavetaAberta && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-72 max-w-[85vw] border-r border-borda bg-carvao">{historico}</div>
          <button
            type="button"
            aria-label="Fechar histórico"
            className="flex-1 bg-carvao/70 backdrop-blur-sm"
            onClick={() => setGavetaAberta(false)}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col" style={{ minHeight: 'calc(100svh - var(--altura-nav))' }}>
        <div className="area flex-1 pb-6 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setGavetaAberta(true)}
                aria-label="Abrir histórico de conversas"
                className="botao botao-linha !min-h-10 !w-10 shrink-0 !px-0 lg:hidden"
              >
                <Lista className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <h1 className="titulo truncate text-2xl">
                  {conversas.find((c) => c.id === conversaId)?.titulo ?? 'Assistente'}
                </h1>
                <p className="mt-1 text-sm text-fumaca">Pergunta de churrasco, texto pro cliente e imagem.</p>
              </div>
            </div>
          </div>

          {eventoAberto && (
            <label className="cartao mt-4 flex items-center gap-3 p-3 text-sm">
              <input
                type="checkbox"
                checked={usarContexto}
                onChange={(e) => setUsarContexto(e.target.checked)}
                className="h-5 w-5 accent-[#c4261d]"
              />
              <span className="text-fumaca">
                Usar os números de <strong className="text-creme">{eventoAberto.cliente || 'evento aberto'}</strong> na
                conversa
              </span>
            </label>
          )}

          <div className="mt-6 space-y-4">
            {!mensagens.length && !parcial && (
              <div className="space-y-2">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => despachar(s)}
                    className="cartao block w-full p-3 text-left text-sm text-fumaca transition-colors hover:border-dourado/40 hover:text-creme"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {mensagens.map((m) => (
              <div key={m.id} className={m.papel === 'user' ? 'flex justify-end' : ''}>
                <div
                  className={
                    m.papel === 'user'
                      ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-brasa px-4 py-2.5 text-creme'
                      : 'cartao max-w-[92%] p-4'
                  }
                >
                  {!!m.anexos?.length && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {m.anexos.map((a) => (
                        <AnexoNaMensagem key={a.url} anexo={a} />
                      ))}
                    </div>
                  )}

                  {m.imagem ? (
                    <img
                      src={m.imagem}
                      alt="Imagem gerada pelo assistente"
                      className="w-full max-w-sm rounded-xl"
                      loading="lazy"
                    />
                  ) : m.papel === 'user' ? (
                    m.conteudo && <p className="whitespace-pre-wrap">{m.conteudo}</p>
                  ) : (
                    <Texto markdown={m.conteudo} />
                  )}
                </div>
              </div>
            ))}

            {parcial && (
              <div className="cartao max-w-[92%] p-4">
                <Texto markdown={parcial} />
              </div>
            )}

            {gerandoImagem && (
              <div className="cartao max-w-[92%] border-dourado/30 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-dourado">
                  <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-dourado" />
                  Desenhando a imagem
                </p>
                <p className="mt-1.5 text-sm text-fumaca">{gerandoImagem}</p>
                <p className="mt-2 text-xs text-fumaca">Leva perto de meio minuto.</p>
              </div>
            )}

            {ocupado && !parcial && !gerandoImagem && (
              <p className="flex items-center gap-2 text-sm text-fumaca">
                <span className="inline-flex gap-0.5">
                  <span className="animate-bounce">·</span>
                  <span className="animate-bounce" style={{ animationDelay: '120ms' }}>
                    ·
                  </span>
                  <span className="animate-bounce" style={{ animationDelay: '240ms' }}>
                    ·
                  </span>
                </span>
                Pensando
              </p>
            )}

            {erro && (
              <p className="rounded-xl border border-brasa/50 bg-brasa/10 p-3 text-sm text-brasa-clara">{erro}</p>
            )}

            <div ref={fim} />
          </div>
        </div>

        <BarraDeEntrada
          valor={entrada}
          aoMudar={setEntrada}
          aoEnviar={() => despachar(entrada)}
          anexos={anexos}
          aoAnexar={(novos) => setAnexos((a) => [...a, ...novos].slice(0, 6))}
          aoRemoverAnexo={(i) => setAnexos((a) => a.filter((_, j) => j !== i))}
          armadoParaImagem={armadoParaImagem}
          aoArmarImagem={setArmadoParaImagem}
          qualidade={qualidade}
          aoMudarQualidade={setQualidade}
          aoParar={parar}
          aoErro={setErro}
          ocupado={ocupado}
        />
      </div>
    </div>
  );
}

/**
 * Anexo dentro do balão.
 *
 * Áudio vira um player de verdade, e não um ícone: quem mandou o recado quer
 * poder ouvir o que mandou, e quem lê a conversa depois também.
 */
function AnexoNaMensagem({ anexo }: { anexo: { url: string; mime: string; nome: string } }) {
  if (ehImagem(anexo.mime)) {
    return <img src={anexo.url} alt={anexo.nome} className="max-h-40 rounded-xl" loading="lazy" />;
  }

  if (ehAudio(anexo.mime)) {
    return <audio src={anexo.url} controls className="h-10 max-w-full" preload="none" />;
  }

  return (
    <a
      href={anexo.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-xl bg-carvao-3/70 px-3 py-2 text-xs text-creme underline-offset-2 hover:underline"
    >
      {anexo.nome}
    </a>
  );
}
