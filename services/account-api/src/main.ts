import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadConfig } from './config/app.config';
import { configureApp } from './bootstrap';

async function bootstrap() {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(config.port);
}

bootstrap();
