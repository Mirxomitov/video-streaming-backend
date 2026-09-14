import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateVideoDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]
}
