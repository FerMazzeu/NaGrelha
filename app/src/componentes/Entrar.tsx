import { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { Campo, CampoTexto } from './Campos';

/**
 * Entrada do app.
 *
 * Cadastro aberto de propósito, mas com freio no banco: o primeiro usuário
 * vira dono e já entra aprovado; do segundo em diante o perfil nasce pendente
 * e não enxerga nada até o dono liberar. Quem segura isso é a RLS, não esta
 * tela.
 */
export default function Entrar() {
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setAviso('');
    setOcupado(true);

    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { data: { nome } },
        });
        if (error) throw error;
        // Com confirmação de e-mail ligada no projeto, não vem sessão agora.
        if (!data.session) setAviso('Conta criada. Confirme o e-mail e depois entre.');
      }
    } catch (e) {
      setErro(traduzir(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="area flex min-h-[100svh] flex-col justify-center py-10">
      <div className="mx-auto w-full max-w-sm">
        <p className="titulo text-2xl text-dourado">Na Grelha</p>
        <p className="mt-1 text-sm text-fumaca">Orçamento, agenda e equipe</p>

        <form onSubmit={enviar} className="mt-8 space-y-4">
          {modo === 'criar' && (
            <Campo rotulo="Seu nome">
              <CampoTexto valor={nome} aoMudar={setNome} placeholder="Como a equipe te chama" autoComplete="name" />
            </Campo>
          )}

          <Campo rotulo="E-mail">
            <input
              type="email"
              className="campo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </Campo>

          <Campo rotulo="Senha" dica={modo === 'criar' ? 'Mínimo de 6 caracteres.' : undefined}>
            <input
              type="password"
              className="campo"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete={modo === 'criar' ? 'new-password' : 'current-password'}
              minLength={6}
              required
            />
          </Campo>

          {erro && <p className="rounded-xl border border-brasa/50 bg-brasa/10 p-3 text-sm text-brasa-clara">{erro}</p>}
          {aviso && <p className="rounded-xl border border-verde/50 bg-verde/10 p-3 text-sm text-verde">{aviso}</p>}

          <button type="submit" className="botao botao-brasa w-full" disabled={ocupado}>
            {ocupado ? 'Só um instante...' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <button
          type="button"
          className="mt-5 w-full text-sm text-fumaca underline-offset-4 hover:text-creme hover:underline"
          onClick={() => {
            setModo(modo === 'entrar' ? 'criar' : 'entrar');
            setErro('');
            setAviso('');
          }}
        >
          {modo === 'entrar' ? 'Ainda não tenho conta' : 'Já tenho conta'}
        </button>
      </div>
    </div>
  );
}

/** As mensagens do Supabase chegam em inglês e cruas. */
function traduzir(e: unknown) {
  const bruto = e instanceof Error ? e.message : String(e);
  if (/invalid login credentials/i.test(bruto)) return 'E-mail ou senha não conferem.';
  if (/user already registered/i.test(bruto)) return 'Esse e-mail já tem conta. Tente entrar.';
  if (/password should be at least/i.test(bruto)) return 'A senha precisa de pelo menos 6 caracteres.';
  if (/email not confirmed/i.test(bruto)) return 'Confirme o e-mail antes de entrar.';
  if (/rate limit|too many/i.test(bruto)) return 'Muitas tentativas. Espere um pouco.';
  return bruto;
}
