import { diferencial, promessa } from '../conteudo';
import { AberturaDeSecao, Revelar } from './Base';
import { porNome, type NomeDeIcone } from './Icones';

export default function Promessa() {
  return (
    <>
      <section id="promessa" className="secao">
        <div className="area">
          <Revelar>
            <AberturaDeSecao selo={promessa.selo} titulo={promessa.titulo} texto={promessa.texto} />
          </Revelar>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {promessa.itens.map((item, i) => {
              const Icone = porNome[item.icone as NomeDeIcone];
              return (
                <Revelar key={item.titulo} atraso={i * 90}>
                  <article className="cartao flex h-full flex-col p-7">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brasa/12 text-brasa-clara ring-1 ring-brasa/30">
                      <Icone className="h-6 w-6" />
                    </span>
                    <h3 className="titulo mt-6 text-xl">{item.titulo}</h3>
                    <p className="corpo mt-3 text-[0.95rem]">{item.texto}</p>
                  </article>
                </Revelar>
              );
            })}
          </div>
        </div>
      </section>

      <section className="secao brilho-brasa border-y border-borda bg-carvao-2">
        <div className="area">
          <Revelar>
            <AberturaDeSecao selo={diferencial.selo} titulo={diferencial.titulo} texto={diferencial.texto} centrada />
          </Revelar>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {diferencial.blocos.map((bloco, i) => {
              const Icone = porNome[bloco.icone as NomeDeIcone];
              return (
                <Revelar key={bloco.titulo} atraso={i * 120}>
                  <article className="cartao flex h-full flex-col p-8 md:p-10">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-dourado/12 text-dourado ring-1 ring-dourado/30">
                      <Icone className="h-7 w-7" />
                    </span>
                    <h3 className="titulo mt-6 text-2xl md:text-3xl">{bloco.titulo}</h3>
                    <div className="mt-4 space-y-4">
                      {bloco.paragrafos.map((p) => (
                        <p key={p.slice(0, 24)} className="corpo">
                          {p}
                        </p>
                      ))}
                    </div>
                    {bloco.destaque && (
                      <p className="mt-6 rounded-xl border border-dourado/30 bg-dourado/8 px-4 py-3 text-sm font-semibold text-dourado">
                        {bloco.destaque}
                      </p>
                    )}
                  </article>
                </Revelar>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
