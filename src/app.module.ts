import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { VideoModule } from './video/video.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull'
import { StorageModule } from './storage/storage.module'


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        MONGO_URI: Joi.string().required(),
        PORT: Joi.number().default(3000),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRES_IN: Joi.string().required(),
        DEFAULT_OTP_CODE: Joi.string().required(),
        STORAGE_ENDPOINT: Joi.string().uri().required(),
        STORAGE_REGION: Joi.string().default('us-east-1'),
        STORAGE_BUCKET: Joi.string().required(),
        STORAGE_ACCESS_KEY_ID: Joi.string().required(),
        STORAGE_SECRET_ACCESS_KEY: Joi.string().required(),
        STORAGE_FORCE_PATH_STYLE: Joi.boolean().default(true),
        STORAGE_PUBLIC_BASE_URL: Joi.string().uri().required(),
        STORAGE_SET_PUBLIC_POLICY: Joi.boolean().default(true),
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().required(),
      }),
    }), 
    
     MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({uri: config.get('MONGO_URI')}),
    }), 
    HealthModule,
    UserModule,
    AuthModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: config.getOrThrow<number>('REDIS_PORT'),
        },
      }),
    }),
    StorageModule,
    VideoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})

export class AppModule {}
