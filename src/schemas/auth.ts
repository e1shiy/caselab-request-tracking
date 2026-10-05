import { z } from 'zod';

const emailSchema = z.email('Некорректный email').max(254).toLowerCase();
const passwordSchema = z
  .string()
  .min(12, 'Пароль должен содержать не менее 12 символов')
  .max(128, 'Пароль не более 128 символов')
  .refine((value) => /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value), {
    message: 'Пароль должен содержать строчные и прописные буквы и цифры',
  });

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z
    .string()
    .trim()
    .min(2, 'ФИО должно содержать не менее 2 символов')
    .max(120, 'ФИО не более 120 символов'),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Пароль обязателен').max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;