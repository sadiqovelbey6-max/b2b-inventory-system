import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { User } from '../../users/schemas/user.schema';

interface RequestWithUser {
  user?: User;
  tenantId?: string;
}

function getTenantId(user?: User): string | undefined {
  if (!user?.tenant) return undefined;
  const t = user.tenant as unknown;
  if (
    typeof t === 'object' &&
    t !== null &&
    'id' in t &&
    typeof (t as { id?: string }).id === 'string'
  ) {
    return (t as { id: string }).id;
  }
  if (typeof (t as { toString?: () => string })?.toString === 'function') {
    return (t as { toString: () => string }).toString();
  }
  return undefined;
}

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    const tenantId = getTenantId(user);
    if (tenantId) {
      request.tenantId = tenantId;
    }

    return next.handle();
  }
}
