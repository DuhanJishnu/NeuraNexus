// app/admin/components/UserCard.tsx
'use client';

import  { User } from '../../types/User';

interface UserCardProps {
  user: User;
}

export default function UserCard({ user }: UserCardProps) {
  const getRoleColor = (role: string) => {
    return role === 'ADMIN' ? 'bg-purple-600' : 'bg-green-600';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 hover:bg-gray-750 transition-colors duration-200 border border-gray-700">
      {/* Header with Name and Role */}
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-white truncate">
          {user.username || 'Unnamed User'}
        </h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
          {user.role}
        </span>
      </div>

      {/* Email */}
      <div className="mb-3">
        <p className="text-sm text-gray-400 mb-1">Email</p>
        <p className="text-white truncate">{user.email}</p>
      </div>

      {/* User ID */}
      <div className="mb-3">
        <p className="text-sm text-gray-400 mb-1">User ID</p>
        <p className="text-gray-300">#{user.id}</p>
      </div>

      {/* Created At */}
      <div className="mb-4">
        <p className="text-sm text-gray-400 mb-1">Joined</p>
        <p className="text-gray-300">{formatDate(user.createdAt)}</p>
      </div>

      {/* Admin Badge */}
      {user.role === 'ADMIN' && (
        <div className="flex items-center mt-4 pt-4 border-t border-gray-700">
          <svg className="h-4 w-4 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
          </svg>
          <span className="text-yellow-400 text-sm font-medium">Administrator</span>
        </div>
      )}
    </div>
  );
}
