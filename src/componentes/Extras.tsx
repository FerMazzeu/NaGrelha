import { bebidas, burguer, visual } from '../conteudo';
import { AberturaDeSecao, Foto, Moldura, Revelar, Selo, TituloSecao } from './Base';
import { porNome, type NomeDeIcone } from './Icones';

export default function Extras() {
  return (
    <>
      <section className="secao">
        <div className="area grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Revelar>
            <Moldura proporcao="7 / 5">
              <Foto nome="burguer" alt="Burguer artesanal grelhado no carvão" />
            </Moldura>
          </Revelar>

          <Revelar atraso={120}>
            <Selo>{burguer.selo}</Selo>
            <TituloSecao texto={burguer.titulo} className="mt-4" />
            <div className="mt-6 space-y-4">
              {burguer.paragrafos.map((p) => (
                <p key={p.slice(0, 24)} className="corpo">
                  {p}
                </p>
              ))}
            </div>
            <p className="mt-6 rounded-xl border border-brasa/30 bg-brasa/8 px-5 py-4 text-[0.95rem] text-creme">
              {burguer.extra}
            </p>
            <p className="mt-4 text-sm text-fumaca">{burguer.nota}</p>
          </Revelar>
        </div>
      </section>

      <section className="secao border-y border-borda bg-carvao-2">
        <div className="area">
          <Revelar>
            <AberturaDeSecao selo={bebidas.selo} titulo={bebidas.titulo} texto={bebidas.texto} centrada />
          </Revelar>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {bebidas.itens.map((item, i) => {
              const Icone = porNome[item.icone as NomeDeIcone];
              return (
                <Revelar key={item.titulo} atraso={i * 100}>
                  <article className="cartao flex h-full items-start gap-5 p-7">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-dourado/12 text-dourado ring-1 ring-dourado/30">
                      <Icone className="h-6 w-6" />
                    </span>
                    <div>
                      <h3 className="titulo text-xl">{item.titulo}</h3>
                      <p className="corpo mt-2 text-[0.93rem]">{item.texto}</p>
                    </div>
                  </article>
                </Revelar>
              );
            })}
          </div>

          <Revelar>
            <p className="titulo mt-12 text-center text-[clamp(1.3rem,3.2vw,2rem)] text-creme">{bebidas.fechamento}</p>
          </Revelar>
        </div>
      </section>

      <section className="secao">
        <div className="area">
          <Revelar className="max-w-2xl">
            <Selo>{visual.selo}</Selo>
            <TituloSecao texto={visual.titulo} className="mt-4" />
            <p className="corpo mt-6 text-lg">{visual.texto}</p>
          </Revelar>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {visual.itens.map((item, i) => (
              <Revelar key={item.titulo} atraso={i * 110}>
                <article className="border-t border-borda pt-6">
                  <span className="titulo text-2xl text-brasa">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="titulo mt-3 text-xl">{item.titulo}</h3>
                  <p className="corpo mt-3 text-[0.95rem]">{item.texto}</p>
                </article>
              </Revelar>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
