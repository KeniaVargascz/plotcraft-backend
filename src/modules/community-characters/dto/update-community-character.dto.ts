import { PartialType } from '@nestjs/swagger';
import { CreateCommunityCharacterDto } from './create-community-character.dto';

export class UpdateCommunityCharacterDto extends PartialType(
  CreateCommunityCharacterDto,
) {}
