import { useCallback, useEffect, useRef, useState } from 'react';
import { calcular } from '../dominio/calculo';
import { ROTULO_CATEGORIA } from '../dominio/catalogo';
import type { Orcamento } from '../dominio/tipos';
import { decimal, inteiro, quantidade, real } from '../formato';
import { funcao, supabase } from '../integrations/supabase/client';
import BarraDeEntrada, { type Modo } from './BarraDeEntrada';
import { Recomecar } from './Icones';
import { Texto } from './Markdown';

type Mensagem = {
  id: string;
  papel: 'user' | 'assistant';
  conteudo: string;
  imagem_url?: string | null;
  criado_em?: string;
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
    `Convidados: ${inteiro(o.adultos)} adultos e ${inteiro(o.criancas)} criancas (${decimal(
      r.pessoasEquivalentes,
    )} pessoas equivalentes, apetite ${o.apetite})`,
    `Carne por pessoa no prato: ${inteiro(r.carnePorPessoa)} g`,
    `Carne crua a comprar: ${decimal(r.carneCrua)} kg`,
    `Carvao: ${inteiro(r.carvaoKg)} kg`,
    `Custo total: ${real(r.custoTotal)}`,
    `Preco fechado: ${real(r.preco)} (${real(r.precoPorPessoa)} por pessoa)`,
    `Margem sobre o preco: ${decimal(r.margemSobrePreco)}%`,
    '',
    'Itens do evento:',
  ];

  for (const l of r.linhas) {
    linhas.push(
      `- ${l.item.nome} (${ROTULO_CATEGORIA[l.item.categoria]}): ${inteiro(
        l.item.porPessoa,
      )} ${l.item.unidade === 'kg' ? 'g' : 'un'} por pessoa, comprar ${quantidade(
        l.comprar,
        l.item.unidade,
      )}, custo ${real(l.custo)}`,
    );
  }

  return linhas.join('\n');
}

export default function Chat({ eventoAberto }: { eventoAberto: Orcamento | null }) {
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [entrada, setEntrada] = useState('');
  const [parcial, setParcial] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [usarContexto, setUsarContexto] = useState(true);
  const [modo, setModo] = useState<Modo>('texto');
  const fim = useRef<HTMLDivElement>(null);
  // Guarda a requisicao em curso para o botao de parar poder aborta-la.
  const emCurso = useRef<AbortController | null>(null);

  const parcialRef = useRef('');
  useEffect(() => {
    parcialRef.current = parcial;
    fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensagens, parcial]);

  /** Cria a conversa na primeira mensagem, não ao abrir a tela. */
  const garantirConversa = useCallback(async () => {
    if (conversaId) return conversaId;

    const { data: sessao } = await supabase.auth.getUser();
    if (!sessao.user) throw new Error('sessao expirada');

    const { data, error } = await supabase
      .from('conversas')
      .insert({
        usuario_id: sessao.user.id,
        titulo: eventoAberto?.cliente ? `Sobre ${eventoAberto.cliente}` : 'Nova conversa',
        evento_id: eventoAberto?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;

    setConversaId(data.id as string);
    return data.id as string;
  }, [conversaId, eventoAberto]);

  const enviar = async (texto: string) => {
    const limpo = texto.trim();
    if (!limpo || ocupado) return;

    setErro('');
    setEntrada('');
    setOcupado(true);
    setMensagens((m) => [...m, { id: `tmp-${Date.now()}`, papel: 'user', conteudo: limpo }]);

    try {
      const id = await garantirConversa();
      const { data: sessao } = await supabase.auth.getSession();
      const token = sessao.session?.access_token;

      const controlador = new AbortController();
      emCurso.current = controlador;

      const resposta = await fetch(funcao('chat'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        signal: controlador.signal,
        body: JSON.stringify({
          conversaId: id,
          mensagem: limpo,
          contexto: usarContexto ? contextoDoEvento(eventoAberto) : '',
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
              setParcial(acumulado);
            }
            // O modelo bateu no teto de saída. Isso chega como 200 e texto
            // cortado no meio, então precisa aparecer para quem lê.
            if (evento.tipo === 'truncado') truncado = true;
            if (evento.tipo === 'erro') throw new Error(evento.mensagem);
          } catch {
            // fragmento de JSON partido entre dois chunks
          }
        }
      }

      setParcial('');
      setMensagens((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          papel: 'assistant',
          conteudo: truncado ? `${acumulado}\n\n_(a resposta foi cortada no limite do modelo)_` : acumulado,
        },
      ]);
    } catch (e) {
      // Abortar e uma escolha da pessoa, nao uma falha. O que ja chegou fica.
      if (e instanceof DOMException && e.name === 'AbortError') {
        setMensagens((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            papel: 'assistant',
            conteudo: `${parcialRef.current}

_(interrompido)_`,
          },
        ]);
      } else {
        setErro(e instanceof Error ? e.message : String(e));
      }
      setParcial('');
    } finally {
      emCurso.current = null;
      setOcupado(false);
    }
  };

  const parar = () => emCurso.current?.abort();

  const gerarImagem = async (texto: string) => {
    const pedido = texto.trim();
    if (!pedido || ocupado) return;

    setErro('');
    setEntrada('');
    setOcupado(true);
    setMensagens((m) => [...m, { id: `tmp-${Date.now()}`, papel: 'user', conteudo: `Gerar imagem: ${pedido}` }]);

    try {
      const id = await garantirConversa();
      const { data: sessao } = await supabase.auth.getSession();

      const resposta = await fetch(funcao('imagem'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessao.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conversaId: id, prompt: pedido, proporcao: '1:1' }),
      });

      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo?.message ?? `Falhou com HTTP ${resposta.status}`);

      setMensagens((m) => [
        ...m,
        { id: `i-${Date.now()}`, papel: 'assistant', conteudo: '', imagem_url: corpo.url },
      ]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100svh-4rem)] flex-col">
      <div className="area flex-1 pb-6 pt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="titulo text-2xl">Assistente</h1>
            <p className="mt-1 text-sm text-fumaca">Pergunta de churrasco, texto pro cliente e imagem.</p>
          </div>
          {mensagens.length > 0 && (
            <button
              type="button"
              className="botao botao-linha !min-h-9 !px-3 text-sm"
              onClick={() => {
                setConversaId(null);
                setMensagens([]);
                setErro('');
                setEntrada('');
              }}
            >
              <Recomecar className="h-4 w-4" />
              Nova conversa
            </button>
          )}
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
                  onClick={() => enviar(s)}
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
                {m.imagem_url ? (
                  <img
                    src={m.imagem_url}
                    alt="Imagem gerada pelo assistente"
                    className="w-full max-w-sm rounded-xl"
                    loading="lazy"
                  />
                ) : m.papel === 'user' ? (
                  <p className="whitespace-pre-wrap">{m.conteudo}</p>
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

          {ocupado && !parcial && (
            <p className="flex items-center gap-2 text-sm text-fumaca">
              <span className="inline-flex gap-0.5">
                <span className="animate-bounce">·</span>
                <span className="animate-bounce" style={{ animationDelay: '120ms' }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: '240ms' }}>·</span>
              </span>
              {modo === 'imagem' ? 'Desenhando' : 'Pensando'}
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
        aoEnviar={() => (modo === 'texto' ? enviar(entrada) : gerarImagem(entrada))}
        aoParar={parar}
        ocupado={ocupado}
        modo={modo}
        aoMudarModo={setModo}
      />
    </div>
  );
}
