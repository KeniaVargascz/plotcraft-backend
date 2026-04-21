import type { JwtPayload } from './strategies/jwt.strategy';

export const AUTH_SERVICE = 'AUTH_SERVICE';

export interface IAuthService {
  getOptionalJwtPayloadFromAuthHeader(
    authorization?: string,
  ): Promise<JwtPayload | null>;
}
