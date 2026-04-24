import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { ReorderTasksDto } from './dto/reorder-tasks.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { PlannerService } from './planner.service';

@ApiTags('planner')
@ApiBearerAuth()
@RequireFeature('author.planner')
@Controller('planner')
export class PlannerController {
  constructor(private readonly plannerService: PlannerService) {}

  // ── Projects ──────────────────────────────────────────────────────

  @Get('projects')
  @ApiOperation({ summary: 'Listar proyectos del usuario' })
  listProjects(@CurrentUser() user: JwtPayload) {
    return this.plannerService.listProjects(user.sub);
  }

  @Post('projects')
  @ApiOperation({ summary: 'Crear proyecto' })
  createProject(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateProjectDto,
  ) {
    return this.plannerService.createProject(user.sub, dto);
  }

  @Get('projects/:id')
  @ApiOperation({ summary: 'Detalle de un proyecto' })
  getProject(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.plannerService.getProject(id, user.sub);
  }

  @Patch('projects/:id')
  @ApiOperation({ summary: 'Editar proyecto' })
  updateProject(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.plannerService.updateProject(id, user.sub, dto);
  }

  @Delete('projects/:id')
  @ApiOperation({ summary: 'Eliminar proyecto' })
  deleteProject(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.plannerService.deleteProject(id, user.sub);
  }

  @Patch('projects/:id/archive')
  @ApiOperation({ summary: 'Archivar proyecto' })
  archiveProject(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.plannerService.archiveProject(id, user.sub);
  }

  @Patch('projects/:id/restore')
  @ApiOperation({ summary: 'Restaurar proyecto archivado' })
  restoreProject(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.plannerService.restoreProject(id, user.sub);
  }

  // ── Tasks ─────────────────────────────────────────────────────────

  @Get('projects/:id/tasks')
  @ApiOperation({ summary: 'Listar tareas de un proyecto' })
  listTasks(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: TaskQueryDto,
  ) {
    return this.plannerService.listTasks(id, user.sub, query);
  }

  @Post('projects/:id/tasks')
  @ApiOperation({ summary: 'Crear tarea en un proyecto' })
  createTask(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTaskDto,
  ) {
    return this.plannerService.createTask(id, user.sub, dto);
  }

  @Patch('projects/:id/tasks/reorder')
  @ApiOperation({ summary: 'Reordenar tareas' })
  reorderTasks(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReorderTasksDto,
  ) {
    return this.plannerService.reorderTasks(id, user.sub, dto);
  }

  @Patch('projects/:id/tasks/:taskId')
  @ApiOperation({ summary: 'Editar tarea' })
  updateTask(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.plannerService.updateTask(id, taskId, user.sub, dto);
  }

  @Delete('projects/:id/tasks/:taskId')
  @ApiOperation({ summary: 'Eliminar tarea' })
  deleteTask(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.plannerService.deleteTask(id, taskId, user.sub);
  }

  @Post('projects/:id/tasks/:taskId/move')
  @ApiOperation({ summary: 'Mover tarea de columna' })
  moveTask(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: MoveTaskDto,
  ) {
    return this.plannerService.moveTask(id, taskId, user.sub, dto);
  }

  // ── Board / Calendar / Stats ──────────────────────────────────────

  @Get('board/:projectId')
  @ApiOperation({ summary: 'Tablero Kanban de un proyecto' })
  getBoard(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.plannerService.getBoard(projectId, user.sub);
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Vista calendario de tareas' })
  getCalendar(
    @CurrentUser() user: JwtPayload,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.plannerService.getCalendar(user.sub, from, to);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estadisticas globales del planner' })
  getStats(@CurrentUser() user: JwtPayload) {
    return this.plannerService.getStats(user.sub);
  }
}
