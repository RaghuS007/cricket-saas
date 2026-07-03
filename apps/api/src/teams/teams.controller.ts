import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipeBuilder,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { unlink } from 'fs/promises';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { teamLogoMulterOptions } from './team-logo.storage';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.teamsService.findAll(user.id);
  }

  @Post()
  create(@Body() body: CreateTeamDto, @CurrentUser() user: AuthUser) {
    return this.teamsService.create(body, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateTeamDto, @CurrentUser() user: AuthUser) {
    return this.teamsService.update(id, body, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.teamsService.remove(id, user.id);
  }

  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('logo', teamLogoMulterOptions))
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        // diskStorage doesn't populate file.buffer, so magic-number sniffing can't run —
        // fall back to the mimetype already checked by multer's fileFilter.
        .addFileTypeValidator({ fileType: /^(image\/png|image\/jpeg|image\/webp)$/, skipMagicNumbersValidation: true })
        .addMaxSizeValidator({ maxSize: 3 * 1024 * 1024 })
        .build({ fileIsRequired: false, errorHttpStatusCode: 400 }),
    )
    file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('No logo file was uploaded');
    try {
      return await this.teamsService.updateLogo(id, `/uploads/team-logos/${file.filename}`, user.id);
    } catch (err) {
      // Don't leave an orphaned file on disk if the ownership check rejects the write.
      await unlink(file.path).catch(() => undefined);
      throw err;
    }
  }
}
