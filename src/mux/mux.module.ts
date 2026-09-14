import { Module } from '@nestjs/common'

import { MuxService } from './mux.service'

// Exports MuxService so other modules (VideoModule) can inject it.
// ConfigModule is global, so MuxService gets ConfigService without importing anything.
@Module({
  providers: [MuxService],
  exports: [MuxService],
})
export class MuxModule {}
