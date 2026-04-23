import './instrument'; // Sentry must be imported before everything else
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false, // Disable built-in parser to control order
  });
  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);

  app.use(helmet());

  // Content-Type validation BEFORE body parsers — rejects XML, YAML, etc.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const isMutation = ['POST', 'PUT', 'PATCH'].includes(req.method);
    if (isMutation && req.headers['content-type']) {
      const ct = req.headers['content-type'];
      const isJson = ct.includes('application/json');
      const isMultipart = ct.includes('multipart/form-data');
      const isUrlEncoded = ct.includes('application/x-www-form-urlencoded');
      if (!isJson && !isMultipart && !isUrlEncoded) {
        res.status(415).json({
          success: false,
          error: { statusCode: 415, message: 'Content-Type no soportado' },
          timestamp: new Date().toISOString(),
        });
        return;
      }
    }
    next();
  });

  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });

  const corsOrigin = configService.get<string>(
    'CORS_ORIGIN',
    'http://localhost:4200',
  );
  app.enableCors({
    origin: corsOrigin.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Backward compatibility: redirect /api/* to /api/v1/*
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.url.startsWith('/api/') && !req.url.startsWith('/api/v1/')) {
      req.url = req.url.replace('/api/', '/api/v1/');
    }
    next();
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalGuards(new JwtAuthGuard(reflector));
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Swagger solo se activa con ENABLE_SWAGGER=true (desarrollo local)
  const enableSwagger = configService.get<string>('ENABLE_SWAGGER') === 'true';
  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('PlotCraft API')
      .setDescription('Entregable 1: autenticacion, usuarios y perfiles')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();

    SwaggerModule.setup(
      'api/v1/docs',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }

  await app.listen(configService.get<number>('PORT', 3000));
}

void bootstrap();
