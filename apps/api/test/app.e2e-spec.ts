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

  describe('회원가입 API (/api/auth/signup)', () => {
    // 테스트용 임시 이메일 (실행할 때마다 충돌 방지를 위해 타임스탬프 활용)
    const testEmail = `runner_${Date.now()}@runground.com`;
    const signupDto = {
      email: testEmail,
      password: 'password123!',
      name: '테스트러너',
    };

    it('POST /api/auth/signup - 이메일과 비밀번호로 가입할 수 있어야 한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send(signupDto)
        .expect(201); // 1. HTTP 상태 코드는 201(Created)이어야 함

      // 2. 응답 데이터 검증
      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(signupDto.email);
      expect(response.body.globalRole).toBe('USER'); // 기본 권한은 USER
      
      // 3. 보안: 응답에 비밀번호 해시값이 포함되면 안 됨!
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('POST /api/auth/signup - 중복된 이메일로 가입하면 409 에러를 반환해야 한다', async () => {
      // 위에서 이미 가입한 이메일로 다시 요청
      await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send(signupDto)
        .expect(409); // Conflict (중복)
    });
  });
});
