import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { diskStorage } from 'multer';
import type { Request } from 'express';
import { BadRequestException } from '@nestjs/common';

export const TEAM_LOGO_DIR = join(process.cwd(), 'uploads', 'team-logos');

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

export const teamLogoMulterOptions = {
  storage: diskStorage({
    destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, dest: string) => void) => {
      if (!existsSync(TEAM_LOGO_DIR)) mkdirSync(TEAM_LOGO_DIR, { recursive: true });
      cb(null, TEAM_LOGO_DIR);
    },
    filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const ext = ALLOWED_MIME_TYPES[file.mimetype] ?? extname(file.originalname).toLowerCase();
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  fileFilter: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
    if (!ALLOWED_MIME_TYPES[file.mimetype]) {
      cb(new BadRequestException('Logo must be a PNG, JPEG, or WebP image'), false);
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 3 * 1024 * 1024 },
};
