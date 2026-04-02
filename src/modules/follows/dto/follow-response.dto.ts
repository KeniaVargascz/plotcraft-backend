export class FollowResponseDto {
  id!: string;
  username!: string;
  displayName!: string | null;
  avatarUrl!: string | null;
  isFollowing!: boolean;
}
