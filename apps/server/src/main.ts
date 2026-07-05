import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Every route is versioned under /v1 per the API surface in SPEC §9.
  app.setGlobalPrefix('v1');

  // OpenAPI spec is generated from the code (CLAUDE.md §2).
  const config = new DocumentBuilder()
    .setTitle('Kapar API')
    .setDescription('Kapar backend — one app, two modes. See SPEC.md §9 for the endpoint contract.')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
