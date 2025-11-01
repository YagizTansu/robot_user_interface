import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { UsersService } from './users.service';
import type { User } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(): User[] {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): User | undefined {
    return this.usersService.findOne(id);
  }

  @Post()
  create(@Body() userData: Omit<User, 'id' | 'createdAt'>): User {
    return this.usersService.create(userData);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() userData: Partial<Omit<User, 'id' | 'createdAt'>>,
  ): User | undefined {
    return this.usersService.update(id, userData);
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number): { deleted: boolean } {
    const deleted = this.usersService.delete(id);
    return { deleted };
  }
}