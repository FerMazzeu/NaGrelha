import { useCallback, useEffect, useState } from 'react';
import { financeiro } from '../../dados/financeiro';
import { lancamentoNovo, type Categoria, type Conta, type Lancamento, type Pendencia } from '../../dominio/financeiro';
import type { Escala, Membro, Orcamento, Situacao } from '../../dominio/tipos';
import { mensagemDe } from '../../erro';
import AReceber from './AReceber';
import APagarTela from './APagar';
import Ajustes from './Ajustes';
import FormularioDeLancamento from './FormularioDeLancamento';
import LivroCaixa from './LivroCaixa';
import ParaConferir from './ParaConferir';
import PorEvento from './PorEvento';
import Resumo from './Resumo';

export type DadosDoCaixa = {
  contas: Conta[];
  categorias: Categoria[];
  lancamentos: Lancamento[];
  escalas: Escala[];
  orcamentos: Orcamento[];
  membros: Membro[];
};

/** O que as telas do caixa pedem para fazer. Quem grava é só este componente. */
export type AcoesDoCaixa = {
  /** Abre o formulário: lançamento existente para editar, ou parcial para um novo. */
  abrir: (l: Lancamento) => void;
  novo: (tipo: Lancamento['tipo'], parcial?: Partial<Lancamento>) => void;
  /** Grava sem abrir formulário: o "marcar como pago" de um toque. */
  gravar: (ls: Lancamento[]) => Promise<void>;
  /** Confirmado, realizado, perdido: o evento muda daqui, sem abrir o orçamento. */
  mudarSituacao: (o: Orcamento, situacao: Situacao) => Promise<void>;
};

type SubAba = 'resumo' | 'conferir' | 'livro' | 'receber' | 'pagar' | 'eventos' | 'ajustes';

const SUB_ABAS: [SubAba, string][] = [
  ['resumo', 'Resumo'],
  ['conferir', 'Para conferir'],
  ['livro', 'Livro caixa'],
  ['receber', 'A receber'],
  ['pagar', 'A pagar'],
  ['eventos', 'Por evento'],
  ['ajustes', 'Contas e importar'],
];

/**
 * O controle de caixa, que substitui a planilha "CONTROLE CAIXA NA GRELHA".
 *
 * Só aparece para dono, e a RLS garante o mesmo no banco: para os outros as
 * tabelas voltam vazias.
 *
 * Os dados do caixa são carregados aqui, quando a aba abre, e não junto com
 * o app: quem só vai orçar não precisa baixar o livro caixa inteiro.
 */
export default function Caixa({
  orcamentos,
  membros,
  aoSalvarEvento,
}: {
  orcamentos: Orcamento[];
  membros: Membro[];
  /** Para a importação criar os eventos que ainda não estão no app. */
  aoSalvarEvento: (o: Orcamento) => Promise<void>;
}) {
  const [aba, setAba] = useState<SubAba>(() => {
    try {
      return (localStorage.getItem('caixa-aba') as SubAba) || 'resumo';
    } catch {
      return 'resumo';
    }
  });
  const [contas, setContas] = useState<Conta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState<Lancamento | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const [c, cat, l, e, p] = await Promise.all([
        financeiro.lerContas(),
        financeiro.lerCategorias(),
        financeiro.lerLancamentos(),
        financeiro.lerEscalas(),
        financeiro.lerPendencias(),
      ]);
      setPendencias(p);
      setContas(c);
      setCategorias(cat);
      setLancamentos(l);
      setEscalas(e);
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const trocarAba = (a: SubAba) => {
    setAba(a);
    try {
      localStorage.setItem('caixa-aba', a);
    } catch {
      /* sem armazenamento, só não lembra a aba */
    }
  };

  /** Grava e põe na tela o que o banco devolveu, já com id. */
  const gravar = async (ls: Lancamento[]) => {
    const novos = ls.filter((l) => !l.id);
    const editados = ls.filter((l) => l.id);
    const criados = await financeiro.criarLancamentos(novos);
    const atualizados = await Promise.all(editados.map((l) => financeiro.salvarLancamento(l)));
    setLancamentos((atual) => {
      const porId = new Map(atual.map((l) => [l.id, l]));
      for (const l of [...criados, ...atualizados]) porId.set(l.id, l);
      return [...porId.values()];
    });
  };

  const remover = async (id: string) => {
    await financeiro.removerLancamento(id);
    setLancamentos((atual) => atual.filter((l) => l.id !== id));
  };

  const acoes: AcoesDoCaixa = {
    abrir: setEditando,
    novo: (tipo, parcial) => setEditando(lancamentoNovo(tipo, parcial)),
    gravar,
    mudarSituacao: (o, situacao) => aoSalvarEvento({ ...o, situacao, atualizadoEm: new Date().toISOString() }),
  };

  const dados: DadosDoCaixa = { contas, categorias, lancamentos, escalas, orcamentos, membros };
  const abertas = pendencias.filter((p) => p.situacao === 'aberta').length;

  return (
    <div className="area-larga py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="titulo text-2xl">Caixa</h1>
          <p className="mt-1 text-sm text-fumaca">O dinheiro da empresa. Só quem é dono vê esta tela.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="botao botao-linha" onClick={() => acoes.novo('saida')}>
            − Saída
          </button>
          <button type="button" className="botao botao-brasa" onClick={() => acoes.novo('entrada')}>
            + Entrada
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-borda pb-2">
        {SUB_ABAS.map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            onClick={() => trocarAba(id)}
            aria-pressed={aba === id}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              aba === id ? 'bg-carvao-3 text-dourado' : 'text-fumaca hover:text-creme'
            }`}
          >
            {rotulo}
            {id === 'conferir' && abertas > 0 && (
              <span className="ml-1.5 rounded-full bg-dourado px-1.5 py-0.5 text-[0.65rem] font-bold text-carvao">{abertas}</span>
            )}
          </button>
        ))}
      </div>

      {erro && (
        <div className="mt-4 rounded-xl border border-brasa/50 bg-brasa/10 p-3 text-sm text-brasa-clara">
          <p>{erro}</p>
          <button type="button" className="mt-2 font-semibold underline" onClick={() => void carregar()}>
            Tentar de novo
          </button>
        </div>
      )}

      {carregando ? (
        <p className="py-10 text-sm text-fumaca">Carregando o caixa...</p>
      ) : (
        <div className="mt-6">
          {aba === 'resumo' && (
            <>
              {abertas > 0 && (
                <button
                  type="button"
                  onClick={() => trocarAba('conferir')}
                  className="cartao mb-6 flex w-full items-center justify-between gap-3 border-dourado/50 p-4 text-left hover:border-dourado"
                >
                  <span>
                    <span className="block font-semibold text-dourado">
                      {abertas} {abertas === 1 ? 'ponto para conferir' : 'pontos para conferir'}
                    </span>
                    <span className="block text-sm text-fumaca">Dúvidas da importação que só quem conhece o caixa sabe responder.</span>
                  </span>
                  <span className="text-dourado">›</span>
                </button>
              )}
              <Resumo dados={dados} acoes={acoes} irPara={trocarAba} />
            </>
          )}
          {aba === 'conferir' && (
            <ParaConferir
              pendencias={pendencias}
              eventos={orcamentos}
              aoMudar={(p) => setPendencias((a) => a.map((x) => (x.id === p.id ? p : x)))}
            />
          )}
          {aba === 'livro' && <LivroCaixa dados={dados} acoes={acoes} />}
          {aba === 'receber' && <AReceber dados={dados} acoes={acoes} />}
          {aba === 'pagar' && <APagarTela dados={dados} acoes={acoes} />}
          {aba === 'eventos' && <PorEvento dados={dados} acoes={acoes} />}
          {aba === 'ajustes' && (
            <Ajustes
              dados={dados}
              acoes={acoes}
              aoMudarConta={(c) => setContas((a) => a.map((x) => (x.id === c.id ? c : x)))}
              aoCriarConta={(c) => setContas((a) => [...a, c])}
              aoMudarCategoria={(c) => setCategorias((a) => (a.some((x) => x.id === c.id) ? a.map((x) => (x.id === c.id ? c : x)) : [...a, c]))}
              aoSalvarEvento={aoSalvarEvento}
              aoRecarregar={carregar}
            />
          )}
        </div>
      )}

      {editando && (
        <FormularioDeLancamento
          key={editando.id || 'novo'}
          inicial={editando}
          contas={contas}
          categorias={categorias}
          eventos={orcamentos}
          membros={membros}
          aoSalvar={gravar}
          aoRemover={editando.id ? () => remover(editando.id) : undefined}
          aoFechar={() => setEditando(null)}
        />
      )}
    </div>
  );
}
