import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { prisma as db } from '@runground/db'; // 👈 프리즈마 클라이언트 모듈 에러를 피하기 위해 @prisma/client 임포트 삭제!

@Injectable()
export class ClassService {
  // 1. 클래스 생성 (코치 전용)
  async createClass(dto: any, userId: string) {
    const { title, mode, intro } = dto;

    const newClass = await db.class.create({
      data: {
        title,
        mode,
        intro,
        createdById: userId,
        memberships: {
          create: {
            userId: userId,
            role: 'HEAD_COACH', // 👈 Enum 대신 프리즈마가 알아듣는 안전한 문자열 사용
            memberStatus: 'ACTIVE',
          },
        },
      },
    });

    return newClass;
  }

  // 2. 클래스 가입 (러너용)
  async joinClass(classId: string, userId: string) {
    // 1) 클래스가 존재하는지 확인
    const targetClass = await db.class.findUnique({ where: { id: classId } });
    if (!targetClass) {
      throw new NotFoundException('존재하지 않는 클래스입니다.');
    }

    // 2) 이미 가입된 멤버인지 확인
    // 💡 해결의 핵심: 복합 키 이름 에러를 피하기 위해 findUnique 대신 findFirst를 사용합니다!
    const existingMember = await db.classMembership.findFirst({
      where: {
        userId: userId,
        classId: classId,
      },
    });

    if (existingMember) {
      throw new ConflictException('이미 가입된 클래스입니다.');
    }

    // 3) 멤버십(가입) 생성
    const membership = await db.classMembership.create({
      data: {
        classId,
        userId,
        role: 'RUNNER', // 👈 Enum 대신 문자열 사용
        memberStatus: 'ACTIVE',
      },
    });

    return membership;
  }

  // 3. 전체 클래스 목록 조회
  async getAllClasses() {
    return db.class.findMany({
      orderBy: { createdAt: 'desc' }, // 최신순 정렬
    });
  }

  // 4. 내 클래스 목록 조회 (내가 가입하거나 만든 클래스)
  async getMyClasses(userId: string) {
    return db.class.findMany({
      where: {
        memberships: {
          some: { userId: userId }, // 내 userId가 멤버십에 포함된 클래스만 검색
        },
      },
      include: {
        memberships: {
          where: { userId: userId }, // 반환할 때 내 멤버십 정보도 포함
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}