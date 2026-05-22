
import React, { useState, useEffect } from 'react';
import { User, Warehouse } from '../types';
import { Search, Plus, ShieldCheck, User as UserIcon, Mail, Clock, Truck, Briefcase, Pencil, Trash2, X, UserCheck, Store, Loader2, AlertCircle, Building2, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { supabase } from '../services/supabaseClient';
import { useUsers, useWarehouses, useUserCompanies, fetchUserCompaniesForUser } from '../hooks/useSupabaseData';
import { useStore } from '../store/useStore';

// Fallback props for when Supabase is disabled
interface UsersProps {
  users?: User[];
  warehouses?: Warehouse[];
  currentUser: User;
  onAddUser?: (user: User) => void;
  onUpdateUser?: (user: User) => void;
  onDeleteUser?: (id: string) => void;
}

const UsersComp: React.FC<UsersProps> = (props) => {
  const { t } = useLanguage();

  // ALWAYS call hooks (React rules - hooks must be called unconditionally)
  const usersHook = useUsers();
  const warehousesHook = useWarehouses();
  const userCompaniesHook = useUserCompanies();
  const { companyProfiles } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [copyFromManagerId, setCopyFromManagerId] = useState<string>('');
  // Reset password state
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState<Partial<User> & { password?: string }>({
      role: 'Sales',
      name: '',
      email: '',
      password: '',
      warehouseId: null,
      companyId: null
  });

  // Use Supabase hook data directly
  const users = usersHook.users;
  const warehouses = warehousesHook.warehouses;
  const currentUser = props.currentUser;
  const loading = usersHook.loading;
  const error = usersHook.error;

  // Auto-limpiar warehouse cuando se selecciona Admin/Manager
  // Auto-limpiar companies cuando se selecciona Admin
  useEffect(() => {
    if (formData.role === 'Admin' || formData.role === 'Manager') {
      setFormData(prev => ({ ...prev, warehouseId: null }));
    }
    if (formData.role === 'Admin') {
      setFormData(prev => ({ ...prev, companyId: null }));
      setSelectedCompanyIds([]);
    }
  }, [formData.role]);

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
          onClick={() => usersHook.refresh()}
          className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  const filteredUsers = users.filter(u => 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenAdd = () => {
      setIsEditing(false);
      setFormData({ role: 'Sales', name: '', email: '', password: '' });
      setSelectedCompanyIds([]);
      setCopyFromManagerId('');
      setShowModal(true);
  };

  const handleOpenEdit = async (user: User) => {
      setIsEditing(true);
      setFormData({ ...user });
      setCopyFromManagerId('');
      // Load user's assigned companies
      const companies = await fetchUserCompaniesForUser(user.id);
      setSelectedCompanyIds(companies);
      setShowModal(true);
  };

  const handleCopyFromManager = async (managerId: string) => {
    setCopyFromManagerId(managerId);
    if (!managerId) return;
    const companies = await fetchUserCompaniesForUser(managerId);
    setSelectedCompanyIds(companies);
  };

  const handleOpenDelete = (user: User) => {
      setUserToDelete(user);
  };

  const confirmDelete = async () => {
      if (!userToDelete) return;

      try {
        if (usersHook) {
          await usersHook.deleteUser(userToDelete.id);
        } else {
          props.onDeleteUser?.(userToDelete.id);
        }
        setUserToDelete(null);
      } catch (error: any) {
        alert(`${t('error')}: ${error.message}`);
      }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!resetPasswordUser) return;

      if (newPassword.length < 6) {
          alert('La contraseña debe tener al menos 6 caracteres');
          return;
      }
      if (newPassword !== confirmPassword) {
          alert('Las contraseñas no coinciden');
          return;
      }

      setResetLoading(true);
      try {
          const { error } = await supabase.rpc('admin_reset_password', {
              target_user_id: resetPasswordUser.id,
              new_password: newPassword
          });
          if (error) throw error;
          alert(t('password_reset_success').replace('{name}', resetPasswordUser.name));
          setResetPasswordUser(null);
          setNewPassword('');
          setConfirmPassword('');
      } catch (error: any) {
          alert(`Error: ${error.message}`);
      } finally {
          setResetLoading(false);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      if (!formData.name || !formData.email) {
          alert(t('fill_all_fields'));
          return;
      }

      // Validar contraseña solo para nuevos usuarios
      if (!isEditing && !formData.password) {
          alert('La contraseña es requerida para crear un nuevo usuario');
          return;
      }

      if (!isEditing && formData.password && formData.password.length < 6) {
          alert('La contraseña debe tener al menos 6 caracteres');
          return;
      }

      if (!formData.role) {
          alert('Por favor selecciona un rol para el usuario');
          return;
      }

      // Non-Admin users must have at least 1 company assigned
      if (formData.role !== 'Admin' && selectedCompanyIds.length === 0) {
          alert('Debes asignar al menos una empresa a este usuario (sección "Empresas Asignadas" al final del formulario)');
          return;
      }

      const userData: Partial<User> & { password?: string } = {
          ...formData,
          id: formData.id,
          name: formData.name,
          email: formData.email,
          role: formData.role,
          lastActive: formData.lastActive || new Date().toISOString()
      };

      try {
        if (usersHook) {
          if (isEditing) {
            // No enviar password en updates
            const { password, ...updateData } = userData;
            await usersHook.updateUser(userData.id!, updateData as User);
            // Update company assignments (only for non-Admin)
            if (userData.role !== 'Admin') {
              await userCompaniesHook.setCompaniesForUser(userData.id!, selectedCompanyIds);
            }
          } else {
            // Type assertion: userData has all required fields at this point
            const newUser = await usersHook.addUser(userData as Omit<User, 'id'> & { password?: string });
            // Create company assignments for new user (only for non-Admin)
            if (newUser && userData.role !== 'Admin') {
              await userCompaniesHook.setCompaniesForUser(newUser.id, selectedCompanyIds);
            }
          }
        } else {
          if (isEditing) {
            const { password, ...updateData } = userData;
            props.onUpdateUser?.(updateData as User);
          } else {
            props.onAddUser?.(userData as User);
          }
        }
        setShowModal(false);
      } catch (error: any) {
        alert(`${t('error')}: ${error.message}`);
      }
  };

  const getRoleIcon = (role: string) => {
      switch(role) {
          case 'Admin': return <ShieldCheck className="w-3 h-3 mr-1"/>;
          case 'Manager': return <UserCheck className="w-3 h-3 mr-1"/>;
          case 'Accountant': return <Building2 className="w-3 h-3 mr-1"/>;
          case 'Sales': return <Briefcase className="w-3 h-3 mr-1"/>;
          case 'Warehouse': return <Truck className="w-3 h-3 mr-1"/>;
          default: return <UserIcon className="w-3 h-3 mr-1"/>;
      }
  };

  const getRoleColor = (role: string) => {
      switch(role) {
          case 'Admin': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
          case 'Manager': return 'bg-violet-50 text-violet-700 border-violet-100';
          case 'Accountant': return 'bg-teal-50 text-teal-700 border-teal-100';
          case 'Sales': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
          case 'Warehouse': return 'bg-amber-50 text-amber-700 border-amber-100';
          default: return 'bg-slate-50 text-slate-700';
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
         <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('manage_team')}</h1>
            <p className="text-sm text-slate-500">{t('manage_team_desc')}</p>
         </div>
         <button 
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm font-medium w-full sm:w-auto"
         >
             <Plus className="w-4 h-4 mr-2" />
             {t('add_user')}
         </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                  type="text"
                  placeholder={t('search_placeholder')}
                  className="pl-10 pr-4 py-2 w-full md:w-96 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
              />
          </div>
      </div>
      
      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('user')} / {t('role')}</th>
                      <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('email')}</th>
                      <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Entrepôt</th>
                      <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Société</th>
                      <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('last_active')}</th>
                      <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">{t('actions')}</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map(user => {
                      // UX Only: Resaltar usuario actual para evitar borrado accidental en la UI
                      const isMe = user.id === currentUser.id;
                      return (
                          <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                              <td className="px-4 py-4">
                                  <div className="flex items-center">
                                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm mr-3 ${
                                          user.role === 'Admin' ? 'bg-indigo-100 text-indigo-700' :
                                          user.role === 'Manager' ? 'bg-violet-100 text-violet-700' :
                                          user.role === 'Accountant' ? 'bg-teal-100 text-teal-700' :
                                          user.role === 'Sales' ? 'bg-emerald-100 text-emerald-700' :
                                          'bg-amber-100 text-amber-700'
                                      }`}>
                                          {user.name.charAt(0)}
                                      </div>
                                      <div>
                                          <p className="text-sm font-medium text-slate-900">{user.name} {isMe && <span className="ml-2 text-xs text-slate-400 font-normal">(Vous)</span>}</p>
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase mt-1 border ${getRoleColor(user.role)}`}>
                                              {getRoleIcon(user.role)}
                                              {t(`role_${user.role.toLowerCase()}` as any) || user.role}
                                          </span>
                                      </div>
                                  </div>
                              </td>
                              <td className="px-4 py-4">
                                  <div className="flex items-center text-sm text-slate-600">
                                      <Mail className="w-4 h-4 mr-2 text-slate-400" />
                                      {user.email}
                                  </div>
                              </td>
                              {/* Nueva columna: Almacén */}
                              <td className="px-4 py-4">
                                {user.warehouseId ? (
                                  <div className="flex items-center text-sm text-slate-600">
                                    <Store className="w-4 h-4 mr-2 text-emerald-500" />
                                    {warehouses.find(w => w.id === user.warehouseId)?.name || 'Desconocido'}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-50 text-purple-700">
                                    <Building2 className="w-3 h-3 mr-1" />
                                    Todos los almacenes
                                  </span>
                                )}
                              </td>
                              {/* Nueva columna: Empresa */}
                              <td className="px-4 py-4">
                                {user.companyId ? (
                                  <div className="flex items-center text-sm text-slate-600">
                                    <Briefcase className="w-4 h-4 mr-2 text-blue-500" />
                                    {companyProfiles.find(c => c.id === user.companyId)?.profileName || 'Desconocida'}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-50 text-indigo-700">
                                    <Building2 className="w-3 h-3 mr-1" />
                                    Todas las empresas
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                  <div className="flex items-center text-sm text-slate-500">
                                      <Clock className="w-4 h-4 mr-2 text-slate-400" />
                                      {user.lastActive ? new Date(user.lastActive).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                  </div>
                              </td>
                              <td className="px-4 py-4 text-right whitespace-nowrap">
                                  {currentUser.role === 'Admin' && (
                                    <button
                                        type="button"
                                        onClick={() => { setResetPasswordUser(user); setNewPassword(''); setConfirmPassword(''); }}
                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-amber-600 hover:bg-amber-50 hover:text-amber-800 transition-colors mr-1"
                                        title="Resetear contraseña"
                                    >
                                        <KeyRound className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                      type="button"
                                      onClick={() => handleOpenEdit(user)}
                                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition-colors mr-1"
                                      title={t('edit')}
                                  >
                                      <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                      type="button"
                                      onClick={() => handleOpenDelete(user)}
                                      disabled={isMe}
                                      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${isMe ? 'text-slate-300 cursor-not-allowed' : 'text-rose-500 hover:bg-rose-50 hover:text-rose-700'}`}
                                      title={t('remove')}
                                  >
                                      <Trash2 className="w-4 h-4" />
                                  </button>
                              </td>
                          </tr>
                      );
                  })}
              </tbody>
          </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden grid grid-cols-1 gap-4">
          {filteredUsers.map(user => {
              const isMe = user.id === currentUser.id;
              return (
                  <div key={user.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                      <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm mr-3 ${
                                  user.role === 'Admin' ? 'bg-indigo-100 text-indigo-700' : 
                                  user.role === 'Manager' ? 'bg-violet-100 text-violet-700' :
                                  user.role === 'Accountant' ? 'bg-teal-100 text-teal-700' :
                                  user.role === 'Sales' ? 'bg-emerald-100 text-emerald-700' :
                                  'bg-amber-100 text-amber-700'
                              }`}>
                                  {user.name.charAt(0)}
                              </div>
                              <div>
                                  <p className="text-sm font-bold text-slate-900">{user.name} {isMe && "(Vous)"}</p>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase mt-1 border ${getRoleColor(user.role)}`}>
                                      {getRoleIcon(user.role)}
                                      {t(`role_${user.role.toLowerCase()}` as any) || user.role}
                                  </span>
                              </div>
                          </div>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                          <div className="flex items-center text-sm text-slate-600">
                              <Mail className="w-4 h-4 mr-2 text-slate-400" />
                              {user.email}
                          </div>
                          <div className="flex items-center text-sm text-slate-600">
                            {user.warehouseId ? (
                              <>
                                <Store className="w-4 h-4 mr-2 text-emerald-500" />
                                {warehouses.find(w => w.id === user.warehouseId)?.name || 'Desconocido'}
                              </>
                            ) : (
                              <>
                                <Building2 className="w-4 h-4 mr-2 text-purple-600" />
                                <span className="text-purple-700 font-medium">Todos los almacenes</span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center text-sm text-slate-600">
                            {user.companyId ? (
                              <>
                                <Briefcase className="w-4 h-4 mr-2 text-blue-500" />
                                {companyProfiles.find(c => c.id === user.companyId)?.profileName || 'Desconocida'}
                              </>
                            ) : (
                              <>
                                <Building2 className="w-4 h-4 mr-2 text-indigo-600" />
                                <span className="text-indigo-700 font-medium">Todas las empresas</span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center text-sm text-slate-500">
                              <Clock className="w-4 h-4 mr-2 text-slate-400" />
                              {user.lastActive || '-'}
                          </div>
                      </div>

                      <div className="flex space-x-2 pt-3 border-t border-slate-100">
                          {currentUser.role === 'Admin' && (
                            <button
                                type="button"
                                onClick={() => { setResetPasswordUser(user); setNewPassword(''); setConfirmPassword(''); }}
                                className="flex-1 py-2 bg-slate-50 text-amber-600 font-medium text-sm rounded-lg hover:bg-amber-50 transition-colors flex items-center justify-center"
                            >
                                <KeyRound className="w-3 h-3 mr-2" /> Contraseña
                            </button>
                          )}
                          <button
                              type="button"
                              onClick={() => handleOpenEdit(user)}
                              className="flex-1 py-2 bg-slate-50 text-blue-600 font-medium text-sm rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center"
                          >
                              <Pencil className="w-3 h-3 mr-2" /> {t('edit')}
                          </button>
                          <button
                              type="button"
                              onClick={() => handleOpenDelete(user)}
                              disabled={isMe}
                              className={`flex-1 py-2 font-medium text-sm rounded-lg transition-colors flex items-center justify-center ${isMe ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'bg-slate-50 text-rose-600 hover:bg-rose-50'}`}
                          >
                              <Trash2 className="w-3 h-3 mr-2" /> {t('remove')}
                          </button>
                      </div>
                  </div>
              );
          })}
      </div>

      {/* User Modal (Formulario) */}
      {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900 bg-opacity-60 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
                  <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                      <h3 className="font-bold text-slate-900">{isEditing ? t('edit_user') : t('add_user')}</h3>
                      <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  <form onSubmit={handleSubmit} className="p-6 space-y-4" autoComplete="off">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('full_name')}</label>
                          <input 
                              required
                              type="text" 
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              value={formData.name || ''}
                              onChange={(e) => setFormData({...formData, name: e.target.value})}
                              autoComplete="off"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('email')}</label>
                          <input
                              required
                              type="email"
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              value={formData.email || ''}
                              onChange={(e) => setFormData({...formData, email: e.target.value})}
                              autoComplete="off"
                          />
                      </div>

                      {/* Password field - Solo mostrar al crear nuevo usuario */}
                      {!isEditing && (
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contraseña</label>
                          <div className="relative">
                            <input
                                required
                                type={showCreatePassword ? 'text' : 'password'}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={formData.password || ''}
                                onChange={(e) => setFormData({...formData, password: e.target.value})}
                                autoComplete="new-password"
                                minLength={6}
                                placeholder={t('password_placeholder_min')}
                            />
                            <button
                              type="button"
                              onClick={() => setShowCreatePassword(v => !v)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                              tabIndex={-1}
                              aria-label={showCreatePassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                            >
                              {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">El usuario recibirá esta contraseña para acceder al sistema</p>
                        </div>
                      )}

                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('role')}</label>
                          <div className="grid grid-cols-1 gap-2">
                              {['Admin', 'Manager', 'Accountant', 'Sales', 'Warehouse'].map((roleKey) => (
                                <button
                                    key={roleKey}
                                    type="button"
                                    onClick={() => setFormData({...formData, role: roleKey as any})}
                                    className={`p-3 rounded-lg border text-sm font-medium flex items-center justify-start transition-all ${
                                        formData.role === roleKey 
                                        ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500 shadow-sm' 
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className={`p-2 rounded-md mr-3 ${
                                        formData.role === roleKey ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {getRoleIcon(roleKey)}
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold">{t(`role_${roleKey.toLowerCase()}` as any)}</div>
                                        <div className="text-xs font-normal opacity-80">{t(`role_${roleKey.toLowerCase()}_desc` as any)}</div>
                                    </div>
                                </button>
                              ))}
                          </div>
                      </div>

                      {/* Selector de almacén */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                          Entrepôt Assigné
                        </label>
                        <div className="text-xs text-slate-500 mb-2">
                          {formData.role === 'Admin' || formData.role === 'Manager'
                            ? 'Les administrateurs ont accès à tous les entrepôts'
                            : t('select_user_warehouse_desc')}
                        </div>

                        {formData.role !== 'Admin' && formData.role !== 'Manager' ? (
                          <select
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            value={formData.warehouseId || ''}
                            onChange={(e) => setFormData({...formData, warehouseId: e.target.value || null})}
                          >
                            <option value="">-- Sin almacén --</option>
                            {warehouses.map(w => (
                              <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-700 flex items-center">
                            <Building2 className="w-4 h-4 mr-2" />
                            Acceso a todos los almacenes (Admin/Manager)
                          </div>
                        )}
                      </div>

                      {/* Copiar empresas de un Manager (solo para Sales/Accountant/Warehouse) */}
                      {formData.role !== 'Admin' && formData.role !== 'Manager' && (
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                            Seguir a un Manager
                          </label>
                          <select
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                            value={copyFromManagerId}
                            onChange={(e) => handleCopyFromManager(e.target.value)}
                          >
                            <option value="">-- Seleccionar Manager (copia sus empresas) --</option>
                            {users.filter(u => u.role === 'Manager').map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                          {copyFromManagerId && (
                            <p className="mt-1 text-xs text-blue-600">↳ Empresas copiadas del Manager seleccionado</p>
                          )}
                        </div>
                      )}

                      {/* Selector de empresas (multi-select) */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                          Empresas Asignadas
                        </label>
                        <div className="text-xs text-slate-500 mb-2">
                          {formData.role === 'Admin'
                            ? 'Los administradores tienen acceso a todas las empresas'
                            : 'Selecciona las empresas a las que el usuario tendra acceso'}
                        </div>

                        {formData.role !== 'Admin' ? (
                          companyProfiles.length > 0 ? (
                            <div className="space-y-2 max-h-48 overflow-y-auto p-2 border border-slate-200 rounded-lg bg-slate-50">
                              {companyProfiles.map(company => (
                                <label key={company.id} className="flex items-center p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={selectedCompanyIds.includes(company.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedCompanyIds([...selectedCompanyIds, company.id]);
                                      } else {
                                        setSelectedCompanyIds(selectedCompanyIds.filter(id => id !== company.id));
                                      }
                                    }}
                                    className="mr-3 h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-slate-700 font-medium">{company.profileName}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center">
                              <AlertCircle className="w-4 h-4 mr-2" />
                              No hay empresas configuradas. Ve a Parametros para crear una.
                            </div>
                          )
                        ) : (
                          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-700 flex items-center">
                            <Building2 className="w-4 h-4 mr-2" />
                            Acceso a todas las empresas (Admin)
                          </div>
                        )}
                        {formData.role !== 'Admin' && (
                          <p className={`mt-2 text-xs font-medium ${selectedCompanyIds.length === 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {selectedCompanyIds.length === 0
                              ? '⚠ Obligatorio: selecciona al menos una empresa'
                              : `✓ ${selectedCompanyIds.length} empresa(s) asignada(s)`}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 flex space-x-3">
                          <button 
                             type="button" 
                             onClick={() => setShowModal(false)}
                             className="flex-1 py-3 border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-50"
                          >
                              {t('cancel')}
                          </button>
                          <button 
                             type="submit" 
                             className="flex-1 py-3 bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-700 shadow-md"
                          >
                              {isEditing ? t('user_updated') : t('user_created')}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Reset Password Modal (Admin only) */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900 bg-opacity-60 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-amber-50 flex justify-between items-center">
                    <div className="flex items-center">
                        <KeyRound className="w-5 h-5 text-amber-600 mr-2" />
                        <h3 className="font-bold text-slate-900">Resetear Contraseña</h3>
                    </div>
                    <button type="button" onClick={() => setResetPasswordUser(null)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleResetPassword} className="p-6 space-y-4">
                    <div className="text-center mb-2">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-2 ${
                            resetPasswordUser.role === 'Admin' ? 'bg-indigo-100 text-indigo-700' :
                            resetPasswordUser.role === 'Manager' ? 'bg-violet-100 text-violet-700' :
                            'bg-emerald-100 text-emerald-700'
                        }`}>
                            {resetPasswordUser.name.charAt(0)}
                        </div>
                        <p className="font-semibold text-slate-900">{resetPasswordUser.name}</p>
                        <p className="text-sm text-slate-500">{resetPasswordUser.email}</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nouveau Mot de Passe</label>
                        <div className="relative">
                          <input
                              type={showNewPassword ? 'text' : 'password'}
                              required
                              minLength={6}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Minimum 6 caractères"
                              autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(v => !v)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                            tabIndex={-1}
                            aria-label={showNewPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                          >
                            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirmer le Mot de Passe</label>
                        <div className="relative">
                          <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              required
                              minLength={6}
                              className={`w-full border rounded-lg px-3 py-2.5 pr-10 text-sm focus:ring-2 focus:outline-none ${
                                  confirmPassword && confirmPassword !== newPassword
                                      ? 'border-rose-300 focus:ring-rose-500 bg-rose-50'
                                      : confirmPassword && confirmPassword === newPassword
                                      ? 'border-emerald-300 focus:ring-emerald-500 bg-emerald-50'
                                      : 'border-slate-300 focus:ring-amber-500'
                              }`}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Repetir contraseña"
                              autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(v => !v)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                            tabIndex={-1}
                            aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {confirmPassword && confirmPassword !== newPassword && (
                            <p className="text-xs text-rose-600 mt-1">Las contraseñas no coinciden</p>
                        )}
                        {confirmPassword && confirmPassword === newPassword && newPassword.length >= 6 && (
                            <p className="text-xs text-emerald-600 mt-1">Las contraseñas coinciden</p>
                        )}
                    </div>
                    <div className="pt-2 flex space-x-3">
                        <button
                            type="button"
                            onClick={() => setResetPasswordUser(null)}
                            className="flex-1 py-3 border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-50"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={resetLoading || newPassword.length < 6 || newPassword !== confirmPassword}
                            className="flex-1 py-3 bg-amber-600 rounded-lg text-white font-medium hover:bg-amber-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {resetLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
                            {resetLoading ? 'Modification...' : 'Modifier'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900 bg-opacity-60 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                    <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trash2 className="w-6 h-6 text-rose-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{t('confirm_delete_user')}</h3>
                    <p className="text-sm text-slate-600 mb-6">
                        {userToDelete.name}
                    </p>
                    <div className="flex space-x-3">
                        <button 
                            type="button"
                            onClick={() => setUserToDelete(null)}
                            className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                        >
                            {t('cancel')}
                        </button>
                        <button 
                            type="button"
                            onClick={confirmDelete}
                            className="flex-1 py-2.5 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 shadow-md transition-colors"
                        >
                            {t('remove')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default UsersComp;
