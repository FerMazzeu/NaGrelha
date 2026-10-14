import { describe, expect, it } from 'vitest';
import {
  blocosDoContrato,
  cpfValido,
  faltaNoContratante,
  impressaoDigital,
  inteiroPorExtenso,
  reaisPorExtenso,
  textoDoContrato,
  type ConteudoDoContrato,
  type Contratante,
} from '../supabase/functions/_shared/contrato';

/* Dados inventados: o repositório é público. CPF de teste gerado, não é de ninguém. */

describe('valor por extenso', () => {
  it('como no contrato do Alan', () => {
    expect(reaisPorExtenso(5806.8)).toBe('cinco mil, oitocentos e seis reais e oitenta centavos');
  });

  it('os casos que costumam sair errados', () => {
    expect(reaisPorExtenso(10)).toBe('dez reais');
    expect(reaisPorExtenso(1)).toBe('um real');
    expect(reaisPorExtenso(0.01)).toBe('um centavo');
    expect(reaisPorExtenso(100)).toBe('cem reais');
    expect(reaisPorExtenso(1100)).toBe('mil e cem reais');
    expect(reaisPorExtenso(2050)).toBe('dois mil e cinquenta reais');
    expect(reaisPorExtenso(15489.4)).toBe('quinze mil, quatrocentos e oitenta e nove reais e quarenta centavos');
    expect(reaisPorExtenso(1_000_000)).toBe('um milhão de reais');
    expect(inteiroPorExtenso(5)).toBe('cinco');
    expect(inteiroPorExtenso(21)).toBe('vinte e um');
  });
});

describe('CPF', () => {
  it('confere os dígitos verificadores', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('529.982.247-24')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cpfValido('123')).toBe(false);
  });
});

const conteudo: ConteudoDoContrato = {
  modelo: 'teste',
  contratada: { nome: 'BUFFET TESTE', cnpj: '00.000.000/0001-00', endereco: 'Rua A, nº 1', telefone: '(00) 0000-0000' },
  representante: 'Fulano',
  evento: { descricao: 'Casamento', data: '2027-06-26', hora: '11:00', local: 'Fazenda Teste', duracaoHoras: 5, adultos: 35, criancas: 4 },
  cardapio: [{ titulo: 'Frios', itens: ['Provolone', 'Salame'] }],
  incluiEstrutura: true,
  carnes: 'contratante',
  bebidas: 'contratante',
  valorTotal: 5806.8,
  valorEntrada: 0,
  valorAvaria: 10,
  foro: 'Cidade Teste - MG',
};
const cliente: Contratante = { nome: 'Fulana de Tal', cpf: '52998224725', endereco: 'Rua B, nº 2, Centro', email: 'fulana@teste.com', telefone: '' };

describe('texto do contrato', () => {
  it('traz os dados do orçamento e do cliente nos lugares certos', () => {
    const texto = textoDoContrato(conteudo, cliente);
    expect(texto).toContain('CONTRATANTE: Fulana de Tal, inscrito(a) no CPF sob o nº 529.982.247-25');
    expect(texto).toContain('evento de Casamento da CONTRATANTE, a realizar-se no dia 26/06/2027, com início previsto para as 11:00 horas');
    expect(texto).toContain('35 Convidados Adultos e 04 Crianças');
    expect(texto).toContain('R$ 5.806,80 (cinco mil, oitocentos e seis reais e oitenta centavos)');
    expect(texto).toContain('(até 22/06/2027)');
    expect(texto).toContain('Frios: Provolone, Salame.');
    expect(texto).toContain('5 (cinco) horas');
  });

  it('a cláusula de carnes e de bebidas muda com a escolha', () => {
    const doBuffet = textoDoContrato({ ...conteudo, carnes: 'buffet', bebidas: 'buffet' }, cliente);
    expect(doBuffet).toContain('serão fornecidas pela CONTRATADA, conforme o cardápio');
    expect(doBuffet).toContain('CLÁUSULA QUARTA - DAS BEBIDAS');
    expect(textoDoContrato(conteudo, cliente)).toContain('fornecidas exclusivamente pela CONTRATANTE');
  });

  it('campo do cliente vazio aparece como linha a preencher', () => {
    const [partes] = blocosDoContrato(conteudo, { ...cliente, nome: '', cpf: '' });
    expect(partes.paragrafos[0]).toContain('CONTRATANTE: ________________, inscrito(a) no CPF sob o nº ________________');
  });

  it('a impressão digital muda com uma letra', async () => {
    const a = await impressaoDigital(textoDoContrato(conteudo, cliente));
    const b = await impressaoDigital(textoDoContrato(conteudo, { ...cliente, nome: 'Fulana de Tai' }));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it('diz o que falta preencher antes de pedir o código', () => {
    expect(faltaNoContratante(cliente)).toEqual([]);
    expect(faltaNoContratante({ ...cliente, nome: 'Fulana', cpf: '1', email: 'x' })).toEqual(['nome completo', 'CPF válido', 'e-mail válido']);
  });
});
