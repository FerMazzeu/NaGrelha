import { useCallback, useMemo, useState } from 'react';
import type { Item } from '../dominio/tipos';
import { exportarCatalogo } from '../excel';
import { inteiro } from '../formato';
import { compararComCatalogo, type Comparacao, type Opcoes } from '../importacao';
import { lerFotos, MAXIMO_DE_FOTOS } from '../foto-planilha';
import { EXPLICACAO, lerArquivo, type PlanilhaLida } from '../planilha';
import { Arquivo, Imagem } from './Icones';
import Mudancas, { incompleto, type Mudanca, type Rascunho } from './Mudancas';

/**
 * Trazer a planilha do Excel para o catálogo.
 *
 * O Alan trabalha na planilha dele desde antes deste app existir, e vai
 * continuar. O caminho era mandar o arquivo por WhatsApp e alguém digitar item
 * por item.
 *
 * Esta tela foi refeita três vezes, e as três com razão:
 *
 * 1. Pedia o número de pessoas em dois campos parecidos antes de mostrar nada,
 *    e exigia esse número até para quem só queria atualizar preço.
 * 2. Era um relatório: dizia o que faltava e mandava a pessoa consertar noutra
 *    aba, depois de aplicar errado.
 * 3. Eram três listas separadas, e o mesmo item aparecia em duas delas sem
 *    explicação.
 *
 * Agora: sobe o arquivo, aparece UMA tabela do que vai mudar, cada linha abre
 * para editar, e o que você confirma é o que entra.
 *
 * E entra por foto também, porque metade do que ele manda é foto da tela do
 * Excel. A leitura por foto é a única parte que roda no servidor; daí para
 * frente é exatamente o mesmo caminho do arquivo.
 */
export default function ImportarCatalogo({
  catalogo,
  aoSalvar,
  aoCriar,
  aoTerminar,
}: {
  catalogo: Item[];
  aoSalvar: (item: Item) => Promise<void>;
  aoCriar: (item: Omit<Item, 'id'>) => Promise<void>;
  aoTerminar: () => void;
}) {
  const [lida, setLida] = useState<PlanilhaLida | null>(null);
  const [nomeDoArquivo, setNomeDoArquivo] = useState('');
  /** Foto é leitura de máquina, e a tela precisa dizer isso a quem confere. */
  const [veioDeFoto, setVeioDeFoto] = useState(false);
  const [erro, setErro] = useState('');
  const [lendo, setLendo] = useState<false | 'arquivo' | 'foto'>(false);
  const [aplicando, setAplicando] = useState(false);
  const [pronto, setPronto] = useState('');
  const [baixando, setBaixando] = useState(false);
  const [mostrarBaixar, setMostrarBaixar] = useState(false);

  const [pessoas, setPessoas] = useState(0);
  const [comQuantidade, setComQuantidade] = useState(false);

  const [recusados, setRecusados] = useState<Set<string>>(new Set());
  const [rascunhos, setRascunhos] = useState<Record<string, Rascunho>>({});

  /**
   * Abre o que a pessoa escolheu, seja arquivo ou foto.
   *
   * Recebe uma lista porque tabela raramente cabe numa foto só: ela fotografa
   * em pedaços e manda os pedaços juntos. Arquivo continua sendo um de cada
   * vez, que é como ele trabalha.
   */
  const abrir = async (arquivos: File[]) => {
    if (!arquivos.length) return;
    const fotos = arquivos.filter((a) => a.type.startsWith('image/'));
    const porFoto = fotos.length > 0;

    setErro('');
    setPronto('');
    setLendo(porFoto ? 'foto' : 'arquivo');
    try {
      const resultado = porFoto ? await lerFotos(fotos) : await lerArquivo(arquivos[0]);

      if (!resultado.itens.length) {
        setErro(
          porFoto
            ? 'Não consegui ler item nenhum nessa foto. Tenta de novo com a tabela mais de frente, sem sombra, e com os nomes legíveis.'
            : 'Não achei item nenhum nessa planilha. Ela precisa ter o preparo numa linha própria e os itens abaixo dele.',
        );
        setLida(null);
        return;
      }

      setLida(resultado);
      setVeioDeFoto(porFoto);
      setNomeDoArquivo(
        porFoto
          ? fotos.length === 1
            ? fotos[0].name
            : `${inteiro(fotos.length)} fotos`
          : arquivos[0].name,
      );
      setPessoas(resultado.pessoas ?? 0);
      setRecusados(new Set());
      setRascunhos({});
    } catch (e) {
      const recado = e instanceof Error ? e.message : String(e);
      setErro(porFoto ? recado : `Não consegui abrir o arquivo: ${recado}`);
      setLida(null);
    } finally {
      setLendo(false);
    }
  };

  const opcoes: Opcoes = {
    pessoas: pessoas || 1,
    atualizarPrecos: true,
    atualizarQuantidades: comQuantidade && pessoas > 0,
    criarNovos: true,
  };

  const comparacao = useMemo(
    () => (lida ? compararComCatalogo(lida.itens, catalogo, opcoes) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lida, catalogo, pessoas, comQuantidade],
  );

  /*
    As três listas da comparação viram UMA tabela.

    Preço e quantidade do mesmo item eram duas linhas em dois blocos: quem
    conferia via o item duas vezes e não entendia por quê. Aqui é uma linha por
    item, com tudo que muda nele.
  */
  const montarLinhas = useCallback((c: Comparacao, atuais: Record<string, Rascunho>): Mudanca[] => {
    const porItem = new Map<string, Mudanca>();

    const daExistente = (item: Item) => {
      const chave = `e:${item.id}`;
      if (!porItem.has(chave)) {
        porItem.set(chave, {
          chave,
          nome: item.nome,
          preparo: item.grupo,
          unidade: item.unidade,
          tipo: 'existente',
          precoAtual: item.preco,
          porPessoaAtual: item.porPessoa,
          rascunho: {
            nome: item.nome,
            preco: item.preco,
            porPessoa: item.porPessoa,
            categoria: item.categoria,
            rendimento: item.rendimento,
            unidade: item.unidade,
          },
        });
      }
      return porItem.get(chave)!;
    };

    for (const p of c.precos) daExistente(p.item).rascunho.preco = p.para;
    for (const q of c.quantidades) daExistente(q.item).rascunho.porPessoa = q.para;

    for (const n of c.novos) {
      const chave = `n:${n.grupo}|${n.nome}`;
      porItem.set(chave, {
        chave,
        nome: n.nome,
        preparo: n.grupo,
        unidade: n.unidade,
        tipo: 'novo',
        precoAtual: null,
        porPessoaAtual: null,
        rascunho: {
          nome: n.nome,
          preco: n.preco,
          porPessoa: n.porPessoa,
          categoria: n.categoria,
          rendimento: n.rendimento,
          unidade: n.unidade,
        },
      });
    }

    // O que a pessoa digitou ganha do que veio da planilha.
    return [...porItem.values()].map((m) => (atuais[m.chave] ? { ...m, rascunho: atuais[m.chave] } : m));
  }, []);

  const linhas = useMemo(
    () => (comparacao ? montarLinhas(comparacao, rascunhos) : []),
    [comparacao, rascunhos, montarLinhas],
  );

  const marcadas = linhas.filter((m) => !recusados.has(m.chave));
  const faltamPreencher = marcadas.filter(incompleto).length;

  const aplicar = async () => {
    setAplicando(true);
    setErro('');
    try {
      for (const m of marcadas) {
        const r = m.rascunho;
        if (m.tipo === 'existente') {
          const original = catalogo.find((i) => `e:${i.id}` === m.chave);
          if (!original) continue;
          // Uma gravação por item, com tudo que mudou nele junto.
          await aoSalvar({ ...original, preco: r.preco, porPessoa: r.porPessoa });
        } else {
          await aoCriar({
            nome: r.nome.trim() || m.nome,
            grupo: m.preparo,
            categoria: r.categoria,
            unidade: r.unidade,
            porPessoa: r.porPessoa,
            rendimento: r.rendimento,
            preco: r.preco,
          });
        }
      }

      setPronto(
        `${inteiro(marcadas.length)} ${marcadas.length === 1 ? 'mudança aplicada' : 'mudanças aplicadas'}.`,
      );
      setLida(null);
      aoTerminar();
    } catch (e) {
      setErro(
        `Parou no meio: ${e instanceof Error ? e.message : String(e)}. O que já entrou está salvo, dá para subir a planilha de novo.`,
      );
    } finally {
      setAplicando(false);
    }
  };

  return (
    <div className="space-y-4">
      {!lida && (
        <>
          <label
            className={`cartao flex items-center gap-3 p-4 transition-colors ${
              lendo ? 'opacity-60' : 'cursor-pointer hover:border-dourado/40'
            }`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-carvao-3 text-dourado">
              <Arquivo className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">
                {lendo === 'arquivo' ? 'Lendo a planilha...' : 'Escolher planilha do Excel'}
              </span>
              <span className="block truncate text-sm text-fumaca">
                {nomeDoArquivo || 'Nada muda até você conferir e confirmar'}
              </span>
            </span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              disabled={!!lendo}
              onChange={(e) => {
                abrir([...(e.target.files ?? [])]);
                e.target.value = '';
              }}
            />
          </label>

          {/*
            A foto é um caminho separado, e não um `accept` a mais no campo de
            cima, porque ela custa dinheiro, demora alguns segundos e erra. Quem
            tem o arquivo deve subir o arquivo; a foto é para quem só tem a foto.
          */}
          <label
            className={`cartao flex items-center gap-3 p-4 transition-colors ${
              lendo ? 'opacity-60' : 'cursor-pointer hover:border-dourado/40'
            }`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-carvao-3 text-dourado">
              <Imagem className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">
                {lendo === 'foto' ? 'Lendo a foto...' : 'Ou mandar foto da tabela'}
              </span>
              <span className="block truncate text-sm text-fumaca">
                {lendo === 'foto'
                  ? 'Isso leva alguns segundos'
                  : `Dá para mandar até ${inteiro(MAXIMO_DE_FOTOS)} fotos da mesma planilha`}
              </span>
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={!!lendo}
              onChange={(e) => {
                abrir([...(e.target.files ?? [])]);
                e.target.value = '';
              }}
            />
          </label>

          <button
            type="button"
            className="w-full text-left text-sm text-fumaca underline-offset-2 hover:text-creme hover:underline"
            onClick={() => setMostrarBaixar((v) => !v)}
          >
            {mostrarBaixar ? 'Esconder' : 'Ou baixe o cardápio de hoje para editar no Excel'}
          </button>

          {mostrarBaixar && (
            <div className="cartao p-4">
              <p className="text-sm text-fumaca">
                Sai uma planilha no formato do Alan, com as quantidades de compra para o tamanho que
                você escolher. Ele edita lá e devolve, e você sobe aqui em cima.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  className="campo w-28"
                  value={pessoas || 80}
                  onChange={(e) => setPessoas(Number(e.target.value))}
                  aria-label="Pessoas do modelo a baixar"
                />
                <span className="text-sm text-fumaca">pessoas</span>
                <button
                  type="button"
                  className="botao botao-linha ml-auto !min-h-10 text-sm"
                  disabled={baixando}
                  onClick={async () => {
                    setBaixando(true);
                    setErro('');
                    try {
                      await exportarCatalogo(catalogo, pessoas || 80);
                    } catch (e) {
                      setErro(`Não consegui gerar: ${e instanceof Error ? e.message : String(e)}`);
                    } finally {
                      setBaixando(false);
                    }
                  }}
                >
                  {baixando ? 'Gerando...' : 'Baixar'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {erro && (
        <p className="rounded-xl border border-brasa/50 bg-brasa/10 p-3 text-sm text-brasa-clara">{erro}</p>
      )}

      {pronto && (
        <p className="rounded-xl border border-dourado/40 bg-dourado/10 p-3 text-sm text-dourado">{pronto}</p>
      )}

      {lida && comparacao && (
        <>
          <div className="cartao p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{nomeDoArquivo}</p>
                <p className="mt-1 text-sm text-fumaca">
                  {inteiro(lida.itens.length)} itens em{' '}
                  {inteiro(new Set(lida.itens.map((i) => i.grupo)).size)} preparos
                  {lida.pessoas ? `, modelo de ${inteiro(lida.pessoas)} pessoas` : ''}.
                </p>
              </div>
              <button
                type="button"
                className="botao botao-linha !min-h-9 shrink-0 text-xs"
                onClick={() => {
                  setLida(null);
                  setNomeDoArquivo('');
                  setVeioDeFoto(false);
                }}
              >
                Trocar
              </button>
            </div>

            {/*
              Leitura de foto erra, e erra em silêncio.

              Eu mesmo li 1400 numa tabela de cachê onde estava 1600, e só
              apareceu quando chegou a foto nítida. Quem confere precisa saber
              que está conferindo um palpite, não uma cópia.
            */}
            {veioDeFoto && (
              <p className="mt-3 rounded-xl border border-dourado/40 bg-dourado/10 p-3 text-sm text-dourado">
                Isso foi lido da foto, então confira os números antes de confirmar. Preço e
                quantidade tortos na foto saem tortos aqui.
              </p>
            )}

            {lida.ignoradas.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-fumaca">
                  {inteiro(lida.ignoradas.length)}{' '}
                  {lida.ignoradas.length === 1 ? 'linha ficou de fora' : 'linhas ficaram de fora'}
                </summary>
                <ul className="mt-2 space-y-1.5 text-xs">
                  {lida.ignoradas.map((i) => (
                    <li key={i.linha}>
                      <span className="text-creme">
                        Linha {inteiro(i.linha)}: {i.texto}
                      </span>
                      <br />
                      <span className="text-fumaca">{EXPLICACAO[i.motivo]}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <label className="mt-3 flex items-start gap-3 border-t border-borda pt-3 text-sm">
              <input
                type="checkbox"
                checked={comQuantidade}
                onChange={(e) => setComQuantidade(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[#c4261d]"
              />
              <span className="min-w-0">
                <span className="block">Trazer também a quantidade por pessoa</span>
                <span className="block text-xs text-fumaca">
                  Só ligue se a planilha tiver as quantidades certas do evento.
                </span>
              </span>
            </label>

            {comQuantidade && (
              <div className="mt-2 flex items-center gap-2 pl-8">
                <input
                  type="number"
                  className="campo w-24"
                  value={pessoas}
                  onChange={(e) => setPessoas(Number(e.target.value))}
                  aria-label="Pessoas do modelo"
                />
                <span className="text-sm text-fumaca">
                  {lida.pessoas ? 'pessoas, lido da planilha' : 'pessoas do modelo'}
                </span>
              </div>
            )}
          </div>

          <Mudancas
            comparacao={comparacao}
            rascunhos={rascunhos}
            recusados={recusados}
            aoAlternar={(chave) =>
              setRecusados((r) => {
                const novo = new Set(r);
                if (novo.has(chave)) novo.delete(chave);
                else novo.add(chave);
                return novo;
              })
            }
            aoMudar={(chave, r) => setRascunhos((a) => ({ ...a, [chave]: r }))}
            montarLinhas={montarLinhas}
          />

          <div className="cartao p-4">
            <p className="text-sm text-fumaca">
              {inteiro(comparacao.iguais)}{' '}
              {comparacao.iguais === 1 ? 'item já está igual' : 'itens já estão iguais'} ao catálogo.
            </p>
            {faltamPreencher > 0 && (
              <p className="mt-1 text-sm text-dourado">
                {inteiro(faltamPreencher)}{' '}
                {faltamPreencher === 1 ? 'vai entrar incompleto' : 'vão entrar incompletos'}.
              </p>
            )}
            <button
              type="button"
              className="botao botao-brasa mt-3 w-full"
              disabled={aplicando || marcadas.length === 0}
              onClick={aplicar}
            >
              {aplicando
                ? 'Aplicando...'
                : marcadas.length === 0
                  ? 'Nada marcado'
                  : `Aplicar ${inteiro(marcadas.length)} ${marcadas.length === 1 ? 'mudança' : 'mudanças'}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
