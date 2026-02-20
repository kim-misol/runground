import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';

import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

import request = require('supertest');

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // main.ts와 동일하게 글로벌 프리픽스 설정 (모바일에서 /api 로 호출하므로)
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('클래스 목록 조회 API', () => {
    it('/ (GET)', () => {
      return request(app.getHttpServer())
        .get('/api')
        .expect(200)
        .expect({ message: 'ok', data: [] });
    });

    it('/api (GET) - 변경된 새 스키마 구조로 클래스 목록을 반환해야 한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api')
        .expect(200); 
        
      // 1) 응답은 { message, data } 형태
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');

      // 2) data는 배열
      expect(Array.isArray(response.body.data)).toBeTruthy();

      // 3. 배열에 데이터가 있다면, 새로운 DB 스키마의 필드들을 포함해야 함
      if (response.body.length > 0) {
        const item = response.body.data[0];

        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('mode'); // ADVANCED, HYBRID, ONLINE_ONLY
        expect(item).toHaveProperty('isActive');
      }
    });
  });
});
