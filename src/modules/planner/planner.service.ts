import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TaskStatus, TaskType, TaskPriority } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { ReorderTasksDto } from './dto/reorder-tasks.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const TASK_INCLUDE = {
  project: { select: { id: true, name: true, color: true } },
  chapter: { select: { id: true, slug: true, title: true } },
  character: { select: { id: true, slug: true, name: true } },
} satisfies Prisma.WritingTaskInclude;

type RawTask = Prisma.WritingTaskGetPayload<{ include: typeof TASK_INCLUDE }>;

@Injectable()
export class PlannerService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Projects ──────────────────────────────────────────────────────

  async listProjects(userId: string) {
    const projects = await this.prisma.writingProject.findMany({
      where: { authorId: userId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      include: {
        novel: { select: { id: true, slug: true, title: true } },
        tasks: { select: { id: true, status: true, dueDate: true } },
      },
    });

    return projects.map((p) => this.toProjectResponse(p));
  }

  async createProject(userId: string, dto: CreateProjectDto) {
    if (dto.novelId) {
      await this.assertNovelOwnership(dto.novelId, userId);
    }

    const project = await this.prisma.writingProject.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        color: dto.color || null,
        authorId: userId,
        novelId: dto.novelId || null,
      },
      include: {
        novel: { select: { id: true, slug: true, title: true } },
        tasks: { select: { id: true, status: true, dueDate: true } },
      },
    });

    return this.toProjectResponse(project);
  }

  async getProject(id: string, userId: string) {
    const project = await this.prisma.writingProject.findUnique({
      where: { id },
      include: {
        novel: { select: { id: true, slug: true, title: true } },
        tasks: { select: { id: true, status: true, dueDate: true } },
      },
    });

    if (!project) throw new NotFoundException({ statusCode: 404, message: 'Project not found', code: 'PROJECT_NOT_FOUND' });
    if (project.authorId !== userId)
      throw new ForbiddenException({ statusCode: 403, message: 'You cannot access this project', code: 'PROJECT_ACCESS_FORBIDDEN' });

    return this.toProjectResponse(project);
  }

  async updateProject(id: string, userId: string, dto: UpdateProjectDto) {
    const project = await this.findOwnedProject(id, userId);

    if (dto.novelId) {
      await this.assertNovelOwnership(dto.novelId, userId);
    }

    const updated = await this.prisma.writingProject.update({
      where: { id: project.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.color !== undefined ? { color: dto.color || null } : {}),
        ...(dto.novelId !== undefined ? { novelId: dto.novelId || null } : {}),
      },
      include: {
        novel: { select: { id: true, slug: true, title: true } },
        tasks: { select: { id: true, status: true, dueDate: true } },
      },
    });

    return this.toProjectResponse(updated);
  }

  async deleteProject(id: string, userId: string) {
    await this.findOwnedProject(id, userId);
    await this.prisma.writingProject.delete({ where: { id } });
    return { message: 'Project deleted successfully' };
  }

  async archiveProject(id: string, userId: string) {
    await this.findOwnedProject(id, userId);

    const updated = await this.prisma.writingProject.update({
      where: { id },
      data: { isActive: false },
      include: {
        novel: { select: { id: true, slug: true, title: true } },
        tasks: { select: { id: true, status: true, dueDate: true } },
      },
    });

    return this.toProjectResponse(updated);
  }

  async restoreProject(id: string, userId: string) {
    await this.findOwnedProject(id, userId);

    const updated = await this.prisma.writingProject.update({
      where: { id },
      data: { isActive: true },
      include: {
        novel: { select: { id: true, slug: true, title: true } },
        tasks: { select: { id: true, status: true, dueDate: true } },
      },
    });

    return this.toProjectResponse(updated);
  }

  async upsertByNovel(novelSlug: string, userId: string) {
    const novel = await this.prisma.novel.findUnique({
      where: { slug: novelSlug },
    });

    if (!novel) throw new NotFoundException({ statusCode: 404, message: 'Novel not found', code: 'NOVEL_NOT_FOUND' });
    if (novel.authorId !== userId)
      throw new ForbiddenException({ statusCode: 403, message: 'You cannot manage this novel', code: 'NOVEL_FORBIDDEN' });

    let project = await this.prisma.writingProject.findFirst({
      where: { novelId: novel.id, authorId: userId },
      include: {
        novel: { select: { id: true, slug: true, title: true } },
        tasks: { select: { id: true, status: true, dueDate: true } },
      },
    });

    if (!project) {
      project = await this.prisma.writingProject.create({
        data: {
          name: `${novel.title} — Planner`,
          authorId: userId,
          novelId: novel.id,
        },
        include: {
          novel: { select: { id: true, slug: true, title: true } },
          tasks: { select: { id: true, status: true, dueDate: true } },
        },
      });
    }

    return this.toProjectResponse(project);
  }

  // ── Tasks ─────────────────────────────────────────────────────────

  async listTasks(projectId: string, userId: string, query: TaskQueryDto) {
    await this.findOwnedProject(projectId, userId);
    const limit = query.limit ?? 20;

    const now = new Date();
    const where: Prisma.WritingTaskWhereInput = {
      projectId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              {
                description: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
      ...(query.overdue
        ? { dueDate: { lt: now }, status: { not: TaskStatus.DONE } }
        : {}),
      ...(query.dueFrom || query.dueTo
        ? {
            dueDate: {
              ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
              ...(query.dueTo ? { lte: new Date(query.dueTo) } : {}),
            },
          }
        : {}),
    };

    const tasks = await this.prisma.writingTask.findMany({
      where,
      take: limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: TASK_INCLUDE,
    });

    const hasMore = tasks.length > limit;
    const items = tasks.slice(0, limit);

    return {
      data: items.map((t) => this.toTaskResponse(t)),
      pagination: {
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
        hasMore,
        limit,
      },
    };
  }

  async createTask(projectId: string, userId: string, dto: CreateTaskDto) {
    await this.findOwnedProject(projectId, userId);

    if (dto.chapterId) {
      await this.assertChapterOwnership(dto.chapterId, userId);
    }
    if (dto.characterId) {
      await this.assertCharacterOwnership(dto.characterId, userId);
    }

    const status = dto.status ?? TaskStatus.BACKLOG;

    const maxOrder = await this.prisma.writingTask.aggregate({
      where: { projectId, status },
      _max: { sortOrder: true },
    });

    const task = await this.prisma.writingTask.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        type: dto.type ?? undefined,
        priority: dto.priority ?? undefined,
        status,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        targetWords: dto.targetWords ?? null,
        actualWords: dto.actualWords ?? null,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        tags: dto.tags?.map((t) => t.trim()).filter(Boolean) ?? [],
        chapterId: dto.chapterId || null,
        characterId: dto.characterId || null,
        completedAt: status === TaskStatus.DONE ? new Date() : null,
        projectId,
        authorId: userId,
      },
      include: TASK_INCLUDE,
    });

    return this.toTaskResponse(task);
  }

  async updateTask(
    projectId: string,
    taskId: string,
    userId: string,
    dto: UpdateTaskDto,
  ) {
    const task = await this.findOwnedTask(projectId, taskId, userId);

    if (dto.chapterId) {
      await this.assertChapterOwnership(dto.chapterId, userId);
    }
    if (dto.characterId) {
      await this.assertCharacterOwnership(dto.characterId, userId);
    }

    const completedAt = this.resolveCompletedAt(
      task.status,
      dto.status,
      task.completedAt,
    );

    const updated = await this.prisma.writingTask.update({
      where: { id: taskId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.dueDate !== undefined
          ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }
          : {}),
        ...(dto.targetWords !== undefined
          ? { targetWords: dto.targetWords ?? null }
          : {}),
        ...(dto.actualWords !== undefined
          ? { actualWords: dto.actualWords ?? null }
          : {}),
        ...(dto.tags !== undefined
          ? { tags: dto.tags?.map((t) => t.trim()).filter(Boolean) ?? [] }
          : {}),
        ...(dto.chapterId !== undefined
          ? { chapterId: dto.chapterId || null }
          : {}),
        ...(dto.characterId !== undefined
          ? { characterId: dto.characterId || null }
          : {}),
        completedAt,
      },
      include: TASK_INCLUDE,
    });

    return this.toTaskResponse(updated);
  }

  async deleteTask(projectId: string, taskId: string, userId: string) {
    await this.findOwnedTask(projectId, taskId, userId);
    await this.prisma.writingTask.delete({ where: { id: taskId } });
    return { message: 'Task deleted successfully' };
  }

  async moveTask(
    projectId: string,
    taskId: string,
    userId: string,
    dto: MoveTaskDto,
  ) {
    const task = await this.findOwnedTask(projectId, taskId, userId);

    const completedAt = this.resolveCompletedAt(
      task.status,
      dto.status,
      task.completedAt,
    );

    const data: Prisma.WritingTaskUpdateInput = {
      status: dto.status,
      completedAt,
    };

    if (dto.sortOrder !== undefined) {
      data.sortOrder = dto.sortOrder;
    }

    const updated = await this.prisma.writingTask.update({
      where: { id: taskId },
      data,
      include: TASK_INCLUDE,
    });

    return this.toTaskResponse(updated);
  }

  async reorderTasks(projectId: string, userId: string, dto: ReorderTasksDto) {
    await this.findOwnedProject(projectId, userId);

    const taskIds = dto.tasks.map((t) => t.id);

    const existing = await this.prisma.writingTask.findMany({
      where: { id: { in: taskIds }, projectId },
      select: { id: true, status: true },
    });

    if (existing.length !== taskIds.length) {
      throw new BadRequestException({ statusCode: 400, message: 'One or more tasks do not belong to this project', code: 'TASKS_NOT_IN_PROJECT' });
    }

    const wrongStatus = existing.find((t) => t.status !== dto.status);
    if (wrongStatus) {
      throw new BadRequestException({ statusCode: 400, message: `Task ${wrongStatus.id} does not have the status ${dto.status}`, code: 'TASK_STATUS_MISMATCH' });
    }

    await this.prisma.$transaction(
      dto.tasks.map((t) =>
        this.prisma.writingTask.update({
          where: { id: t.id },
          data: { sortOrder: t.sortOrder },
        }),
      ),
    );

    return { message: 'Tasks reordered successfully' };
  }

  // ── Board ─────────────────────────────────────────────────────────

  async getBoard(projectId: string, userId: string) {
    const project = await this.getProject(projectId, userId);

    const tasks = await this.prisma.writingTask.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: TASK_INCLUDE,
    });

    const columns: Record<
      TaskStatus,
      { tasks: ReturnType<PlannerService['toTaskResponse']>[]; count: number }
    > = {
      [TaskStatus.BACKLOG]: { tasks: [], count: 0 },
      [TaskStatus.IN_PROGRESS]: { tasks: [], count: 0 },
      [TaskStatus.REVIEW]: { tasks: [], count: 0 },
      [TaskStatus.DONE]: { tasks: [], count: 0 },
    };

    for (const task of tasks) {
      const mapped = this.toTaskResponse(task);
      columns[task.status].tasks.push(mapped);
      columns[task.status].count += 1;
    }

    return { project, columns };
  }

  // ── Calendar ──────────────────────────────────────────────────────

  async getCalendar(userId: string, from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const diffMs = toDate.getTime() - fromDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays > 90 || diffDays < 0) {
      throw new BadRequestException({ statusCode: 400, message: 'The maximum allowed range is 90 days', code: 'CALENDAR_RANGE_EXCEEDED' });
    }

    const activeProjects = await this.prisma.writingProject.findMany({
      where: { authorId: userId, isActive: true },
      select: { id: true },
    });

    const projectIds = activeProjects.map((p) => p.id);

    const tasks = await this.prisma.writingTask.findMany({
      where: {
        projectId: { in: projectIds },
        dueDate: { gte: fromDate, lte: toDate },
      },
      orderBy: [{ dueDate: 'asc' }, { sortOrder: 'asc' }],
      include: TASK_INCLUDE,
    });

    const mapped = tasks.map((t) => this.toTaskResponse(t));

    const groupedByDate: Record<
      string,
      ReturnType<PlannerService['toTaskResponse']>[]
    > = {};

    for (const task of mapped) {
      if (task.dueDate) {
        const dateKey = new Date(task.dueDate).toISOString().slice(0, 10);
        if (!groupedByDate[dateKey]) {
          groupedByDate[dateKey] = [];
        }
        groupedByDate[dateKey].push(task);
      }
    }

    return { tasks: mapped, groupedByDate };
  }

  // ── Stats ─────────────────────────────────────────────────────────

  async getStats(userId: string) {
    const now = new Date();

    const [
      totalProjects,
      activeProjects,
      totalTasks,
      tasksDone,
      tasksOverdue,
      tasksInProgress,
      wordsAgg,
      byTypeRaw,
      byPriorityRaw,
      recentCompletions,
    ] = await Promise.all([
      this.prisma.writingProject.count({ where: { authorId: userId } }),
      this.prisma.writingProject.count({
        where: { authorId: userId, isActive: true },
      }),
      this.prisma.writingTask.count({ where: { authorId: userId } }),
      this.prisma.writingTask.count({
        where: { authorId: userId, status: TaskStatus.DONE },
      }),
      this.prisma.writingTask.count({
        where: {
          authorId: userId,
          dueDate: { lt: now },
          status: { not: TaskStatus.DONE },
        },
      }),
      this.prisma.writingTask.count({
        where: { authorId: userId, status: TaskStatus.IN_PROGRESS },
      }),
      this.prisma.writingTask.aggregate({
        where: { authorId: userId },
        _sum: { targetWords: true, actualWords: true },
      }),
      this.prisma.writingTask.groupBy({
        by: ['type'],
        where: { authorId: userId },
        _count: true,
      }),
      this.prisma.writingTask.groupBy({
        by: ['priority'],
        where: { authorId: userId },
        _count: true,
      }),
      this.prisma.writingTask.findMany({
        where: { authorId: userId, status: TaskStatus.DONE },
        orderBy: { completedAt: 'desc' },
        take: 5,
        include: {
          project: { select: { id: true, name: true, color: true } },
        },
      }),
    ]);

    const byType: Record<string, number> = {};
    for (const val of Object.values(TaskType)) {
      byType[val] = 0;
    }
    for (const row of byTypeRaw) {
      byType[row.type] = row._count;
    }

    const byPriority: Record<string, number> = {};
    for (const val of Object.values(TaskPriority)) {
      byPriority[val] = 0;
    }
    for (const row of byPriorityRaw) {
      byPriority[row.priority] = row._count;
    }

    return {
      totalProjects,
      activeProjects,
      totalTasks,
      tasksDone,
      tasksOverdue,
      tasksInProgress,
      completionRate: totalTasks > 0 ? (tasksDone / totalTasks) * 100 : 0,
      wordsTargeted: wordsAgg._sum.targetWords ?? 0,
      wordsWritten: wordsAgg._sum.actualWords ?? 0,
      byType,
      byPriority,
      recentCompletions: recentCompletions.map((t) => ({
        id: t.id,
        title: t.title,
        completedAt: t.completedAt,
        project: t.project,
      })),
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private async findOwnedProject(id: string, userId: string) {
    const project = await this.prisma.writingProject.findUnique({
      where: { id },
    });

    if (!project) throw new NotFoundException({ statusCode: 404, message: 'Project not found', code: 'PROJECT_NOT_FOUND' });
    if (project.authorId !== userId)
      throw new ForbiddenException({ statusCode: 403, message: 'You cannot manage this project', code: 'PROJECT_FORBIDDEN' });

    return project;
  }

  private async findOwnedTask(
    projectId: string,
    taskId: string,
    userId: string,
  ) {
    await this.findOwnedProject(projectId, userId);

    const task = await this.prisma.writingTask.findUnique({
      where: { id: taskId },
    });

    if (!task || task.projectId !== projectId)
      throw new NotFoundException({ statusCode: 404, message: 'Task not found', code: 'TASK_NOT_FOUND' });

    return task;
  }

  private async assertNovelOwnership(novelId: string, userId: string) {
    const novel = await this.prisma.novel.findUnique({
      where: { id: novelId },
      select: { authorId: true },
    });

    if (!novel) throw new NotFoundException({ statusCode: 404, message: 'Novel not found', code: 'NOVEL_NOT_FOUND' });
    if (novel.authorId !== userId)
      throw new ForbiddenException({ statusCode: 403, message: 'You cannot link this novel', code: 'NOVEL_LINK_FORBIDDEN' });
  }

  private async assertChapterOwnership(chapterId: string, userId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { novel: { select: { authorId: true } } },
    });

    if (!chapter) throw new NotFoundException({ statusCode: 404, message: 'Chapter not found', code: 'CHAPTER_NOT_FOUND' });
    if (chapter.novel.authorId !== userId)
      throw new ForbiddenException({ statusCode: 403, message: 'You cannot link this chapter', code: 'CHAPTER_LINK_FORBIDDEN' });
  }

  private async assertCharacterOwnership(characterId: string, userId: string) {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { authorId: true },
    });

    if (!character) throw new NotFoundException({ statusCode: 404, message: 'Character not found', code: 'CHARACTER_NOT_FOUND' });
    if (character.authorId !== userId)
      throw new ForbiddenException({ statusCode: 403, message: 'You cannot link this character', code: 'CHARACTER_LINK_FORBIDDEN' });
  }

  private resolveCompletedAt(
    currentStatus: TaskStatus,
    newStatus: TaskStatus | undefined,
    currentCompletedAt: Date | null,
  ): Date | null {
    if (newStatus === undefined) return currentCompletedAt;
    if (newStatus === TaskStatus.DONE && currentStatus !== TaskStatus.DONE) {
      return new Date();
    }
    if (newStatus !== TaskStatus.DONE && currentStatus === TaskStatus.DONE) {
      return null;
    }
    return currentCompletedAt;
  }

  private toTaskResponse(task: RawTask) {
    const now = new Date();
    const isOverdue =
      task.dueDate !== null &&
      task.dueDate < now &&
      task.status !== TaskStatus.DONE;

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      type: task.type,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
      targetWords: task.targetWords,
      actualWords: task.actualWords,
      sortOrder: task.sortOrder,
      tags: task.tags,
      completedAt: task.completedAt,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      project: task.project,
      chapter: task.chapter ?? null,
      character: task.character ?? null,
      isOverdue,
    };
  }

  private toProjectResponse(
    project: Prisma.WritingProjectGetPayload<{
      include: {
        novel: { select: { id: true; slug: true; title: true } };
        tasks: { select: { id: true; status: true; dueDate: true } };
      };
    }>,
  ) {
    const now = new Date();
    const tasks = project.tasks;
    const total = tasks.length;

    const byStatus = {
      BACKLOG: 0,
      IN_PROGRESS: 0,
      REVIEW: 0,
      DONE: 0,
    };

    let overdue = 0;
    for (const t of tasks) {
      byStatus[t.status] += 1;
      if (t.dueDate && t.dueDate < now && t.status !== TaskStatus.DONE) {
        overdue += 1;
      }
    }

    const completionPct =
      total > 0 ? Math.round((byStatus.DONE / total) * 100) : 0;

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color,
      isActive: project.isActive,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      novel: project.novel ?? null,
      stats: { total, byStatus, overdue, completionPct },
    };
  }
}
