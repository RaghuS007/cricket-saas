import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '@prisma/client';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
}

// Normalizes every thrown error — HttpException, Prisma errors, or anything
// unexpected — into the same { statusCode, error, message } shape so the
// frontend never has to guess what an error response looks like.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const body = this.toErrorBody(exception);

    if (body.statusCode >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    response.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return { statusCode: exception.getStatus(), error: exception.name, message: res };
      }
      const resObj = res as Record<string, unknown>;
      return {
        statusCode: exception.getStatus(),
        error: (resObj.error as string) ?? exception.name,
        message: (resObj.message as string | string[]) ?? exception.message,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          statusCode: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: 'A record with these details already exists',
        };
      }
      if (exception.code === 'P2025') {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Not Found',
          message: 'Record not found',
        };
      }
      if (exception.code === 'P2003') {
        // Foreign key violation. Services should pre-check usage and throw a
        // more specific ConflictException before reaching this point — this
        // is a defense-in-depth fallback for any relation we didn't catch.
        return {
          statusCode: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: 'This record is referenced by other data and cannot be deleted',
        };
      }
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    };
  }
}
