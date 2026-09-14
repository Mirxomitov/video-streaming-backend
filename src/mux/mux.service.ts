import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { IncomingHttpHeaders } from 'http'
import Mux from '@mux/mux-node'

// Thin wrapper around the Mux SDK. Everything that talks to Mux goes through
// here — so when we swap Mux for our own ffmpeg+R2 pipeline later, only this
// file changes, not VideoService.
@Injectable()
export class MuxService {
  private readonly client: Mux

  constructor(private readonly config: ConfigService) {
    // The SDK needs the token pair. Non-null asserted because Joi already
    // guaranteed both exist at boot (app would've refused to start otherwise).
    this.client = new Mux({
      tokenId: this.config.get<string>('MUX_TOKEN_ID')!,
      tokenSecret: this.config.get<string>('MUX_TOKEN_SECRET')!,
    })
  }

  // Ask Mux for a one-time upload slot. The client PUTs the file straight to
  // `url`; Mux then creates an asset and transcodes it.
  async create_direct_upload() {
    const upload = await this.client.video.uploads.create({
      cors_origin: '*', // dev only — lock this to your app's origin in prod
      new_asset_settings: {
        playback_policies: ['public'], // public HLS URL (no signed tokens yet)
      },
    })
    return { upload_url: upload.url, upload_id: upload.id }
  }

  // Verify the signature on an incoming Mux webhook and return the parsed event.
  // Throws if the signature is bad — so a forged request never reaches our logic.
  async verify_and_parse_webhook(raw_body: string, headers: IncomingHttpHeaders) {
    const secret = this.config.get<string>('MUX_WEBHOOK_SECRET')
    if (!secret) {
      throw new Error('MUX_WEBHOOK_SECRET is not set — cannot verify webhook')
    }
    return this.client.webhooks.unwrap(raw_body, headers, secret)
  }
}
