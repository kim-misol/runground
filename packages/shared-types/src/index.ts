export interface UserDto {
  id: string;
  email: string;
  role: 'RUNNER' | 'COACH' | 'HEAD_COACH' | 'ADMIN';
}
