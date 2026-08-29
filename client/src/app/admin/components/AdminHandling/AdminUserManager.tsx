// app/admin/users/page.tsx
'use client';

import { useState, useMemo } from 'react';
import { useUsers } from '../../hooks/useUsers';
import UserCard from './UserCard';
import SearchBar from './SearchBar';
import AddUserForm from './AddUserForm';

export default function UsersPage() {
  const { users, addUser } = useUsers();
 
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 15;

  // Filter users based on search term
  const normalizedSearch = searchTerm.trim().toLowerCase();

const filteredUsers = useMemo(() => {
  return users.filter(user =>
    user.email.toLowerCase().includes(normalizedSearch) ||
    user.username.toLowerCase().includes(normalizedSearch) ||
    user.role.toLowerCase().includes(normalizedSearch)
  );
}, [users, normalizedSearch]);


  // Paginate users
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * usersPerPage;
    return filteredUsers.slice(startIndex, startIndex + usersPerPage);
  }, [filteredUsers, currentPage]);

  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

  const handleAddUser = async (email: string) => {
    const success = await addUser(email);
    if (success) {
      setShowAddForm(false);
      setSearchTerm('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 text-center">User Management</h1>
          <p className="text-gray-400 text-center">Manage admin users and their permissions</p>
        </div>

        {/* Search and Add User Section */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <SearchBar 
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              placeholder="Search by email, name, or role..."
            />
            {!showAddForm&&
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600  hover:shadow-xl text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200 cursor-pointer"
            >
              Add Admin
            </button>}
          </div>
        </div>

        {/* Add User Form Modal */}
        {showAddForm && (
          <AddUserForm
            onAddUser={handleAddUser}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {/* Users Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          {paginatedUsers.map((user) => (
            <UserCard key={user.id} user={user} />
          ))}
        </div>

        {/* No Users Message */}
        {paginatedUsers.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg">
              {searchTerm ? 'No users found matching your search.' : 'No users available.'}
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center space-x-4">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
            >
              Previous
            </button>
            
            <span className="text-white">
              Page {currentPage} of {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
            >
              
              Next
            </button>
          </div>
        )}

        {/* Results Count */}
        <div className="text-center mt-8">
          <span className="text-gray-400">
            Showing {paginatedUsers.length} of {filteredUsers.length} users
            {searchTerm && ` (filtered from ${users.length} total)`}
          </span>
        </div>
      </div>
    </div>
  );
}
