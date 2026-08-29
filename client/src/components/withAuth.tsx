"use client";

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const withAuth = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredRole?: 'USER' | 'ADMIN',
) => {
  const Wrapper = (props: P) => {
    const { isAuthenticated, loading, user } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading && (!isAuthenticated || (requiredRole && user?.role !== requiredRole))) {
        router.replace(isAuthenticated ? '/' : '/login');
      }
    }, [isAuthenticated, loading, router, user]);

    if (loading || !isAuthenticated || (requiredRole && user?.role !== requiredRole)) {
      return (
        <div className="flex min-h-screen items-center justify-center" role="status">
          <span className="sr-only">Checking access</span>
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-600 border-t-vsyellow" />
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };

  Wrapper.displayName = `withAuth(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return Wrapper;
};

export default withAuth;
