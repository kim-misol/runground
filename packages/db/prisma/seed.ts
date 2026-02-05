// packages/db/prisma/seed.ts
import { PrismaClient, UserRole, ClassType, MemberRole, SessionType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 시딩을 시작합니다...');

  // 1. 초기화 (기존 데이터 삭제 - 개발용)
  await prisma.activityRecord.deleteMany();
  await prisma.session.deleteMany();
  await prisma.curriculum.deleteMany();
  await prisma.classMember.deleteMany();
  await prisma.class.deleteMany();
  await prisma.user.deleteMany();

  // 2. 코치 계정 생성
  const coach = await prisma.user.create({
    data: {
      email: 'coach@runground.com',
      name: '김코치',
      role: UserRole.ADMIN,
      isCoach: true,
    },
  });
  console.log(`✅ 코치 생성: ${coach.name}`);

  // 3. 러너 계정 생성
  const runner = await prisma.user.create({
    data: {
      email: 'runner@runground.com',
      name: '이러너',
      role: UserRole.USER,
    },
  });
  console.log(`✅ 러너 생성: ${runner.name}`);

  // 4. 하이브리드 클래스 생성 (예: 2026 서울마라톤 대비반)
  const marathonClass = await prisma.class.create({
    data: {
      title: '2026 동아마라톤 대비반 (A조)',
      type: ClassType.HYBRID,
      description: '서브3 목표를 위한 고강도 훈련 클래스입니다.',
      isActive: true,
      // 코치를 멤버(OWNER)로 등록
      members: {
        create: {
          userId: coach.id,
          role: MemberRole.OWNER_COACH,
          status: 'ACTIVE',
        },
      },
    },
  });
  console.log(`✅ 클래스 생성: ${marathonClass.title}`);

  // 5. 러너를 클래스에 가입시킴
  await prisma.classMember.create({
    data: {
      userId: runner.id,
      classId: marathonClass.id,
      role: MemberRole.RUNNER,
      level: 'INTERMEDIATE',
      status: 'ACTIVE',
    },
  });

  // 6. 1주차 커리큘럼 및 세션 생성
  const week1 = await prisma.curriculum.create({
    data: {
      classId: marathonClass.id,
      weekNumber: 1,
      startDate: new Date(), // 오늘부터 시작
    },
  });

  // 6-1. [오프라인] 토요일 정기 런
  await prisma.session.create({
    data: {
      curriculumId: week1.id,
      dayOfWeek: 6, // 토요일
      type: SessionType.OFFLINE,
      title: '잠실 보조경기장 10K TT',
      description: '현재 자신의 수행 능력을 점검하는 타임 트라이얼입니다.',
      location: '잠실 보조경기장 트랙',
      meetTime: new Date(new Date().setHours(8, 0, 0, 0)), // 오전 8시
    },
  });

  // 6-2. [온라인] 화요일 조깅 과제
  await prisma.session.create({
    data: {
      curriculumId: week1.id,
      dayOfWeek: 2, // 화요일
      type: SessionType.ONLINE_TASK,
      title: '가벼운 조깅 60분',
      description: '심박수 Zone 2를 유지하며 피로를 회복하세요.',
      targetDuration: 3600, // 60분 (초 단위)
    },
  });

  console.log('✅ 1주차 훈련 세션 생성 완료');
  console.log('🏁 시딩이 완료되었습니다!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });