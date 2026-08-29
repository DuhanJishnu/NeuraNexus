// app/admin/types/user.ts
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt?: string;
}

export interface AddUserResponse {
  message: string;
}

