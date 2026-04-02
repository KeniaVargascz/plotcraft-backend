import { Body, Controller, Delete, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { DeleteUserDto } from './dto/delete-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Obtener datos del usuario autenticado' })
  getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.getCurrentUser(user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualizar email, username o password' })
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateUserDto) {
    return this.usersService.updateCurrentUser(user.sub, dto);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Eliminar cuenta propia con confirmacion' })
  deleteMe(@CurrentUser() user: JwtPayload, @Body() dto: DeleteUserDto) {
    return this.usersService.deleteCurrentUser(user.sub, dto);
  }
}
