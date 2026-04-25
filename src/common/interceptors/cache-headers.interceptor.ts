import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { CACHE_TTL_KEY } from '../decorators/cache-ttl.decorator';

const DEFAULT_PUBLIC_TTL = 60; // 1 minute for public GET endpoints

@Injectable()
export class CacheHeadersInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    // Only apply to GET requests
    if (req.method !== 'GET') {
      return next.handle().pipe(
        tap(() => {
          res.setHeader('Cache-Control', 'no-store');
        }),
      );
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const customTtl = this.reflector.getAllAndOverride<number>(CACHE_TTL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return next.handle().pipe(
      tap(() => {
        if (isPublic) {
          const ttl = customTtl ?? DEFAULT_PUBLIC_TTL;
          if (ttl === 0) {
            res.setHeader('Cache-Control', 'no-store');
          } else {
            res.setHeader('Cache-Control', `public, max-age=${ttl}`);
          }
        } else {
          res.setHeader('Cache-Control', 'private, no-store');
        }
      }),
    );
  }
}
