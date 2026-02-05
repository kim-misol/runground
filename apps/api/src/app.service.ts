import { Injectable } from '@nestjs/common';
import { prisma } from '@runground/db'; // 모노레포의 강점: DB 패키지 직접 import

@Injectable()
export class AppService {
  async getHello() {
    // DB에서 활성화된 클래스 목록 조회 (관계된 멤버 정보도 포함)
    const classes = await prisma.class.findMany({
      where: { isActive: true },
      include: {
        members: true, // 멤버 정보도 같이 가져오기
        curriculums: true, // 주차별 커리큘럼도 같이 가져오기
      },
    });

    return {
      message: 'Runground API is alive! 🏃‍♂️',
      data: classes,
    };
  }
}