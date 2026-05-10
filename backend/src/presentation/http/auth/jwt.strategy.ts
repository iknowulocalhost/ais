import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtAccessPayload } from '../../../application/use-cases/auth/login.use-case';

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: JwtAccessPayload['roles'];
  netschoolEmployeeId: number | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(cfg: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: cfg.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: JwtAccessPayload): AuthenticatedUser {
    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles,
      // Старые токены, выпущенные до введения поля, не содержат его — нормализуем к null.
      netschoolEmployeeId: payload.netschoolEmployeeId ?? null,
    };
  }
}
