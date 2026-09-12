import { equipe, familia } from '../conteudo';
import { AberturaDeSecao, Foto, Moldura, Revelar, Selo, TituloSecao } from './Base';

export default function Equipe() {
  return (
    <>
      <section id="equipe" className="secao">
        <div className="area">
          <Revelar>
            <AberturaDeSecao selo={equipe.selo} titulo={equipe.titulo} texto={equipe.texto} centrada />
          </Revelar>

          {/* Alan e Érica alternam o lado da foto para a leitura não ficar mecânica. */}
          <div className="mt-14 space-y-14 md:space-y-20">
            {equipe.destaques.map((pessoa, i) => (
              <Revelar key={pessoa.nome}>
                <article className="grid items-center gap-8 md:grid-cols-5 md:gap-12">
                  <Moldura
                    proporcao="4 / 5"
                    className={`md:col-span-2 ${i % 2 === 1 ? 'md:order-2' : ''}`}
                  >
                    <Foto nome={pessoa.foto} alt={`${pessoa.nome}, ${pessoa.papel}`} />
                  </Moldura>

                  <div className="md:col-span-3">
                    <p className="selo">{pessoa.papel}</p>
                    <h3 className="titulo mt-3 text-[clamp(2rem,5vw,3rem)] text-dourado">{pessoa.nome}</h3>
                    <div className="mt-5 space-y-4">
                      {pessoa.paragrafos.map((p) => (
                        <p key={p.slice(0, 24)} className="corpo">
                          {p}
                        </p>
                      ))}
                    </div>
                  </div>
                </article>
              </Revelar>
            ))}
          </div>

          <Revelar className="mt-14 md:mt-20">
            <article className="cartao grid items-center gap-8 overflow-hidden md:grid-cols-2">
              <Moldura proporcao="4 / 3" className="!rounded-none !border-0">
                <Foto
                  nome={equipe.ambientacao.foto}
                  alt="Mesa montada e decorada para um evento"
                />
              </Moldura>
              <div className="p-7 md:py-10 md:pr-10">
                <h3 className="titulo text-2xl md:text-3xl">{equipe.ambientacao.titulo}</h3>
                <div className="mt-4 space-y-4">
                  {equipe.ambientacao.paragrafos.map((p) => (
                    <p key={p.slice(0, 24)} className="corpo text-[0.95rem]">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            </article>
          </Revelar>

          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {equipe.apoio.map((pessoa, i) => (
              <Revelar key={pessoa.nome} atraso={i * 120}>
                <article className="cartao h-full overflow-hidden">
                  <Moldura proporcao="16 / 10" className="!rounded-none !border-0">
                    <Foto nome={pessoa.foto} alt={`${pessoa.nome}, ${pessoa.papel}`} />
                  </Moldura>
                  <div className="p-7">
                    <p className="selo">{pessoa.papel}</p>
                    <h3 className="titulo mt-2 text-2xl text-dourado">{pessoa.nome}</h3>
                    <p className="corpo mt-3 text-[0.95rem]">{pessoa.texto}</p>
                  </div>
                </article>
              </Revelar>
            ))}
          </div>

          <Revelar>
            <p className="titulo mx-auto mt-14 max-w-3xl text-center text-[clamp(1.3rem,3.2vw,2rem)] text-creme">
              {equipe.fechamento}
            </p>
          </Revelar>
        </div>
      </section>

      <section className="secao border-y border-borda bg-carvao-2">
        <div className="area grid gap-10 lg:grid-cols-2 lg:gap-16">
          <Revelar>
            <Selo>{familia.selo}</Selo>
            <TituloSecao texto={familia.titulo} className="mt-4" />
          </Revelar>
          <Revelar atraso={100}>
            <div className="space-y-5">
              {familia.paragrafos.map((p) => (
                <p key={p.slice(0, 24)} className="corpo">
                  {p}
                </p>
              ))}
            </div>
            <p className="mt-7 border-l-2 border-brasa pl-5 font-display text-xl uppercase leading-tight text-creme">
              {familia.fechamento}
            </p>
          </Revelar>
        </div>
      </section>
    </>
  );
}
