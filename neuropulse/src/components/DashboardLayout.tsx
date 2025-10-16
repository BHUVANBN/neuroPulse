'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return; // Still loading
    if (!session) router.push('/auth/signin');
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">NP</span>
              </div>
              <h1 className="text-xl font-semibold text-white">NeuroPulse</h1>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-300">
              Welcome, {session.user?.name || session.user?.email}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              session.user?.role === 'patient'
                ? 'bg-green-900 text-green-300'
                : session.user?.role === 'doctor'
                ? 'bg-purple-900 text-purple-300'
                : 'bg-blue-900 text-blue-300'
            }`}>
              {session.user?.role}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
