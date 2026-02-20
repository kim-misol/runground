export interface UserDto {
  id: string;
  email: string;
  role: 'RUNNER' | 'COACH' | 'HEAD_COACH' | 'ADMIN';
}

export interface ClassItem {
  id: string;
  title: string;
  type: string;
  isActive: boolean;
}

// 나중에 백엔드 API 응답용 타입도 추가 가능
export interface ApiResponse<T> {
  message: string;
  data: T;
}