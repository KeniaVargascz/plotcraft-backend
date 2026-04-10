import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateNovelDto } from './create-novel.dto';

export class UpdateNovelDto extends PartialType(
  OmitType(CreateNovelDto, ['novelType', 'linkedCommunityId'] as const),
) {}
