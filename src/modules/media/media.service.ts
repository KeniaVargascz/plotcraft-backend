import { Injectable } from '@nestjs/common';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

@Injectable()
export class MediaService {
  readonly uploadRoot = join(process.cwd(), 'uploads');

  ensureUploadDir() {
    if (!existsSync(this.uploadRoot)) {
      mkdirSync(this.uploadRoot, { recursive: true });
    }
    return this.uploadRoot;
  }

  buildFilename(originalName: string) {
    const SAFE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']);
    const ext = extname(originalName).toLowerCase();
    const safeExt = SAFE_EXTENSIONS.has(ext) ? ext : '.bin';
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`;
  }
}
