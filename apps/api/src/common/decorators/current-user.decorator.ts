import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthenticatedRequest, RequestUser } from "../interfaces/request-with-user.interface";

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
