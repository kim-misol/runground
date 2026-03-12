# Runground 프로젝트 기술 분석 보고서

> 작성일: 2026-03-06
> 분석 대상: `/runground` 모노레포 전체

---

<!-- 
분석 요약:

현재 구현된 것

이메일 인증 + JWT 기반 로그인/가입
클래스 생성·참가·조회
훈련 이벤트(WARMUP/MAIN/COOLDOWN 세부 항목) 생성·조회
웹(코치 대시보드) + 모바일(러너 앱) 기본 화면
스키마는 설계되어 있으나 API/UI가 없는 것

소셜 로그인, 운영진 초대, 참석 투표, 웨어러블 기록, 코치 피드백, 결제/구독, 게시판, 미디어 업로드 등
주요 이슈

🔴 JWT 시크릿 하드코딩 — auth.module.ts에 'super-secret-key-for-dev' 그대로 사용
🟡 역할 체계 불일치 — DB의 HEAD_COACH/COACH/RUNNER/STAFF와 JWT payload의 USER/ADMIN이 별개로 움직이고 있음. 클래스 생성 권한이 현재 ADMIN 전용이지만 요구사항은 COACH_GRADE 구독자에게도 부여해야 함
🟢 플랫폼 분기 코드 중복 — 모든 모바일 화면에 Platform.OS === 'web' 분기가 반복됨
 -->

## 1. 프로젝트 개요

Runground는 러닝 코치가 클래스를 운영하고 러너가 훈련 일정을 조회·수행하는 **코칭 운영 플랫폼**이다. 모노레포 구조로 백엔드 API, 웹 대시보드(코치용), 모바일 앱(러너용)을 하나의 저장소에서 관리한다.

---

## 2. 모노레포 구조

```
runground/
├── apps/
│   ├── api/          # NestJS 백엔드 (포트 3001)
│   ├── web/          # Next.js 코치 대시보드 (포트 3000)
│   └── mobile/       # React Native / Expo 모바일 앱
├── packages/
│   ├── db/           # Prisma 스키마 + 클라이언트 싱글턴
│   └── shared-types/ # 공유 TypeScript 타입
├── turbo.json
└── pnpm-workspace.yaml
```

### 빌드 도구

| 도구 | 역할 |
|---|---|
| pnpm 10.30.2 | 패키지 매니저, 워크스페이스 |
| Turborepo 2.x | 태스크 오케스트레이션 (build / dev / lint 병렬화) |

---

## 3. 기술 스택

| 영역 | 기술 | 버전 |
|---|---|---|
| Backend | NestJS | 11.0 |
| Web Frontend | Next.js + React | 16.1 / 19.2 |
| Web Styling | Tailwind CSS | 4 |
| Mobile | React Native + Expo | 0.81 / 54 |
| DB ORM | Prisma | 5.21 |
| DB | PostgreSQL | - |
| 인증 | JWT (@nestjs/jwt) + bcrypt | - |
| 모바일 토큰 저장 | expo-secure-store | 15.0 |
| 모바일 내비게이션 | React Navigation 7 | native-stack + bottom-tabs |
| 타입 공유 | @runground/shared-types | workspace:* |

---

## 4. 데이터베이스 스키마 (Prisma)

### 4.1 사용자 / 인증

```
User
  id            CUID PK
  email         String? unique
  passwordHash  String?
  globalRole    GlobalRole  (USER | ADMIN)
  createdAt / updatedAt / deletedAt

UserProfile (1:1 → User)
  name / phone / instagram

UserIdentity (N:1 → User)
  provider   EMAIL | GOOGLE | NAVER | KAKAO
  providerId unique per provider
```

- `email`과 `passwordHash`는 모두 nullable → OAuth 가입 계정은 비밀번호가 없음
- `UserIdentity`가 소셜 로그인 provider별 외부 ID를 저장하는 역할

### 4.2 클래스 / 멤버십

```
Class
  id          CUID PK
  mode        ClassMode  (ADVANCED | HYBRID | ONLINE_ONLY)
  title / intro
  createdById → User

ClassMembership (N:N 피벗 테이블)
  classId + userId  (unique 복합 제약)
  role        ClassRole   (HEAD_COACH | COACH | RUNNER | STAFF)
  staffRole   StaffRole?  (PHOTO | PACER)
  memberStatus  ACTIVE | INACTIVE
  runnerLevel / runnerGoal

ClassInvitation
  email / role / staffRole
  token  unique
  expiresAt / acceptedAt / acceptedByUserId
```

### 4.3 훈련 이벤트 / 세부 항목

```
TrainingEvent
  classId / createdById
  kind        OFFLINE_SESSION | ONLINE_TASK
  title / location / startsAt / endsAt
  Index: (classId, startsAt)

TrainingDetail (N:1 → TrainingEvent)
  section  WARMUP | MAIN | COOLDOWN
  order    Int (순서)
  type     TrainingType
  distanceKm / durationMin / reps / sets / note
  Index: (eventId, section)

TrainingTemplateItem (반복 커리큘럼 템플릿)
  classId / weekIndex / dayOffset
  type / title / description
  targetDistanceKm / targetDurationMin / targetPaceSecPerKm
  Index: (classId, weekIndex, dayOffset)

TrainingProgress
  userId / classId
  eventId? / templateItemId? (둘 중 하나)
  status   NOT_STARTED | IN_PROGRESS | DONE | VERIFIED
  note / completedAt
```

### 4.4 출석 / 기록 / 피드백

```
AttendanceVote
  eventId + userId  (unique)
  status  GOING | MAYBE | NOT_GOING

ActivityRecord
  userId / classId? / eventId? / templateItemId?
  provider  AMAZIFIT | GARMIN | APPLE | SAMSUNG | MANUAL
  externalId / startedAt / durationSec / distanceM
  avgPaceSecPerKm / avgHr / calories
  rawJson   Json   (provider 원시 데이터)

CoachFeedback
  activityId / coachId
  content
```

### 4.5 소셜 / 미디어

```
Post (N:1 → Class)  +  Comment (N:1 → Post)
MediaAsset
  classId / eventId?
  type  PHOTO | VIDEO
  url / thumbnailUrl
```

### 4.6 결제 / 권한

```
Plan
  scope  CLASS_SUBSCRIPTION | COACH_GRADE
  classId? / name / price / currency(KRW)

Subscription (User → Plan)
  status  ACTIVE | PAST_DUE | CANCELED | EXPIRED
  startedAt / endsAt

Payment
  userId / planId / subscriptionId?
  status  PENDING | PAID | FAILED | CANCELED | REFUNDED
  amount / provider / providerPaymentId

Entitlement
  userId / type(COACH_GRADE)
  startsAt / endsAt
```

---

## 5. 백엔드 API (NestJS)

### 5.1 실행 설정

- 진입점: `apps/api/src/main.ts`
- 글로벌 prefix: `/api`
- CORS: 전체 허용 (개발 환경)
- 포트: 3001

### 5.2 모듈 구조

```
AppModule
├── AuthModule
│   ├── AuthController  (auth/*)
│   ├── AuthService
│   ├── JwtAuthGuard
│   ├── RolesGuard
│   └── RolesDecorator
└── ClassModule
    ├── ClassController (classes/*)
    └── ClassService
```

### 5.3 인증 흐름

```
회원가입
  POST /api/auth/signup
  → 이메일 중복 확인
  → bcrypt(10 rounds) 해시
  → User + UserProfile 트랜잭션 생성

로그인
  POST /api/auth/login
  → 이메일로 유저 조회
  → bcrypt.compare 검증
  → JWT 발급 (payload: { sub: userId, email, role: globalRole })
  → { accessToken, user } 반환

보호된 엔드포인트
  Authorization: Bearer <token>
  → JwtAuthGuard: 토큰 검증, req.user 주입
  → RolesGuard: @Roles() 데코레이터 기반 역할 검사
```

**⚠️ 보안 이슈:** JWT 시크릿이 `'super-secret-key-for-dev'`로 하드코딩되어 있음. 프로덕션 배포 전 환경 변수로 이전 필수.

### 5.4 API 엔드포인트 전체 목록

| Method | Path | Guard | 설명 |
|---|---|---|---|
| GET | /health | - | 헬스 체크 |
| GET | / | - | 전체 클래스 목록 |
| POST | /auth/signup | - | 회원가입 |
| POST | /auth/login | - | 로그인 |
| GET | /auth/me | JWT | 내 프로필 |
| GET | /auth/admin-only | JWT + ADMIN | 어드민 테스트 |
| POST | /classes | JWT + ADMIN | 클래스 생성 |
| GET | /classes | JWT | 전체 클래스 목록 |
| GET | /classes/me | JWT | 내 클래스 목록 |
| GET | /classes/:id | JWT | 클래스 상세 |
| POST | /classes/:id/join | JWT | 클래스 참가 |
| POST | /classes/:id/events | JWT + ADMIN | 훈련 이벤트 생성 |
| GET | /classes/:id/events | JWT | 훈련 이벤트 목록 |

### 5.5 ClassService 주요 로직

- **createClass**: 클래스 생성 + 생성자를 HEAD_COACH로 자동 멤버십 등록
- **joinClass**: 중복 참가 방지 (ConflictException), RUNNER 역할로 멤버십 생성
- **createEvent**: TrainingEvent + 중첩 TrainingDetail 배열을 한 번에 생성
- **getClassEvents**: `startsAt` 오름차순, 각 이벤트 내 details는 `order` 오름차순
<!-- 
TODO: ClassService 주요 로직 수정
1. 클래스 생성 + 생성자를 HEAD_COACH 로 자동 멤버십 등록
2. RUNNER 가 클래스 탐색 앱에서 클래스 구독 신청
3. HEAD_COACH 가 구독 신청한 RUNNER 리스트를 보고 구독 수락
4. HEAD_COACH 가 구독 수락해준 RUNNER 는 클래스 JOIN
 -->

---

## 6. 웹 애플리케이션 (Next.js)

**대상 사용자: 코치**

### 6.1 페이지 구조

```
/                   → 로그인 페이지
/dashboard          → 코치 대시보드 (내 클래스 목록 + 클래스 생성)
/dashboard/classes/[id] → 클래스 상세 (훈련 이벤트 생성/조회, 멤버 목록)
```
<!-- 
TODO: 페이지 구조 변경
/                   → 코치 대시보드 (내 클래스 목록 + 클래스 생성)
/login              → 로그인 페이지
/dashboard/classes/[id] → 클래스 상세 (훈련 이벤트 생성/조회, 멤버 목록)

* `/` 로 라우팅 했는데 token 이 없으면 `/login` 으로 자동 라우팅
 -->

### 6.2 주요 동작

- **로그인**: `POST /api/auth/login` → JWT를 `localStorage.accessToken`에 저장 → `/dashboard` 리다이렉트
- **클래스 생성**: title, mode, intro 입력 → `POST /api/classes`
- **훈련 이벤트 생성**: 동적 폼으로 TrainingDetail 복수 추가 → `POST /api/classes/:id/events`
- **훈련 이벤트 조회**: section별 색상 배지(웜업=주황/본운동=파랑/쿨다운=초록) + 테이블 형태 렌더링
- **인증 상태**: localStorage 토큰 확인, 없으면 로그인 페이지로 redirect

---

## 7. 모바일 앱 (React Native / Expo)

**대상 사용자: 러너**

### 7.1 내비게이션 구조

```
Stack Navigator
├── Login                  (LoginScreen)
├── MainTabs               (Bottom Tab)
│   ├── 내 클래스          (MyClassesScreen)
│   └── 탐색              (ExploreScreen)
└── ClassDetail            (ClassDetailScreen, 헤더 있음)
```

### 7.2 화면별 동작

#### LoginScreen
- 이메일 + 비밀번호 입력
- `POST /api/auth/login`
- 토큰 저장: iOS/Android → `SecureStore`, 웹 → `localStorage`
- 성공 시 `MainTabs`로 이동

#### MyClassesScreen
- screen focus 시마다 `GET /api/classes/me` 호출
- 클래스 카드 탭 → `ClassDetailScreen`으로 이동 (classId, title 전달)
- 로그아웃 버튼: 토큰 삭제 + `Login`으로 이동

#### ExploreScreen
- `GET /api/classes`로 전체 클래스 조회
- "구독하기" 버튼 → `POST /api/classes/:id/join`
- 참가 성공 시 "내 클래스" 탭으로 이동

#### ClassDetailScreen
- route.params에서 `classId` 수신
- `GET /api/classes/:classId/events` 호출
- FlatList + 카드 렌더링:
  - 상단: 제목, 장소, 시간
  - 하단: TrainingDetail 구성표 (섹션 배지 색상 + type + 거리/시간/세트)
- 로딩 중: `ActivityIndicator`
- 빈 상태: "아직 등록된 훈련 일정이 없습니다."

### 7.3 토큰 관리 패턴

```typescript
// 플랫폼 분기 패턴 (모든 화면에서 반복됨)
const token = Platform.OS === 'web'
  ? localStorage.getItem('accessToken')
  : await SecureStore.getItemAsync('accessToken');
```

---

## 8. 공유 패키지

### packages/db
- `src/index.ts`: PrismaClient 싱글턴 + 전체 타입/열거형 re-export
- `prisma/seed.ts`: 개발용 시드 데이터 (코치/러너 계정, 클래스, 훈련 이벤트)
- 시드 실행: `pnpm db:seed`

**시드 데이터:**
- 코치: `coach@runground.com` (ADMIN)
- 러너: `runner@runground.com` (USER)
- 클래스: "2026 동아마라톤 대비반 (A조)" (HYBRID)
- 이벤트 2개: 오프라인 10K TT + 온라인 조깅 60분

### packages/shared-types
```typescript
export interface UserDto {
  id: string;
  email: string;
  role: 'RUNNER' | 'COACH' | 'HEAD_COACH' | 'ADMIN';
}

export interface ClassItem {
  id: string;
  title: string;
  mode: 'ADVANCED' | 'HYBRID' | 'ONLINE_ONLY';
  intro: string | null;
  createdById: string;
}

export interface ApiResponse<T> {
  message: string;
  data: T;
}
```

---

## 9. 데이터 흐름 예시

### 훈련 이벤트 생성 → 모바일 조회

```
[웹] 코치가 폼 작성
  → POST /api/classes/:id/events
  → JwtAuthGuard (토큰 검증)
  → RolesGuard (ADMIN 확인)
  → ClassService.createEvent()
  → Prisma: TrainingEvent + TrainingDetail[] 생성
  → 201 응답

[모바일] 러너가 ClassDetailScreen 진입
  → GET /api/classes/:id/events
  → JwtAuthGuard
  → ClassService.getClassEvents()
  → Prisma: events + details (order ASC) 조회
  → FlatList 렌더링
```

---

## 10. 구현 현황

### 완료된 기능

- [x] 이메일/비밀번호 회원가입 및 로그인
- [x] JWT 기반 인증 + 역할(ADMIN/USER) 기반 접근 제어
- [x] 클래스 생성, 목록 조회, 상세 조회
- [x] 클래스 참가 (RUNNER 멤버십)
- [x] 훈련 이벤트 생성 (WARMUP/MAIN/COOLDOWN 세부 항목 포함)
- [x] 훈련 이벤트 조회 (웹/모바일)
- [x] 모바일 클래스 탐색 및 구독
- [x] 모바일 클래스 상세 + 훈련 일정 조회

### 스키마는 있으나 API/UI 미구현

- [ ] 소셜 로그인 (Google / Naver / Kakao)
- [ ] ClassInvitation (운영진 이메일 초대)
- [ ] AttendanceVote (세션 참석 투표)
- [ ] ActivityRecord (웨어러블 기록 연동)
- [ ] CoachFeedback (코치 피드백 작성)
- [ ] TrainingProgress (수행 여부 추적)
- [ ] Post / Comment (클래스 게시판)
- [ ] MediaAsset (사진/영상 업로드)
- [ ] Plan / Subscription / Payment (결제)
- [ ] Entitlement (코치 등급 권한 부여)
- [ ] 리더보드
- [ ] TrainingTemplateItem (주차별 반복 커리큘럼)

### 알려진 이슈 / 개선 필요 사항

| 항목 | 내용 | 우선순위 |
|---|---|---|
| JWT 시크릿 하드코딩 | `auth.module.ts`, `jwt-auth.guard.ts`에 고정값 | 🔴 긴급 |
| CORS 전체 허용 | 프로덕션에서 특정 origin으로 제한 필요 | 🟡 중요 |
| 역할 체계 불일치 | DB는 HEAD_COACH/COACH/RUNNER/STAFF, JWT payload는 globalRole(USER/ADMIN)만 사용 | 🟡 중요 |
| 클래스 생성 권한 | 현재 ADMIN만 가능, 요구사항은 코치(COACH_GRADE 구독자)도 가능해야 함 | 🟡 중요 |
| 플랫폼 분기 코드 중복 | `Platform.OS === 'web'` 분기가 모든 화면에 반복됨, 유틸 함수로 추출 필요 | 🟢 개선 |
| shared-types 미활용 | 웹/모바일에서 `any` 타입 다수 사용, 공유 타입 적용 필요 | 🟢 개선 |
| 멤버 목록 미완성 | 웹 클래스 상세 페이지 멤버 섹션이 미구현 | 🟢 개선 |

---

## 11. 환경 변수

| 앱 | 변수명 | 용도 |
|---|---|---|
| api | DATABASE_URL | PostgreSQL 연결 URL |
| web | NEXT_PUBLIC_API_URL | API 서버 URL |
| mobile | EXPO_PUBLIC_API_URL | API 서버 URL |

> 현재 mobile `.env.local`: `EXPO_PUBLIC_API_URL=http://172.30.1.85:3001/api` (로컬 맥 IP)

---

## 12. 실행 방법

```bash
# 전체 개발 서버 동시 실행
pnpm dev

# DB 스키마 동기화
pnpm db:push

# DB 시드 실행
pnpm db:seed

# Prisma 클라이언트 생성
pnpm db:generate

# 개별 앱 실행
pnpm --filter api dev          # NestJS API
pnpm --filter web dev          # Next.js 웹
pnpm --filter mobile start     # Expo 모바일
```
