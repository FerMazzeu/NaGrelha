import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
  O que se testa aqui é a fronteira, e não o modelo.

  Se o Gemini lê 1600 ou 1400 na foto é problema da foto, e nenhum teste local
  resolve. O que dá para garantir é o resto: que o que volta do servidor vira
  exatamente o mesmo formato do leitor de Excel, que zero vira aviso em vez de
  entrar calado, e que erro do servidor chega em português.
*/

const fetchFalso = vi.fn();
vi.stubGlobal('fetch', fetchFalso);

vi.mock('./integrations/supabase/client', () => ({
  funcao: (nome: string) => `https://exemplo/functions/v1/${nome}`,
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) },
  },
}));

// A preparação da foto usa canvas e createImageBitmap, que não existem no
// vitest. Como o que importa aqui é o depois, a foto entra já pronta.
vi.stubGlobal(
  'createImageBitmap',
  vi.fn(async () => ({ width: 100, height: 100, close() {} })),
);
vi.stubGlobal('document', {
  createElement: () => ({
    width: 0,
    height: 0,
    getContext: () => ({ drawImage() {} }),
    toDataURL: () => 'data:image/jpeg;base64,' + 'A'.repeat(40),
  }),
});

const { lerFotos } = await import('./foto-planilha');

const foto = () => new File(['x'], 'tabela.jpg', { type: 'image/jpeg' });

const responde = (corpo: unknown, ok = true, status = 200) =>
  fetchFalso.mockResolvedValue({ ok, status, json: async () => corpo });

describe('leitura da planilha por foto', () => {
  beforeEach(() => fetchFalso.mockReset());

  it('traz os itens no mesmo formato do leitor de Excel', async () => {
    responde({
      pessoas: 80,
      itens: [{ nome: 'Picanha', grupo: 'CHURRASCO', unidade: 'kg', quantidade: 12, preco: 89.9 }],
    });

    const lida = await lerFotos([foto()]);

    expect(lida.pessoas).toBe(80);
    expect(lida.itens).toEqual([
      { nome: 'Picanha', grupo: 'CHURRASCO', unidade: 'kg', quantidade: 12, preco: 89.9, linha: 1, falta: undefined },
    ]);
    expect(lida.ignoradas).toEqual([]);
  });

  it('marca o que faltou em vez de deixar entrar zerado calado', async () => {
    responde({
      pessoas: 0,
      itens: [
        { nome: 'Sem preço', grupo: 'X', unidade: 'kg', quantidade: 3, preco: 0 },
        { nome: 'Sem quantidade', grupo: 'X', unidade: 'kg', quantidade: 0, preco: 50 },
        { nome: 'Só o nome', grupo: 'X', unidade: 'un', quantidade: 0, preco: 0 },
      ],
    });

    const lida = await lerFotos([foto()]);

    expect(lida.itens.map((i) => i.falta)).toEqual(['sem-preco', 'sem-quantidade', 'sem-nada']);
    // Zero pessoas não é "zero pessoas", é "não achei" — e a tela pergunta.
    expect(lida.pessoas).toBeNull();
  });

  it('joga fora item sem nome, que é linha de sujeira da foto', async () => {
    responde({ pessoas: 0, itens: [{ nome: '   ', grupo: 'X' }, { nome: 'Pão', grupo: 'X' }] });

    const lida = await lerFotos([foto()]);

    expect(lida.itens.map((i) => i.nome)).toEqual(['Pão']);
  });

  it('não deixa item sem preparo virar item sem grupo', async () => {
    // Sem isto o item cai num grupo de nome vazio e some da tabela de conferência.
    responde({ pessoas: 0, itens: [{ nome: 'Carvão', grupo: '' }] });

    const lida = await lerFotos([foto()]);

    expect(lida.itens[0].grupo).toBe('SEM PREPARO');
  });

  it('repassa o recado do servidor, que já vem em português', async () => {
    responde({ error: 'openrouter', message: 'O provider recusou a imagem.' }, false, 502);

    await expect(lerFotos([foto()])).rejects.toThrow('O provider recusou a imagem.');
  });

  it('trata o 200 com erro no corpo, que é como a OpenRouter falha', async () => {
    responde({ error: 'json', message: 'A leitura veio malformada. Tenta outra foto.' });

    await expect(lerFotos([foto()])).rejects.toThrow('A leitura veio malformada');
  });

  it('manda no máximo quatro fotos, mesmo que escolham dez', async () => {
    responde({ pessoas: 0, itens: [{ nome: 'X', grupo: 'Y' }] });

    await lerFotos(Array.from({ length: 10 }, foto));

    const enviado = JSON.parse(fetchFalso.mock.calls[0][1].body);
    expect(enviado.imagens).toHaveLength(4);
  });

  it('recusa arquivo que não é foto antes de gastar uma chamada', async () => {
    await expect(lerFotos([new File(['x'], 'a.xlsx', { type: 'application/vnd.ms-excel' })])).rejects.toThrow(
      'Isso não é uma foto',
    );
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});
