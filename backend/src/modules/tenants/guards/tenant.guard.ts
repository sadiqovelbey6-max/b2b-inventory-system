import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { User } from '../../users/schemas/user.schema';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: User }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('İstifadəçi autentifikasiya olunmayıb');
    }

    if (!user.tenant) {
      throw new ForbiddenException('İstifadəçi müştəriyə təyin edilməyib');
    }

    return true;
  }
}
