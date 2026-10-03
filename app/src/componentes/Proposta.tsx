import { agruparPorPreparo } from '../dominio/catalogo';
import type { Orcamento, Resultado } from '../dominio/tipos';
import { dataCurta, inteiro, real } from '../formato';

/**
 * A proposta que vai para o cliente, feita para virar PDF.
 *
 * Esta tela é o contrário do Excel que o Alan exporta. Lá vai tudo: preço do
 * quilo da picanha, cachê de cada pessoa da equipe, imposto, caixa, lucro. É
 * o arquivo de trabalho dele, e espelha a planilha que ele já usava.
 *
 * Aqui o cliente vê o que está comprando e quanto custa, e mais nada. Ele não
 * vê custo de insumo, não vê quanto a equipe ganha e não vê a margem. Essa
 * separação é a regra do documento, e não um detalhe de layout: foi a
 * primeira coisa que o Alan perguntou duas vezes na mesma conversa.
 *
 * Vira PDF pelo próprio navegador, com `window.print()` e a opção "Salvar como
 * PDF". É de propósito: nenhuma biblioteca nova, o texto sai vetorial e
 * legível em qualquer zoom, e funciona igual no notebook da Érica e no celular
 * do Alan na rua.
 */
export default function Proposta({
  orcamento,
  resultado,
  aoFechar,
}: {
  orcamento: Orcamento;
  resultado: Resultado;
  aoFechar: () => void;
}) {
  const selecionados = orcamento.itens.filter((i) => orcamento.selecionados.includes(i.id));
  const grupos = agruparPorPreparo(selecionados);

  /*
    Só a equipe entra em "o que está incluso".

    Imposto, caixa e taxa também são "serviços" do ponto de vista do cálculo,
    mas listar "Imposto (DAS)" numa proposta é mostrar a contabilidade dele
    para quem está comprando churrasco. Frete e locação ficam porque são coisa
    que o cliente recebe.
  */
  const inclusos = resultado.servicos
    .filter((s) => ['equipe', 'frete', 'locacao'].includes(s.servico.papel))
    .filter((s) => s.servico.quantidade > 0);

  const cobranca = resultado.cobranca.filter((c) => c.quantidade > 0);

  return (
    <div className="proposta-raiz">
      {/* Barra de controle: existe na tela e some no papel. */}
      <div className="proposta-controles">
        <button type="button" className="botao botao-linha !min-h-10 !px-4 text-sm" onClick={aoFechar}>
          Voltar
        </button>
        <p className="text-sm text-fumaca">
          Confira e use <strong className="text-creme">Salvar como PDF</strong> no destino da impressão.
        </p>
        <button type="button" className="botao botao-brasa !min-h-10 !px-4 text-sm" onClick={() => window.print()}>
          Salvar PDF
        </button>
      </div>

      <article className="proposta">
        <header className="proposta-topo">
          <img src="/logo.png" alt="Na Grelha com Alan Xavier" className="proposta-logo" />
          <div className="proposta-contato">
            <p className="proposta-marca">Na Grelha com Alan Xavier</p>
            <p>Churrasco completo para o seu evento</p>
          </div>
        </header>

        <h1 className="proposta-titulo">Proposta de orçamento</h1>

        <dl className="proposta-dados">
          <Dado rotulo="Cliente" valor={orcamento.cliente} />
          <Dado
            rotulo="Data"
            valor={
              orcamento.data
                ? `${dataCurta(orcamento.data)}${orcamento.hora ? ` às ${orcamento.hora}` : ''}`
                : ''
            }
          />
          <Dado rotulo="Local" valor={orcamento.local} />
          <Dado rotulo="Duração" valor={`${inteiro(orcamento.duracaoHoras)} horas de serviço`} />
          <Dado rotulo="Convidados" valor={`${inteiro(resultado.convidados)} pessoas`} />
        </dl>

        {/* --------------------------------------------------------- cardápio */}
        <section className="proposta-secao">
          <h2>O que vai ser servido</h2>
          {grupos.length === 0 ? (
            <p className="proposta-vazio">Nenhum item selecionado ainda.</p>
          ) : (
            <div className="proposta-cardapio">
              {grupos.map(([grupo, itens]) => (
                <div key={grupo} className="proposta-grupo">
                  <h3>{grupo}</h3>
                  {/*
                    Só o nome do prato.

                    Quantidade aqui não ajuda e atrapalha: "16,7 kg de picanha"
                    convida o cliente a discutir gramatura, que é conta interna
                    do Alan, e muda conforme o apetite e a faixa etária.
                  */}
                  <ul>
                    {itens.map((i) => (
                      <li key={i.id}>{i.nome}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ---------------------------------------------------------- serviço */}
        {inclusos.length > 0 && (
          <section className="proposta-secao">
            <h2>Serviço incluso</h2>
            <ul className="proposta-inclusos">
              {inclusos.map((s) => (
                <li key={s.servico.id}>
                  {s.servico.quantidade > 1 ? `${inteiro(s.servico.quantidade)}× ` : ''}
                  {s.servico.nome}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ---------------------------------------------------------- valores */}
        <section className="proposta-secao">
          <h2>Valores</h2>
          <table className="proposta-tabela">
            <thead>
              <tr>
                <th>Quem</th>
                <th className="num">Pessoas</th>
                <th className="num">Por pessoa</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {cobranca.map((c) => (
                <tr key={c.rotulo}>
                  <td>{c.rotulo}</td>
                  <td className="num">{inteiro(c.quantidade)}</td>
                  <td className="num">{real(c.unitario)}</td>
                  <td className="num">{real(c.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Valor total</td>
                <td className="num">{real(resultado.preco)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {orcamento.observacoes && (
          <section className="proposta-secao">
            <h2>Observações</h2>
            <p className="proposta-obs">{orcamento.observacoes}</p>
          </section>
        )}

        <footer className="proposta-rodape">
          <p>
            Valores sujeitos a confirmação de data e número de convidados. O número de convidados pode
            ser ajustado até uma semana antes do evento.
          </p>
          {orcamento.contato && <p>Contato: {orcamento.contato}</p>}
        </footer>
      </article>
    </div>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  if (!valor) return null;
  return (
    <div>
      <dt>{rotulo}</dt>
      <dd>{valor}</dd>
    </div>
  );
}
