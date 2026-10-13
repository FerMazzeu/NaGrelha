import { useState } from 'react';
import { financeiro } from '../../dados/financeiro';
import {
  hojeIso,
  ROTULO_GRUPO,
  ROTULO_TIPO_CONTA,
  saldos,
  type Categoria,
  type Conta,
  type GrupoDeCategoria,
  type TipoDeConta,
} from '../../dominio/financeiro';
import type { Orcamento } from '../../dominio/tipos';
import { mensagemDe } from '../../erro';
import { real } from '../../formato';
import { Campo, CampoNumero, CampoTexto } from '../Campos';
import type { AcoesDoCaixa, DadosDoCaixa } from './Caixa';
import ImportarCaixa from './ImportarCaixa';

export default function Ajustes({
  dados,
  acoes,
  aoMudarConta,
  aoCriarConta,
  aoMudarCategoria,
  aoSalvarEvento,
  aoRecarregar,
}: {
  dados: DadosDoCaixa;
  acoes: AcoesDoCaixa;
  aoMudarConta: (c: Conta) => void;
  aoCriarConta: (c: Conta) => void;
  aoMudarCategoria: (c: Categoria) => void;
  aoSalvarEvento: (o: Orcamento) => Promise<void>;
  aoRecarregar: () => Promise<void>;
}) {
  const atuais = new Map(saldos(dados.contas, dados.lancamentos).map((x) => [x.conta.id, x.saldo]));

  return (
    <div className="space-y-8">
      <section>
        <h2 className="titulo text-lg text-dourado">Contas</h2>
        <p className="mt-1 text-sm text-fumaca">
          O saldo inicial é quanto tinha na conta no dia em que o controle começou. O que foi pago antes desse dia já
          está dentro dele.
        </p>
        <div className="mt-3 space-y-3">
          {dados.contas.map((c) => (
            <EditorDeConta
              // A importação muda o saldo inicial por fora: a chave remonta o editor com o valor novo.
              key={`${c.id}-${c.saldoInicial}-${c.saldoInicialEm}`}
              conta={c}
              saldoAtual={atuais.get(c.id) ?? 0}
              acoes={acoes}
              categorias={dados.categorias}
              aoSalvar={aoMudarConta}
            />
          ))}
          <NovaConta aoCriar={aoCriarConta} />
        </div>
      </section>

      <section>
        <h2 className="titulo text-lg text-dourado">Importar a planilha de controle de caixa</h2>
        <p className="mt-1 text-sm text-fumaca">
          A planilha "CONTROLE CAIXA NA GRELHA", com uma aba por ano. Os eventos entram no app, o que já foi recebido e
          a parte do Alan e da Érica viram lançamentos, e o dinheiro em caixa vira o saldo inicial das contas.
        </p>
        <ImportarCaixa dados={dados} aoSalvarEvento={aoSalvarEvento} aoMudarConta={aoMudarConta} aoTerminar={aoRecarregar} />
      </section>

      <section>
        <h2 className="titulo text-lg text-dourado">Categorias</h2>
        <p className="mt-1 text-sm text-fumaca">O grupo é o que monta o resultado do mês: receita, custo, equipe, pró-labore.</p>
        <Categorias categorias={dados.categorias} aoMudar={aoMudarCategoria} />
      </section>
    </div>
  );
}

function EditorDeConta({
  conta,
  saldoAtual,
  acoes,
  categorias,
  aoSalvar,
}: {
  conta: Conta;
  saldoAtual: number;
  acoes: AcoesDoCaixa;
  categorias: Categoria[];
  aoSalvar: (c: Conta) => void;
}) {
  const [c, setC] = useState(conta);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState('');
  const [conferindo, setConferindo] = useState(false);
  const [noBanco, setNoBanco] = useState(saldoAtual);
  const mudou = JSON.stringify(c) !== JSON.stringify(conta);

  const salvar = async () => {
    setGravando(true);
    setErro('');
    try {
      await financeiro.salvarConta(c);
      aoSalvar(c);
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setGravando(false);
    }
  };

  /*
    Conferir com o extrato: se o banco diz outro número, a diferença vira um
    lançamento de ajuste, com nome. Mexer no saldo inicial apagaria a pista de
    que alguma coisa não foi lançada.
  */
  const ajustar = () => {
    const diferenca = Math.round((noBanco - saldoAtual) * 100) / 100;
    if (!diferenca) {
      setConferindo(false);
      return;
    }
    const tipo = diferenca > 0 ? 'entrada' : 'saida';
    acoes.novo(tipo, {
      valor: Math.abs(diferenca),
      contaId: conta.id,
      categoriaId: categorias.find((x) => x.tipo === tipo && x.grupo === 'outros')?.id ?? null,
      descricao: `Ajuste de saldo ${conta.nome}`,
      observacoes: `O app mostrava ${real(saldoAtual)} e a conta tinha ${real(noBanco)}.`,
    });
    setConferindo(false);
  };

  return (
    <div className={`cartao p-4 ${c.ativo ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">{conta.nome}</p>
        <p className="text-sm">
          Saldo hoje <strong className={saldoAtual < 0 ? 'text-brasa-clara' : 'text-creme'}>{real(saldoAtual)}</strong>
        </p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <Campo rotulo="Nome">
          <CampoTexto valor={c.nome} aoMudar={(nome) => setC({ ...c, nome })} />
        </Campo>
        <Campo rotulo="Tipo">
          <select className="campo" value={c.tipo} onChange={(e) => setC({ ...c, tipo: e.target.value as TipoDeConta })}>
            {(Object.keys(ROTULO_TIPO_CONTA) as TipoDeConta[]).map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO_CONTA[t]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Saldo inicial">
          <CampoNumero valor={c.saldoInicial} aoMudar={(saldoInicial) => setC({ ...c, saldoInicial })} sufixo="R$" />
        </Campo>
        <Campo rotulo="Em">
          <input type="date" className="campo" value={c.saldoInicialEm} onChange={(e) => setC({ ...c, saldoInicialEm: e.target.value || hojeIso() })} />
        </Campo>
      </div>
      {erro && <p className="mt-2 text-sm text-brasa-clara">{erro}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {mudou && (
          <button type="button" className="botao botao-brasa !min-h-9 !px-3 text-sm" disabled={gravando} onClick={() => void salvar()}>
            {gravando ? 'Gravando...' : 'Salvar conta'}
          </button>
        )}
        {conferindo ? (
          <>
            <div className="w-40">
              <CampoNumero valor={noBanco} aoMudar={setNoBanco} sufixo="R$" aria-label="Saldo no extrato" />
            </div>
            <button type="button" className="botao botao-linha !min-h-9 !px-3 text-sm" onClick={ajustar}>
              Lançar a diferença
            </button>
            <button type="button" className="text-sm text-fumaca hover:text-creme" onClick={() => setConferindo(false)}>
              Cancelar
            </button>
          </>
        ) : (
          <button
            type="button"
            className="botao botao-linha !min-h-9 !px-3 text-sm"
            onClick={() => {
              setNoBanco(saldoAtual);
              setConferindo(true);
            }}
          >
            Conferir com o extrato
          </button>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm text-fumaca">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#c4261d]"
            checked={c.ativo}
            onChange={(e) => setC({ ...c, ativo: e.target.checked })}
          />
          Em uso
        </label>
      </div>
    </div>
  );
}

function NovaConta({ aoCriar }: { aoCriar: (c: Conta) => void }) {
  const [abrindo, setAbrindo] = useState(false);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoDeConta>('banco');
  const [saldo, setSaldo] = useState(0);
  const [erro, setErro] = useState('');

  if (!abrindo) {
    return (
      <button type="button" className="botao botao-linha" onClick={() => setAbrindo(true)}>
        + Nova conta
      </button>
    );
  }
  return (
    <div className="cartao p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo rotulo="Nome">
          <CampoTexto valor={nome} aoMudar={setNome} placeholder="Banco do Brasil, maquininha" autoFocus />
        </Campo>
        <Campo rotulo="Tipo">
          <select className="campo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoDeConta)}>
            {(Object.keys(ROTULO_TIPO_CONTA) as TipoDeConta[]).map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO_CONTA[t]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Saldo hoje">
          <CampoNumero valor={saldo} aoMudar={setSaldo} sufixo="R$" />
        </Campo>
      </div>
      {erro && <p className="mt-2 text-sm text-brasa-clara">{erro}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="botao botao-brasa"
          disabled={!nome.trim()}
          onClick={async () => {
            try {
              aoCriar(await financeiro.criarConta({ nome, tipo, saldoInicial: saldo, saldoInicialEm: hojeIso(), ativo: true }));
              setAbrindo(false);
              setNome('');
              setSaldo(0);
            } catch (e) {
              setErro(mensagemDe(e));
            }
          }}
        >
          Criar conta
        </button>
        <button type="button" className="botao botao-linha" onClick={() => setAbrindo(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Categorias({ categorias, aoMudar }: { categorias: Categoria[]; aoMudar: (c: Categoria) => void }) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('saida');
  const [grupo, setGrupo] = useState<GrupoDeCategoria>('despesa_fixa');
  const [erro, setErro] = useState('');

  const mudar = async (c: Categoria) => {
    aoMudar(c);
    try {
      await financeiro.salvarCategoria(c);
    } catch (e) {
      setErro(mensagemDe(e));
    }
  };

  return (
    <div className="mt-3 space-y-4">
      {(['entrada', 'saida'] as const).map((t) => (
        <div key={t}>
          <p className="rotulo mb-2">{t === 'entrada' ? 'Entradas' : 'Saídas'}</p>
          <div className="cartao divide-y divide-borda">
            {categorias
              .filter((c) => c.tipo === t)
              .map((c) => (
                <div key={c.id} className={`flex flex-wrap items-center gap-2 px-3 py-2 ${c.ativo ? '' : 'opacity-50'}`}>
                  <span className="min-w-0 flex-1 truncate text-sm">{c.nome}</span>
                  <select
                    className="campo !min-h-9 !w-auto !py-1 text-xs"
                    value={c.grupo}
                    onChange={(e) => void mudar({ ...c, grupo: e.target.value as GrupoDeCategoria })}
                    aria-label={`Grupo de ${c.nome}`}
                  >
                    {(Object.keys(ROTULO_GRUPO) as GrupoDeCategoria[]).map((g) => (
                      <option key={g} value={g}>
                        {ROTULO_GRUPO[g]}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="text-xs text-fumaca hover:text-creme" onClick={() => void mudar({ ...c, ativo: !c.ativo })}>
                    {c.ativo ? 'Esconder' : 'Usar de novo'}
                  </button>
                </div>
              ))}
          </div>
        </div>
      ))}

      <div className="cartao grid gap-3 p-4 sm:grid-cols-4">
        <Campo rotulo="Nova categoria">
          <CampoTexto valor={nome} aoMudar={setNome} placeholder="Aluguel do galpão" />
        </Campo>
        <Campo rotulo="Tipo">
          <select className="campo" value={tipo} onChange={(e) => setTipo(e.target.value as 'entrada' | 'saida')}>
            <option value="saida">Saída</option>
            <option value="entrada">Entrada</option>
          </select>
        </Campo>
        <Campo rotulo="Grupo">
          <select className="campo" value={grupo} onChange={(e) => setGrupo(e.target.value as GrupoDeCategoria)}>
            {(Object.keys(ROTULO_GRUPO) as GrupoDeCategoria[]).map((g) => (
              <option key={g} value={g}>
                {ROTULO_GRUPO[g]}
              </option>
            ))}
          </select>
        </Campo>
        <div className="flex items-end">
          <button
            type="button"
            className="botao botao-brasa w-full"
            disabled={!nome.trim()}
            onClick={async () => {
              try {
                aoMudar(await financeiro.criarCategoria({ nome, tipo, grupo, ativo: true }));
                setNome('');
              } catch (e) {
                setErro(mensagemDe(e));
              }
            }}
          >
            Criar
          </button>
        </div>
      </div>
      {erro && <p className="text-sm text-brasa-clara">{erro}</p>}
    </div>
  );
}
