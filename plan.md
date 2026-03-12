# Runground 구현 완성 플랜

> 작성일: 2026-03-06
> 기반: 실제 코드베이스 분석 (research.md 참조)

---

## 전체 로드맵

```
Phase 0  기반 수정 (보안 + 역할 체계)       ← 모든 작업의 전제조건
Phase 1  코치 권한 흐름 완성                ← 클래스 생성/관리 진입점
Phase 2  훈련 일정 노출 규칙 (전/현/후 3주) ← 핵심 러너 경험
Phase 3  기록 수동 업로드 (ActivityRecord)  ← 러너 인증
Phase 4  코치 피드백 (CoachFeedback)        ← 코칭 루프
Phase 5  기록 웨어러블 연동                      ← 어메지핏/가민
Phase 6  참석 투표 (AttendanceVote)         ← 온오프라인 클래스
Phase 7  프로필 관리 + 러너 상태 토글       ← 계정 완성
Phase 8  소셜 로그인 (OAuth)               ← 가입 UX
Phase 9  결제/구독                         ← 수익화
```

---

## Phase 0 — 기반 수정 (착수 전 필수)

### 0-1. JWT 시크릿 환경변수화

**문제:** `'super-secret-key-for-dev'`가 `auth.module.ts`와 `jwt-auth.guard.ts` 두 곳에 하드코딩.

**`apps/api/.env` 생성**
```env
DATABASE_URL="postgresql://..."
JWT_SECRET="교체할_랜덤_시크릿_최소_32자"
JWT_EXPIRES_IN="1d"
```

**`apps/api/src/auth/auth.module.ts` 수정**
```typescript
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '1d') },
      }),
      inject: [ConfigService],
    }),
  ],
  ...
})
export class AuthModule {}
```

**`apps/api/src/auth/jwt-auth.guard.ts` 수정**
```typescript
// constructor에 ConfigService 주입
constructor(
  private jwtService: JwtService,
  private config: ConfigService,
) {}

// verifyAsync 호출부
const payload = await this.jwtService.verifyAsync(token, {
  secret: this.config.get('JWT_SECRET'),
});
```

**`apps/api/src/app.module.ts`에 ConfigModule 추가**
```typescript
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    ClassModule,
  ],
})
export class AppModule {}
```

---

### 0-2. 역할 체계 통합 (핵심 설계 수정)

**문제:** DB의 `ClassMembership.role` (HEAD_COACH/COACH/RUNNER/STAFF)과 JWT payload의 `globalRole` (USER/ADMIN)이 분리되어 있음.
현재 클래스 생성이 `@Roles('ADMIN')`으로 막혀 있어 일반 코치가 클래스를 만들 수 없다.

**해결 방향:** 클래스 생성/관리 권한은 `Entitlement.COACH_GRADE` 보유 여부로 판단.

**`apps/api/src/auth/class-role.guard.ts` 신규 생성**
```typescript
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { prisma as db } from '@runground/db';

@Injectable()
export class CoachGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId: string = request.user?.sub;

    if (!userId) throw new ForbiddenException();

    // ADMIN은 항상 통과
    if (request.user?.role === 'ADMIN') return true;

    // Entitlement 테이블에서 유효한 COACH_GRADE 확인
    const entitlement = await db.entitlement.findFirst({
      where: {
        userId,
        type: 'COACH_GRADE',
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      },
    });

    if (!entitlement) throw new ForbiddenException('코치 권한이 필요합니다.');
    return true;
  }
}
```

**`apps/api/src/class/class.controller.ts` 클래스 생성 권한 변경**
```typescript
// Before
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Post()

// After
@UseGuards(JwtAuthGuard, CoachGuard)
@Post()
async createClass(@Body() body: any, @Request() req: any) {
  return this.classService.createClass(body, req.user.sub);
}
```

**`apps/api/src/class/class.controller.ts` 이벤트 생성도 동일하게**
```typescript
// Before
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Post(':id/events')

// After: 해당 클래스의 COACH 이상 멤버만 허용
@UseGuards(JwtAuthGuard, ClassCoachGuard)   // 아래에서 정의
@Post(':id/events')
```

**`apps/api/src/auth/class-coach.guard.ts` — 클래스 내 코치 역할 검사**
```typescript
@Injectable()
export class ClassCoachGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId: string = request.user?.sub;
    const classId: string = request.params.id;

    if (request.user?.role === 'ADMIN') return true;

    const membership = await db.classMembership.findFirst({
      where: {
        classId,
        userId,
        role: { in: ['HEAD_COACH', 'COACH'] },
        memberStatus: 'ACTIVE',
      },
    });

    if (!membership) throw new ForbiddenException('클래스 코치 권한이 필요합니다.');
    return true;
  }
}
```

---

## Phase 1 — 코치 권한 흐름 완성

### 1-1. 운영진 초대 API

**`apps/api/src/class/class.service.ts`에 추가**
```typescript
async inviteStaff(classId: string, inviterId: string, dto: { email: string; staffRole: 'PHOTO' | 'PACER' }) {
  // 이미 초대된 경우 체크
  const existing = await db.classInvitation.findFirst({
    where: { classId, email: dto.email, acceptedAt: null },
  });
  if (existing) throw new ConflictException('이미 초대된 이메일입니다.');

  const token = crypto.randomUUID();
  return db.classInvitation.create({
    data: {
      classId,
      email: dto.email,
      role: 'STAFF',
      staffRole: dto.staffRole,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일
    },
  });
}

async acceptInvitation(token: string, userId: string) {
  const invitation = await db.classInvitation.findUnique({ where: { token } });
  if (!invitation) throw new NotFoundException('유효하지 않은 초대입니다.');
  if (invitation.expiresAt < new Date()) throw new BadRequestException('만료된 초대입니다.');
  if (invitation.acceptedAt) throw new ConflictException('이미 수락된 초대입니다.');

  await db.$transaction([
    db.classMembership.create({
      data: {
        classId: invitation.classId,
        userId,
        role: 'STAFF',
        staffRole: invitation.staffRole ?? undefined,
        memberStatus: 'ACTIVE',
      },
    }),
    db.classInvitation.update({
      where: { token },
      data: { acceptedAt: new Date(), acceptedByUserId: userId },
    }),
  ]);
}
```

**엔드포인트 추가**
```typescript
// class.controller.ts
@UseGuards(JwtAuthGuard, ClassCoachGuard)
@Post(':id/invite')
inviteStaff(@Param('id') classId: string, @Body() body: any, @Request() req: any) {
  return this.classService.inviteStaff(classId, req.user.sub, body);
}

@UseGuards(JwtAuthGuard)
@Post('invitations/:token/accept')
acceptInvitation(@Param('token') token: string, @Request() req: any) {
  return this.classService.acceptInvitation(token, req.user.sub);
}
```

### 1-2. 구독 신청 / 수락 흐름 (requestJoin → approveJoin)

**문제:** 현재 `joinClass`는 즉시 ACTIVE. `MemberStatus.PENDING` → 코치 수락 → ACTIVE 흐름으로 전환 필요.

**`apps/api/src/class/class.service.ts`에 추가**
```typescript
async requestJoin(classId: string, userId: string) {
  const existing = await db.classMembership.findFirst({
    where: { classId, userId },
  });
  if (existing) throw new ConflictException('이미 신청하거나 가입된 클래스입니다.');

  return db.classMembership.create({
    data: { classId, userId, role: 'RUNNER', memberStatus: 'INACTIVE' },
  });
}

async approveJoin(classId: string, targetUserId: string) {
  return db.classMembership.update({
    where: { classId_userId: { classId, userId: targetUserId } },
    data: { memberStatus: 'ACTIVE' },
  });
}
```

**`apps/api/src/class/class.controller.ts`에 엔드포인트 추가**
```typescript
// 기존 POST :id/join → requestJoin으로 변경
@UseGuards(JwtAuthGuard)
@Post(':id/join')
requestJoin(@Param('id') classId: string, @Request() req: any) {
  return this.classService.requestJoin(classId, req.user.sub);
}

// 코치가 신청 수락
@UseGuards(JwtAuthGuard, ClassCoachGuard)
@Post(':id/members/:userId/approve')
approveJoin(
  @Param('id') classId: string,
  @Param('userId') targetUserId: string,
) {
  return this.classService.approveJoin(classId, targetUserId);
}

// 코치가 PENDING 목록 조회
@UseGuards(JwtAuthGuard, ClassCoachGuard)
@Get(':id/members/pending')
getPendingMembers(@Param('id') classId: string) {
  return this.classService.getMembersByStatus(classId, 'INACTIVE');
}
```

> `getMembersByStatus`는 `findMany({ where: { classId, memberStatus: status } })`로 구현.

---

### 1-3. 러너 활성/비활성 토글

```typescript
// class.service.ts
async setMemberStatus(classId: string, targetUserId: string, status: 'ACTIVE' | 'INACTIVE') {
  return db.classMembership.update({
    where: { classId_userId: { classId, userId: targetUserId } },
    data: { memberStatus: status },
  });
}
```

```typescript
// class.controller.ts
@UseGuards(JwtAuthGuard, ClassCoachGuard)
@Patch(':id/members/:userId/status')
setMemberStatus(
  @Param('id') classId: string,
  @Param('userId') targetUserId: string,
  @Body('status') status: 'ACTIVE' | 'INACTIVE',
) {
  return this.classService.setMemberStatus(classId, targetUserId, status);
}
```

---

## Phase 2 — 훈련 일정 노출 규칙 (전/현/후 3주)

### 설계

러너가 클래스에 구독한 시점(`joinedAt`)을 기준으로 주차를 계산한다.

```
현재 주차 W = floor((today - joinedAt) / 7일)

노출 범위:
  - 온라인 클래스: W-1 ~ W+1  (이전 1주 + 현재 + 다음 1주)
  - 기획서 "전/현/후 3주"를 실제 적용 시: W-2 ~ W+2  (양쪽 2주씩)
  → 팀과 합의 후 상수로 관리 추천
```

### API: 러너용 훈련 일정 조회 (주차 필터 포함)

```typescript
// class.service.ts
async getMyEvents(classId: string, userId: string) {
  // 1. 내 멤버십에서 joinedAt 가져오기
  const membership = await db.classMembership.findFirst({
    where: { classId, userId },
    select: { joinedAt: true },
  });
  if (!membership) throw new ForbiddenException('클래스 멤버가 아닙니다.');

  const joinedAt = membership.joinedAt;
  const now = new Date();

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const currentWeek = Math.floor((now.getTime() - joinedAt.getTime()) / msPerWeek);

  // 전/현/후 각 2주씩 (총 5주 window)
  const WINDOW = 2;
  const fromWeek = currentWeek - WINDOW;
  const toWeek = currentWeek + WINDOW;

  const rangeStart = new Date(joinedAt.getTime() + fromWeek * msPerWeek);
  const rangeEnd   = new Date(joinedAt.getTime() + (toWeek + 1) * msPerWeek);

  return db.trainingEvent.findMany({
    where: {
      classId,
      startsAt: { gte: rangeStart, lt: rangeEnd },
    },
    orderBy: { startsAt: 'asc' },
    include: { details: { orderBy: { order: 'asc' } } },
  });
}
```

```typescript
// class.controller.ts
@UseGuards(JwtAuthGuard)
@Get(':id/my-events')
getMyEvents(@Param('id') classId: string, @Request() req: any) {
  return this.classService.getMyEvents(classId, req.user.sub);
}
```

### 모바일: ClassDetailScreen 호출 변경

```typescript
// ClassDetailScreen.tsx: /events → /my-events
import { apiFetch } from '../utils/auth';

const response = await apiFetch(`/classes/${classId}/my-events`);
```

---


## Phase 3 — 기록 수동 업로드 (ActivityRecord)

### API

```typescript
// 신규 파일: apps/api/src/activity/activity.module.ts + controller + service

// activity.service.ts
async createRecord(userId: string, dto: {
  classId?: string;
  eventId?: string;
  provider: string;
  startedAt: string;
  durationSec?: number;
  distanceM?: number;
  avgPaceSecPerKm?: number;
  avgHr?: number;
  note?: string;
}) {
  return db.activityRecord.create({
    data: {
      userId,
      classId: dto.classId,
      eventId: dto.eventId,
      provider: dto.provider as any,
      startedAt: new Date(dto.startedAt),
      durationSec: dto.durationSec,
      distanceM: dto.distanceM,
      avgPaceSecPerKm: dto.avgPaceSecPerKm,
      avgHr: dto.avgHr,
      rawJson: dto.note ? { note: dto.note } : undefined,
    },
  });
}

async getMyRecords(userId: string, classId?: string) {
  return db.activityRecord.findMany({
    where: { userId, ...(classId ? { classId } : {}) },
    orderBy: { startedAt: 'desc' },
    include: { feedback: { include: { coach: { select: { profile: { select: { name: true } } } } } } },
  });
}
```

```typescript
// activity.controller.ts
@Controller('activity')
export class ActivityController {
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() body: any, @Request() req: any) {
    return this.activityService.createRecord(req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  getMyRecords(@Request() req: any, @Query('classId') classId?: string) {
    return this.activityService.getMyRecords(req.user.sub, classId);
  }
}
```

### 모바일 — 기록 업로드 폼 (모달 or 새 화면)

```tsx
// src/screens/RecordUploadScreen.tsx
import { apiFetch } from '../utils/auth';

const PROVIDERS = ['MANUAL', 'GARMIN', 'APPLE', 'SAMSUNG', 'AMAZIFIT'];

export default function RecordUploadScreen({ route, navigation }: any) {
  const { classId } = route.params;
  const [form, setForm] = useState({
    provider: 'MANUAL',
    startedAt: new Date().toISOString(),
    distanceM: '',
    durationSec: '',
    avgPaceSecPerKm: '',
    avgHr: '',
    note: '',
  });

  const submit = async () => {
    const res = await apiFetch('/activity', {
      method: 'POST',
      body: JSON.stringify({
        classId,
        provider: form.provider,
        startedAt: form.startedAt,
        distanceM: form.distanceM ? parseInt(form.distanceM) : undefined,
        durationSec: form.durationSec ? parseInt(form.durationSec) : undefined,
        avgPaceSecPerKm: form.avgPaceSecPerKm ? parseInt(form.avgPaceSecPerKm) : undefined,
        avgHr: form.avgHr ? parseInt(form.avgHr) : undefined,
        note: form.note,
      }),
    });
    if (res.ok) navigation.goBack();
  };

  return (
    <ScrollView style={{ flex: 1, padding: 20 }}>
      {/* provider picker, 날짜 입력, 거리/시간/심박 입력 필드 */}
      {/* ... */}
      <TouchableOpacity onPress={submit} style={{ backgroundColor: '#1e88e5', padding: 14, borderRadius: 10 }}>
        <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>기록 저장</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
```

---

## Phase 4 — 코치 피드백 (CoachFeedback)

### API

```typescript
// activity.service.ts에 추가
async createFeedback(activityId: string, coachId: string, content: string) {
  // 해당 기록이 내 클래스 러너의 것인지 검증 (옵션: 신뢰 환경에서는 생략 가능)
  return db.coachFeedback.create({
    data: { activityId, coachId, content },
  });
}

async getFeedbacks(activityId: string) {
  return db.coachFeedback.findMany({
    where: { activityId },
    include: { coach: { select: { profile: { select: { name: true } } } } },
    orderBy: { createdAt: 'asc' },
  });
}
```

```typescript
// activity.controller.ts에 추가
@UseGuards(JwtAuthGuard)
@Post(':activityId/feedback')
createFeedback(
  @Param('activityId') activityId: string,
  @Body('content') content: string,
  @Request() req: any,
) {
  return this.activityService.createFeedback(activityId, req.user.sub, content);
}

@UseGuards(JwtAuthGuard)
@Get(':activityId/feedback')
getFeedbacks(@Param('activityId') activityId: string) {
  return this.activityService.getFeedbacks(activityId);
}
```

### 웹 대시보드 — 코치 피드백 입력 UI

```tsx
// apps/web/src/app/dashboard/classes/[id]/page.tsx 내 러너 기록 섹션에 추가

function FeedbackForm({ activityId }: { activityId: string }) {
  const [content, setContent] = useState('');
  const submit = async () => {
    await fetch(`${API_URL}/activity/${activityId}/feedback`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    setContent('');
  };
  return (
    <div className="flex gap-2 mt-2">
      <input
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="피드백을 입력하세요..."
        className="flex-1 border rounded px-3 py-2 text-sm"
      />
      <button onClick={submit} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">전송</button>
    </div>
  );
}
```

---

## Phase 5 — 기록 웨어러블 연동

## Phase 6 — 참석 투표 (AttendanceVote)

### API

```typescript
// class.service.ts
async upsertAttendance(eventId: string, userId: string, status: 'GOING' | 'MAYBE' | 'NOT_GOING') {
  return db.attendanceVote.upsert({
    where: { eventId_userId: { eventId, userId } },
    update: { status },
    create: { eventId, userId, status },
  });
}

async getAttendance(eventId: string) {
  return db.attendanceVote.findMany({
    where: { eventId },
    include: { user: { select: { id: true, profile: { select: { name: true } } } } },
  });
}
```

```typescript
// 신규 파일: apps/api/src/event/event.controller.ts
@Controller('events')
export class EventController {
  @UseGuards(JwtAuthGuard)
  @Put(':eventId/attendance')
  upsertAttendance(
    @Param('eventId') eventId: string,
    @Body('status') status: string,
    @Request() req: any,
  ) {
    return this.classService.upsertAttendance(eventId, req.user.sub, status as any);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':eventId/attendance')
  getAttendance(@Param('eventId') eventId: string) {
    return this.classService.getAttendance(eventId);
  }
}
```

### 모바일 UI — AttendanceVoteBar 컴포넌트

```tsx
// src/components/AttendanceVoteBar.tsx
import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { apiFetch } from '../utils/auth';

type Status = 'GOING' | 'MAYBE' | 'NOT_GOING';

const OPTIONS: { key: Status; label: string; color: string }[] = [
  { key: 'GOING',     label: '✅ 참석',   color: '#4caf50' },
  { key: 'MAYBE',     label: '🤔 미정',   color: '#ff9800' },
  { key: 'NOT_GOING', label: '❌ 불참',   color: '#f44336' },
];

export default function AttendanceVoteBar({ eventId, initialStatus }: {
  eventId: string;
  initialStatus?: Status;
}) {
  const [selected, setSelected] = useState<Status | null>(initialStatus ?? null);

  const vote = async (status: Status) => {
    await apiFetch(`/events/${eventId}/attendance`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    setSelected(status);
  };

  return (
    <View style={styles.row}>
      {OPTIONS.map(opt => (
        <TouchableOpacity
          key={opt.key}
          style={[styles.btn, { borderColor: opt.color, backgroundColor: selected === opt.key ? opt.color : 'white' }]}
          onPress={() => vote(opt.key)}
        >
          <Text style={{ color: selected === opt.key ? 'white' : opt.color, fontWeight: 'bold', fontSize: 12 }}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { flex: 1, borderWidth: 1.5, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
});
```

**ClassDetailScreen 카드 안에 추가**
```tsx
// ClassDetailScreen.tsx renderItem 내부
{item.kind === 'OFFLINE_SESSION' && (
  <AttendanceVoteBar eventId={item.id} />
)}
```

---

## Phase 7 — 프로필 관리 + 러너 상태 토글

### API: 프로필 수정

```typescript
// auth.service.ts에 추가
async updateProfile(userId: string, dto: { name?: string; phone?: string; instagram?: string }) {
  return db.userProfile.upsert({
    where: { userId },
    update: dto,
    create: { userId, ...dto },
  });
}
```

```typescript
// auth.controller.ts에 추가
@UseGuards(JwtAuthGuard)
@Patch('profile')
updateProfile(@Body() body: any, @Request() req: any) {
  return this.authService.updateProfile(req.user.sub, body);
}
```

### 모바일 — ProfileScreen 추가

```tsx
// src/screens/ProfileScreen.tsx
import { apiFetch } from '../utils/auth';

export default function ProfileScreen({ navigation }: any) {
  const [profile, setProfile] = useState({ name: '', phone: '', instagram: '' });

  useEffect(() => {
    apiFetch('/auth/me').then(r => r.json()).then(data => setProfile(data.profile ?? {}));
  }, []);

  const save = async () => {
    await apiFetch('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(profile),
    });
    Alert.alert('저장되었습니다.');
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 20 }}>
      {/* 이름, 전화번호, 인스타 입력 필드 */}
      <TouchableOpacity onPress={save} style={{ backgroundColor: '#1e88e5', padding: 14, borderRadius: 10, marginTop: 20 }}>
        <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>저장</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
```

**App.tsx에 탭 추가**
```typescript
// MainTabNavigator
<Tab.Screen name="프로필" component={ProfileScreen} />
```

---

## Phase 8 — 소셜 로그인 (OAuth)

### 설계

```
[모바일] expo-auth-session or expo-web-browser
  → 소셜 provider 로그인 팝업
  → provider로부터 accessToken/code 수신
  → POST /api/auth/social { provider, accessToken }
  → 서버에서 provider API 호출로 email/providerId 확인
  → UserIdentity 조회 or 신규 생성
  → JWT 발급 후 반환
```

### API

```typescript
// auth.service.ts에 추가
async socialLogin(dto: { provider: 'GOOGLE' | 'NAVER' | 'KAKAO'; accessToken: string }) {
  // provider별 사용자 정보 API 호출
  const providerUser = await this.fetchProviderUser(dto.provider, dto.accessToken);
  // { id: string, email?: string, name?: string }

  // 기존 UserIdentity 조회
  let identity = await db.userIdentity.findUnique({
    where: { provider_providerId: { provider: dto.provider, providerId: providerUser.id } },
    include: { user: true },
  });

  if (!identity) {
    // 신규 가입: User + UserProfile + UserIdentity 생성
    const user = await db.user.create({
      data: {
        email: providerUser.email,
        profile: { create: { name: providerUser.name } },
        identities: {
          create: { provider: dto.provider, providerId: providerUser.id },
        },
      },
    });
    identity = await db.userIdentity.findFirst({ where: { userId: user.id }, include: { user: true } });
  }

  const payload = { sub: identity!.userId, email: identity!.user.email, role: identity!.user.globalRole };
  return { accessToken: this.jwtService.sign(payload) };
}
```

```typescript
// auth.controller.ts
@Post('social')
socialLogin(@Body() body: { provider: string; accessToken: string }) {
  return this.authService.socialLogin(body as any);
}
```

---

## Phase 9 — 결제/구독

### 설계 (Portone / 토스페이먼츠 기준)

```
[웹/모바일] 결제 버튼 클릭
  → POST /api/payments/prepare { planId }
  → 서버: Payment record 생성 (PENDING), orderId 반환
  → 클라이언트: PG SDK 결제 팝업
  → 결제 완료 후 → POST /api/payments/confirm { paymentId, pgToken }
  → 서버: PG API 검증 → Payment 상태 PAID 업데이트
  → Subscription 활성화
  → COACH_GRADE면 Entitlement 생성 (CoachGuard에서 확인)
```

```typescript
// payment.service.ts
async preparePayment(userId: string, planId: string) {
  const plan = await db.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new NotFoundException();

  const payment = await db.payment.create({
    data: { userId, planId, status: 'PENDING', amount: plan.price },
  });
  return { orderId: payment.id, amount: plan.price, planName: plan.name };
}

async confirmPayment(paymentId: string, pgToken: string) {
  // 1. PG사 API로 pgToken 검증
  // 2. Payment 상태 PAID로 변경
  // 3. Subscription 생성 또는 업데이트
  // 4. COACH_GRADE 플랜이면 Entitlement 생성
  await db.$transaction(async (tx) => {
    const payment = await tx.payment.update({
      where: { id: paymentId },
      data: { status: 'PAID', providerPaymentId: pgToken },
      include: { plan: true },
    });

    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + 1); // 1개월 구독

    await tx.subscription.create({
      data: {
        userId: payment.userId,
        planId: payment.planId,
        classId: payment.plan.classId,
        status: 'ACTIVE',
        endsAt,
      },
    });

    if (payment.plan.scope === 'COACH_GRADE') {
      await tx.entitlement.create({
        data: { userId: payment.userId, type: 'COACH_GRADE', endsAt },
      });
    }
  });
}
```

---

## 공통 유틸: 토큰 헬퍼 (모바일 코드 중복 제거) ✅ 완료

> `apps/mobile/src/utils/auth.ts` 생성 완료. 모든 화면(LoginScreen, MyClassesScreen, ExploreScreen, ClassDetailScreen)에 적용 완료.

**`apps/mobile/src/utils/auth.ts`**
```typescript
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const TOKEN_KEY = 'accessToken';

export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === 'web') localStorage.setItem(TOKEN_KEY, token);
  else await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  if (Platform.OS === 'web') localStorage.removeItem(TOKEN_KEY);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await getToken();
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}
```

**사용 예 (기존 코드 교체)**
```typescript
// Before (각 화면마다 반복)
const token = Platform.OS === 'web' ? localStorage.getItem('accessToken') : await SecureStore.getItemAsync('accessToken');
const response = await fetch(`${API_URL}/classes/me`, { headers: { 'Authorization': `Bearer ${token}` } });

// After
import { apiFetch } from '../utils/auth';
const response = await apiFetch('/classes/me');
```

---

## 스키마 수정 사항

### TrainingProgress 관계 필드 정리

현재 스키마에 `eventId`/`templateItemId` (String?)와 `trainingEventId`/`trainingTemplateItemId` (실제 FK)가 혼재.

```prisma
// 수정 후: 필드 통일
model TrainingProgress {
  id      String @id @default(cuid())
  userId  String
  classId String

  eventId        String?
  event          TrainingEvent?        @relation(fields: [eventId], references: [id])
  templateItemId String?
  templateItem   TrainingTemplateItem? @relation(fields: [templateItemId], references: [id])

  status      ProgressStatus @default(NOT_STARTED)
  note        String?
  completedAt DateTime?

  @@index([userId, classId])
  @@index([eventId])
  @@index([templateItemId])
}
```

---

## 구현 순서 요약 (추천)

```
✅ 완료  공통 유틸 auth.ts + 4개 화면 apiFetch 적용
Week 1  Phase 0 (보안: JWT 환경변수화 + ConfigModule)
Week 2  Phase 0-2 (역할 체계: CoachGuard, ClassCoachGuard)
         Phase 1   (구독 신청/수락 흐름: requestJoin / approveJoin)
Week 3  Phase 2 (훈련 일정 노출 규칙: getMyEvents)
         Phase 3 (기록 수동 업로드: ActivityRecord)
Week 4  Phase 4 (코치 피드백: CoachFeedback)
         Phase 6 (참석 투표: AttendanceVote)
Week 5  Phase 7 (프로필 관리: ProfileScreen)
Week 6  Phase 8 (소셜 로그인: OAuth)
Week 7+ Phase 9 (결제/구독)
```

---

## 파일 생성/수정 체크리스트

### 신규 생성
- [ ] `apps/api/.env`
- [ ] `apps/api/src/auth/class-role.guard.ts` (CoachGuard)
- [ ] `apps/api/src/auth/class-coach.guard.ts` (ClassCoachGuard)
- [ ] `apps/api/src/activity/activity.module.ts`
- [ ] `apps/api/src/activity/activity.service.ts`
- [ ] `apps/api/src/activity/activity.controller.ts`
- [x] `apps/mobile/src/utils/auth.ts` ✅
- [ ] `apps/mobile/src/components/AttendanceVoteBar.tsx`
- [ ] `apps/mobile/src/screens/ProfileScreen.tsx`
- [ ] `apps/mobile/src/screens/RecordUploadScreen.tsx`

### 수정 필요
- [ ] `apps/api/src/app.module.ts` (ConfigModule 추가)
- [ ] `apps/api/src/auth/auth.module.ts` (ConfigService 기반 JWT)
- [ ] `apps/api/src/auth/jwt-auth.guard.ts` (환경변수 사용)
- [ ] `apps/api/src/auth/auth.service.ts` (프로필 수정, 소셜 로그인)
- [ ] `apps/api/src/auth/auth.controller.ts` (신규 엔드포인트)
- [ ] `apps/api/src/class/class.service.ts` (requestJoin/approveJoin, 초대, 상태 토글, 일정 노출)
- [ ] `apps/api/src/class/class.controller.ts` (CoachGuard 적용, 신청/수락 엔드포인트)
- [ ] `apps/api/src/app.module.ts` (ActivityModule 등록)
- [ ] `packages/db/prisma/schema.prisma` (TrainingProgress 관계 정리)
- [ ] `apps/mobile/App.tsx` (ProfileScreen 탭 추가, ClassDetail 스택 등록)
- [ ] `apps/mobile/src/screens/ClassDetailScreen.tsx` (AttendanceVoteBar, /my-events 사용)
- [x] `apps/mobile/src/screens/MyClassesScreen.tsx` ✅ (apiFetch 적용 완료)
- [x] `apps/mobile/src/screens/LoginScreen.tsx` ✅ (apiFetch 적용 완료)
- [x] `apps/mobile/src/screens/ExploreScreen.tsx` ✅ (apiFetch 적용 완료)
