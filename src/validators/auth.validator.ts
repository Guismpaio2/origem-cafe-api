import { z } from 'zod';

export const registerBody = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome completo.').max(120),
  email: z.email({ message: 'Informe um e-mail válido.' }).transform((value) => value.toLowerCase()),
  // bcrypt só usa os primeiros 72 bytes da senha, então o limite evita surpresas.
  senha: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.').max(72),
  // RE001 (LGPD): o cadastro só é aceito com o consentimento explícito.
  consentimentoLgpd: z.literal(true, {
    message: 'É preciso aceitar o tratamento de dados para criar a conta.',
  }),
});

export const loginBody = z.object({
  email: z.email({ message: 'Informe um e-mail válido.' }).transform((value) => value.toLowerCase()),
  senha: z.string().min(1, 'Informe a senha.'),
});

export type RegisterBody = z.infer<typeof registerBody>;
export type LoginBody = z.infer<typeof loginBody>;
