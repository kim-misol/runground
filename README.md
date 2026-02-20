# 🏃‍♂️ Runground (런그라운드)

**Runground**는 마라톤/러닝 훈련 클래스를 위한 종합 플랫폼입니다. 코치와 러너를 연결하고, 온/오프라인 하이브리드 훈련 스케줄을 관리하며, 러너들의 활동 기록(웨어러블 연동)을 트래킹합니다.

## 🛠 Tech Stack

- **Package Manager:** [pnpm](https://pnpm.io/) (Monorepo Workspace)
- **Backend (API):** [NestJS](https://nestjs.com/)
- **Frontend (Web):** [Next.js](https://nextjs.org/) (Coach Dashboard & Admin)
- **Frontend (Mobile):** [React Native (Expo)](https://expo.dev/) (Runner App)
- **Database / ORM:** PostgreSQL / [Prisma](https://www.prisma.io/)
- **Shared:** TypeScript (100% Type Safe between Front/Back)

---

## 📦 Monorepo Structure

이 프로젝트는 `pnpm workspaces`를 활용한 모노레포 구조로 구성되어 있습니다.

```text
runground/
├── apps/
│   ├── api/             # NestJS 백엔드 서버 (Port: 3001)
│   ├── web/             # Next.js 웹 어드민/대시보드 (Port: 3000)
│   └── mobile/          # Expo 모바일 앱 (Runner 용)
└── packages/
    ├── db/              # Prisma 스키마, 마이그레이션, 시드 데이터 및 DB Client
    └── shared-types/    # 프론트엔드와 백엔드가 공유하는 공통 TypeScript 인터페이스
```

🚀 Getting Started
1. Prerequisites
    - Node.js (v20 이상 권장)
    - pnpm 설치 (npm install -g pnpm)
    - Expo Go 앱 (스마트폰 테스트용)

2. Installation

    프로젝트 루트에서 의존성을 설치합니다.
    ```Bash
    pnpm install
    ```

3. Environment Variables (.env)

    각 앱과 패키지에 환경변수 파일을 설정해야 합니다. (루트의 `.env`를 복사해서 사용)

    - `packages/db/.env` : DATABASE_URL 설정
    - `apps/api/.env` : 백엔드 포트 및 DATABASE_URL 설정
    - `apps/mobile/.env` : `EXPO_PUBLIC_API_URL` 설정 (예: `http://192.168.X.X:3001/api` - 자신의 IP 주소 입력 필수)

4. Database Setup

    데이터베이스 마이그레이션 및 시드(초기 데이터) 주입을 진행합니다.
    ```bash
    # Prisma 마이그레이션 적용 및 클라이언트 생성
    pnpm --filter @runground/db prisma migrate dev

    # 시드 데이터 생성 (테스트용 코치, 러너, 클래스 주입)
    pnpm --filter @runground/db prisma db seed
    ```
---

## 💻 Running the Apps

각 어플리케이션은 개별적으로 실행하거나 동시에 실행할 수 있습니다.

Backend (NestJS API)

```Bash
pnpm --filter api dev
# API Server runs on http://localhost:3001/api
```
Web (Next.js Admin)

```Bash
pnpm --filter web dev
# Web app runs on http://localhost:3000
```
Mobile (Expo)

```Bash
# pnpm --filter mobile dev -- --tunnel
cd apps/mobile
npx expo start -c --tunnel
# QR 코드가 생성되면 핸드폰의 카메라 또는 Expo Go 앱으로 스캔하세요.
```
🤝 Development Workflow

1. DB 스키마가 변경되었을 때 (packages/db/prisma/schema.prisma)
```Bash
pnpm --filter @runground/db prisma migrate dev --name <migration_name>
pnpm --filter @runground/db db:generate
```

2. 공용 타입이 변경되었을 때 (packages/shared-types) shared-types/src/index.ts를 수정하면 api, web, mobile 프로젝트에서 즉시 변경된 타입을 인식합니다. (필요시 각 앱의 TS 서버 리스타트)


## Dev Notes

Mac 기준 (와이파이 연결 시)
`ipconfig getifaddr en0`

### Node 버전 맞춰주기
`nvm use 20`

### root 실행
`pnpm dev`

### web 만 실행
`pnpm -C apps/web dev`

### API Test in Terminal
`pnpm --filter mobile dev`

### Mobile 캐시를 비우며 시작 (-c 옵션)
`pnpm --filter mobile dev -- -c`


### 모바일 앱 의존성 추가
모바일 앱(apps/mobile)이 shared-types 패키지를 가져다 쓸 수 있도록 의존성 추가

`pnpm add @runground/shared-types --filter mobile`

### 테스트 실행 
`pnpm --filter api test:e2e`

### DB seeding
`git push --set-upstream origin tdd`