import { z } from 'zod';
export const password = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(128)
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    'Password must be at most 72 UTF-8 bytes',
  );
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_.-]{3,40}$/, 'Use 3–40 lowercase letters, numbers, dots or underscores'),
  email: z.union([z.email(), z.literal('')]).optional(),
  number: z.string().trim().min(2).max(80),
  classId: z.uuid(),
  password,
});
export const messageSchema = z
  .object({
    clientId: z.uuid(),
    body: z.string().trim().max(4000),
    replyTo: z.uuid().nullable().optional(),
    attachmentIds: z.array(z.uuid()).max(3).default([]),
  })
  .refine((v) => v.body.length || v.attachmentIds.length, 'Write a message or attach a file');
export const noticeSchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(12000),
  classId: z.uuid().nullable(),
  priority: z.enum(['normal', 'important']),
  requiresAck: z.boolean(),
  expiresAt: z.number().nullable().optional(),
  status: z.enum(['draft', 'published']),
});
