# Mac 기준 (와이파이 연결 시)
`ipconfig getifaddr en0`

# API Test in Terminal
`pnpm --filter mobile dev`

# Mobile 캐시를 비우며 시작 (-c 옵션)
`pnpm --filter mobile dev -- -c`

# Node 버전 맞춰주기
`nvm use 20`

# web 만 실행
`pnpm -C apps/web dev`

# root 실행
`pnpm dev`