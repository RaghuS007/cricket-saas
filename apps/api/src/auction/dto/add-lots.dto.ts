import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class AddLotsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  playerIds!: string[];
}
