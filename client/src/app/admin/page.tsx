// app/admin/page.tsx
'use client';

import React, { useState } from "react";
import FileUpload from "../admin/components/FileUpload/index";
import AdminUserManager from "./components/AdminHandling/AdminUserManager";
import withAuth from '@/components/withAuth';

type AdminSection = 'files' | 'users';

const AdminPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<AdminSection>('files');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-4">
            Admin Dashboard
          </h1>
          
          {/* Navigation Buttons */}
          <div className="flex justify-center space-x-4 mb-6">
            <button
              onClick={() => setActiveSection('files')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
                activeSection === 'files'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-600'
              }`}
            >
              📁 File Manager
            </button>
            <button
              onClick={() => setActiveSection('users')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
                activeSection === 'users'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-600'
              }`}
            >
              👥 User Manager
            </button>
          </div>
        </div>
        
        <div className="grid lg:grid-cols-1 gap-8">
          {activeSection === 'files' && <FileUpload />}
          {activeSection === 'users' && <AdminUserManager />}
        </div>
      </div>
    </div>
  );
};

export default withAuth(AdminPage, 'ADMIN');
