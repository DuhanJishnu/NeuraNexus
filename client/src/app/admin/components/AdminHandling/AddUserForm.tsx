// app/admin/components/AddUserForm.tsx
'use client';

import { useState } from 'react';

interface AddUserFormProps {
  onAddUser: (email: string) => Promise<void>;
  onCancel: () => void;
}

export default function AddUserForm({ onAddUser, onCancel }: AddUserFormProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) return;

    setIsLoading(true);
    try {
      await onAddUser(email.trim());
      setEmail('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full pb-6">
      <div className="bg-gray-800 rounded-lg p-6 w-full">
        <h2 className="text-xl font-bold text-white mb-4 text-center">Add Admin User</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            {/* Email Field */}
            <div className="flex-1 w-full">
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter user's email"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            
            {/* Buttons */}
            <div className="flex space-x-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors border border-gray-600 rounded-lg hover:bg-gray-700 w-full sm:w-auto"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !email.trim()}
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600  hover:shadow-xl text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200 cursor-pointer"
              >
                {isLoading ? 'Adding...' : 'Add Admin'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
