import { Controller, HttpCode, Post, Req } from '@nestjs/common'
import type { RawBodyRequest } from '@nestjs/common'
import type { Request } from 'express'

import { Public } from '../common/decorators/public.decorator'
import { MuxService } from '../mux/mux.service'
import { VideoService } from './video.service'

// Mux calls this endpoint when transcoding finishes/fails. It's PUBLIC (Mux has
// no JWT) — the security comes from verifying the signature, not a token.
@Controller('webhooks')
export class MuxWebhookController {
  constructor(
    private readonly mux_service: MuxService,
    private readonly video_service: VideoService,
  ) {}

  @Public()
  @Post('mux')
  @HttpCode(200) // ack fast; Mux retries on non-2xx
  async handle(@Req() req: RawBodyRequest<Request>) {
    // rawBody is the original bytes (main.ts enabled it) — needed for the signature.
    const raw = req.rawBody?.toString() ?? ''
    const event = await this.mux_service.verify_and_parse_webhook(raw, req.headers)

    switch (event.type) {
      case 'video.asset.ready': {
        const asset = event.data
        await this.video_service.mark_ready_by_mux_upload(asset.upload_id, {
          asset_id: asset.id,
          playback_id: asset.playback_ids?.[0]?.id,
          duration: asset.duration,
        })
        break
      }
      case 'video.asset.errored': {
        await this.video_service.mark_failed_by_mux_upload(event.data.upload_id)
        break
      }
      // other event types (asset.created, upload.asset_created, …) are ignored
    }

    return { received: true }
  }
}
