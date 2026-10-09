import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import Agenda from './componentes/Agenda';
import Catalogo from './componentes/Catalogo';
import Chat from './componentes/Chat';
import EditorDeOrcamento from './componentes/EditorDeOrcamento';
import Entrar from './componentes/Entrar';
import Equipe from './componentes/Equipe';
import ListaDeOrcamentos from './componentes/ListaDeOrcamentos';
import { converterPedidosPendentes } from './dados/pedidos';
import { repositorio } from './dados/supabase';
import type { FaixaEtaria, Item, Membro, Orcamento, Perfil, Servico } from './dominio/tipos';
import { novoId } from './formato';
import { orcamentoNovo } from './dominio/orcamento-novo';
import { useGravacaoEnfileirada } from './gravacao';
import { supabase } from './integrations/supabase/client';
import Moldura, { type Aba } from './componentes/Moldura';
import AvisoDeVersao from './componentes/AvisoDeVersao';
import { useVersaoNova } from './versao';
import { mensagemDe } from './erro';

export default function App() {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [aprovado, setAprovado] = useState<boolean | null>(null);

  const [aba, setAba] = useState<Aba>('orcamentos');
  const versaoNova = useVersaoNova();
  const [abertoId, setAbertoId] = useState<string | null>(null);

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [catalogo, setCatalogo] = useState<Item[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [souDono, setSouDono] = useState(false);
  const [faixas, setFaixas] = useState<FaixaEtaria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setVerificandoSessao(false);
    });
    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, nova) => setSessao(nova));
    return () => assinatura.subscription.unsubscribe();
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      // O perfil diz se a pessoa foi liberada. Quem garante isso de verdade e
      // a RLS: sem aprovacao, as consultas abaixo voltam vazias de qualquer
      // jeito. Isto aqui so evita mostrar tela vazia sem explicacao.
      const { data: perfil } = await supabase
        .from('perfis')
        .select('aprovado')
        .eq('id', sessao!.user.id)
        .maybeSingle();

      const liberado = !!perfil?.aprovado;
      setAprovado(liberado);
      if (!liberado) return;

      const [o, c, m, sv, fx, pf, dono] = await Promise.all([
        repositorio.listarOrcamentos(),
        repositorio.lerCatalogo(),
        repositorio.listarMembros(),
        repositorio.lerServicos(),
        repositorio.lerFaixasEtarias(),
        repositorio.listarPerfis(),
        repositorio.souDono(),
      ]);
      setOrcamentos(o);
      setCatalogo(c);
      setMembros(m);
      setServicos(sv);
      setFaixas(fx);
      setPerfis(pf);
      setSouDono(dono);

      /*
        Pedido que o cliente mandou pelo link vira rascunho aqui.

        Sem `await`: a lista aparece na hora com o que já existe, e o rascunho
        novo entra no topo quando fica pronto. Esperar a conversão atrasaria a
        abertura do app toda vez, inclusive quando não tem pedido nenhum.
      */
      converterPedidosPendentes({
        catalogo: c,
        servicos: sv,
        faixas: fx,
        salvar: (orcamento) => repositorio.salvarOrcamento(orcamento),
      }).then((doLink) => {
        if (doLink.length) setOrcamentos((atuais) => [...doLink, ...atuais]);
      });
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setCarregando(false);
    }
  }, [sessao]);

  useEffect(() => {
    if (sessao) carregar();
  }, [sessao, carregar]);

  /**
   * Gravar o orcamento inteiro e apagar as linhas de item e reescrever todas.
   * Por isso passa por fila: duas gravacoes ao mesmo tempo apagavam as duas
   * antes de escrever as duas, e o cardapio saia em dobro.
   */
  const { agendar, agora: gravarAgora, esvaziar } = useGravacaoEnfileirada<Orcamento>(
    (o) => repositorio.salvarOrcamento(o),
    setErro,
  );

  /** A tela muda na hora; o banco recebe pouco depois, uma gravacao por vez. */
  const lembrar = (o: Orcamento) =>
    setOrcamentos((atuais) => {
      const i = atuais.findIndex((x) => x.id === o.id);
      if (i < 0) return [o, ...atuais];
      const copia = [...atuais];
      copia[i] = o;
      return copia;
    });

  const salvar = (o: Orcamento) => {
    lembrar(o);
    agendar(o);
  };

  /**
   * Grava sem esperar a fila.
   *
   * Criar e duplicar usam isto: um orcamento que so existe na tela some se a
   * aba fechar antes da fila rodar, e a pessoa acha que perdeu o trabalho.
   */
  const salvarJa = async (o: Orcamento) => {
    lembrar(o);
    try {
      await repositorio.salvarOrcamento(o);
    } catch (e) {
      setErro(mensagemDe(e));
    }
  };

  if (verificandoSessao) return <p className="area py-10 text-sm text-fumaca">Carregando...</p>;
  if (!sessao) return <Entrar />;

  if (aprovado === false) {
    return (
      <div className="area flex min-h-[100svh] flex-col justify-center">
        <div className="mx-auto max-w-sm text-center">
          <p className="titulo text-xl text-dourado">Conta criada</p>
          <p className="corpo mt-3 text-sm text-fumaca">
            Falta o dono liberar o seu acesso. Enquanto isso você não enxerga os dados da empresa, e isso é garantido
            no banco, não só nesta tela.
          </p>
          <button
            type="button"
            className="botao botao-linha mt-6"
            onClick={() => supabase.auth.signOut()}
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  const aberto = abertoId ? orcamentos.find((o) => o.id === abertoId) ?? null : null;

  /**
   * Sair para outra tela, de onde quer que a pessoa esteja.
   *
   * No computador o menu fica visível com o orçamento aberto, então dá para
   * pular direto para o Catálogo no meio de uma edição. A gravação é
   * enfileirada e espera o relógio: sem este `gravarAgora`, o último campo
   * digitado iria embora e a pessoa acharia que o app comeu o trabalho dela.
   */
  const irParaAba = (nova: Aba) => {
    if (abertoId) gravarAgora();
    setAbertoId(null);
    setAba(nova);
  };

  const moldura = {
    aba,
    aoTrocarAba: irParaAba,
    email: sessao.user.email ?? '',
    aoSair: () => void supabase.auth.signOut(),
  };

  if (aberto) {
    return (
      <Moldura {...moldura}>
        {versaoNova && <AvisoDeVersao antesDeAtualizar={esvaziar} />}
        <EditorDeOrcamento
          orcamento={aberto}
          membros={membros}
          servicosDisponiveis={servicos}
          faixasDisponiveis={faixas}
          aoMudar={salvar}
          aoVoltar={() => {
            // Sair da tela nao pode deixar a ultima edicao esperando o relogio.
            gravarAgora();
            setAbertoId(null);
          }}
          aoRemover={async () => {
            setOrcamentos((a) => a.filter((o) => o.id !== aberto.id));
            setAbertoId(null);
            await repositorio.removerOrcamento(aberto.id);
          }}
        />
      </Moldura>
    );
  }

  return (
    <Moldura {...moldura}>
      {versaoNova && <AvisoDeVersao antesDeAtualizar={esvaziar} />}
      {erro && (
        <div className="area pt-4">
          <p className="rounded-xl border border-brasa/50 bg-brasa/10 p-3 text-sm text-brasa-clara">{erro}</p>
        </div>
      )}

      {carregando ? (
        <p className="area py-10 text-sm text-fumaca">Carregando...</p>
      ) : (
        <>
          {aba === 'orcamentos' && (
            <ListaDeOrcamentos
              orcamentos={orcamentos}
              aoAbrir={setAbertoId}
              aoCriar={async () => {
                const o = orcamentoNovo(catalogo, servicos);
                await salvarJa(o);
                setAbertoId(o.id);
              }}
              aoRemover={async (id) => {
                setOrcamentos((a) => a.filter((o) => o.id !== id));
                await repositorio.removerOrcamento(id);
              }}
              aoDuplicar={async (id) => {
                const base = orcamentos.find((o) => o.id === id);
                if (!base) return;
                const agora = new Date().toISOString();
                const copia: Orcamento = {
                  ...base,
                  id: novoId(),
                  cliente: base.cliente ? `${base.cliente} (cópia)` : '',
                  data: '',
                  situacao: 'orcado',
                  criadoEm: agora,
                  atualizadoEm: agora,
                };
                await salvarJa(copia);
                setAbertoId(copia.id);
              }}
            />
          )}

          {aba === 'agenda' && <Agenda orcamentos={orcamentos} aoAbrir={setAbertoId} />}

          {aba === 'equipe' && (
            <Equipe
              membros={membros}
              perfis={perfis}
              meuId={sessao.user.id}
              souDono={souDono}
              aoLiberar={async (id, aprovado) => {
                setPerfis((a) => a.map((p) => (p.id === id ? { ...p, aprovado } : p)));
                await repositorio.definirAcesso(id, aprovado);
              }}
              aoMudarPapel={async (id, papel) => {
                setPerfis((a) => a.map((p) => (p.id === id ? { ...p, papel } : p)));
                await repositorio.definirPapel(id, papel);
              }}
              aoCriar={async (m) => {
                const criado = await repositorio.criarMembro(m);
                setMembros((a) => [...a, criado]);
              }}
              aoSalvar={async (m) => {
                setMembros((a) => a.map((x) => (x.id === m.id ? m : x)));
                await repositorio.salvarMembro(m);
              }}
              aoRemover={async (id) => {
                setMembros((a) => a.filter((x) => x.id !== id));
                await repositorio.removerMembro(id);
              }}
            />
          )}

          {aba === 'catalogo' && (
            <Catalogo
              itens={catalogo}
              aoSalvar={async (item) => {
                setCatalogo((a) => a.map((i) => (i.id === item.id ? item : i)));
                await repositorio.salvarItem(item);
              }}
              aoCriar={async (item) => {
                const criado = await repositorio.criarItem(item);
                setCatalogo((a) => [...a, criado]);
              }}
              aoRemover={async (id) => {
                setCatalogo((a) => a.filter((i) => i.id !== id));
                await repositorio.removerItem(id);
              }}
              servicos={servicos}
              faixas={faixas}
              aoSalvarFaixa={async (faixa) => {
                setFaixas((a) => a.map((f) => (f.id === faixa.id ? faixa : f)));
                try {
                  await repositorio.salvarFaixaEtaria(faixa);
                } catch (e) {
                  setErro(mensagemDe(e));
                }
              }}
              aoCriarFaixa={async (faixa) => {
                try {
                  const criada = await repositorio.criarFaixaEtaria(faixa);
                  setFaixas((a) => [...a, criada]);
                } catch (e) {
                  setErro(mensagemDe(e));
                }
              }}
              aoRemoverFaixa={async (id) => {
                setFaixas((a) => a.filter((f) => f.id !== id));
                try {
                  await repositorio.removerFaixaEtaria(id);
                } catch (e) {
                  setErro(mensagemDe(e));
                }
              }}
              aoSalvarServico={async (servico) => {
                // A tela mostra na hora; o banco recebe logo atrás. Tabela de
                // cachê é editada aos poucos, campo a campo.
                setServicos((a) => a.map((s) => (s.id === servico.id ? servico : s)));
                try {
                  await repositorio.salvarServico(servico);
                } catch (e) {
                  setErro(mensagemDe(e));
                }
              }}
            />
          )}

          {/*
            O assistente fica montado o tempo todo, escondido pelo `hidden`.

            Desmontar ele ao trocar de aba matava a resposta no meio: a pessoa
            perguntava, ia ver o orçamento, voltava, e não tinha nada. Com ele
            montado, a geração continua enquanto você usa o resto do app.
          */}
          <div hidden={aba !== 'assistente'}>
            <Chat eventoAberto={null} />
          </div>
        </>
      )}

    </Moldura>
  );
}
