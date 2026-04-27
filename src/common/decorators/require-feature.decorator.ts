import { SetMetadata } from '@nestjs/common';
import type { FeatureFlagKey } from '../../config/feature-flags.constants';

export const FEATURE_FLAG_KEY = 'requireFeature';
export const RequireFeature = (featureKey: FeatureFlagKey) =>
  SetMetadata(FEATURE_FLAG_KEY, featureKey);
