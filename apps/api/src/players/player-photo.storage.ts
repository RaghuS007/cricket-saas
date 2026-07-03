import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { diskStorage } from 'multer';
import type { Request } from 'express';
import { BadRequestException } from '@nestjs/common';

export const PLAYER_PHOTO_DIR = join(process.cwd(), 'uploads', 'player-photos');

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

export const playerPhotoMulterOptions = {
  storage: diskStorage({
    destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, dest: string) => void) => {
      if (!existsSync(PLAYER_PHOTO_DIR)) mkdirSync(PLAYER_PHOTO_DIR, { recursive: true });
      cb(null, PLAYER_PHOTO_DIR);
    },
    filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const ext = ALLOWED_MIME_TYPES[file.mimetype] ?? extname(file.originalname).toLowerCase();
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  fileFilter: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
    if (!ALLOWED_MIME_TYPES[file.mimetype]) {
      cb(new BadRequestException('Photo must be a PNG, JPEG, or WebP image'), false);
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 3 * 1024 * 1024 },
};
