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
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { playerPhotoMulterOptions } from './player-photo.storage';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';

@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.playersService.findAll(user.id);
  }

  @Post()
  create(@Body() body: CreatePlayerDto, @CurrentUser() user: AuthUser) {
    return this.playersService.create(body, user.id);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('csv'))
  importCsv(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() user: AuthUser) {
    if (!file) throw new BadRequestException('No CSV file was uploaded');
    return this.playersService.importCsv(file, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdatePlayerDto, @CurrentUser() user: AuthUser) {
    return this.playersService.update(id, body, user.id);
  }

  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('photo', playerPhotoMulterOptions))
  async uploadPhoto(
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
    if (!file) throw new BadRequestException('No photo file was uploaded');
    try {
      return await this.playersService.updatePhoto(id, `/uploads/player-photos/${file.filename}`, user.id);
    } catch (err) {
      // Don't leave an orphaned file on disk if the ownership check rejects the write.
      await unlink(file.path).catch(() => undefined);
      throw err;
    }
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.playersService.remove(id, user.id);
  }
}
