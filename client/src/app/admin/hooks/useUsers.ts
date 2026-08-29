'use client';

import { useCallback, useState } from 'react';
import { isAxiosError } from 'axios';
import { toast } from 'react-toastify';
import { User } from '../types/User';
import { api } from '@/service/api';


const errorMessage = (error: unknown, fallback: string) => {
  if (!isAxiosError(error)) return fallback;
  const data = error.response?.data as { message?: string } | undefined;
  return data?.message || fallback;
};

export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);

  const findUser = useCallback(async (email: string) => {
    const response = await api.get<User>('/auth/v1/getuser', { params: { email } });
    setUsers(current => [
      response.data,
      ...current.filter(user => user.id !== response.data.id),
    ]);
    return response.data;
  }, []);

  const addUser = useCallback(async (email: string) => {
    try {
      const user = await findUser(email);
      const response = await api.patch<User & { message: string }>('/auth/v1/makeadmin', {
        userId: user.id,
      });
      setUsers(current => [
        response.data,
        ...current.filter(item => item.id !== response.data.id),
      ]);
      toast.success(response.data.message);
      return true;
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Failed to promote user'));
      return false;
    }
  }, [findUser]);

  return {
    users,
    addUser,
    refetch: async () => undefined,
  };
};
