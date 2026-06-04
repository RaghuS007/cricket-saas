import { Body, Controller, Get, Post } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';

@Controller('organizations')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Post()
  create(@Body() dto: CreateOrganizationDto, @CurrentUser() user: AuthUser) {
    return this.orgService.create(dto, user.id);
  }

  @Get('me')
  findMine(@CurrentUser() user: AuthUser) {
    return this.orgService.findMine(user.id);
  }
}
