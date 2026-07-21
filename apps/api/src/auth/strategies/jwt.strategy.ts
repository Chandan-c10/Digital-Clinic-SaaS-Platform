import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { RequestUser } from "../../common/interfaces/request-with-user.interface";

interface AccessTokenPayload {
  sub: string;
  role: RequestUser["role"];
  clinicId: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_ACCESS_SECRET"),
    });
  }

  validate(payload: AccessTokenPayload): RequestUser {
    return { userId: payload.sub, role: payload.role, clinicId: payload.clinicId };
  }
}
