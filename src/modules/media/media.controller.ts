import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { MediaService } from './media.service';
import { CloudinaryService } from './cloudinary.service';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const MAGIC_BYTES: Array<{ mime: string; bytes: number[] }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
];

function validateMagicBytes(buffer: Buffer, declaredMime: string): boolean {
  // SVG is text-based, skip magic byte check
  if (declaredMime === 'image/svg+xml') {
    const head = buffer.subarray(0, 256).toString('utf8').trim();
    return head.startsWith('<') && head.includes('svg');
  }
  const entry = MAGIC_BYTES.find((m) => m.mime === declaredMime);
  if (!entry) return false;
  return entry.bytes.every((byte, i) => buffer[i] === byte);
}

@ApiTags('media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post('upload')
  @ApiOperation({ summary: 'Subir archivo multimedia' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  async uploadFile(
    @UploadedFile()
    file:
      | { originalname: string; mimetype: string; size: number; buffer: Buffer }
      | undefined,
    @Req() req: Request,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException({ statusCode: 400, message: 'No file received', code: 'FILE_NOT_RECEIVED' });
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException({ statusCode: 400, message: `File type not allowed: ${file.mimetype}. Only images are accepted (JPEG, PNG, WebP, GIF, SVG).`, code: 'FILE_TYPE_NOT_ALLOWED' });
    }

    if (!validateMagicBytes(file.buffer, file.mimetype)) {
      throw new BadRequestException({ statusCode: 400, message: 'File content does not match the declared type', code: 'FILE_CONTENT_MISMATCH' });
    }

    // Use Cloudinary if configured, otherwise fall back to local filesystem
    if (this.cloudinaryService.isConfigured()) {
      const result = await this.cloudinaryService.upload(file.buffer, {
        folder: 'plotcraft',
        resourceType: file.mimetype.startsWith('image/') ? 'image' : 'auto',
      });

      return {
        url: result.secureUrl,
        publicId: result.publicId,
        filename: result.publicId.split('/').pop() ?? result.publicId,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: result.bytes,
        width: result.width,
        height: result.height,
        format: result.format,
      };
    }

    // Fallback: local filesystem (development only)
    const uploadDir = this.mediaService.ensureUploadDir();
    const filename = this.mediaService.buildFilename(file.originalname);
    writeFileSync(join(uploadDir, filename), file.buffer);

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    return {
      url: `${baseUrl}/uploads/${filename}`,
      filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
  }
}
