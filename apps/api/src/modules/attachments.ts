import { Router } from 'express';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import path from 'node:path';
import { db } from '../infrastructure/database.js';
import { id, ensure, HttpError } from '../infrastructure/core.js';
import { active } from '../middleware/auth.js';
import { member } from '../policies/access.js';
import { scanFile, saveFile, storageRoot } from '../infrastructure/storage.js';
export const attachments = Router();
attachments.use(active);
attachments.post(
  '/',
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 },
  }).single('file'),
  async (req, res) => {
    ensure(req.file, 422, 'Choose one file');
    const type = await fileTypeFromBuffer(req.file.buffer);
    ensure(
      type && ['image/png', 'image/jpeg', 'application/pdf'].includes(type.mime),
      422,
      'Only actual PNG, JPEG and PDF files are accepted',
    );
    try {
      await scanFile(req.file.buffer);
    } catch {
      throw new HttpError(
        503,
        'Upload unavailable or file rejected by scanner. Please contact support.',
      );
    }
    const aid = id();
    await saveFile(aid, req.file.buffer);
    const name =
      path
        .basename(req.file.originalname)
        .replace(/[^a-zA-Z0-9 ._-]/g, '_')
        .slice(0, 160) || `attachment.${type.ext}`;
    await db('attachments').insert({
      id: aid,
      uploader_id: req.user.id,
      name,
      mime: type.mime,
      size: req.file.size,
      created_at: Date.now(),
    });
    res.status(201).json({ id: aid, name, mime: type.mime, size: req.file.size });
  },
);
attachments.get('/:id', async (req, res) => {
  const a = await db('attachments').where({ id: req.params.id }).first();
  ensure(a, 404, 'File not found');
  if (a.message_id) {
    const m = await db('messages').where({ id: a.message_id }).first();
    ensure(m && !m.deleted_at, 404, 'File not found');
    const c = await member(req.user, m.conversation_id);
    ensure(m.sequence > c.membership.joined_sequence, 404, 'File not found');
  } else ensure(a.uploader_id === req.user.id, 404, 'File not found');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.download(path.join(storageRoot, a.id), a.name);
});
