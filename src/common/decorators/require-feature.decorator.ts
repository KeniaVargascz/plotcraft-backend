import { SetMetadata } from '@nestjs/common';

export const FEATURE_FLAG_KEY = 'requireFeature';
export const RequireFeature = (featureKey: string) =>
  SetMetadata(FEATURE_FLAG_KEY, featureKey);
