import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

interface Bucket {
  count: number;
  windowStart: number;
}

// Simple in-memory fixed-window limiter, keyed by client IP.
// Single-process only — fine for this app's current single-instance deployment.
// If this ever runs behind multiple instances, swap for a shared store (Redis).
//
// Threshold is read from env at construction time (not module load time) so
// the e2e suite — which legitimately calls /auth/register dozens of times
// per test file from the same client — can run with a much higher ceiling
// without weakening the production default.
@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private readonly windowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 60_000;
  private readonly maxAttempts = Number(process.env.AUTH_RATE_LIMIT_MAX) || 10;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.ip ?? 'unknown';
    const now = Date.now();

    const bucket = this.buckets.get(key);
    if (!bucket || now - bucket.windowStart > this.windowMs) {
      this.buckets.set(key, { count: 1, windowStart: now });
      return true;
    }

    bucket.count += 1;
    if (bucket.count > this.maxAttempts) {
      throw new HttpException('Too many attempts — try again shortly', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
