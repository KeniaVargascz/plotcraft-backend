import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message = 'Error interno del servidor';
    let errors: string[] | undefined;
    let code: string | undefined;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (
      exceptionResponse &&
      typeof exceptionResponse === 'object' &&
      'message' in exceptionResponse
    ) {
      if (
        'code' in exceptionResponse &&
        typeof exceptionResponse.code === 'string'
      ) {
        code = exceptionResponse.code;
      }

      const rawMessage = exceptionResponse.message;

      if (Array.isArray(rawMessage)) {
        message = 'Error de validacion';
        errors = rawMessage.map((item) => String(item));
      } else if (typeof rawMessage === 'string') {
        message = rawMessage;
      }
    }

    response.status(statusCode).json({
      success: false,
      error: {
        statusCode,
        message,
        ...(code ? { code } : {}),
        ...(errors ? { errors } : {}),
      },
      timestamp: new Date().toISOString(),
    });
  }
}
