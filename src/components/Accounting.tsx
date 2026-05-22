
import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Sale, Customer, CompanySettings, Warehouse, User, Product, SaleSource, DocumentType, Charge, ChargePaymentMethod, CHARGE_CATEGORIES } from '../types';
import { useLanguage } from '../services/i18n';
import { Download, Calendar, Filter, FileSpreadsheet, TrendingUp, Wallet, Calculator, Eye, FileText, Store, Building2, BarChart3, CheckCircle, Clock, AlertCircle, TrendingDown, Receipt, Plus, Pencil, Trash2, X, Undo2 } from 'lucide-react';
import { CURRENCY } from '../constants';
import { exportToCSV } from '../utils/helpers';
import { calculateHT } from '../utils/pricing';
import ProductProfitReport from './ProductProfitReport';
import AgingReport from './AgingReport';
// Lazy load PDF component (only loaded when printing)
const PrintableDocument = lazy(() => import('./PrintableDocument'));

// ─── ChargesManager ───────────────────────────────────────────────────────────
interface ChargesManagerProps {
    charges: Charge[];
    onAdd: (charge: Omit<Charge, 'id' | 'createdAt'>) => Promise<void>;
    onUpdate: (id: string, updates: Partial<Charge>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    currentUser: User;
}

const EMPTY_FORM = {
    date: new Date().toISOString().split('T')[0],
    category: CHARGE_CATEGORIES[0] as string,
    description: '',
    amountTTC: '',
    taxRate: '0',
    paymentMethod: 'Cash' as ChargePaymentMethod,
    reference: '',
};

const ChargesManager: React.FC<ChargesManagerProps> = ({ charges, onAdd, onUpdate, onDelete, currentUser }) => {
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
    });
    const [catFilter, setCatFilter] = useState('ALL');
    const [payFilter, setPayFilter] = useState('ALL');
    const [showModal, setShowModal] = useState(false);
    const [editingCharge, setEditingCharge] = useState<Charge | null>(null);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [submitting, setSubmitting] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState('');

    const filtered = useMemo(() => {
        return charges.filter(c => {
            const d = new Date(c.date);
            const start = startDate ? new Date(startDate) : new Date(0);
            const end = endDate ? new Date(endDate) : new Date(8640000000000000);
            end.setHours(23, 59, 59, 999);
            if (d < start || d > end) return false;
            if (catFilter !== 'ALL' && c.category !== catFilter) return false;
            if (payFilter !== 'ALL' && c.paymentMethod !== payFilter) return false;
            return true;
        });
    }, [charges, startDate, endDate, catFilter, payFilter]);

    const totalHT = filtered.reduce((s, c) => s + c.amountHT, 0);
    const totalTVA = filtered.reduce((s, c) => s + (c.amountTTC - c.amountHT), 0);
    const totalTTC = filtered.reduce((s, c) => s + c.amountTTC, 0);

    const openAdd = () => {
        setEditingCharge(null);
        setForm({ ...EMPTY_FORM });
        setErrorMsg('');
        setShowModal(true);
    };

    const openEdit = (c: Charge) => {
        setEditingCharge(c);
        setForm({
            date: c.date,
            category: c.category,
            description: c.description,
            amountTTC: String(c.amountTTC),
            taxRate: String(c.taxRate),
            paymentMethod: c.paymentMethod,
            reference: c.reference || '',
        });
        setErrorMsg('');
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        const ttc = parseFloat(form.amountTTC);
        if (!ttc || ttc <= 0) { setErrorMsg('Montant TTC invalide.'); return; }
        if (!form.description.trim()) { setErrorMsg('Description requise.'); return; }
        const rate = parseFloat(form.taxRate);
        const ht = rate > 0 ? ttc / (1 + rate) : ttc;
        const payload: Omit<Charge, 'id' | 'createdAt'> = {
            date: form.date,
            category: form.category,
            description: form.description.trim(),
            amountHT: Math.round(ht * 100) / 100,
            taxRate: rate,
            amountTTC: ttc,
            paymentMethod: form.paymentMethod,
            reference: form.reference || undefined,
            createdBy: currentUser.name,
        };
        setSubmitting(true);
        try {
            if (editingCharge) {
                await onUpdate(editingCharge.id, payload);
            } else {
                await onAdd(payload);
            }
            setShowModal(false);
        } catch (err: any) {
            setErrorMsg(err?.message || 'Erreur lors de la sauvegarde.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await onDelete(deleteId);
        } catch (err: any) {
            setErrorMsg(err?.message || 'Erreur suppression.');
        } finally {
            setDeleteId(null);
        }
    };

    const handleExportCSV = () => {
        const headers = ['Date', 'Catégorie', 'Description', 'HT', 'TVA%', 'TVA', 'TTC', 'Paiement', 'Référence'];
        const rows = filtered.map(c => [
            c.date,
            `"${c.category}"`,
            `"${c.description}"`,
            c.amountHT.toFixed(2),
            `${(c.taxRate * 100).toFixed(0)}%`,
            (c.amountTTC - c.amountHT).toFixed(2),
            c.amountTTC.toFixed(2),
            c.paymentMethod,
            c.reference || '',
        ].join(','));
        exportToCSV(`CHARGES_${startDate}_${endDate}.csv`, headers, rows);
    };

    return (
        <div className="space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center">
                    <div className="p-3 bg-red-100 text-red-600 rounded-lg mr-3">
                        <TrendingDown className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Total HT</p>
                        <p className="text-lg font-bold text-slate-900">{totalHT.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} <span className="text-xs text-slate-400">{CURRENCY}</span></p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg mr-3">
                        <Calculator className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">TVA Déductible</p>
                        <p className="text-lg font-bold text-slate-900">{totalTVA.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} <span className="text-xs text-slate-400">{CURRENCY}</span></p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center">
                    <div className="p-3 bg-orange-100 text-orange-600 rounded-lg mr-3">
                        <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Total TTC</p>
                        <p className="text-lg font-bold text-orange-700">{totalTTC.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} <span className="text-xs text-slate-400">{CURRENCY}</span></p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center">
                    <div className="p-3 bg-slate-100 text-slate-600 rounded-lg mr-3">
                        <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Nb Charges</p>
                        <p className="text-lg font-bold text-slate-900">{filtered.length}</p>
                    </div>
                </div>
            </div>

            {/* Filters + Actions */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-end justify-between">
                <div className="flex flex-wrap gap-3 items-end">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date début</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date fin</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Catégorie</label>
                        <div className="relative">
                            <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white min-w-[180px]">
                                <option value="ALL">Toutes catégories</option>
                                {CHARGE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Paiement</label>
                        <div className="relative">
                            <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <select value={payFilter} onChange={e => setPayFilter(e.target.value)} className="pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                <option value="ALL">Tous</option>
                                <option value="Cash">Cash</option>
                                <option value="Virement">Virement</option>
                                <option value="Chèque">Chèque</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleExportCSV} className="flex items-center px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 text-slate-600">
                        <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />
                        Export CSV
                    </button>
                    <button onClick={openAdd} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Ajouter une charge
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                            <tr>
                                <th className="p-4">Date</th>
                                <th className="p-4">Catégorie</th>
                                <th className="p-4">Description</th>
                                <th className="p-4 text-right">HT</th>
                                <th className="p-4 text-right">TVA%</th>
                                <th className="p-4 text-right">TTC</th>
                                <th className="p-4">Paiement</th>
                                <th className="p-4">Réf</th>
                                <th className="p-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map(c => (
                                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 whitespace-nowrap">{new Date(c.date).toLocaleDateString('fr-MA')}</td>
                                    <td className="p-4">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">{c.category}</span>
                                    </td>
                                    <td className="p-4 font-medium text-slate-800">{c.description}</td>
                                    <td className="p-4 text-right font-medium">{c.amountHT.toFixed(2)}</td>
                                    <td className="p-4 text-right text-slate-500">{(c.taxRate * 100).toFixed(0)}%</td>
                                    <td className="p-4 text-right font-bold text-slate-900">{c.amountTTC.toFixed(2)}</td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.paymentMethod === 'Cash' ? 'bg-emerald-100 text-emerald-700' : c.paymentMethod === 'Virement' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {c.paymentMethod}
                                        </span>
                                    </td>
                                    <td className="p-4 text-slate-500 text-xs">{c.reference || '—'}</td>
                                    <td className="p-4 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => openEdit(c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Modifier">
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setDeleteId(c.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors" title="Supprimer">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-slate-400">
                                        Aucune charge pour cette période.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                            <tr>
                                <td colSpan={3} className="p-4 text-right uppercase text-slate-500 text-xs">Totaux</td>
                                <td className="p-4 text-right">{totalHT.toFixed(2)}</td>
                                <td className="p-4"></td>
                                <td className="p-4 text-right text-orange-700">{totalTTC.toFixed(2)}</td>
                                <td colSpan={3}></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-slate-200">
                        <div className="flex items-center justify-between p-5 border-b border-slate-200">
                            <h2 className="text-lg font-semibold text-slate-900">
                                {editingCharge ? 'Modifier la charge' : 'Ajouter une charge'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date *</label>
                                    <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mode paiement *</label>
                                    <select required value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value as ChargePaymentMethod }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                        <option value="Cash">Cash</option>
                                        <option value="Virement">Virement</option>
                                        <option value="Chèque">Chèque</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Catégorie *</label>
                                <select required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                    {CHARGE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description *</label>
                                <input type="text" required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Loyer local commercial — Mars 2026" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Montant TTC ({CURRENCY}) *</label>
                                    <input type="number" required min="0.01" step="0.01" value={form.amountTTC} onChange={e => setForm(f => ({ ...f, amountTTC: e.target.value }))} placeholder="0.00" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Taux TVA</label>
                                    <select value={form.taxRate} onChange={e => setForm(f => ({ ...f, taxRate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                        <option value="0">0% (HT)</option>
                                        <option value="0.20">20%</option>
                                    </select>
                                </div>
                            </div>
                            {form.amountTTC && (
                                <div className="bg-slate-50 rounded-lg px-4 py-2 text-sm text-slate-600">
                                    HT calculé: <span className="font-bold text-slate-900">
                                        {parseFloat(form.taxRate) > 0
                                            ? (parseFloat(form.amountTTC) / (1 + parseFloat(form.taxRate))).toFixed(2)
                                            : parseFloat(form.amountTTC).toFixed(2)
                                        } {CURRENCY}
                                    </span>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Référence (facultatif)</label>
                                <input type="text" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="N° facture fournisseur, bon de livraison..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            {errorMsg && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>}
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                                    Annuler
                                </button>
                                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                                    {submitting ? 'Sauvegarde...' : editingCharge ? 'Modifier' : 'Ajouter'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirm */}
            {deleteId && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm border border-slate-200 p-6">
                        <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                            <Trash2 className="w-6 h-6 text-red-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 text-center mb-2">Supprimer cette charge ?</h3>
                        <p className="text-sm text-slate-500 text-center mb-6">Cette action est irréversible.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                                Annuler
                            </button>
                            <button onClick={handleDelete} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
                                Supprimer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
// ─────────────────────────────────────────────────────────────────────────────

// ─── PnLReport ───────────────────────────────────────────────────────────────
interface PnLReportProps {
    sales: Sale[];
    charges: Charge[];
    products: Product[];
    startDate: string;
    endDate: string;
}

const PnLReport: React.FC<PnLReportProps> = ({ sales, charges, products, startDate, endDate }) => {
    const revenueHT = sales.reduce((s, sale) => s + sale.subtotalAmount, 0);

    // COGS: coût des marchandises vendues HT
    // product.cost is TTC — divide by (1+taxRate) to get HT
    const cogsHT = useMemo(() => {
        const productMap = new Map(products.map(p => [p.id, p]));
        return sales.reduce((total, sale) => {
            return total + sale.items.reduce((lineTotal, item) => {
                const product = productMap.get(item.productId);
                if (!product?.cost) return lineTotal;
                const taxRate = product.customTaxRate ?? (sale.taxRate ?? 0.20);
                const costHT = product.cost / (1 + taxRate);
                const units = item.sellMode === 'box'
                    ? item.quantity * (item.unitsPerBox || 1)
                    : item.quantity;
                return lineTotal + costHT * units;
            }, 0);
        }, 0);
    }, [sales, products]);

    const margebrute = revenueHT - cogsHT;
    const margeBruteRate = revenueHT > 0 ? (margebrute / revenueHT) * 100 : 0;

    const filteredCharges = useMemo(() => {
        return charges.filter(c => {
            const d = new Date(c.date);
            const start = startDate ? new Date(startDate) : new Date(0);
            const end = endDate ? new Date(endDate) : new Date(8640000000000000);
            end.setHours(23, 59, 59, 999);
            return d >= start && d <= end;
        });
    }, [charges, startDate, endDate]);

    const totalChargesHT = filteredCharges.reduce((s, c) => s + c.amountHT, 0);
    const netResult = margebrute - totalChargesHT;

    const byCategory = useMemo(() => {
        const map: Record<string, number> = {};
        filteredCharges.forEach(c => {
            map[c.category] = (map[c.category] || 0) + c.amountHT;
        });
        return Object.entries(map).sort((a, b) => b[1] - a[1]);
    }, [filteredCharges]);

    const period = startDate && endDate ? `${new Date(startDate).toLocaleDateString('fr-MA')} — ${new Date(endDate).toLocaleDateString('fr-MA')}` : 'Toute la période';

    const fmt = (n: number) => n.toLocaleString('fr-MA', { minimumFractionDigits: 2 });

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-2xl mx-auto">
            <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight uppercase">Compte de Résultat</h2>
                <p className="text-sm text-slate-500 mt-1">{period}</p>
                <div className="mt-2 h-px bg-slate-200"></div>
            </div>

            {/* 1. Chiffre d'affaires */}
            <div className="mb-4">
                <div className="flex justify-between items-center py-2 px-3 rounded-lg bg-emerald-50 text-sm">
                    <span className="font-semibold text-slate-700">Chiffre d'affaires HT</span>
                    <span className="font-bold text-emerald-700">{fmt(revenueHT)} {CURRENCY}</span>
                </div>
            </div>

            {/* 2. COGS */}
            <div className="mb-4">
                <div className="flex justify-between items-center py-2 px-3 rounded-lg bg-orange-50 text-sm">
                    <span className="font-semibold text-slate-700">− Coût des marchandises vendues (HT)</span>
                    <span className="font-bold text-orange-700">({fmt(cogsHT)}) {CURRENCY}</span>
                </div>
            </div>

            {/* 3. Marge brute */}
            <div className="mb-6">
                <div className={`flex justify-between items-center py-2.5 px-3 rounded-lg border text-sm ${margebrute >= 0 ? 'bg-emerald-100 border-emerald-200' : 'bg-red-100 border-red-200'}`}>
                    <span className="font-bold text-slate-800 uppercase tracking-wide">= Marge brute</span>
                    <div className="text-right">
                        <span className={`font-bold text-base ${margebrute >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{margebrute >= 0 ? '' : '-'}{fmt(Math.abs(margebrute))} {CURRENCY}</span>
                        <span className="block text-xs text-slate-500">{margeBruteRate.toFixed(1)}% du CA</span>
                    </div>
                </div>
            </div>

            <div className="h-px bg-slate-200 mb-6"></div>

            {/* 4. Charges d'exploitation */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-red-500" />
                        − Charges d'exploitation (HT)
                    </h3>
                    <span className="font-bold text-slate-900">({fmt(totalChargesHT)}) {CURRENCY}</span>
                </div>
                {byCategory.length === 0 ? (
                    <p className="text-sm text-slate-400 px-3">Aucune charge enregistrée pour cette période.</p>
                ) : (
                    <div className="space-y-1">
                        {byCategory.map(([cat, amt]) => (
                            <div key={cat} className="flex justify-between items-center py-1.5 px-3 rounded-lg bg-red-50 text-sm">
                                <span className="text-slate-600">{cat}</span>
                                <span className="font-medium text-red-700">{fmt(amt)} {CURRENCY}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="h-px bg-slate-200 mb-6"></div>

            {/* 5. Résultat net */}
            <div className={`flex justify-between items-center p-4 rounded-xl border-2 ${netResult >= 0 ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
                <span className="font-bold text-slate-900 text-base uppercase tracking-wide">= Résultat Net</span>
                <div className="text-right">
                    <span className={`text-2xl font-bold ${netResult >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {netResult >= 0 ? '+' : ''}{fmt(netResult)} {CURRENCY}
                    </span>
                    {revenueHT > 0 && (
                        <span className="block text-xs text-slate-500 mt-0.5">
                            {((netResult / revenueHT) * 100).toFixed(1)}% du CA
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
// ─────────────────────────────────────────────────────────────────────────────

interface AccountingProps {
    sales: Sale[];
    customers: Customer[];
    warehouses: Warehouse[];
    products: Product[];
    companySettings: CompanySettings;
    currentUser: User;
    onRefresh?: () => void;
    charges: Charge[];
    onAddCharge: (charge: Omit<Charge, 'id' | 'createdAt'>) => Promise<void>;
    onUpdateCharge: (id: string, updates: Partial<Charge>) => Promise<void>;
    onDeleteCharge: (id: string) => Promise<void>;
}

const Accounting: React.FC<AccountingProps> = ({ sales, customers, warehouses, products, companySettings, currentUser, onRefresh, charges, onAddCharge, onUpdateCharge, onDeleteCharge }) => {
    const { t } = useLanguage();
    const [subTab, setSubTab] = useState<'ledger' | 'profitability' | 'aging' | 'charges' | 'pnl'>('ledger');

    // Dates
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [taxFilter, setTaxFilter] = useState<'ALL' | 'WITH_TAX' | 'WITHOUT_TAX'>('ALL');
    const [sourceFilter, setSourceFilter] = useState<'ALL' | SaleSource>('ALL');
    const [documentTypeFilter, setDocumentTypeFilter] = useState<'ALL' | DocumentType>('ALL');
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<'ALL' | 'paid' | 'check_pending' | 'partial' | 'unpaid'>('ALL');
    const [saleStatusFilter, setSaleStatusFilter] = useState<'ALL' | 'active' | 'cancelled'>('active');

    // Warehouse Filter
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() => {
        // Si el usuario tiene almacén asignado, usar ese; si es Admin/Manager, usar 'ALL'
        if (currentUser.warehouseId) return currentUser.warehouseId;
        return 'ALL';
    });

    // Document View
    const [viewingSale, setViewingSale] = useState<Sale | null>(null);

    // Initialize dates to current quarter start
    useEffect(() => {
        const now = new Date();
        const quarter = Math.floor((now.getMonth() / 3));
        const start = new Date(now.getFullYear(), quarter * 3, 1);
        const end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        
        // Format to YYYY-MM-DD
        const formatDate = (d: Date) => d.toISOString().split('T')[0];
        setStartDate(formatDate(start));
        setEndDate(formatDate(end));
    }, []);

    const setQuarter = (offset: number) => {
        const now = new Date();
        const currentQuarter = Math.floor((now.getMonth() / 3));
        const targetQuarter = currentQuarter + offset;
        
        const start = new Date(now.getFullYear(), targetQuarter * 3, 1);
        const end = new Date(now.getFullYear(), targetQuarter * 3 + 3, 0);
        
        const formatDate = (d: Date) => {
            const offsetDate = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
            return offsetDate.toISOString().split('T')[0];
        };

        setStartDate(formatDate(start));
        setEndDate(formatDate(end));
    };

    // Filter Logic — pass 1: all filters except payment status
    const baseSales = useMemo(() => {
        return sales.filter(s => {
            const saleDate = new Date(s.date);
            const start = startDate ? new Date(startDate) : new Date(0);
            const end = endDate ? new Date(endDate) : new Date(8640000000000000);
            end.setHours(23, 59, 59, 999);

            const inDateRange = saleDate >= start && saleDate <= end;

            let matchesTax = true;
            if (taxFilter === 'WITH_TAX') matchesTax = s.taxRate > 0;
            if (taxFilter === 'WITHOUT_TAX') matchesTax = s.taxRate === 0;

            let matchesWarehouse = true;
            if (selectedWarehouseId !== 'ALL') matchesWarehouse = s.warehouseId === selectedWarehouseId;

            let matchesSource = true;
            if (sourceFilter !== 'ALL') matchesSource = s.source === sourceFilter;

            let matchesDocType = true;
            if (documentTypeFilter !== 'ALL') matchesDocType = s.documentType === documentTypeFilter;

            // QUOTEs are never a completed accounting document — always exclude unless
            // the user explicitly selected QUOTE via documentTypeFilter.
            if (documentTypeFilter === 'ALL' && s.documentType === 'QUOTE') return false;

            let matchesSaleStatus = true;
            if (saleStatusFilter === 'active') matchesSaleStatus = s.status !== 'Cancelled' && s.returnStatus !== 'full';
            if (saleStatusFilter === 'cancelled') matchesSaleStatus = s.status === 'Cancelled';

            return inDateRange && matchesTax && matchesWarehouse && matchesSource && matchesDocType && matchesSaleStatus;
        }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [sales, startDate, endDate, taxFilter, selectedWarehouseId, sourceFilter, documentTypeFilter, saleStatusFilter]);

    // Payment status breakdown per invoice (computed from baseSales)
    const paymentStats = useMemo(() => {
        return baseSales.map(s => {
            const payments = s.payments || [];
            const pendingCheckAmount = payments
                .filter(p => p.method === 'Check' && p.paymentStatus === 'Pending')
                .reduce((sum, p) => sum + p.amount, 0);
            const encaisse = payments
                .filter(p => p.method !== 'Check' || p.paymentStatus === 'Cashed')
                .reduce((sum, p) => sum + p.amount, 0);
            const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
            const creance = Math.max(0, s.totalAmount - totalPaid - (s.creditedAmount || 0));

            let status: 'paid' | 'check_pending' | 'partial' | 'unpaid';
            const effectivePaid = (s.amountPaid || 0) + (s.creditedAmount || 0);
            if (effectivePaid >= s.totalAmount && pendingCheckAmount === 0) {
                status = 'paid';
            } else if (pendingCheckAmount > 0) {
                status = 'check_pending';
            } else if (s.amountPaid > 0 || (s.creditedAmount || 0) > 0) {
                status = 'partial';
            } else {
                status = 'unpaid';
            }

            return { saleId: s.id, pendingCheckAmount, encaisse, creance, status };
        });
    }, [baseSales]);

    // Pass 2: apply payment status filter
    const filteredSales = useMemo(() => {
        if (paymentStatusFilter === 'ALL') return baseSales;
        return baseSales.filter(s => {
            const stat = paymentStats.find(p => p.saleId === s.id);
            return stat?.status === paymentStatusFilter;
        });
    }, [baseSales, paymentStats, paymentStatusFilter]);

    // subtotalAmount IS already HT
    const totalHT = filteredSales.reduce((sum, s) => sum + (s.subtotalAmount || 0), 0);
    const totalTVA = filteredSales.reduce((sum, s) => sum + (s.taxAmount || 0), 0);
    const totalTTC = filteredSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

    const totalEncaisse          = filteredSales.reduce((sum, s) => { const p = paymentStats.find(x => x.saleId === s.id); return sum + (p?.encaisse || 0); }, 0);
    const totalChequesEnAttente  = filteredSales.reduce((sum, s) => { const p = paymentStats.find(x => x.saleId === s.id); return sum + (p?.pendingCheckAmount || 0); }, 0);
    const totalCreances          = filteredSales.reduce((sum, s) => { const p = paymentStats.find(x => x.saleId === s.id); return sum + (p?.creance || 0); }, 0);
    const totalAvoirs            = filteredSales.reduce((sum, s) => sum + (s.creditedAmount || 0), 0);
    const totalTTCNet            = totalTTC - totalAvoirs;

    // Export Handler
    const handleExportCSV = () => {
        const headers = ["Date", "Invoice Ref", "Customer", "ICE", "Tax ID", "Total HT", "TVA Rate", "TVA Amount", "Total TTC", "Réglé", "Avoir", "Reste", "Statut"];

        const rows = filteredSales.map(s => {
            const customer = customers.find(c => c.id === s.customerId);
            const stats = paymentStats.find(p => p.saleId === s.id)!;
            const statusLabel = stats.status === 'paid' ? 'Payé' : stats.status === 'check_pending' ? 'Chèque en attente' : stats.status === 'partial' ? 'Partiel' : 'Impayé';
            return [
                new Date(s.date).toLocaleDateString(),
                s.invoiceNumber || s.deliveryNoteNumber || s.id,
                `"${s.customerName}"`,
                customer?.ice || '-',
                customer?.taxId || '-',
                s.subtotalAmount.toFixed(2),
                `${(s.taxRate * 100).toFixed(0)}%`,
                s.taxAmount.toFixed(2),
                s.totalAmount.toFixed(2),
                s.amountPaid.toFixed(2),
                (s.creditedAmount || 0).toFixed(2),
                stats.creance.toFixed(2),
                statusLabel
            ].join(",");
        });

        rows.push(`,,,,TOTALS,${totalHT.toFixed(2)},,${totalTVA.toFixed(2)},${totalTTC.toFixed(2)},${totalEncaisse.toFixed(2)},${totalAvoirs.toFixed(2)},${totalCreances.toFixed(2)},`);

        exportToCSV(`COMPTABILITE_${startDate}_${endDate}.csv`, headers, rows);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{t('accounting')}</h1>
                    <p className="text-sm text-slate-500">{t('accounting_desc')}</p>
                </div>
                <div className="flex space-x-2">
                    {subTab === 'ledger' && (
                        <>
                            <button onClick={() => setQuarter(0)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 text-slate-600">
                                {t('quarter_this')}
                            </button>
                            <button onClick={() => setQuarter(-1)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 text-slate-600">
                                {t('quarter_last')}
                            </button>
                            <button
                                onClick={handleExportCSV}
                                className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm font-medium"
                            >
                                <FileSpreadsheet className="w-4 h-4 mr-2" />
                                {t('export_csv')}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-fit">
                <button
                    onClick={() => setSubTab('ledger')}
                    className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${subTab === 'ledger' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Calculator className="w-4 h-4 mr-2" />
                    {t('ledger')}
                </button>
                <button
                    onClick={() => setSubTab('profitability')}
                    className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${subTab === 'profitability' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    {t('profitability')}
                </button>
                <button
                    onClick={() => setSubTab('aging')}
                    className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${subTab === 'aging' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Clock className="w-4 h-4 mr-2" />
                    Créances
                </button>
                <button
                    onClick={() => setSubTab('charges')}
                    className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${subTab === 'charges' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <TrendingDown className="w-4 h-4 mr-2" />
                    Charges
                </button>
                <button
                    onClick={() => setSubTab('pnl')}
                    className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${subTab === 'pnl' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    P&amp;L
                </button>
            </div>

            {subTab === 'profitability' ? (
                <ProductProfitReport sales={baseSales} products={products} />
            ) : subTab === 'aging' ? (
                <AgingReport sales={baseSales} customers={customers} />
            ) : subTab === 'charges' ? (
                <ChargesManager
                    charges={charges}
                    onAdd={onAddCharge}
                    onUpdate={onUpdateCharge}
                    onDelete={onDeleteCharge}
                    currentUser={currentUser}
                />
            ) : subTab === 'pnl' ? (
                <PnLReport
                    sales={baseSales.filter(s => s.status !== 'Cancelled' && s.returnStatus !== 'full')}
                    charges={charges}
                    products={products}
                    startDate={startDate}
                    endDate={endDate}
                />
            ) : (
            <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-lg mr-4">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">{t('total_ht')} (Revenue)</p>
                        <p className="text-xl font-bold text-slate-900">{totalHT.toLocaleString()} <span className="text-sm text-slate-400">{CURRENCY}</span></p>
                    </div>
                </div>
                
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg mr-4">
                        <Calculator className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">{t('total_tva')} (Collected)</p>
                        <p className="text-xl font-bold text-slate-900">{totalTVA.toLocaleString()} <span className="text-sm text-slate-400">{CURRENCY}</span></p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center">
                    <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg mr-4">
                        <Wallet className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">{t('total_ttc')} <span className="text-slate-400 font-normal">(brut)</span></p>
                        <p className="text-xl font-bold text-emerald-700">{totalTTC.toLocaleString()} <span className="text-sm text-slate-400">{CURRENCY}</span></p>
                        {totalAvoirs > 0 && (
                            <p className="text-xs text-slate-500 mt-0.5">Net: <span className="font-bold text-slate-700">{totalTTCNet.toFixed(0)}</span> {CURRENCY}</p>
                        )}
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center">
                    <div className="p-3 bg-slate-100 text-slate-600 rounded-lg mr-4">
                        <FileText className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">{t('invoices_count')}</p>
                        <p className="text-xl font-bold text-slate-900">{filteredSales.length}</p>
                    </div>
                </div>
            </div>

            {/* Payment Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm flex items-center">
                    <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg mr-4">
                        <CheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Encaissé</p>
                        <p className="text-xs text-slate-400 mb-0.5">Espèces + virements + chèques encaissés</p>
                        <p className="text-xl font-bold text-emerald-700">{totalEncaisse.toFixed(2)} <span className="text-sm text-slate-400">{CURRENCY}</span></p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm flex items-center">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-lg mr-4">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Chèques en attente</p>
                        <p className="text-xs text-slate-400 mb-0.5">Chèques reçus non encore encaissés</p>
                        <p className="text-xl font-bold text-blue-700">{totalChequesEnAttente.toFixed(2)} <span className="text-sm text-slate-400">{CURRENCY}</span></p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-orange-200 shadow-sm flex items-center">
                    <div className="p-3 bg-orange-100 text-orange-600 rounded-lg mr-4">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Créances</p>
                        <p className="text-xs text-slate-400 mb-0.5">Montants non encore réglés</p>
                        <p className="text-xl font-bold text-orange-700">{totalCreances.toFixed(2)} <span className="text-sm text-slate-400">{CURRENCY}</span></p>
                    </div>
                </div>

                {totalAvoirs > 0 && (
                <div className="bg-white p-4 rounded-xl border border-violet-200 shadow-sm flex items-center">
                    <div className="p-3 bg-violet-100 text-violet-600 rounded-lg mr-4">
                        <Undo2 className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Avoirs / Devoluciones</p>
                        <p className="text-xs text-slate-400 mb-0.5">Créditos por devoluciones de mercancía</p>
                        <p className="text-xl font-bold text-violet-700">{totalAvoirs.toFixed(2)} <span className="text-sm text-slate-400">{CURRENCY}</span></p>
                    </div>
                </div>
                )}
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('date_start')}</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('date_end')}</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('tax_filter')}</label>
                    <div className="relative">
                        <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <select
                            value={taxFilter}
                            onChange={(e) => setTaxFilter(e.target.value as any)}
                            className="pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white min-w-[200px]"
                        >
                            <option value="ALL">{t('all_invoices')}</option>
                            <option value="WITH_TAX">{t('with_tax')} (20%)</option>
                            <option value="WITHOUT_TAX">HT / Bons (0%)</option>
                        </select>
                    </div>
                </div>

                {/* Filtre par Entrepôt */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Entrepôt</label>
                    {(currentUser.role === 'Admin' || currentUser.role === 'Manager' || currentUser.role === 'Accountant') ? (
                        // Admin/Manager: Dropdown para filtrar
                        <div className="relative">
                            <Store className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <select
                                value={selectedWarehouseId}
                                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                                className="pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white min-w-[200px]"
                            >
                                <option value="ALL">Todos los almacenes</option>
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        // Usuarios normales: Badge fijo con su almacén
                        <div className="flex items-center px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-700 min-w-[200px]">
                            <Store className="w-4 h-4 mr-2 text-emerald-500" />
                            <span className="font-medium">
                                {warehouses.find(w => w.id === currentUser.warehouseId)?.name || 'Sans entrepôt'}
                            </span>
                        </div>
                    )}
                </div>

                {/* Filtro por Source (POS/B2B) */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('sale_source') || 'Origen'}</label>
                    <div className="relative">
                        <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <select
                            value={sourceFilter}
                            onChange={(e) => setSourceFilter(e.target.value as any)}
                            className="pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white min-w-[180px]"
                        >
                            <option value="ALL">{t('all') || 'Todos'}</option>
                            <option value="POS">🧾 POS (Caisse)</option>
                            <option value="B2B">💼 B2B (Commandes)</option>
                        </select>
                    </div>
                </div>

                {/* Filtro por Document Type */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('document_type') || 'Documento'}</label>
                    <div className="relative">
                        <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <select
                            value={documentTypeFilter}
                            onChange={(e) => setDocumentTypeFilter(e.target.value as any)}
                            className="pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white min-w-[180px]"
                        >
                            <option value="ALL">{t('all') || 'Todos'}</option>
                            <option value="TICKET">🧾 {t('ticket') || 'Ticket'}</option>
                            <option value="INVOICE">📄 {t('invoice') || 'Facture'}</option>
                            <option value="DELIVERY_NOTE">📦 {t('delivery_note') || 'Bono'}</option>
                        </select>
                    </div>
                </div>

                {/* Filtro por Estado de Pago */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">État paiement</label>
                    <div className="relative">
                        <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <select
                            value={paymentStatusFilter}
                            onChange={(e) => setPaymentStatusFilter(e.target.value as any)}
                            className="pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white min-w-[180px]"
                        >
                            <option value="ALL">Tous</option>
                            <option value="paid">✓ Payé</option>
                            <option value="partial">◑ Partiel</option>
                            <option value="check_pending">⏳ Chèque en attente</option>
                            <option value="unpaid">✗ Impayé</option>
                        </select>
                    </div>
                </div>

                {/* Filtro Devoluciones / Annulés */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Statut document</label>
                    <div className="relative">
                        <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <select
                            value={saleStatusFilter}
                            onChange={(e) => setSaleStatusFilter(e.target.value as any)}
                            className="pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white min-w-[180px]"
                        >
                            <option value="ALL">Tous (actifs + annulés)</option>
                            <option value="active">✓ Actifs uniquement</option>
                            <option value="cancelled">↩ Annulés / Retours</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                            <tr>
                                <th className="p-4">Date</th>
                                <th className="p-4">Reference</th>
                                <th className="p-4">{t('customers')}</th>
                                <th className="p-4">TVA%</th>
                                <th className="p-4 text-right">HT</th>
                                <th className="p-4 text-right">TVA</th>
                                <th className="p-4 text-right">TTC</th>
                                <th className="p-4 text-right">Réglé</th>
                                <th className="p-4 text-right">Avoir</th>
                                <th className="p-4 text-right">Reste</th>
                                <th className="p-4 text-center">Statut</th>
                                <th className="p-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredSales.map(s => {
                                const customer = customers.find(c => c.id === s.customerId);
                                const isHT = s.taxRate === 0;
                                const stats = paymentStats.find(p => p.saleId === s.id)!;
                                const reste = Math.max(0, s.totalAmount - s.amountPaid - (s.creditedAmount || 0));
                                return (
                                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 whitespace-nowrap">{new Date(s.date).toLocaleDateString()}</td>
                                        <td className="p-4 font-mono text-xs font-bold text-slate-700">{s.invoiceNumber || s.deliveryNoteNumber || `#${s.id.slice(0, 8)}...`}</td>
                                        <td className="p-4">
                                            <div className="font-medium text-slate-900">{s.customerName}</div>
                                            <div className="text-xs text-slate-500">{customer?.ice ? `ICE: ${customer.ice}` : '-'}</div>
                                        </td>
                                        <td className="p-4">
                                            {isHT ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                                                    HT (0%)
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                                                    20%
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right font-medium">{s.subtotalAmount.toFixed(2)}</td>
                                        <td className="p-4 text-right text-slate-500">{s.taxAmount.toFixed(2)}</td>
                                        <td className="p-4 text-right font-bold text-slate-900">{s.totalAmount.toFixed(2)}</td>
                                        <td className="p-4 text-right text-emerald-700 font-medium">{s.amountPaid.toFixed(2)}</td>
                                        <td className="p-4 text-right text-violet-600 font-medium">{(s.creditedAmount || 0) > 0 ? (s.creditedAmount || 0).toFixed(2) : <span className="text-slate-300">—</span>}</td>
                                        <td className="p-4 text-right text-orange-600 font-medium">{reste > 0 ? reste.toFixed(2) : <span className="text-slate-300">—</span>}</td>
                                        <td className="p-4 text-center">
                                            {stats?.status === 'paid' && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">✓ Payé</span>
                                            )}
                                            {stats?.status === 'check_pending' && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">⏳ Chèque</span>
                                            )}
                                            {stats?.status === 'partial' && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">◑ Partiel</span>
                                            )}
                                            {stats?.status === 'unpaid' && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">✗ Impayé</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <button
                                                onClick={() => setViewingSale(s)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                title="View Invoice"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredSales.length === 0 && (
                                <tr>
                                    <td colSpan={12} className="p-8 text-center text-slate-400">
                                        <p>Aucune facture trouvée pour cette période.</p>
                                        {onRefresh && (
                                            <button
                                                onClick={onRefresh}
                                                className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                                            >
                                                🔄 Actualiser les données
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                            <tr>
                                <td colSpan={4} className="p-4 text-right uppercase text-slate-500 text-xs">Totals</td>
                                <td className="p-4 text-right">{totalHT.toFixed(2)}</td>
                                <td className="p-4 text-right">{totalTVA.toFixed(2)}</td>
                                <td className="p-4 text-right text-emerald-700">{totalTTC.toFixed(2)}</td>
                                <td className="p-4 text-right text-emerald-700">{totalEncaisse.toFixed(2)}</td>
                                <td className="p-4 text-right text-violet-600">{totalAvoirs > 0 ? totalAvoirs.toFixed(2) : <span className="text-slate-300">—</span>}</td>
                                <td className="p-4 text-right text-orange-600">{totalCreances.toFixed(2)}</td>
                                <td></td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Document Viewer */}
            {viewingSale && (
                <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="text-white text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>Chargement du document...</div></div>}>
                    <PrintableDocument
                        sale={viewingSale}
                        type="INVOICE"
                        customer={customers.find(c => c.id === viewingSale.customerId)}
                        warehouse={warehouses.find(w => w.id === viewingSale.warehouseId)}
                        companySettings={companySettings}
                        products={products}
                        onClose={() => setViewingSale(null)}
                    />
                </Suspense>
            )}
            </>
            )}
        </div>
    );
};

export default Accounting;
