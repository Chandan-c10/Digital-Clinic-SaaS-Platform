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
      // QA/security audit, TC-AUTH-08: passport-jwt's defaults already
      // reject `alg: none` and infer HS* for a string secret (no live
      // vulnerability) — pinning explicitly is defense-in-depth, not a fix
      // for a hole, so a future change to how tokens are signed can't
      // silently widen what's accepted here without this line also changing.
      algorithms: ["HS256"],
    });
  }

  validate(payload: AccessTokenPayload): RequestUser {
    return { userId: payload.sub, role: payload.role, clinicId: payload.clinicId };
  }
}
