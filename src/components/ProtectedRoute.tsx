import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { UserRole, User } from '../types';
import { useLanguage } from '../services/i18n';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  currentUser: User;
  onNavigate?: (tab: string) => void;
}

export function ProtectedRoute({
  children,
  allowedRoles,
  currentUser,
  onNavigate
}: ProtectedRouteProps) {
  const { t } = useLanguage();

  // Empty allowedRoles means all authenticated users have access
  if (allowedRoles.length === 0) {
    return <>{children}</>;
  }

  if (!allowedRoles.includes(currentUser.role)) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center max-w-md p-8">
          <ShieldAlert className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            {t('access_denied')}
          </h2>
          <p className="text-slate-600 mb-6">
            {t('access_denied_message').replace('{role}', currentUser.role)}
          </p>
          {onNavigate && (
            <button
              onClick={() => onNavigate('dashboard')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              {t('back_to_dashboard')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
