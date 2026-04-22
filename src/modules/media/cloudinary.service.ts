import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export type CloudinaryUploadResult = {
  url: string;
  secureUrl: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
};

/**
 * Cloudinary upload service (S — Single Responsibility: only handles cloud uploads).
 * Falls back to null if credentials are not configured.
 */
@Injectable()
export class CloudinaryService implements OnModuleInit {
  private readonly logger = new Logger(CloudinaryService.name);
  private configured = false;

  onModuleInit() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      this.logger.warn(
        'Cloudinary credentials not set — uploads will use local filesystem fallback',
      );
      return;
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });

    this.configured = true;
    this.logger.log(`Cloudinary configured (cloud: ${cloudName})`);
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async upload(
    buffer: Buffer,
    options: { folder?: string; resourceType?: 'image' | 'raw' | 'auto' } = {},
  ): Promise<CloudinaryUploadResult> {
    const folder = options.folder ?? 'plotcraft';
    const resourceType = options.resourceType ?? 'auto';

    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder,
            resource_type: resourceType,
            transformation: [
              { quality: 'auto', fetch_format: 'auto' },
            ],
          },
          (error, result?: UploadApiResponse) => {
            if (error || !result) {
              reject(error ?? new Error('Cloudinary upload failed'));
              return;
            }
            resolve({
              url: result.url,
              secureUrl: result.secure_url,
              publicId: result.public_id,
              width: result.width,
              height: result.height,
              format: result.format,
              bytes: result.bytes,
            });
          },
        )
        .end(buffer);
    });
  }

  /**
   * Generate an optimized URL with transformations.
   * @example imageUrl(publicId, { width: 200, height: 300, crop: 'fill' })
   */
  imageUrl(
    publicId: string,
    transforms: { width?: number; height?: number; crop?: string } = {},
  ): string {
    return cloudinary.url(publicId, {
      secure: true,
      transformation: [
        {
          width: transforms.width,
          height: transforms.height,
          crop: transforms.crop ?? 'limit',
          quality: 'auto',
          fetch_format: 'auto',
        },
      ],
    });
  }
}
