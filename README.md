

## Dev Notes

### Mac 기준 (와이파이 연결 시)
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

### 모바일 실행
```bash
cd apps/mobile
npx expo start -c --tunnel
```

### 모바일 앱 의존성 추가
모바일 앱(apps/mobile)이 shared-types 패키지를 가져다 쓸 수 있도록 의존성 추가

`pnpm add @runground/shared-types --filter mobile`

### 테스트 실행 
`pnpm --filter api test:e2e`