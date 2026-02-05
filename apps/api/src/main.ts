import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 1. 모든 엔드포인트 앞에 '/api' 접두사 붙이기
  app.setGlobalPrefix('api');
  
  // 2. CORS 허용 (프론트엔드와 통신 위해 필수)
  app.enableCors();

  // 3. 포트를 3001번으로 고정
  await app.listen(3001);
  console.log(`🚀 Application is running on: http://localhost:3001/api`);
}
bootstrap();