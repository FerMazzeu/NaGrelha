import { useMemo, useState } from 'react';
import { CATEGORIAS, ROTULO_CATEGORIA } from '../dominio/catalogo';
import type { Categoria, Item } from '../dominio/tipos';
import { casaBusca, quantidade as formatarQuantidade, real } from '../formato';
import { Campo, CampoNumero, CampoTexto, Segmentado } from './Campos';
import { Lupa } from './Icones';

/**
 * Cabeçalho de uma receita, com o que ela custa e como acrescentar ingrediente.
 *
 * Uma receita aqui não é tabela nova: é o conjunto de itens que compartilham o
 * mesmo preparo, que é exatamente como a planilha do Alan sempre foi. "Tutu de
 * feijão" é o preparo de feijão, bacon, alho e cebola.
 *
 * O que faltava era montar isso sem sofrimento. Para criar uma receita de oito
 * ingredientes era preciso abrir oito formulários e digitar o nome do preparo
 * oito vezes, e um acento diferente numa delas criava um segundo preparo com
 * quase o mesmo nome.
 */
export default function Receita({
  preparo,
  itens,
  catalogo,
  aoCriar,
  aoRenomear,
  children,
}: {
  preparo: string;
  itens: Item[];
  /** O catálogo inteiro, para reaproveitar ingrediente que já existe noutro preparo. */
  catalogo: Item[];
  aoCriar: (item: Omit<Item, 'id'>) => Promise<void>;
  aoRenomear: (de: string, para: string) => Promise<void>;
  /** As linhas de item, montadas por quem chama: elas já sabem salvar e apagar. */
  children: React.ReactNode;
}) {
  const [acrescentando, setAcrescentando] = useState(false);
  const [renomeando, setRenomeando] = useState(false);
  const [nomeNovo, setNomeNovo] = useState(preparo);

  /*
    O custo por pessoa da receita inteira.

    É o número que decide se o preparo entra ou não no orçamento, e ele não
    existia em lugar nenhum: para saber quanto custava o tutu de feijão era
    preciso somar item por item na cabeça.
  */
  const custo = itens.reduce(
    (s, i) => s + (i.unidade === 'kg' ? (i.porPessoa / 1000) * i.preco : i.porPessoa * i.preco),
    0,
  );

  return (
    <section className="cartao p-4">
      {renomeando ? (
        <div>
          <Campo rotulo="Nome da receita">
            <CampoTexto
              valor={nomeNovo}
              aoMudar={setNomeNovo}
              placeholder="Tutu de feijão"
              aria-label={`Novo nome de ${preparo}`}
            />
          </Campo>
          <p className="mt-1 text-xs text-fumaca">
            Renomear muda o preparo dos {itens.length} itens de uma vez.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="botao botao-brasa !min-h-10 flex-1 text-sm"
              disabled={!nomeNovo.trim() || nomeNovo.trim() === preparo}
              onClick={async () => {
                await aoRenomear(preparo, nomeNovo.trim());
                setRenomeando(false);
              }}
            >
              Salvar
            </button>
            <button
              type="button"
              className="botao botao-linha !min-h-10 flex-1 text-sm"
              onClick={() => {
                setNomeNovo(preparo);
                setRenomeando(false);
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-baseline justify-between gap-3">
          <button
            type="button"
            onClick={() => setRenomeando(true)}
            className="titulo min-w-0 truncate text-left text-lg text-dourado"
            title="Renomear a receita"
          >
            {preparo}
          </button>
          <span className="shrink-0 text-right text-xs text-fumaca">
            {itens.length} {itens.length === 1 ? 'item' : 'itens'}
            <br />
            <strong className="text-creme">{real(custo)}</strong> por pessoa
          </span>
        </div>
      )}

      <div className="mt-3 space-y-3">{children}</div>

      {acrescentando ? (
        <NovoIngrediente
          preparo={preparo}
          catalogo={catalogo}
          aoCriar={async (item) => {
            await aoCriar(item);
            setAcrescentando(false);
          }}
          aoCancelar={() => setAcrescentando(false)}
        />
      ) : (
        <button
          type="button"
          className="botao botao-linha mt-3 w-full !min-h-10 text-sm"
          onClick={() => setAcrescentando(true)}
        >
          Acrescentar ingrediente
        </button>
      )}

      {!itens.length && (
        <p className="mt-3 text-sm text-fumaca">
          Receita sem ingrediente ainda. Ela não aparece em orçamento até ter pelo menos um.
        </p>
      )}
    </section>
  );
}

/**
 * Acrescenta um ingrediente à receita.
 *
 * Procura primeiro no catálogo, porque bacon já existe em quatro preparos e
 * copiar o preço e a unidade de lá evita digitar errado. Escolher um existente
 * não move o item: cria uma cópia neste preparo, que é como a planilha do
 * cliente funciona, e é o que faz a lista de compras somar certo.
 */
function NovoIngrediente({
  preparo,
  catalogo,
  aoCriar,
  aoCancelar,
}: {
  preparo: string;
  catalogo: Item[];
  aoCriar: (item: Omit<Item, 'id'>) => Promise<void>;
  aoCancelar: () => void;
}) {
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState<Item | null>(null);
  const [rascunho, setRascunho] = useState<Omit<Item, 'id'>>({
    nome: '',
    grupo: preparo,
    categoria: 'extra',
    unidade: 'un',
    porPessoa: 0,
    rendimento: 1,
    preco: 0,
  });
  const [salvando, setSalvando] = useState(false);

  /*
    Um por nome, e não todas as cópias.

    Bacon aparece em quatro preparos com quatro linhas. Mostrar as quatro na
    busca não ajuda ninguém a escolher: o que interessa é o ingrediente, e o
    preço mais recente que ele tem.
  */
  const sugestoes = useMemo(() => {
    if (busca.trim().length < 2) return [];
    const porNome = new Map<string, Item>();
    for (const i of catalogo) {
      if (!casaBusca(busca, i.nome)) continue;
      const chave = i.nome.toLowerCase();
      if (!porNome.has(chave)) porNome.set(chave, i);
    }
    return [...porNome.values()].slice(0, 6);
  }, [busca, catalogo]);

  const usar = (item: Item) => {
    setEscolhido(item);
    setRascunho({
      nome: item.nome,
      grupo: preparo,
      categoria: item.categoria,
      unidade: item.unidade,
      // A quantidade NÃO vem junto: é o que muda de receita para receita, e é
      // justamente o número que o Alan preenche na hora.
      porPessoa: 0,
      rendimento: item.rendimento,
      preco: item.preco,
    });
  };

  const pronto = rascunho.nome.trim() !== '' && rascunho.preco > 0;

  return (
    <div className="mt-3 rounded-2xl border border-dourado/40 bg-dourado/8 p-3">
      {!escolhido && (
        <>
          <div className="relative">
            <input
              type="search"
              className="campo pl-10"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setRascunho((r) => ({ ...r, nome: e.target.value }));
              }}
              placeholder="Nome do ingrediente"
              aria-label={`Ingrediente novo em ${preparo}`}
            />
            <Lupa className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fumaca" />
          </div>

          {sugestoes.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-fumaca">Já existe no catálogo, aproveita o preço:</p>
              {sugestoes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => usar(s)}
                  className="flex w-full items-center gap-2 rounded-xl bg-carvao-3 px-3 py-2 text-left text-sm transition-colors hover:bg-borda"
                >
                  <span className="min-w-0 flex-1 truncate">{s.nome}</span>
                  <span className="shrink-0 text-xs text-fumaca">
                    {real(s.preco)} por {s.unidade === 'kg' ? 'kg' : 'un'} · {s.grupo}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {escolhido && (
        <p className="text-sm">
          <strong>{escolhido.nome}</strong>
          <button
            type="button"
            className="ml-2 text-xs text-fumaca underline"
            onClick={() => {
              setEscolhido(null);
              setBusca('');
            }}
          >
            trocar
          </button>
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Campo rotulo="Como se compra">
          <Segmentado<Item['unidade']>
            valor={rascunho.unidade}
            aoMudar={(v) => setRascunho({ ...rascunho, unidade: v })}
            opcoes={[
              { valor: 'kg', rotulo: 'Quilo' },
              { valor: 'un', rotulo: 'Unidade' },
            ]}
          />
        </Campo>
        <Campo rotulo="Preço">
          <CampoNumero
            valor={rascunho.preco}
            aoMudar={(v) => setRascunho({ ...rascunho, preco: v })}
            sufixo="R$"
            aria-label={`Preço do ingrediente novo em ${preparo}`}
          />
        </Campo>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Campo
          rotulo="Por pessoa"
          dica={rascunho.unidade === 'kg' ? 'Em gramas, já no prato.' : 'Quantas unidades por convidado.'}
        >
          <CampoNumero
            valor={rascunho.porPessoa}
            aoMudar={(v) => setRascunho({ ...rascunho, porPessoa: v })}
            sufixo={rascunho.unidade === 'kg' ? 'g' : 'un'}
            aria-label={`Por pessoa do ingrediente novo em ${preparo}`}
          />
        </Campo>
        <Campo rotulo="Categoria">
          <select
            className="campo"
            value={rascunho.categoria}
            onChange={(e) => setRascunho({ ...rascunho, categoria: e.target.value as Categoria })}
            aria-label={`Categoria do ingrediente novo em ${preparo}`}
          >
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {ROTULO_CATEGORIA[c]}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      {rascunho.porPessoa > 0 && rascunho.preco > 0 && (
        <p className="mt-2 text-xs text-fumaca">
          {formatarQuantidade(rascunho.porPessoa, rascunho.unidade)} por pessoa dá{' '}
          <strong className="text-creme">
            {real(
              rascunho.unidade === 'kg'
                ? (rascunho.porPessoa / 1000) * rascunho.preco
                : rascunho.porPessoa * rascunho.preco,
            )}
          </strong>{' '}
          por convidado.
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="botao botao-brasa !min-h-10 flex-1 text-sm"
          disabled={!pronto || salvando}
          onClick={async () => {
            setSalvando(true);
            try {
              await aoCriar({ ...rascunho, nome: rascunho.nome.trim() });
            } finally {
              setSalvando(false);
            }
          }}
        >
          {salvando ? 'Salvando...' : 'Acrescentar'}
        </button>
        <button type="button" className="botao botao-linha !min-h-10 flex-1 text-sm" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
