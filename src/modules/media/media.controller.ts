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
      throw new BadRequestException('No se recibio ningun archivo.');
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
