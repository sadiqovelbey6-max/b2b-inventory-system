import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '../../users/schemas/user.schema';

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: User }>();
    return request.user?.tenant;
  },
);
