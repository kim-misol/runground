import { 
  PrismaClient, 
  GlobalRole, 
  ClassMode, 
  ClassRole, 
  TrainingKind, 
  TrainingType, 
  MemberStatus 
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding new database...');

    // 1. 초기화 (삭제 순서 중요: 자식 테이블 -> 부모 테이블)
    console.log('🧹 기존 데이터 정리 중...');
    await prisma.coachFeedback.deleteMany();
    await prisma.activityRecord.deleteMany();
    await prisma.attendanceVote.deleteMany();
    await prisma.trainingDetail.deleteMany(); // 세션 상세 정보
    await prisma.trainingEvent.deleteMany();  // 세션(이벤트)
    await prisma.classMembership.deleteMany();
    await prisma.class.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();


    // 2. 코치 계정 생성 (User + UserProfile)
    const coach = await prisma.user.create({
    data: {
        email: 'coach@runground.com',
        globalRole: GlobalRole.ADMIN, // 코치는 관리자 권한 부여
        profile: {
        create: {
            name: '김코치',
            phone: '010-1234-5678',
            instagram: '@kim_coach',
        },
        },
    },
    });
    console.log(`✅ 코치 생성: ${coach.email}`);


    // 3. 러너 계정 생성
    const runner = await prisma.user.create({
    data: {
        email: 'runner@runground.com',
        globalRole: GlobalRole.USER,
        profile: {
        create: {
            name: '이러너',
            phone: '010-9876-5432',
        },
        },
    },
    });
    console.log(`✅ 러너 생성: ${runner.email}`);


    // 4. 하이브리드 클래스 생성
    // (새 스키마: Class 생성 시 memberships을 통해 코치를 HEAD_COACH로 바로 등록)
    const marathonClass = await prisma.class.create({
    data: {
        title: '2026 동아마라톤 대비반 (A조)',
        mode: ClassMode.HYBRID,
        intro: '서브3 목표를 위한 고강도 훈련 클래스입니다.',
        createdById: coach.id, // 생성자(Owner) 명시
        
        // 코치를 멤버(HEAD_COACH)로 자동 등록
        memberships: {
        create: {
            userId: coach.id,
            role: ClassRole.HEAD_COACH,
            memberStatus: MemberStatus.ACTIVE,
        },
        },
    },
    });
    console.log(`✅ 클래스 생성: ${marathonClass.title}`);


    // 5. 러너를 클래스에 가입시킴 (ClassMembership)
    await prisma.classMembership.create({
    data: {
        userId: runner.id,
        classId: marathonClass.id,
        role: ClassRole.RUNNER,
        runnerLevel: 'INTERMEDIATE', // 러너 레벨 (A조/B조 등)
        memberStatus: MemberStatus.ACTIVE,
    },
    });
    console.log(`✅ 러너 가입 완료`);


    // 6. 훈련 세션 생성 (TrainingEvent)
    // 날짜 계산 헬퍼 (이번주 토요일, 다음주 화요일 등)
    const today = new Date();
    const nextSaturday = new Date(today);
    nextSaturday.setDate(today.getDate() + (6 - today.getDay() + 7) % 7);
    nextSaturday.setHours(8, 0, 0, 0); // 오전 8시

    const nextTuesday = new Date(today);
    nextTuesday.setDate(today.getDate() + (2 - today.getDay() + 7) % 7);
    nextTuesday.setHours(6, 0, 0, 0); // 오전 6시


    // 6-1. [오프라인] 토요일 정기 런 (TrainingEvent)
    const offlineSession = await prisma.trainingEvent.create({
    data: {
        classId: marathonClass.id,
        createdById: coach.id,
        kind: TrainingKind.OFFLINE_SESSION, // 오프라인 세션
        title: '잠실 보조경기장 10K TT',
        location: '잠실 보조경기장 트랙',
        startsAt: nextSaturday,
        endsAt: new Date(nextSaturday.getTime() + 2 * 60 * 60 * 1000), // 2시간 후 종료
        
        // 세부 훈련 내용 (웜업 -> 본운동 -> 쿨다운)
        details: {
        create: [
            { section: 'WARMUP', order: 1, type: TrainingType.RUN_JOG, durationMin: 15, note: '가볍게 조깅' },
            { section: 'MAIN', order: 2, type: TrainingType.RUN_TT, distanceKm: 10, note: '10km 전력 질주 측정' },
            { section: 'COOLDOWN', order: 3, type: TrainingType.WALK, durationMin: 10, note: '트랙 걷기' },
        ],
        },
    },
    });
    console.log(`✅ 오프라인 세션 생성: ${offlineSession.title}`);


    // 6-2. [온라인] 화요일 조깅 과제 (TrainingEvent - ONLINE_TASK)
    // * 참고: 단순 과제는 TrainingTemplateItem으로 만들 수도 있지만, 
    //   특정 날짜에 수행해야 하는 과제라면 TrainingEvent(ONLINE_TASK)가 적합합니다.
    const onlineTask = await prisma.trainingEvent.create({
    data: {
        classId: marathonClass.id,
        createdById: coach.id,
        kind: TrainingKind.ONLINE_TASK, // 온라인 숙제
        title: '가벼운 조깅 60분',
        startsAt: nextTuesday, // 수행 권장 시간
        
        details: {
        create: {
            section: 'MAIN',
            order: 1,
            type: TrainingType.RUN_JOG,
            durationMin: 60,
            note: '심박수 Zone 2 유지하며 피로 회복',
        },
        },
    },
    });
    console.log(`✅ 온라인 과제 생성: ${onlineTask.title}`);

    console.log('🌱 Seed data injected successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });