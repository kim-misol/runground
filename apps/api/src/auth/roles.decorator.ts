import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
// @Roles('ADMIN') 이런 식으로 쓸 수 있게 만들어주는 함수
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);