import { cardapio, cortes, guarnicoes } from '../conteudo';
import { AberturaDeSecao, Citacao, Foto, Moldura, Revelar } from './Base';

export default function Cardapio() {
  return (
    <>
      <section id="cardapio" className="secao">
        <div className="area">
          <Revelar>
            <AberturaDeSecao selo={cardapio.selo} titulo={cardapio.titulo} texto={cardapio.texto} />
          </Revelar>

          {/*
            Cinco cartões, e o primeiro ocupa duas colunas com a foto ao lado do
            texto. Quebra a fileira de cartões idênticos e dá ao item de abertura
            o peso que ele merece.
          */}
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cardapio.itens.map((item, i) => (
              <Revelar key={item.titulo} atraso={(i % 3) * 80} className={item.largo ? 'lg:col-span-2' : ''}>
                <article
                  className={`cartao group flex h-full overflow-hidden ${
                    item.largo ? 'flex-col sm:flex-row' : 'flex-col'
                  }`}
                >
                  <Moldura
                    proporcao={item.largo ? undefined : '4 / 3'}
                    className={`!rounded-none !border-0 ${item.largo ? 'sm:w-1/2 sm:shrink-0' : ''}`}
                  >
                    <Foto
                      nome={item.foto}
                      alt={item.titulo}
                      className="transition-transform duration-500 group-hover:scale-105"
                    />
                  </Moldura>
                  <div className={`flex flex-1 flex-col justify-center p-6 ${item.largo ? 'sm:p-8' : ''}`}>
                    <h3 className={`titulo text-dourado ${item.largo ? 'text-2xl' : 'text-xl'}`}>{item.titulo}</h3>
                    <p className={`corpo mt-3 ${item.largo ? 'text-base' : 'text-[0.93rem]'}`}>{item.texto}</p>
                  </div>
                </article>
              </Revelar>
            ))}
          </div>

          <Revelar>
            <div className="mt-12 text-center">
              <p className="corpo mx-auto max-w-2xl text-lg">{cardapio.fechamento.titulo}</p>
              <p className="titulo mt-3 text-[clamp(1.6rem,4vw,2.4rem)] text-brasa-clara">
                {cardapio.fechamento.destaque}
              </p>
            </div>
          </Revelar>
        </div>
      </section>

      {/* A técnica: o cardápio diz o que se come, esta seção diz como sai certo. */}
      <section className="secao brilho-brasa border-y border-borda bg-carvao-2">
        <div className="area">
          <Revelar>
            <Citacao texto={cortes.citacao.texto} autor={cortes.citacao.autor} />
          </Revelar>

          <div className="mt-16 grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <Revelar>
              <AberturaDeSecao selo={cortes.selo} titulo={cortes.titulo} texto={cortes.texto} />
              <Moldura proporcao="4 / 5" className="mt-8 hidden lg:block">
                <Foto nome="costela" alt="Costela assando na grelha de carvão" />
              </Moldura>
            </Revelar>

            <Revelar atraso={120}>
              <ol className="space-y-4">
                {cortes.passos.map((passo) => (
                  <li key={passo.numero} className="cartao flex gap-5 p-6 md:p-7">
                    <span className="titulo shrink-0 text-3xl text-brasa md:text-4xl">{passo.numero}</span>
                    <div>
                      <h3 className="titulo text-lg md:text-xl">{passo.titulo}</h3>
                      <p className="corpo mt-2 text-[0.95rem]">{passo.texto}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Revelar>
          </div>
        </div>
      </section>

      <section className="secao">
        <div className="area">
          <Revelar>
            <AberturaDeSecao selo={guarnicoes.selo} titulo={guarnicoes.titulo} texto={guarnicoes.texto} centrada />
          </Revelar>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {guarnicoes.itens.map((item, i) => (
              <Revelar key={item.titulo} atraso={i * 80} className="h-full">
                <article className="flex h-full flex-col text-center">
                  {/* redondo, para não virar mais uma grade de quadrados */}
                  <Moldura proporcao="1 / 1" className="mx-auto !w-40 !rounded-full sm:!w-48">
                    <Foto nome={item.foto} alt={item.titulo} />
                  </Moldura>
                  <h3 className="titulo mt-5 text-lg text-dourado">{item.titulo}</h3>
                  <p className="corpo mt-2 text-[0.9rem]">{item.texto}</p>
                </article>
              </Revelar>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
