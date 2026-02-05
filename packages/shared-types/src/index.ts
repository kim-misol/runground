export interface UserDto {
  id: string;
  email: string;
  role: 'RUNNER' | 'COACH' | 'ADMIN';
}
