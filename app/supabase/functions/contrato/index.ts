// Na Grelha — o contrato que o cliente abre pelo link e assina com código no e-mail.
//
// PÚBLICA: roda sem login (verify_jwt = false no supabase/config.toml). Quem
// chama é o cliente, que só tem o token do link. Por isso tudo aqui passa
// pela service role, e cada ação começa achando o contrato pelo token: sem o
// token certo não se lê nem se escreve nada.
//
// Três ações:
//   abrir        → o contrato do token (e marca que foi visualizado)
//   pedir-codigo → guarda os dados do cliente e manda o código de 6 dígitos
//   assinar      → confere o código e registra a assinatura com as evidências
//
// O texto assinado é montado AQUI, a partir dos dados do banco, pelo mesmo
// `_shared/contrato.ts` que a página usa. O navegador não manda texto
// nenhum: assim o hash prova o que o servidor guardou, e não o que alguém
// disse que leu.
//
// Imports por https://esm.sh: deploy por MCP não resolve `jsr:` nem `npm:`.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  faltaNoContratante,
  impressaoDigital,
  textoDoContrato,
  type ConteudoDoContrato,
  type Contratante,
} from '../_shared/contrato.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const VALIDADE_DO_CODIGO_MIN = 10;
const MAX_TENTATIVAS = 5;
const MAX_CODIGOS = 8;
const INTERVALO_ENTRE_CODIGOS_S = 60;

const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

async function sha256(texto: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Código de 6 dígitos com gerador criptográfico, e não Math.random. */
function codigoNovo() {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0] % 1_000_000).padStart(6, '0');
}

/** fu***@gmail.com: a tela confirma para onde foi sem mostrar o e-mail inteiro. */
const mascarar = (email: string) => email.replace(/^(.{2})[^@]*(@.*)$/, '$1***$2');

/** O que o cliente mandou, limpo e com tamanho máximo, antes de ir para o banco. */
function limpar(bruto: unknown): Contratante {
  const o = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>;
  const s = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
  return {
    nome: s(o.nome, 120),
    cpf: s(o.cpf, 20).replace(/\D/g, ''),
    endereco: s(o.endereco, 300),
    email: s(o.email, 160).toLowerCase(),
    telefone: s(o.telefone, 40),
  };
}

async function mandarEmail(para: string, assunto: string, html: string, texto: string) {
  const chave = Deno.env.get('RESEND_API_KEY');
  const de = Deno.env.get('CONTRATO_REMETENTE');
  if (!chave || !de) return { ok: false, motivo: 'nao_configurado' as const };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: de, to: [para], subject: assunto, html, text: texto }),
  });
  if (!r.ok) {
    console.error('resend recusou', r.status, (await r.text()).slice(0, 400));
    return { ok: false, motivo: 'falhou' as const };
  }
  return { ok: true as const };
}

const moldura = (conteudo: string) => `<!doctype html><html><body style="margin:0;background:#f7f2ea;font-family:Arial,Helvetica,sans-serif;color:#1a1512">
<div style="max-width:480px;margin:0 auto;padding:32px 24px">
<p style="font-size:13px;letter-spacing:2px;color:#c4261d;font-weight:bold;margin:0 0 16px">NA GRELHA COM ALAN XAVIER</p>
${conteudo}
<p style="font-size:12px;color:#7a6e62;margin-top:32px">Se você não pediu isto, pode ignorar este e-mail.</p>
</div></body></html>`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'metodo' }, 405);

  try {
    const corpo = await req.json().catch(() => ({}));
    const { acao, token } = corpo as { acao?: string; token?: string };
    if (typeof token !== 'string' || !/^[0-9a-f]{48}$/.test(token)) return json({ error: 'link_invalido' }, 404);

    const db = admin();
    const { data: contrato, error } = await db.from('contratos').select('*').eq('token', token).maybeSingle();
    if (error) {
      console.error('leitura do contrato', error.message);
      return json({ error: 'interno', message: 'Não consegui abrir o contrato agora. Tente de novo.' }, 500);
    }
    if (!contrato) return json({ error: 'link_invalido', message: 'Este link de contrato não existe.' }, 404);
    if (contrato.situacao === 'cancelado') {
      return json({ error: 'cancelado', message: 'Este contrato foi substituído. Peça o link novo ao buffet.' }, 410);
    }

    const conteudo = contrato.conteudo as ConteudoDoContrato;

    // ---------------------------------------------------------- abrir ---
    if (acao === 'abrir') {
      if (!contrato.visualizado_em) {
        await db.from('contratos').update({ visualizado_em: new Date().toISOString() }).eq('id', contrato.id);
      }
      return json({
        situacao: contrato.situacao,
        conteudo,
        contratante: contrato.contratante,
        assinadoEm: contrato.assinado_em,
        hash: contrato.hash_documento,
        enviadoEm: contrato.enviado_em,
        // O comprovante é do próprio cliente: e-mail, IP e aparelho dele.
        assinatura: contrato.assinatura
          ? { email: contrato.assinatura.email, ip: contrato.assinatura.ip, dispositivo: contrato.assinatura.dispositivo }
          : null,
      });
    }

    if (contrato.situacao === 'assinado') {
      return json({ error: 'ja_assinado', message: 'Este contrato já foi assinado.' }, 409);
    }

    // --------------------------------------------------- pedir-codigo ---
    if (acao === 'pedir-codigo') {
      const contratante = limpar(corpo.contratante);
      const falta = faltaNoContratante(contratante);
      if (falta.length) return json({ error: 'dados', message: `Falta preencher: ${falta.join(', ')}.` }, 400);

      const agora = Date.now();
      if (contrato.ultimo_codigo_em && agora - Date.parse(contrato.ultimo_codigo_em) < INTERVALO_ENTRE_CODIGOS_S * 1000) {
        return json({ error: 'espere', message: 'Acabamos de mandar um código. Espere um minuto para pedir outro.' }, 429);
      }
      if (contrato.codigos_enviados >= MAX_CODIGOS) {
        return json({ error: 'limite', message: 'Limite de códigos deste contrato. Fale com o buffet para gerar um link novo.' }, 429);
      }

      const codigo = codigoNovo();
      // Os dados ficam salvos mesmo se o e-mail falhar: o cliente não digita de novo.
      const { error: erroUpdate } = await db
        .from('contratos')
        .update({
          contratante,
          codigo_hash: await sha256(`${contrato.id}:${codigo}`),
          codigo_email: contratante.email,
          codigo_expira: new Date(agora + VALIDADE_DO_CODIGO_MIN * 60_000).toISOString(),
          codigo_tentativas: 0,
          codigos_enviados: contrato.codigos_enviados + 1,
          ultimo_codigo_em: new Date(agora).toISOString(),
        })
        .eq('id', contrato.id)
        .eq('situacao', 'enviado');
      if (erroUpdate) {
        console.error('gravar codigo', erroUpdate.message);
        return json({ error: 'interno', message: 'Não consegui gerar o código. Tente de novo.' }, 500);
      }

      const envio = await mandarEmail(
        contratante.email,
        `${codigo} é o seu código para assinar o contrato`,
        moldura(`<p style="font-size:16px;margin:0 0 8px">Olá, ${contratante.nome.split(' ')[0]}!</p>
<p style="font-size:15px;line-height:1.5;margin:0 0 20px">Use o código abaixo para assinar o contrato do seu evento. Ele vale por ${VALIDADE_DO_CODIGO_MIN} minutos.</p>
<p style="font-size:34px;font-weight:bold;letter-spacing:10px;background:#fff;border-radius:12px;padding:16px;text-align:center;margin:0">${codigo}</p>`),
        `Seu código para assinar o contrato do Na Grelha: ${codigo}\nEle vale por ${VALIDADE_DO_CODIGO_MIN} minutos.`,
      );
      if (!envio.ok) {
        // O e-mail não saiu: não conta como código enviado, senão o cliente
        // espera um minuto (e gasta o limite) por um código que nunca chegou.
        await db
          .from('contratos')
          .update({
            codigo_hash: null,
            codigos_enviados: contrato.codigos_enviados,
            ultimo_codigo_em: contrato.ultimo_codigo_em,
          })
          .eq('id', contrato.id);
        return json(
          {
            error: envio.motivo === 'nao_configurado' ? 'email_nao_configurado' : 'email_falhou',
            message:
              envio.motivo === 'nao_configurado'
                ? 'O envio do código por e-mail ainda está sendo configurado pelo buffet. Seus dados ficaram salvos; tente mais tarde ou fale com o buffet.'
                : 'Não consegui mandar o e-mail agora. Confira o endereço e tente de novo em um minuto.',
          },
          503,
        );
      }
      return json({ ok: true, email: mascarar(contratante.email), validadeMin: VALIDADE_DO_CODIGO_MIN });
    }

    // -------------------------------------------------------- assinar ---
    if (acao === 'assinar') {
      const codigo = String(corpo.codigo ?? '').replace(/\D/g, '');
      if (!contrato.codigo_hash || !contrato.codigo_expira) {
        return json({ error: 'sem_codigo', message: 'Peça o código primeiro.' }, 400);
      }
      if (Date.parse(contrato.codigo_expira) < Date.now()) {
        return json({ error: 'expirado', message: 'O código venceu. Peça um novo.' }, 400);
      }
      if (contrato.codigo_tentativas >= MAX_TENTATIVAS) {
        return json({ error: 'tentativas', message: 'Muitas tentativas erradas. Peça um código novo.' }, 429);
      }
      if ((await sha256(`${contrato.id}:${codigo}`)) !== contrato.codigo_hash) {
        await db.from('contratos').update({ codigo_tentativas: contrato.codigo_tentativas + 1 }).eq('id', contrato.id);
        const restam = MAX_TENTATIVAS - contrato.codigo_tentativas - 1;
        return json({ error: 'codigo_errado', message: restam > 0 ? `Código errado. Restam ${restam} tentativas.` : 'Código errado. Peça um código novo.' }, 400);
      }

      const contratante = contrato.contratante as Contratante;
      const texto = textoDoContrato(conteudo, contratante);
      const hash = await impressaoDigital(texto);
      const assinadoEm = new Date().toISOString();
      const ip =
        req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'não informado';

      const { data: gravado, error: erroAssinar } = await db
        .from('contratos')
        .update({
          situacao: 'assinado',
          assinado_em: assinadoEm,
          texto_assinado: texto,
          hash_documento: hash,
          codigo_hash: null,
          assinatura: {
            email: contrato.codigo_email,
            ip,
            dispositivo: (req.headers.get('user-agent') ?? '').slice(0, 300),
            metodo: 'código de 6 dígitos enviado por e-mail',
            codigoEnviadoEm: contrato.ultimo_codigo_em,
            modelo: conteudo.modelo,
          },
        })
        .eq('id', contrato.id)
        .eq('situacao', 'enviado')
        .select('id')
        .maybeSingle();
      if (erroAssinar || !gravado) {
        console.error('assinar', erroAssinar?.message);
        return json({ error: 'interno', message: 'Não consegui registrar a assinatura. Tente de novo.' }, 500);
      }

      // Contrato assinado é evento fechado.
      await db
        .from('eventos')
        .update({ situacao: 'confirmado', atualizado_em: assinadoEm })
        .eq('id', contrato.evento_id)
        .in('situacao', ['rascunho', 'orcado']);

      // Comprovante para o cliente. Se falhar, a assinatura já está valendo.
      const origem = req.headers.get('origin') ?? '';
      const link = /^https:\/\//.test(origem) ? `${origem}/?contrato=${token}` : '';
      await mandarEmail(
        contratante.email,
        'Contrato assinado - Na Grelha com Alan Xavier',
        moldura(`<p style="font-size:16px;margin:0 0 8px">Contrato assinado, ${contratante.nome.split(' ')[0]}!</p>
<p style="font-size:15px;line-height:1.5;margin:0 0 12px">Recebemos a sua assinatura em ${new Date(assinadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.</p>
<p style="font-size:13px;line-height:1.5;color:#52514e;margin:0 0 20px">Código de verificação do documento (SHA-256):<br><span style="font-family:monospace;word-break:break-all">${hash}</span></p>
${link ? `<p style="margin:0"><a href="${link}" style="background:#c4261d;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Ver e baixar o contrato</a></p>` : ''}`),
        `Contrato assinado em ${assinadoEm}. Código de verificação (SHA-256): ${hash}${link ? `\nVer e baixar: ${link}` : ''}`,
      ).catch(() => undefined);

      return json({ ok: true, assinadoEm, hash });
    }

    return json({ error: 'acao' }, 400);
  } catch (e) {
    console.error('inesperado', String(e));
    return json({ error: 'inesperado', message: 'Erro interno. Tente de novo.' }, 500);
  }
});
