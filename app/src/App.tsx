import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import Agenda from './componentes/Agenda';
import Catalogo from './componentes/Catalogo';
import Chat from './componentes/Chat';
import EditorDeOrcamento from './componentes/EditorDeOrcamento';
import Entrar from './componentes/Entrar';
import Equipe from './componentes/Equipe';
import ListaDeOrcamentos from './componentes/ListaDeOrcamentos';
import { repositorio } from './dados/supabase';
import { FATOR_CARVAO_PADRAO, MARGEM_PADRAO, PRECO_CARVAO_PADRAO, SELECAO_PADRAO } from './dominio/catalogo';
import { valorSugerido } from './dominio/calculo';
import type { FaixaEtaria, Item, Membro, Orcamento, Perfil, Servico } from './dominio/tipos';
import { novoId } from './formato';
import { useGravacaoEnfileirada } from './gravacao';
import { supabase } from './integrations/supabase/client';
import { Calendario, Faisca, Lista, Pessoas, Recibo } from './componentes/Icones';

type Aba = 'orcamentos' | 'agenda' | 'equipe' | 'catalogo' | 'assistente';

const ABAS = [
  { id: 'orcamentos', rotulo: 'Orçamentos', Icone: Recibo },
  { id: 'agenda', rotulo: 'Agenda', Icone: Calendario },
  { id: 'equipe', rotulo: 'Equipe', Icone: Pessoas },
  { id: 'catalogo', rotulo: 'Catálogo', Icone: Lista },
  { id: 'assistente', rotulo: 'Assistente', Icone: Faisca },
] satisfies { id: Aba; rotulo: string; Icone: (p: { className?: string }) => React.ReactElement }[];

/** Serviços que todo evento leva, conforme a planilha do cliente. */
const SERVICOS_DE_PARTIDA = ['Churrasqueiro', 'Organização (metrê)', 'Imposto (DAS)', 'Caixa'];

function orcamentoNovo(catalogo: Item[], servicos: Servico[], adultos = 30): Orcamento {
  const agora = new Date().toISOString();
  return {
    id: novoId(),
    cliente: '',
    contato: '',
    data: '',
    hora: '',
    local: '',
    observacoes: '',
    situacao: 'orcado',
    tipoEvento: 'aniversario',
    adultos,
    faixas: [],
    apetite: 'normal',
    duracaoHoras: 5,
    // Cópia do catálogo: o preço da picanha muda, o orçamento fechado não.
    itens: catalogo.map((i) => ({ ...i })),
    // Por nome, e nao por id: os ids agora vem do banco e mudam por projeto.
    selecionados: catalogo.filter((i) => SELECAO_PADRAO.includes(i.nome)).map((i) => i.id),
    // Já vem com o básico: esquecer a linha de serviço é o erro mais caro
    // possível aqui, porque ela sozinha passa dos insumos no orçamento deles.
    servicos: servicos
      .filter((s) => SERVICOS_DE_PARTIDA.includes(s.nome))
      .map((s) => ({
        id: `novo-${s.id}`,
        servicoId: s.id,
        nome: s.nome,
        papel: s.papel,
        pessoa: '',
        percentual: s.percentual,
        valorManual: false,
        quantidade: 1,
        valor: valorSugerido(s, adultos),
      })),
    custosExtras: [],
    margem: MARGEM_PADRAO,
    fatorCarvao: FATOR_CARVAO_PADRAO,
    precoCarvao: PRECO_CARVAO_PADRAO,
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

export default function App() {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [aprovado, setAprovado] = useState<boolean | null>(null);

  const [aba, setAba] = useState<Aba>('orcamentos');
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
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
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
  const { agendar, agora: gravarAgora } = useGravacaoEnfileirada<Orcamento>(
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
      setErro(e instanceof Error ? e.message : String(e));
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

  if (aberto) {
    return (
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
    );
  }

  return (
    <div style={{ paddingBottom: 'var(--altura-nav)' }}>
      <header className="border-b border-borda">
        <div className="area flex items-center justify-between py-4">
          <div>
            <p className="titulo text-lg text-dourado">Na Grelha</p>
            <p className="text-xs text-fumaca">{sessao.user.email}</p>
          </div>
          <button
            type="button"
            className="botao botao-linha !min-h-10 !px-3 text-sm"
            onClick={() => supabase.auth.signOut()}
          >
            Sair
          </button>
        </div>
      </header>

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
              aoSalvarServico={async (servico) => {
                // A tela mostra na hora; o banco recebe logo atrás. Tabela de
                // cachê é editada aos poucos, campo a campo.
                setServicos((a) => a.map((s) => (s.id === servico.id ? servico : s)));
                try {
                  await repositorio.salvarServico(servico);
                } catch (e) {
                  setErro(e instanceof Error ? e.message : String(e));
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

      {/* Navegação embaixo: o app é usado no celular, com uma mão só. */}
      {/*
        Navegação com ícone e rótulo, e alvo de toque cheio.
        A faixa só de texto miúdo era pequena demais para acertar com o dedo, e
        o rótulo sozinho não dá para reconhecer de relance.
      */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-borda bg-carvao/95 backdrop-blur">
        <div className="area flex items-stretch gap-1 py-1.5" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          {ABAS.map((a) => {
            const ativa = aba === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAba(a.id)}
                aria-current={ativa ? 'page' : undefined}
                className={`relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 pb-2 pt-2 transition-colors ${
                  ativa ? 'bg-carvao-3 text-dourado' : 'text-fumaca hover:text-creme'
                }`}
              >
                {/* traço em cima da aba ativa: dá para ver de relance em qual
                    tela a pessoa está, mesmo sem distinguir a cor */}
                <span
                  className={`absolute inset-x-4 top-0 h-0.5 rounded-full transition-colors ${
                    ativa ? 'bg-dourado' : 'bg-transparent'
                  }`}
                />
                <a.Icone className="h-5 w-5" />
                <span className="text-[0.65rem] font-semibold leading-none">{a.rotulo}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
