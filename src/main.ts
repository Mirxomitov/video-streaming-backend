import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

import basicAuth from 'express-basic-auth'

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  const config = new DocumentBuilder()
    .setTitle('Video Backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build()

  app.use(
    ['/api/docs'],
    basicAuth({
      challenge: true,
      users: { admin: process.env.DOCS_PASSWORD ?? 'changeme' },
    }),
  )

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document)

  
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();


