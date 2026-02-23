export interface UserDto {
  id: string;
  email: string;
  role: 'RUNNER' | 'COACH' | 'HEAD_COACH' | 'ADMIN';
}

export interface ClassItem {
  id: string;
  title: string;
  mode: 'ADVANCED' | 'HYBRID' | 'ONLINE_ONLY'; // 변경된 Enum 반영
  intro: string | null; // description 대신 intro 사용
  createdById: string;
}

// 나중에 백엔드 API 응답용 타입도 추가 가능
export interface ApiResponse<T> {
  message: string;
  data: T;
}