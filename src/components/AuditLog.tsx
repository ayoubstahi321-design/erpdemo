
import React, { useState } from 'react';
import { AuditLogEntry, AuditAction } from '../types';
import { Search, Filter, History, User, Calendar, FileText, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { useAuditLogs } from '../hooks/useSupabaseData';
import { usePagination } from '../hooks/usePagination';
import { Pagination } from './Pagination';

// Fallback props for when Supabase is disabled
interface AuditLogProps {
  logs?: AuditLogEntry[];
}

const AuditLog: React.FC<AuditLogProps> = (props) => {
  const { t } = useLanguage();

  // ALWAYS call hooks (React rules - hooks must be called unconditionally)
  const auditLogsHook = useAuditLogs();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<AuditAction | 'ALL'>('ALL');

  // Use Supabase hook data directly
  const logs = auditLogsHook.auditLogs;
  const loading = auditLogsHook.loading;
  const error = auditLogsHook.error;

  // Compute filtered logs and pagination BEFORE early returns (React hooks rules)
  const filteredLogs = (logs || []).filter(log => {
      const matchesSearch = log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            log.entityId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;
      return matchesSearch && matchesAction;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const { currentPage, totalPages, paginatedData: paginatedLogs, goToPage, startIndex, endIndex, totalItems } = usePagination({ data: filteredLogs, itemsPerPage: 50 });

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
        <p className="text-slate-600">{t('loading')}...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 m-6">
        <div className="flex items-center mb-2">
          <AlertCircle className="w-5 h-5 text-rose-600 mr-2" />
          <h3 className="font-semibold text-rose-900">{t('error')}</h3>
        </div>
        <p className="text-sm text-rose-700 mb-4">{error.message}</p>
        <button
          onClick={() => auditLogsHook.refresh()}
          className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  const getActionColor = (action: AuditAction) => {
      switch(action) {
          case 'CREATE': return 'bg-emerald-100 text-emerald-800';
          case 'UPDATE': return 'bg-blue-100 text-blue-800';
          case 'DELETE': return 'bg-rose-100 text-rose-800';
          case 'SALE': return 'bg-indigo-100 text-indigo-800';
          case 'TRANSFER': return 'bg-amber-100 text-amber-800';
          case 'PAYMENT': return 'bg-teal-100 text-teal-800';
          case 'LOGIN': return 'bg-slate-100 text-slate-800';
          default: return 'bg-slate-100 text-slate-800';
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('audit_log')}</h1>
            <p className="text-sm text-slate-500">{t('activity_log')}</p>
         </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:w-96">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                    type="text"
                    placeholder="Search logs..."
                    className="pl-10 pr-4 py-2 w-full border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div className="flex items-center space-x-2 w-full md:w-auto">
                <Filter className="w-4 h-4 text-slate-400" />
                <select 
                    className="border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value as any)}
                >
                    <option value="ALL">All Actions</option>
                    <option value="SALE">Sales</option>
                    <option value="CREATE">Creates</option>
                    <option value="UPDATE">Updates</option>
                    <option value="DELETE">Deletes</option>
                    <option value="TRANSFER">Transfers</option>
                    <option value="PAYMENT">Payments</option>
                    <option value="LOGIN">Logins</option>
                </select>
            </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                          <th className="px-6 py-4 font-semibold text-slate-500">{t('timestamp')}</th>
                          <th className="px-6 py-4 font-semibold text-slate-500">{t('user')}</th>
                          <th className="px-6 py-4 font-semibold text-slate-500">{t('action')}</th>
                          <th className="px-6 py-4 font-semibold text-slate-500">{t('entity')}</th>
                          <th className="px-6 py-4 font-semibold text-slate-500">{t('details')}</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {paginatedLogs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-50">
                              <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                  <div className="flex items-center">
                                      <Calendar className="w-3 h-3 mr-2 text-slate-400" />
                                      {new Date(log.timestamp).toLocaleString()}
                                  </div>
                              </td>
                              <td className="px-6 py-4">
                                  <div className="flex items-center">
                                      <User className="w-3 h-3 mr-2 text-slate-400" />
                                      <span className="font-medium text-slate-900">{log.userName}</span>
                                      <span className="text-xs text-slate-400 ml-2">({log.userRole})</span>
                                  </div>
                              </td>
                              <td className="px-6 py-4">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getActionColor(log.action)}`}>
                                      {log.action}
                                  </span>
                              </td>
                              <td className="px-6 py-4">
                                  <span className="font-mono text-xs bg-slate-100 px-1 rounded text-slate-600">{log.entity}: {log.entityId}</span>
                              </td>
                              <td className="px-6 py-4 text-slate-700">
                                  {log.details}
                              </td>
                          </tr>
                      ))}
                      {filteredLogs.length === 0 && (
                          <tr>
                              <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                  <History className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                  <p>No activity logs found.</p>
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />
      </div>
    </div>
  );
};

export default AuditLog;
