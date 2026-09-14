import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common'
import type { Request } from 'express'
import { IsNumber, Min } from 'class-validator'
import { HistoryService } from './history.service'

class SaveHistoryDto {
  @IsNumber()
  @Min(0)
  position_seconds!: number
}

@Controller()
export class HistoryController {
  constructor(private readonly history_service: HistoryService) {}

  @Post('videos/:id/history')
  save(@Param('id') id: string, @Body() dto: SaveHistoryDto, @Req() req: Request) {
    return this.history_service.save(id, req['user'].sub, dto.position_seconds)
  }

  @Get('users/me/history')
  list(@Req() req: Request) {
    return this.history_service.list(req['user'].sub)
  }
}
