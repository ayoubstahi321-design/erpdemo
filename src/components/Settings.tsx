
import React, { useState, useRef, useEffect } from 'react';
import { CompanySettings, CompanyProfile, User } from '../types';
import { Building2, Save, FileText, CreditCard, Phone, Mail, Globe, MapPin, CheckCircle, AlertTriangle, Trash2, Plus, Edit, Check, Image, Upload, X, Percent } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { useToast } from '../hooks/useToast';
import { dataService } from '../services/dataService';
import { useStore } from '../store/useStore';
import { useCompanies } from '../hooks/useSupabaseData';
import { supabase } from '../services/supabaseClient';
import { logger } from '../utils/logger';

interface SettingsProps {
    settings: CompanySettings;
    onSave: (settings: CompanySettings) => void;
    currentUser?: User;
}

const Settings: React.FC<SettingsProps> = ({ settings, onSave, currentUser }) => {
    const isAdmin = currentUser?.role === 'Admin';
    const { t } = useLanguage();
    const toast = useToast();
    const [formData, setFormData] = useState<CompanySettings>(settings);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showSaveProfileModal, setShowSaveProfileModal] = useState(false);
    const [newProfileName, setNewProfileName] = useState('');
    const logoInputRef = useRef<HTMLInputElement>(null);
    const signatureInputRef = useRef<HTMLInputElement>(null);

    // Data reset modal state
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetOptions, setResetOptions] = useState({
        sales: false,
        returns: false,
        transfers: false,
        customers: false,
        products: false,
        warehouses: false,
        documentCounters: false,
        auditLogs: false
    });

    // Supabase-backed company profiles (persistent across devices)
    const companiesHook = useCompanies();
    const companyProfiles = companiesHook.companies;

    // Active company selection still in local store (UI state only)
    const { activeCompanyId, setActiveCompany } = useStore();

    // Migrate any localStorage-only profiles to Supabase on first load
    const { companyProfiles: localProfiles, addCompanyProfile: addLocalProfile, deleteCompanyProfile } = useStore();
    useEffect(() => {
      if (companiesHook.loading) return;
      const serverIds = new Set(companyProfiles.map(p => p.id));
      const toMigrate = localProfiles.filter(p => !serverIds.has(p.id));
      if (toMigrate.length > 0) {
        logger.auth(`Migrating ${toMigrate.length} localStorage company profiles to Supabase`);
        Promise.all(toMigrate.map(p => companiesHook.addCompany(p))).catch(err =>
          logger.error('Migration of company profiles failed', err)
        );
      }
    }, [companiesHook.loading]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        toast.success(t('success_settings_saved'));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleResetApp = async () => {
        // Check if at least one option is selected
        const hasSelection = Object.values(resetOptions).some(v => v);

        if (!hasSelection) {
            toast.error(t('select_delete_option'));
            return;
        }

        // Build list of what will be deleted
        const deleteLabels: Record<string, string> = {
            sales: t('delete_sales_payments'),
            returns: t('returns'),
            transfers: t('transfers'),
            customers: t('customers'),
            products: t('total_products'),
            warehouses: t('warehouses'),
            documentCounters: t('delete_doc_counters'),
            auditLogs: t('delete_audit_logs')
        };

        const toDelete: string[] = [];
        for (const [key, selected] of Object.entries(resetOptions)) {
            if (selected) toDelete.push(deleteLabels[key]);
        }

        const confirmation = window.confirm(
            `⚠️ ${t('delete_data_warning')} ⚠️\n\n${toDelete.map(item => `- ${item}`).join('\n')}\n\n${t('warning_confirm_delete')}`
        );

        if (!confirmation) return;

        try {
            toast.info(t('deleting_data'));
            logger.warn('[Settings] User initiated selective data reset', resetOptions);

            // Build list of tables to clear based on selections
            const tablesToClear: string[] = [];

            // Sales (includes payments and sale_items)
            if (resetOptions.sales) {
                tablesToClear.push('sale_items', 'payments', 'sales');
            }

            // Returns (includes return_items)
            if (resetOptions.returns) {
                tablesToClear.push('return_items', 'returns');
            }

            // Transfers (includes transfer_items)
            if (resetOptions.transfers) {
                tablesToClear.push('transfer_items', 'transfers');
            }

            // Products (includes stock_movements)
            if (resetOptions.products) {
                tablesToClear.push('stock_movements', 'products');
            }

            // Customers
            if (resetOptions.customers) {
                tablesToClear.push('customers');
            }

            // Warehouses (includes warehouse_companies)
            if (resetOptions.warehouses) {
                tablesToClear.push('warehouse_companies', 'warehouses');
            }

            // Document counters
            if (resetOptions.documentCounters) {
                tablesToClear.push('document_counters');
            }

            // Audit logs
            if (resetOptions.auditLogs) {
                tablesToClear.push('audit_logs');
            }

            // Delete selected tables
            for (const table of tablesToClear) {
                logger.info(`[Settings] Clearing table: ${table}`);
                const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');

                if (error) {
                    logger.error(`[Settings] Error clearing table ${table}:`, error);
                    toast.error(`Error al borrar ${table}: ${error.message}`);
                    // Continue anyway to clear other tables
                }
            }

            logger.info('[Settings] Selected data cleared successfully');
            toast.success(t('data_deleted'));

            // Close modal and reset options
            setShowResetModal(false);
            setResetOptions({
                sales: false,
                returns: false,
                transfers: false,
                customers: false,
                products: false,
                warehouses: false,
                documentCounters: false,
                auditLogs: false
            });

            // Reload page to reflect changes
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (error: any) {
            logger.error('[Settings] Error during data reset:', error);
            toast.error(`Error al borrar datos: ${error.message}`);
        }
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error(t('select_valid_image'));
            return;
        }

        // Validate file size (max 500KB for base64 storage)
        if (file.size > 500 * 1024) {
            toast.error(t('image_too_large'));
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            // Convert to JPEG via canvas — react-pdf only supports PNG/JPEG (not WebP/SVG)
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d')!;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                const jpeg = canvas.toDataURL('image/jpeg', 0.92);
                setFormData(prev => ({ ...prev, logoBase64: jpeg }));
                toast.success(t('logo_uploaded_save'));
            };
            img.onerror = () => toast.error(t('csv_read_error'));
            img.src = dataUrl;
        };
        reader.onerror = () => {
            toast.error(t('csv_read_error'));
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveLogo = () => {
        setFormData({ ...formData, logoBase64: undefined });
        if (logoInputRef.current) {
            logoInputRef.current.value = '';
        }
        toast.info(t('logo_removed_save'));
    };

    const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error(t('select_valid_image'));
            return;
        }
        if (file.size > 500 * 1024) {
            toast.error(t('image_too_large'));
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setFormData({ ...formData, signatureBase64: base64 });
            toast.success('Firma subida. Guarda los cambios.');
        };
        reader.onerror = () => toast.error(t('csv_read_error'));
        reader.readAsDataURL(file);
    };

    const handleRemoveSignature = () => {
        setFormData({ ...formData, signatureBase64: undefined });
        if (signatureInputRef.current) signatureInputRef.current.value = '';
        toast.info('Firma eliminada. Guarda los cambios.');
    };

    const handleSaveAsProfile = async () => {
        if (!newProfileName.trim()) {
            toast.error(t('val_name_required'));
            return;
        }

        const newProfile: CompanyProfile = {
            id: crypto.randomUUID(),
            profileName: newProfileName.trim(),
            settings: formData
        };

        try {
            await companiesHook.addCompany(newProfile);
            setActiveCompany(newProfile.id);
            setShowSaveProfileModal(false);
            setNewProfileName('');
            toast.success(t('success_profile_saved'));
        } catch (err: any) {
            logger.error('Error saving company profile', err);
            toast.error(`Error al guardar: ${err.message}`);
        }
    };

    const handleSwitchProfile = (profileId: string) => {
        setActiveCompany(profileId);
        const profile = companyProfiles.find(p => p.id === profileId);
        if (profile) {
            setFormData(profile.settings);
            onSave(profile.settings);
            toast.success(t('success_settings_saved'));
        }
    };

    const handleDeleteProfile = async (profileId: string) => {
        if (confirm(t('confirm_delete_profile'))) {
            try {
                await companiesHook.deleteCompany(profileId);
                // Also remove from localStorage so migration effect doesn't re-insert it
                deleteCompanyProfile(profileId);
                if (activeCompanyId === profileId) {
                    const remaining = companyProfiles.filter(p => p.id !== profileId);
                    setActiveCompany(remaining.length > 0 ? remaining[0].id : null);
                }
            } catch (err: any) {
                logger.error('Error deleting company profile', err);
                toast.error(`Error al eliminar: ${err.message}`);
            }
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-10">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{t('settings')}</h1>
                    <p className="text-sm text-slate-500">{t('configure_settings_desc')}</p>
                </div>
                {showSuccess && (
                    <div className="flex items-center text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-200 animate-in fade-in">
                        <CheckCircle className="w-5 h-5 me-2" />
                        <span className="font-bold">{t('settings_saved')}</span>
                    </div>
                )}
            </div>

            {/* Company Profiles Section */}
            {true && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-200 p-6">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-blue-200">
                        <div className="flex items-center">
                            <div className="p-2 bg-blue-100 rounded-lg me-3">
                                <Building2 className="w-5 h-5 text-blue-700" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-blue-900">{t('company_profiles')}</h3>
                                <p className="text-sm text-blue-600">{t('company_profiles_desc')}</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowSaveProfileModal(true)}
                            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm shadow-md transition-colors"
                        >
                            <Plus className="w-4 h-4 me-1" />
                            {t('save_as_new')}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {companyProfiles.map((profile) => (
                            <div
                                key={profile.id}
                                className={`relative p-4 rounded-lg border-2 transition-all cursor-pointer ${
                                    activeCompanyId === profile.id
                                        ? 'border-blue-600 bg-white shadow-md'
                                        : 'border-blue-200 bg-white hover:border-blue-400'
                                }`}
                                onClick={() => handleSwitchProfile(profile.id)}
                            >
                                {activeCompanyId === profile.id && (
                                    <div className="absolute top-2 right-2">
                                        <div className="p-1 bg-blue-600 rounded-full">
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                    </div>
                                )}
                                <h4 className="font-bold text-blue-900 text-lg mb-1">{profile.profileName}</h4>
                                <p className="text-sm text-slate-600 truncate">{profile.settings.name}</p>
                                <p className="text-xs text-slate-500 truncate">ICE: {profile.settings.ice}</p>
                                {isAdmin && companyProfiles.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteProfile(profile.id);
                                        }}
                                        className="absolute bottom-2 right-2 p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                        title={t('delete_profile_title')}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Save Profile Modal */}
            {showSaveProfileModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900 bg-opacity-60 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold text-slate-900 mb-4">{t('save_company_profile')}</h3>
                        <p className="text-sm text-slate-600 mb-4">
                            {t('save_profile_desc')}
                        </p>
                        <input
                            type="text"
                            value={newProfileName}
                            onChange={(e) => setNewProfileName(e.target.value)}
                            placeholder={t('profile_name_placeholder')}
                            className="w-full border border-slate-300 rounded-lg p-3 mb-4"
                            autoFocus
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowSaveProfileModal(false);
                                    setNewProfileName('');
                                }}
                                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveAsProfile}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-md transition-colors"
                            >
                                {t('save_profile')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* General Info */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center mb-4 pb-2 border-b border-slate-100">
                        <div className="p-2 bg-blue-50 rounded-lg me-3">
                            <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">{t('company_info')}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('company_name')}</label>
                            <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full border border-slate-300 rounded-lg p-2.5" required />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('address')}</label>
                            <input type="text" name="address" value={formData.address} onChange={handleChange} className="w-full border border-slate-300 rounded-lg p-2.5" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('city')}</label>
                            <input type="text" name="city" value={formData.city} onChange={handleChange} className="w-full border border-slate-300 rounded-lg p-2.5" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('country')}</label>
                            <input type="text" name="country" value={formData.country} onChange={handleChange} className="w-full border border-slate-300 rounded-lg p-2.5" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('phone')}</label>
                            <div className="relative">
                                <Phone className="absolute start-3 top-3 w-4 h-4 text-slate-400" />
                                <input type="text" name="phone" value={formData.phone} onChange={handleChange} className="w-full border border-slate-300 rounded-lg ps-9 p-2.5" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('email')}</label>
                            <div className="relative">
                                <Mail className="absolute start-3 top-3 w-4 h-4 text-slate-400" />
                                <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full border border-slate-300 rounded-lg ps-9 p-2.5" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Company Logo */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center mb-4 pb-2 border-b border-slate-100">
                        <div className="p-2 bg-purple-50 rounded-lg me-3">
                            <Image className="w-5 h-5 text-purple-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">{t('company_logo')}</h3>
                    </div>
                    <div className="flex items-start gap-6">
                        {/* Logo Preview */}
                        <div className="flex-shrink-0">
                            {formData.logoBase64 ? (
                                <div className="relative">
                                    <img
                                        src={formData.logoBase64}
                                        alt="Company Logo"
                                        className="w-48 h-auto rounded-lg border border-slate-200 shadow-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleRemoveLogo}
                                        className="absolute -top-2 -right-2 p-1 bg-rose-500 text-white rounded-full hover:bg-rose-600 shadow-md transition-colors"
                                        title={t('delete_logo')}
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="w-48 h-24 bg-slate-100 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center">
                                    <span className="text-sm text-slate-400">{t('no_logo')}</span>
                                </div>
                            )}
                        </div>
                        {/* Upload Controls */}
                        <div className="flex-1">
                            <p className="text-sm text-slate-600 mb-3">
                                {t('logo_description')}
                            </p>
                            <input
                                ref={logoInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                className="hidden"
                                id="logo-upload"
                            />
                            <label
                                htmlFor="logo-upload"
                                className="inline-flex items-center px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg font-medium cursor-pointer hover:bg-purple-100 transition-colors"
                            >
                                <Upload className="w-4 h-4 me-2" />
                                {t('upload_logo')}
                            </label>
                            <p className="text-xs text-slate-400 mt-2">
                                {t('logo_format_hint')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Company Signature */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center mb-4 pb-2 border-b border-slate-100">
                        <div className="p-2 bg-emerald-50 rounded-lg me-3">
                            <FileText className="w-5 h-5 text-emerald-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Signature de l'Entreprise</h3>
                    </div>
                    <div className="flex items-start gap-6">
                        {/* Signature Preview */}
                        <div className="flex-shrink-0">
                            {formData.signatureBase64 ? (
                                <div className="relative">
                                    <img
                                        src={formData.signatureBase64}
                                        alt="Signature"
                                        className="w-48 h-24 object-contain rounded-lg border border-slate-200 shadow-sm bg-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleRemoveSignature}
                                        className="absolute -top-2 -right-2 p-1 bg-rose-500 text-white rounded-full hover:bg-rose-600 shadow-md transition-colors"
                                        title="Supprimer la signature"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="w-48 h-24 bg-slate-100 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center">
                                    <span className="text-sm text-slate-400">Sin firma</span>
                                </div>
                            )}
                        </div>
                        {/* Upload Controls */}
                        <div className="flex-1">
                            <p className="text-sm text-slate-600 mb-3">
                                Sube una imagen de la firma de la empresa (JPG/PNG con fondo transparente o blanco). Aparecerá automáticamente en todas las facturas.
                            </p>
                            <input
                                ref={signatureInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleSignatureUpload}
                                className="hidden"
                                id="signature-upload"
                            />
                            <label
                                htmlFor="signature-upload"
                                className="inline-flex items-center px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-medium cursor-pointer hover:bg-emerald-100 transition-colors"
                            >
                                <Upload className="w-4 h-4 me-2" />
                                Subir firma
                            </label>
                            <p className="text-xs text-slate-400 mt-2">
                                PNG con fondo transparente recomendado. Máximo 500 KB.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Legal Info */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center mb-4 pb-2 border-b border-slate-100">
                        <div className="p-2 bg-indigo-50 rounded-lg me-3">
                            <FileText className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">{t('legal_ids')}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ICE</label>
                            <input type="text" name="ice" value={formData.ice} onChange={handleChange} className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">RC</label>
                            <input type="text" name="rc" value={formData.rc} onChange={handleChange} className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">IF (Fiscal)</label>
                            <input type="text" name="if" value={formData.if} onChange={handleChange} className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CNSS</label>
                            <input type="text" name="cnss" value={formData.cnss} onChange={handleChange} className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Patente</label>
                            <input type="text" name="patente" value={formData.patente} onChange={handleChange} className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Capital Social</label>
                            <input type="text" name="capital" value={formData.capital} onChange={handleChange} className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50" />
                        </div>
                    </div>
                </div>

                {/* Fiscal Settings */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center mb-4 pb-2 border-b border-slate-100">
                        <div className="p-2 bg-amber-50 rounded-lg me-3">
                            <Percent className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">{t('fiscal_settings')}</h3>
                            <p className="text-xs text-slate-500 mt-0.5">{t('fiscal_settings_desc')}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Default TVA rate */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t('default_tax_rate_label')}</label>
                            <div className="grid grid-cols-1 gap-2">
                                {[
                                    { value: 0.00, label: t('tva_0') },
                                    { value: 0.07, label: t('tva_7') },
                                    { value: 0.10, label: t('tva_10') },
                                    { value: 0.14, label: t('tva_14') },
                                    { value: 0.20, label: t('tva_20') },
                                ].map(({ value, label }) => (
                                    <label
                                        key={value}
                                        className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                            formData.defaultTaxRate === value
                                                ? 'border-amber-500 bg-amber-50'
                                                : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/40'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="defaultTaxRate"
                                            value={value}
                                            checked={formData.defaultTaxRate === value}
                                            onChange={() => setFormData({ ...formData, defaultTaxRate: value })}
                                            className="accent-amber-600 w-4 h-4"
                                        />
                                        <span className="text-sm font-medium text-slate-700">{label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Currency symbol */}
                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t('currency_symbol_label')}</label>
                                <input
                                    type="text"
                                    name="currencySymbol"
                                    value={formData.currencySymbol ?? 'DH'}
                                    onChange={e => setFormData({ ...formData, currencySymbol: e.target.value })}
                                    placeholder={t('currency_symbol_placeholder')}
                                    maxLength={6}
                                    className="w-full border border-slate-300 rounded-lg p-2.5 text-lg font-bold text-center tracking-widest"
                                />
                                <p className="text-xs text-slate-400 mt-1 text-center">
                                    {t('fiscal_preview')
                                        .replace('{amount}', '1,250.00')
                                        .replace('{currency}', formData.currencySymbol || 'DH')}
                                </p>
                            </div>

                            {/* Common currencies quick-select */}
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Raccourcis</p>
                                <div className="flex flex-wrap gap-2">
                                    {['DH', 'MAD', '€', '$', '£', 'TND', 'DZD', 'XOF'].map(sym => (
                                        <button
                                            key={sym}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, currencySymbol: sym })}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${
                                                (formData.currencySymbol ?? 'DH') === sym
                                                    ? 'bg-amber-500 text-white border-amber-500'
                                                    : 'bg-white text-slate-600 border-slate-300 hover:border-amber-400 hover:bg-amber-50'
                                            }`}
                                        >
                                            {sym}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bank Info */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center mb-4 pb-2 border-b border-slate-100">
                        <div className="p-2 bg-emerald-50 rounded-lg me-3">
                            <CreditCard className="w-5 h-5 text-emerald-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">{t('bank_details')}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('bank_name')}</label>
                            <input type="text" name="bankName" value={formData.bankName} onChange={handleChange} className="w-full border border-slate-300 rounded-lg p-2.5" placeholder="e.g. Attijariwafa Bank" />
                        </div>
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('rib')}</label>
                            <input type="text" name="rib" value={formData.rib} onChange={handleChange} className="w-full border border-slate-300 rounded-lg p-2.5 font-mono" placeholder="000 000 0000000000000000 00" />
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-4">
                    <button
                        type="button"
                        onClick={() => setShowSaveProfileModal(true)}
                        className="flex items-center px-4 py-3 border border-blue-600 text-blue-600 font-bold rounded-lg hover:bg-blue-50 transition-colors"
                    >
                        <Plus className="w-5 h-5 me-2" />
                        {t('save_as_new_profile')}
                    </button>
                    <button type="submit" className="flex items-center px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition-colors">
                        <Save className="w-5 h-5 me-2" />
                        {t('save_settings')}
                    </button>
                </div>
            </form>

            {/* DANGER ZONE - Admin only */}
            {isAdmin && (
                <div className="bg-white rounded-xl shadow-sm border border-rose-200 p-6 mt-8">
                    <div className="flex items-center mb-4 pb-2 border-b border-rose-100">
                        <div className="p-2 bg-rose-50 rounded-lg me-3">
                            <AlertTriangle className="w-5 h-5 text-rose-600" />
                        </div>
                        <h3 className="text-lg font-bold text-rose-700">{t('danger_zone')}</h3>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">{t('reset_desc')}</p>
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={() => setShowResetModal(true)}
                            className="flex items-center px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-bold hover:bg-rose-100 transition-colors"
                        >
                            <Trash2 className="w-4 h-4 me-2" />
                            {t('reset_app_data')}
                        </button>
                    </div>
                </div>
            )}

            {/* RESET DATA MODAL */}
            {showResetModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-rose-50">
                            <div className="flex items-center">
                                <AlertTriangle className="w-6 h-6 text-rose-600 me-3" />
                                <h2 className="text-xl font-bold text-rose-900">{t('delete_supabase_data')}</h2>
                            </div>
                            <button
                                onClick={() => setShowResetModal(false)}
                                className="p-2 hover:bg-rose-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-rose-700" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6">
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                                <p className="text-sm text-yellow-800 font-semibold">
                                    {t('delete_data_warning')}
                                </p>
                            </div>

                            <div className="space-y-4">
                                {/* Sales */}
                                <label className="flex items-start p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={resetOptions.sales}
                                        onChange={(e) => setResetOptions({...resetOptions, sales: e.target.checked})}
                                        className="mt-1 w-5 h-5 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                                    />
                                    <div className="ms-3 flex-1">
                                        <p className="font-bold text-slate-900">{t('delete_sales_payments')}</p>
                                        <p className="text-sm text-slate-600">{t('delete_sales_desc')}</p>
                                    </div>
                                </label>

                                {/* Returns */}
                                <label className="flex items-start p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={resetOptions.returns}
                                        onChange={(e) => setResetOptions({...resetOptions, returns: e.target.checked})}
                                        className="mt-1 w-5 h-5 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                                    />
                                    <div className="ms-3 flex-1">
                                        <p className="font-bold text-slate-900">{t('returns')}</p>
                                        <p className="text-sm text-slate-600">{t('delete_returns_desc')}</p>
                                    </div>
                                </label>

                                {/* Transfers */}
                                <label className="flex items-start p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={resetOptions.transfers}
                                        onChange={(e) => setResetOptions({...resetOptions, transfers: e.target.checked})}
                                        className="mt-1 w-5 h-5 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                                    />
                                    <div className="ms-3 flex-1">
                                        <p className="font-bold text-slate-900">{t('transfers')}</p>
                                        <p className="text-sm text-slate-600">{t('delete_transfers_desc')}</p>
                                    </div>
                                </label>

                                {/* Customers */}
                                <label className="flex items-start p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={resetOptions.customers}
                                        onChange={(e) => setResetOptions({...resetOptions, customers: e.target.checked})}
                                        className="mt-1 w-5 h-5 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                                    />
                                    <div className="ms-3 flex-1">
                                        <p className="font-bold text-slate-900">{t('customers')}</p>
                                        <p className="text-sm text-slate-600">{t('delete_customers_desc')}</p>
                                    </div>
                                </label>

                                {/* Products */}
                                <label className="flex items-start p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={resetOptions.products}
                                        onChange={(e) => setResetOptions({...resetOptions, products: e.target.checked})}
                                        className="mt-1 w-5 h-5 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                                    />
                                    <div className="ms-3 flex-1">
                                        <p className="font-bold text-slate-900">{t('total_products')}</p>
                                        <p className="text-sm text-slate-600">{t('delete_products_desc')}</p>
                                    </div>
                                </label>

                                {/* Warehouses */}
                                <label className="flex items-start p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={resetOptions.warehouses}
                                        onChange={(e) => setResetOptions({...resetOptions, warehouses: e.target.checked})}
                                        className="mt-1 w-5 h-5 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                                    />
                                    <div className="ms-3 flex-1">
                                        <p className="font-bold text-slate-900">{t('warehouses')}</p>
                                        <p className="text-sm text-slate-600">{t('delete_warehouses_desc')}</p>
                                    </div>
                                </label>

                                {/* Document Counters */}
                                <label className="flex items-start p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={resetOptions.documentCounters}
                                        onChange={(e) => setResetOptions({...resetOptions, documentCounters: e.target.checked})}
                                        className="mt-1 w-5 h-5 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                                    />
                                    <div className="ms-3 flex-1">
                                        <p className="font-bold text-slate-900">{t('delete_doc_counters')}</p>
                                        <p className="text-sm text-slate-600">{t('delete_doc_counters_desc')}</p>
                                    </div>
                                </label>

                                {/* Audit Logs */}
                                <label className="flex items-start p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={resetOptions.auditLogs}
                                        onChange={(e) => setResetOptions({...resetOptions, auditLogs: e.target.checked})}
                                        className="mt-1 w-5 h-5 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                                    />
                                    <div className="ms-3 flex-1">
                                        <p className="font-bold text-slate-900">{t('delete_audit_logs')}</p>
                                        <p className="text-sm text-slate-600">{t('delete_audit_logs_desc')}</p>
                                    </div>
                                </label>
                            </div>

                            {/* Quick Actions */}
                            <div className="flex gap-3 mt-6 pt-6 border-t border-slate-200">
                                <button
                                    onClick={() => setResetOptions({
                                        sales: true,
                                        returns: true,
                                        transfers: true,
                                        customers: false,
                                        products: false,
                                        warehouses: false,
                                        documentCounters: true,
                                        auditLogs: true
                                    })}
                                    className="flex-1 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                                >
                                    {t('transactions_only')}
                                </button>
                                <button
                                    onClick={() => setResetOptions({
                                        sales: true,
                                        returns: true,
                                        transfers: true,
                                        customers: true,
                                        products: true,
                                        warehouses: true,
                                        documentCounters: true,
                                        auditLogs: true
                                    })}
                                    className="flex-1 px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-sm font-medium hover:bg-rose-100 transition-colors"
                                >
                                    {t('delete_everything')}
                                </button>
                                <button
                                    onClick={() => setResetOptions({
                                        sales: false,
                                        returns: false,
                                        transfers: false,
                                        customers: false,
                                        products: false,
                                        warehouses: false,
                                        documentCounters: false,
                                        auditLogs: false
                                    })}
                                    className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                                >
                                    {t('clear_selection')}
                                </button>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
                            <button
                                onClick={() => setShowResetModal(false)}
                                className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleResetApp}
                                className="px-6 py-2.5 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition-colors flex items-center"
                            >
                                <Trash2 className="w-4 h-4 me-2" />
                                {t('delete_selected_data')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
