import { IsIn, IsOptional } from 'class-validator';

export class AnalyticsQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d', '90d', '1y', 'all'])
  period?: '7d' | '30d' | '90d' | '1y' | 'all' = '30d';
}
