import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Class Module (e2e)', () => {
  let app: INestApplication;
  let coachToken: string;
  let runnerToken: string;
  let createdClassId: string; // 생성된 클래스의 ID를 저장해둘 변수

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    // 1. 코치(ADMIN) 계정 생성 및 로그인
    const coachEmail = `coach_${Date.now()}@runground.com`;
    await request(app.getHttpServer()).post('/api/auth/signup').send({ email: coachEmail, password: 'pass', name: '코치' });
    
    // DB 백도어: 테스트를 위해 강제로 권한을 ADMIN으로 변경
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.user.update({ where: { email: coachEmail }, data: { globalRole: 'ADMIN' } });
    await prisma.$disconnect();

    const coachLogin = await request(app.getHttpServer()).post('/api/auth/login').send({ email: coachEmail, password: 'pass' });
    coachToken = coachLogin.body.accessToken;

    // 2. 러너(USER) 계정 생성 및 로그인
    const runnerEmail = `runner_${Date.now()}@runground.com`;
    await request(app.getHttpServer()).post('/api/auth/signup').send({ email: runnerEmail, password: 'pass', name: '러너' });
    
    const runnerLogin = await request(app.getHttpServer()).post('/api/auth/login').send({ email: runnerEmail, password: 'pass' });
    runnerToken = runnerLogin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('클래스 생성 API (/api/classes)', () => {
    const newClassDto = {
      title: '2026 하프마라톤 준비반',
      mode: 'HYBRID',
      intro: '초보자도 할 수 있습니다!',
    };

    it('POST /api/classes - 코치(ADMIN)는 새로운 클래스를 생성할 수 있다', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/classes')
        .set('Authorization', `Bearer ${coachToken}`) // 코치 토큰 사용
        .send(newClassDto)
        .expect(201); // Created

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(newClassDto.title);
      expect(response.body.createdById).toBeDefined();
      
      createdClassId = response.body.id; // 가입 테스트를 위해 ID 임시 저장!
    });

    it('POST /api/classes - 러너(USER)가 클래스를 생성하려고 하면 403 에러가 나야 한다', async () => {
      await request(app.getHttpServer())
        .post('/api/classes')
        .set('Authorization', `Bearer ${runnerToken}`) // 러너 토큰 사용
        .send(newClassDto)
        .expect(403); // Forbidden (권한 없음)
    });
  });

  describe('클래스 가입 API (/api/classes/:id/join)', () => {
    it('POST /api/classes/:id/join - 러너(USER)는 클래스에 가입할 수 있어야 한다', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/classes/${createdClassId}/join`)
        .set('Authorization', `Bearer ${runnerToken}`) // 러너 토큰 사용
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.classId).toBe(createdClassId);
      expect(response.body.role).toBe('RUNNER'); // 가입 시 기본 역할은 RUNNER
    });
  });

  describe('클래스 목록 조회 API', () => {
    it('GET /api/classes - 토큰이 있는 유저는 전체 클래스 목록을 조회할 수 있어야 한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/classes')
        .set('Authorization', `Bearer ${runnerToken}`) // 러너 토큰 사용
        .expect(200);

      expect(Array.isArray(response.body)).toBeTruthy();
      // 방금 위 테스트에서 생성한 클래스가 배열 안에 있어야 함
      const foundClass = response.body.find((c: any) => c.id === createdClassId);
      expect(foundClass).toBeDefined();
      expect(foundClass.title).toBe('2026 하프마라톤 준비반');
    });

    it('GET /api/classes/me - 로그인한 유저(러너)가 속한 클래스 목록만 조회할 수 있어야 한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/classes/me')
        .set('Authorization', `Bearer ${runnerToken}`) // 러너 토큰 사용
        .expect(200);

      expect(Array.isArray(response.body)).toBeTruthy();
      // 러너가 방금 가입한 클래스가 목록에 있어야 함
      const myClass = response.body.find((c: any) => c.id === createdClassId);
      expect(myClass).toBeDefined();
      expect(myClass.memberships).toBeDefined(); // 내가 가입한 정보(역할 등)도 함께 와야 함
    });
  });
});