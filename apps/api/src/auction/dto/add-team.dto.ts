import { IsString } from 'class-validator';

export class AddTeamDto {
  @IsString()
  teamId!: string;
}
