import { ForbiddenException } from '@nestjs/common';
import { PostsService } from '../../modules/posts/posts.service';
import { createPostFixture } from '../helpers/fixtures.helper';

describe('PostsService', () => {
  const prisma = {
    post: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    savedPost: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  } as any;

  let service: PostsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PostsService(prisma);
  });

  it('createPost defaults type to TEXT', async () => {
    prisma.post.create.mockResolvedValue({ id: 'post-id' });
    prisma.post.findUnique.mockResolvedValue(createPostFixture());

    await service.createPost('user-id', { content: 'Hola mundo' });

    expect(prisma.post.create).toHaveBeenCalledWith({
      data: {
        authorId: 'user-id',
        content: 'Hola mundo',
        type: 'TEXT',
        imageUrls: [],
        tags: [],
      },
    });
  });

  it('updatePost throws ForbiddenException if requester is not author', async () => {
    prisma.post.findUnique.mockResolvedValue(
      createPostFixture({ authorId: 'other-user' }),
    );

    await expect(
      service.updatePost('post-id', 'user-id', { content: 'Nuevo contenido' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deletePost performs soft delete', async () => {
    prisma.post.findUnique.mockResolvedValue(createPostFixture({ authorId: 'user-id' }));

    await service.deletePost('post-id', 'user-id');

    expect(prisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('savePost toggles saved state through upsert', async () => {
    prisma.post.findUnique.mockResolvedValue(createPostFixture());

    const result = await service.savePost('post-id', 'user-id');

    expect(prisma.savedPost.upsert).toHaveBeenCalled();
    expect(result).toEqual({ saved: true });
  });
});
