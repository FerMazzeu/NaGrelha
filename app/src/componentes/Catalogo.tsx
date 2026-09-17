import { useMemo, useState } from 'react';
import TabelasDeCache from './TabelasDeCache';
import { agruparPorPreparo, CATEGORIAS, ROTULO_CATEGORIA } from '../dominio/catalogo';
import type { Categoria, Item, Servico } from '../dominio/tipos';
import { casaBusca, inteiro, real } from '../formato';
import { Campo, CampoNumero, CampoTexto, Segmentado } from './Campos';
import { Lupa } from './Icones';

const VAZIO: Omit<Item, 'id'> = {
  nome: '',
  grupo: '',
  categoria: 'carne',
  unidade: 'kg',
  porPessoa: 100,
  rendimento: 0.75,
  preco: 0,
};

/**
 * A tabela do Alan.
 *
 * Mexer aqui muda os orçamentos novos, e não os já salvos: cada orçamento
 * guarda uma cópia dos valores do dia em que foi feito, senão o preço de um
 * evento fechado mudaria sozinho quando a picanha subisse.
 */
export default function Catalogo({
  itens,
  servicos,
  aoSalvar,
  aoCriar,
  aoRemover,
  aoSalvarServico,
}: {
  itens: Item[];
  servicos: Servico[];
  aoSalvar: (item: Item) => Promise<void>;
  aoCriar: (item: Omit<Item, 'id'>) => Promise<void>;
  aoRemover: (id: string) => Promise<void>;
  aoSalvarServico: (servico: Servico) => Promise<void>;
}) {
  const [novo, setNovo] = useState(VAZIO);
  const [abrindo, setAbrindo] = useState(false);
  const [busca, setBusca] = useState('');
  const [secao, setSecao] = useState<'itens' | 'cache'>('itens');

  const encontrados = useMemo(() => itens.filter((i) => casaBusca(busca, i.nome)), [itens, busca]);

  const criar = async () => {
    if (!novo.nome.trim()) return;
    await aoCriar(novo);
    setNovo(VAZIO);
    setAbrindo(false);
  };

  return (
    <div className="area py-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="titulo text-2xl">Catálogo</h1>
          <p className="mt-1 text-sm text-fumaca">
            {secao === 'itens'
              ? 'Item, quanto vai por pessoa, aproveitamento e preço.'
              : 'Quanto o Alan e a Érica cobram, por tamanho e tipo de evento.'}
          </p>
        </div>
        {secao === 'itens' && (
          <button type="button" className="botao botao-brasa" onClick={() => setAbrindo((v) => !v)}>
            {abrindo ? 'Cancelar' : 'Novo item'}
          </button>
        )}
      </div>

      <div className="mt-4 flex gap-1 rounded-full border border-borda p-1">
        {(
          [
            ['itens', 'Itens'],
            ['cache', 'Tabelas de cachê'],
          ] as const
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            aria-pressed={secao === valor}
            onClick={() => setSecao(valor)}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
              secao === valor ? 'bg-carvao-3 text-dourado' : 'text-fumaca hover:text-creme'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {secao === 'cache' && (
        <div className="mt-5">
          <TabelasDeCache servicos={servicos} aoSalvar={aoSalvarServico} />
        </div>
      )}

      {secao === 'itens' && (
        <>

      {abrindo && (
        <div className="cartao mt-4 space-y-4 p-4">
          <Campo rotulo="Nome do item">
            <CampoTexto
              valor={novo.nome}
              aoMudar={(v) => setNovo({ ...novo, nome: v })}
              placeholder="Cupim, tulipa de frango, pão francês"
            />
          </Campo>

          <Campo rotulo="Preparo" dica="O prato a que este item pertence. Itens do mesmo preparo ficam juntos na compra.">
            <CampoTexto
              valor={novo.grupo}
              aoMudar={(v) => setNovo({ ...novo, grupo: v })}
              placeholder="Churrasco, Maionese, Hamburguer na grelha"
              list="preparos"
            />
            <datalist id="preparos">
              {[...new Set(itens.map((i) => i.grupo).filter(Boolean))].map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </Campo>

          <Campo rotulo="Categoria">
            <Segmentado<Categoria>
              valor={novo.categoria}
              aoMudar={(v) => setNovo({ ...novo, categoria: v })}
              opcoes={CATEGORIAS.map((c) => ({ valor: c, rotulo: ROTULO_CATEGORIA[c] }))}
            />
          </Campo>

          <Campo rotulo="Como se compra">
            <Segmentado<Item['unidade']>
              valor={novo.unidade}
              aoMudar={(v) => setNovo({ ...novo, unidade: v })}
              opcoes={[
                { valor: 'kg', rotulo: 'Por quilo' },
                { valor: 'un', rotulo: 'Por unidade' },
              ]}
            />
          </Campo>

          <div className="grid grid-cols-3 gap-2">
            <Campo rotulo="Por pessoa">
              <CampoNumero
                valor={novo.porPessoa}
                aoMudar={(v) => setNovo({ ...novo, porPessoa: v })}
                sufixo={novo.unidade === 'kg' ? 'g' : 'un'}
              />
            </Campo>
            <Campo rotulo="Aproveita">
              <CampoNumero
                valor={Math.round(novo.rendimento * 100)}
                aoMudar={(v) => setNovo({ ...novo, rendimento: Math.min(100, Math.max(1, v)) / 100 })}
                sufixo="%"
              />
            </Campo>
            <Campo rotulo="Preço">
              <CampoNumero
                valor={novo.preco}
                aoMudar={(v) => setNovo({ ...novo, preco: v })}
                sufixo={novo.unidade === 'kg' ? '/kg' : '/un'}
              />
            </Campo>
          </div>

          <p className="text-xs text-fumaca">
            {novo.categoria === 'carne'
              ? 'Em carne, "por pessoa" é o peso no prato, já assado e sem osso. O aproveitamento faz a conta do que comprar: costela com osso fica perto de 50%, linguiça 85%.'
              : 'Aqui "por pessoa" já é a quantidade no estado em que você compra, então o aproveitamento costuma ser 100%.'}
          </p>

          <button type="button" className="botao botao-brasa w-full" onClick={criar} disabled={!novo.nome.trim()}>
            Adicionar ao catálogo
          </button>
        </div>
      )}

      <div className="relative mt-4">
        <input
          type="search"
          className="campo pl-10"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Procurar item"
          aria-label="Procurar item no catálogo"
        />
        <Lupa className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fumaca" />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca('')}
            aria-label="Limpar busca"
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-fumaca hover:text-creme"
          >
            ×
          </button>
        )}
      </div>

      {busca && (
        <p className="mt-2 text-sm text-fumaca">
          {encontrados.length === 0
            ? 'Nenhum item com esse nome.'
            : `${encontrados.length} ${encontrados.length === 1 ? 'item encontrado' : 'itens encontrados'}`}
        </p>
      )}

      {!busca && (
        <p className="cartao mt-6 p-4 text-sm text-fumaca">
          Preço e aproveitamento daqui valem para orçamentos <strong className="text-creme">novos</strong>. Orçamento
          já salvo mantém os valores do dia em que foi feito.
        </p>
      )}

      {/* Por preparo, nao por categoria: e assim que a compra acontece. */}
      <div className="mt-6 space-y-8">
        {agruparPorPreparo(encontrados).map(([preparo, itens]) => (
          <section key={preparo}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="titulo text-lg text-dourado">{preparo}</h2>
              <span className="shrink-0 text-xs text-fumaca">
                {itens.length} {itens.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
            <div className="mt-3 space-y-3">
              {itens.map((item) => (
                <LinhaDeItem key={item.id} item={item} aoSalvar={aoSalvar} aoRemover={aoRemover} />
              ))}
            </div>
          </section>
        ))}
      </div>
        </>
      )}
    </div>
  );
}

function LinhaDeItem({
  item,
  aoSalvar,
  aoRemover,
}: {
  item: Item;
  aoSalvar: (item: Item) => Promise<void>;
  aoRemover: (id: string) => Promise<void>;
}) {
  const [rascunho, setRascunho] = useState(item);
  const sujo =
    rascunho.nome !== item.nome ||
    rascunho.porPessoa !== item.porPessoa ||
    rascunho.rendimento !== item.rendimento ||
    rascunho.preco !== item.preco;

  return (
    <div className="cartao p-4">
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded-full border border-borda px-2 py-1 text-[0.65rem] text-fumaca">
          {ROTULO_CATEGORIA[item.categoria]}
        </span>
        <CampoTexto
          valor={rascunho.nome}
          aoMudar={(v) => setRascunho({ ...rascunho, nome: v })}
          aria-label="Nome do item"
        />
        <button
          type="button"
          aria-label={`Remover ${item.nome}`}
          title="Tira do catálogo sem apagar dos eventos antigos"
          className="botao botao-linha !min-h-12 !w-12 shrink-0 !px-0 !text-fumaca hover:!border-brasa hover:!text-brasa-clara"
          onClick={() => aoRemover(item.id)}
        >
          ×
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Campo rotulo="Por pessoa">
          <CampoNumero
            valor={rascunho.porPessoa}
            aoMudar={(v) => setRascunho({ ...rascunho, porPessoa: v })}
            sufixo={item.unidade === 'kg' ? 'g' : 'un'}
          />
        </Campo>
        <Campo rotulo="Aproveita">
          <CampoNumero
            valor={Math.round(rascunho.rendimento * 100)}
            aoMudar={(v) => setRascunho({ ...rascunho, rendimento: Math.min(100, Math.max(1, v)) / 100 })}
            sufixo="%"
          />
        </Campo>
        <Campo rotulo="Preço">
          <CampoNumero
            valor={rascunho.preco}
            aoMudar={(v) => setRascunho({ ...rascunho, preco: v })}
            sufixo={item.unidade === 'kg' ? '/kg' : '/un'}
          />
        </Campo>
      </div>

      <p className="mt-2 text-xs text-fumaca">
        {item.categoria === 'carne'
          ? `${inteiro(rascunho.porPessoa)} g no prato exigem comprar ${inteiro(
              rascunho.porPessoa / (rascunho.rendimento || 1),
            )} g crus, a ${real(rascunho.preco / (rascunho.rendimento || 1))} por quilo servido.`
          : `Custa ${real(
              item.unidade === 'kg' ? (rascunho.porPessoa / 1000) * rascunho.preco : rascunho.porPessoa * rascunho.preco,
            )} por pessoa.`}
      </p>

      {sujo && (
        <button type="button" className="botao botao-brasa mt-3 w-full" onClick={() => aoSalvar(rascunho)}>
          Salvar alteração
        </button>
      )}
    </div>
  );
}
