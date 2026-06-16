import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { Sale, Customer, Warehouse, CompanySettings, Product } from '../types';
import { CURRENCY } from '../constants';
import { calculateHT, numberToWordsFr } from '../utils/pricing';

interface PDFInvoiceDocumentProps {
    sale: Sale;
    type: 'INVOICE' | 'DELIVERY_NOTE' | 'QUOTE';
    customer?: Customer;
    warehouse?: Warehouse;
    companySettings: CompanySettings;
    products?: Product[];
    qrCodeDataUrl?: string;
    stampDataUrl?: string;
    signatureBase64?: string;
}

// Component to render the logo in the PDF (250x95 ratio = ~2.63:1)
const LogoPDF = ({ logoBase64, width = 160 }: { logoBase64?: string; width?: number }) => {
    if (!logoBase64) return null;
    return (
        <Image
            src={logoBase64}
            style={{
                width: `${width}pt`,
                height: `${width / 2.63}pt`,
                objectFit: 'contain',
            }}
        />
    );
};

// B&W-friendly styles — no solid fills, uses borders instead
const styles = StyleSheet.create({
    page: {
        padding: 25,
        paddingBottom: 125,
        fontSize: 9,
        fontFamily: 'Helvetica',
    },
    // Header: border frame instead of blue bar
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#1E3A8A',
        borderRadius: 4,
        padding: 12,
    },
    headerLeft: {
        width: '55%',
    },
    headerRight: {
        width: '42%',
        alignItems: 'flex-end',
    },
    companyName: {
        fontSize: 11,
        fontWeight: 'bold',
        marginBottom: 3,
        textTransform: 'uppercase',
    },
    companyInfo: {
        fontSize: 8,
        color: '#334155',
        lineHeight: 1.4,
    },
    docTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1E293B',
        letterSpacing: 2,
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    referenceBox: {
        backgroundColor: '#F8FAFC',
        padding: 8,
        borderRadius: 3,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        minWidth: 140,
    },
    referenceLabel: {
        fontSize: 8,
        color: '#64748B',
        marginBottom: 2,
    },
    referenceValue: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#0F172A',
    },
    divider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 3,
    },
    // Customer section
    customerSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    customerBox: {
        width: '48%',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 3,
        padding: 10,
    },
    customerBoxAlt: {
        width: '48%',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 3,
        padding: 10,
        backgroundColor: '#F8FAFC',
    },
    customerTitle: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#1E3A8A',
        textTransform: 'uppercase',
        marginBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#CBD5E1',
        paddingBottom: 4,
    },
    customerName: {
        fontSize: 11,
        fontWeight: 'bold',
        marginBottom: 3,
    },
    customerDetail: {
        fontSize: 8,
        color: '#1E293B',
        marginBottom: 2,
    },
    // Table — compact rows for more products
    table: {
        marginBottom: 8,
    },
    tableHeader: {
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: '#1E3A8A',
        borderRadius: 3,
        padding: 6,
        backgroundColor: '#FFFFFF',
    },
    tableHeaderCell: {
        fontSize: 8,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        color: '#1E3A8A',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        paddingVertical: 5,
        paddingHorizontal: 6,
    },
    tableRowAlt: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        paddingVertical: 5,
        paddingHorizontal: 6,
        backgroundColor: '#F8FAFC',
    },
    tableCell: {
        fontSize: 8,
    },
    tableCellBold: {
        fontSize: 8,
        fontWeight: 'bold',
    },
    col1: { width: '40%' },
    col2: { width: '15%', textAlign: 'center' },
    col3: { width: '15%', textAlign: 'right' },
    col4: { width: '15%', textAlign: 'right' },
    col5: { width: '15%', textAlign: 'right' },
    // Totals
    totalsSection: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: 8,
    },
    totalsBox: {
        width: '35%',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 3,
        fontSize: 8,
    },
    totalRowBold: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 5,
        fontSize: 11,
        fontWeight: 'bold',
        borderTopWidth: 2,
        borderTopColor: '#0F172A',
        marginTop: 4,
    },
    // Payment section — compact 4-column layout
    paymentSection: {
        marginBottom: 8,
    },
    paymentTitle: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#1E3A8A',
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    paymentTableHeader: {
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 3,
        paddingVertical: 3,
        paddingHorizontal: 4,
        backgroundColor: '#FFFFFF',
    },
    paymentTableHeaderCell: {
        fontSize: 7,
        fontWeight: 'bold',
        color: '#1E3A8A',
        textTransform: 'uppercase',
    },
    paymentTableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        paddingVertical: 2,
        paddingHorizontal: 4,
    },
    paymentTableCell: {
        fontSize: 7,
        color: '#1E293B',
    },
    paymentTableCellBold: {
        fontSize: 7,
        fontWeight: 'bold',
        color: '#0F172A',
    },
    payCol1: { width: '22%' },
    payCol2: { width: '18%' },
    payCol3: { width: '30%' },
    payCol4: { width: '30%', textAlign: 'right' },
    // Footer — fixed at bottom of every page
    footer: {
        position: 'absolute',
        bottom: 20,
        left: 25,
        right: 25,
    },
    bankInfo: {
        borderWidth: 1,
        borderColor: '#CBD5E1',
        padding: 8,
        borderRadius: 3,
        fontSize: 8,
        marginBottom: 8,
        backgroundColor: '#FFFFFF',
    },
});

export const PDFInvoiceDocument: React.FC<PDFInvoiceDocumentProps> = ({
    sale,
    type,
    customer,
    warehouse,
    companySettings,
    products,
    qrCodeDataUrl,
    stampDataUrl,
    signatureBase64,
}) => {
    // Use company-configured currency symbol, fall back to CURRENCY constant
    const currency = companySettings.currencySymbol || CURRENCY;

    const productMap = React.useMemo(() => {
        const map = new Map<string, Product>();
        (products || []).forEach(p => map.set(p.id, p));
        return map;
    }, [products]);
    const remainingBalance = sale.totalAmount - sale.amountPaid - (sale.creditedAmount || 0);

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Logo — centered at top of page 1 */}
                <View style={{ alignItems: 'center', marginBottom: 10 }}>
                    <LogoPDF logoBase64={companySettings.logoBase64} width={160} />
                </View>

                {/* Header — company info left, document title + reference right */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.companyName}>{companySettings.name}</Text>
                        <Text style={styles.companyInfo}>{companySettings.address}</Text>
                        <Text style={styles.companyInfo}>{companySettings.city}, {companySettings.country}</Text>
                        <Text style={styles.companyInfo}>Tél: {companySettings.phone}  |  {companySettings.email}</Text>
                        <View style={{ marginTop: 5, paddingTop: 4, borderTopWidth: 0.5, borderTopColor: '#CBD5E1' }}>
                            <Text style={[styles.companyInfo, { fontWeight: 'bold', color: '#0F172A' }]}>
                                ICE: {companySettings.ice}  |  IF: {companySettings.if}
                            </Text>
                            <Text style={styles.companyInfo}>
                                RC: {companySettings.rc}  |  Patente: {companySettings.patente}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.headerRight}>
                        <Text style={[styles.docTitle, type !== 'INVOICE' ? { fontSize: 16 } : {}]}>
                            {type === 'INVOICE' ? 'FACTURE' : type === 'QUOTE' ? 'DEVIS' : 'BON DE LIVRAISON'}
                        </Text>
                        <View style={styles.referenceBox}>
                            <Text style={styles.referenceLabel}>Référence</Text>
                            <Text style={styles.referenceValue}>
                                {sale.invoiceNumber || sale.deliveryNoteNumber || `#${sale.id.slice(0, 8).toUpperCase()}`}
                            </Text>
                            <View style={styles.divider} />
                            <Text style={styles.referenceLabel}>Date</Text>
                            <Text style={[styles.referenceValue, { fontSize: 10 }]}>
                                {new Date(sale.date).toLocaleDateString('fr-FR')}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Customer Info */}
                <View style={styles.customerSection}>
                    <View style={styles.customerBox}>
                        <Text style={styles.customerTitle}>Facturer à (Client)</Text>
                        <Text style={styles.customerName}>{customer?.name || sale.customerName}</Text>
                        <Text style={styles.customerDetail}>{customer?.address || 'Adresse non spécifiée'}</Text>
                        {customer?.city ? <Text style={styles.customerDetail}>{customer.city}</Text> : null}
                        {customer?.phone ? <Text style={styles.customerDetail}>Tél: {customer.phone}</Text> : null}
                        {customer?.type === 'Professional' && (
                            <>
                                <Text style={[styles.customerDetail, { marginTop: 4 }]}>
                                    ICE: {customer.ice || '---'}
                                </Text>
                                {customer.taxId && (
                                    <Text style={styles.customerDetail}>
                                        IF / Patente: {customer.taxId}
                                    </Text>
                                )}
                            </>
                        )}
                    </View>
                    <View style={styles.customerBoxAlt}>
                        <Text style={styles.customerTitle}>Adresse de Livraison</Text>
                        <Text style={styles.customerDetail}>{customer?.name || sale.customerName}</Text>
                        <Text style={styles.customerDetail}>
                            {customer?.address || 'Idem adresse de facturation'}
                        </Text>
                        {customer?.city ? <Text style={styles.customerDetail}>{customer.city}</Text> : null}
                        {warehouse && (
                            <Text style={[styles.customerDetail, { marginTop: 6, fontStyle: 'italic' }]}>
                                Expédié depuis: {warehouse.name} ({warehouse.location})
                            </Text>
                        )}
                    </View>
                </View>

                {/* Items Table — compact for more products */}
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, styles.col1]}>Description / Article</Text>
                        <Text style={[styles.tableHeaderCell, styles.col2]}>Qté</Text>
                        <Text style={[styles.tableHeaderCell, styles.col3]}>
                            {type === 'INVOICE' ? 'P.U. HT' : 'P.U. TTC'}
                        </Text>
                        <Text style={[styles.tableHeaderCell, styles.col4]}>Remise</Text>
                        <Text style={[styles.tableHeaderCell, styles.col5]}>
                            {type === 'INVOICE' ? 'Total HT' : 'Total TTC'}
                        </Text>
                    </View>
                    {sale.items.map((item, idx) => {
                        const product = productMap.get(item.productId);
                        const packLabel = product
                            ? `${product.packSize}${product.unit}`
                            : null;
                        const unitPriceHT = calculateHT(item.unitPrice, sale.taxRate);
                        const totalHT = calculateHT(item.total, sale.taxRate);
                        const multiplier = item.sellMode === 'box' ? (item.unitsPerBox || 1) : 1;
                        // P.U. displayed per commercial unit (colis if box mode, unit otherwise)
                        const displayPU = type === 'INVOICE'
                            ? (unitPriceHT * multiplier)
                            : (item.unitPrice * multiplier);
                        return (
                        <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt} wrap={false}>
                            <View style={styles.col1}>
                                <Text style={styles.tableCellBold}>
                                    {item.productName}{packLabel ? ` ${packLabel}` : ''}
                                </Text>
                                {item.sellMode === 'box' && (item.unitsPerBox || 1) > 1 && (
                                    <Text style={{ fontSize: 7, color: '#64748B', marginTop: 1 }}>
                                        {item.unitsPerBox || 1} uds/colis
                                    </Text>
                                )}
                            </View>
                            {/* Quantité — unités ou colis avec contenu */}
                            <View style={styles.col2}>
                                <Text style={[styles.tableCellBold, { textAlign: 'center' }]}>
                                    {item.sellMode === 'box'
                                        ? `${item.quantity} colis`
                                        : `${item.quantity} uds`}
                                </Text>
                                {item.sellMode === 'box' && (item.unitsPerBox || 1) > 1 && (
                                    <Text style={{ fontSize: 6, color: '#64748B', textAlign: 'center', marginTop: 1 }}>
                                        {`(${item.unitsPerBox} uds/col)`}
                                    </Text>
                                )}
                            </View>
                            {/* P.U. HT + P.U. TTC dessous */}
                            <View style={styles.col3}>
                                <Text style={styles.tableCell}>
                                    {`${displayPU.toFixed(2)} ${currency}`}
                                </Text>
                                {type === 'INVOICE' && (
                                    <Text style={{ fontSize: 6, color: '#94A3B8', marginTop: 1 }}>
                                        {`(TTC: ${(displayPU * (1 + (sale.taxRate ?? 0.20))).toFixed(2)})`}
                                    </Text>
                                )}
                            </View>
                            {/* Remise */}
                            <Text style={[styles.tableCell, styles.col4, { color: '#DC2626' }]}>
                                {(() => {
                                    if (type === 'INVOICE') {
                                        const grossHT = calculateHT(item.unitPrice * item.quantity * multiplier, sale.taxRate ?? 0.20);
                                        const remiseHT = Math.round((grossHT - totalHT) * 100) / 100;
                                        return remiseHT > 0.005 ? `-${remiseHT.toFixed(2)}` : '-';
                                    } else {
                                        const grossTTC = item.unitPrice * item.quantity * multiplier;
                                        const remiseTTC = Math.round((grossTTC - item.total) * 100) / 100;
                                        return remiseTTC > 0.005 ? `-${remiseTTC.toFixed(2)}` : '-';
                                    }
                                })()}
                            </Text>
                            {/* Total HT + Total TTC dessous */}
                            <View style={styles.col5}>
                                <Text style={styles.tableCellBold}>
                                    {type === 'INVOICE' ? totalHT.toFixed(2) : item.total.toFixed(2)}
                                </Text>
                                {type === 'INVOICE' && (
                                    <Text style={{ fontSize: 6, color: '#64748B', marginTop: 1 }}>
                                        {`TTC: ${item.total.toFixed(2)}`}
                                    </Text>
                                )}
                            </View>
                        </View>
                        );
                    })}
                </View>

                {/* Totals — Devis (same TTC layout as BL) */}
                {type === 'QUOTE' && (() => {
                    const taxRate = sale.taxRate ?? 0.20;
                    const grossTTC = Math.round(sale.items.reduce((sum, item) => {
                        const mult = item.sellMode === 'box' ? (item.unitsPerBox || 1) : 1;
                        return sum + item.unitPrice * item.quantity * mult;
                    }, 0) * 100) / 100;
                    const itemsTTC = Math.round(sale.items.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
                    const itemRemise = Math.round((grossTTC - itemsTTC) * 100) / 100;
                    const globalDiscountTTC = sale.globalDiscountAmount
                        ? Math.round(sale.globalDiscountAmount * (1 + taxRate) * 100) / 100
                        : 0;
                    const finalTTC = sale.totalAmount;
                    const finalHT = Math.round(finalTTC / (1 + taxRate) * 100) / 100;
                    const finalTVA = Math.round((finalTTC - finalHT) * 100) / 100;
                    const totalRemise = Math.round((grossTTC - finalTTC) * 100) / 100;
                    return (
                        <View style={styles.totalsSection} wrap={false}>
                            <View style={styles.totalsBox}>
                                {totalRemise > 0.005 && (
                                    <>
                                        <View style={styles.totalRow}>
                                            <Text style={{ color: '#64748B', fontSize: 7 }}>Sous-total brut TTC</Text>
                                            <Text style={{ color: '#64748B', fontSize: 7 }}>{grossTTC.toFixed(2)} {currency}</Text>
                                        </View>
                                        {itemRemise > 0.005 && (
                                            <View style={[styles.totalRow, { color: '#DC2626', fontSize: 7 }]}>
                                                <Text>Remise articles</Text>
                                                <Text>-{itemRemise.toFixed(2)} {currency}</Text>
                                            </View>
                                        )}
                                        {globalDiscountTTC > 0.005 && (
                                            <View style={[styles.totalRow, { color: '#DC2626' }]}>
                                                <Text>Remise Globale{sale.globalDiscountType === 'percentage' ? ` (${sale.globalDiscountValue}%)` : ''}</Text>
                                                <Text>-{globalDiscountTTC.toFixed(2)} {currency}</Text>
                                            </View>
                                        )}
                                        <View style={styles.divider} />
                                    </>
                                )}
                                <View style={styles.totalRow}>
                                    <Text>Total H.T.</Text>
                                    <Text>{finalHT.toFixed(2)} {currency}</Text>
                                </View>
                                <View style={styles.totalRow}>
                                    <Text>TVA ({Math.round(taxRate * 100)}%)</Text>
                                    <Text>{finalTVA.toFixed(2)} {currency}</Text>
                                </View>
                                <View style={styles.totalRowBold}>
                                    <Text>Total TTC</Text>
                                    <Text>{finalTTC.toFixed(2)} {currency}</Text>
                                </View>
                            </View>
                        </View>
                    );
                })()}

                {/* Totals — Bon de Livraison */}
                {type === 'DELIVERY_NOTE' && (() => {
                    const taxRate = sale.taxRate ?? 0.20;
                    // Gross = full price before any discount
                    const grossTTC = Math.round(sale.items.reduce((sum, item) => {
                        const mult = item.sellMode === 'box' ? (item.unitsPerBox || 1) : 1;
                        return sum + item.unitPrice * item.quantity * mult;
                    }, 0) * 100) / 100;
                    // Per-item remise (from item.total)
                    const itemsTTC = Math.round(sale.items.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
                    const itemRemise = Math.round((grossTTC - itemsTTC) * 100) / 100;
                    // Global discount converted to TTC
                    const globalDiscountTTC = sale.globalDiscountAmount
                        ? Math.round(sale.globalDiscountAmount * (1 + taxRate) * 100) / 100
                        : 0;
                    // Final total — authoritative (includes all discounts)
                    const finalTTC = sale.totalAmount;
                    const finalHT = Math.round(finalTTC / (1 + taxRate) * 100) / 100;
                    const finalTVA = Math.round((finalTTC - finalHT) * 100) / 100;
                    const totalRemise = Math.round((grossTTC - finalTTC) * 100) / 100;
                    return (
                        <View style={styles.totalsSection} wrap={false}>
                            <View style={styles.totalsBox}>
                                {totalRemise > 0.005 && (
                                    <>
                                        <View style={styles.totalRow}>
                                            <Text style={{ color: '#64748B', fontSize: 7 }}>Sous-total brut TTC</Text>
                                            <Text style={{ color: '#64748B', fontSize: 7 }}>{grossTTC.toFixed(2)} {currency}</Text>
                                        </View>
                                        {itemRemise > 0.005 && (
                                            <View style={[styles.totalRow, { color: '#DC2626', fontSize: 7 }]}>
                                                <Text>Remise articles</Text>
                                                <Text>-{itemRemise.toFixed(2)} {currency}</Text>
                                            </View>
                                        )}
                                        {globalDiscountTTC > 0.005 && (
                                            <View style={[styles.totalRow, { color: '#DC2626' }]}>
                                                <Text>
                                                    Remise Globale{sale.globalDiscountType === 'percentage' ? ` (${sale.globalDiscountValue}%)` : ''}
                                                </Text>
                                                <Text>-{globalDiscountTTC.toFixed(2)} {currency}</Text>
                                            </View>
                                        )}
                                        <View style={styles.divider} />
                                    </>
                                )}
                                <View style={styles.totalRow}>
                                    <Text>Total H.T.</Text>
                                    <Text>{finalHT.toFixed(2)} {currency}</Text>
                                </View>
                                <View style={styles.totalRow}>
                                    <Text>TVA ({Math.round(taxRate * 100)}%)</Text>
                                    <Text>{finalTVA.toFixed(2)} {currency}</Text>
                                </View>
                                <View style={styles.totalRowBold}>
                                    <Text>Total TTC</Text>
                                    <Text>{finalTTC.toFixed(2)} {currency}</Text>
                                </View>
                            </View>
                        </View>
                    );
                })()}

                {/* Totals (Invoice only) */}
                {type === 'INVOICE' && (
                    <View style={styles.totalsSection} wrap={false}>
                        <View style={styles.totalsBox}>
                            {(() => {
                                // Gross HT = sum of (unitPriceHT × qty × multiplier) before any discount
                                const grossHT = Math.round(sale.items.reduce((sum, item) => {
                                    const mult = item.sellMode === 'box' ? (item.unitsPerBox || 1) : 1;
                                    return sum + calculateHT(item.unitPrice * item.quantity * mult, sale.taxRate ?? 0.20);
                                }, 0) * 100) / 100;
                                const totalRemiseHT = Math.round((grossHT - sale.subtotalAmount) * 100) / 100;
                                if (totalRemiseHT < 0.005) return null;
                                return (
                                    <>
                                        <View style={styles.totalRow}>
                                            <Text style={{ color: '#64748B', fontSize: 7 }}>Sous-total brut H.T.</Text>
                                            <Text style={{ color: '#64748B', fontSize: 7 }}>{grossHT.toFixed(2)} {currency}</Text>
                                        </View>
                                        <View style={[styles.totalRow, { color: '#DC2626', fontSize: 7 }]}>
                                            <Text>Total Remise</Text>
                                            <Text>-{totalRemiseHT.toFixed(2)} {currency}</Text>
                                        </View>
                                        <View style={styles.divider} />
                                    </>
                                );
                            })()}
                            {sale.globalDiscountAmount && sale.globalDiscountAmount > 0 && (
                                <>
                                    <View style={[styles.totalRow, { color: '#DC2626' }]}>
                                        <Text>
                                            Remise Globale
                                            {sale.globalDiscountType === 'percentage' ? ` (${sale.globalDiscountValue}%)` : ''}
                                        </Text>
                                        <Text>-{sale.globalDiscountAmount.toFixed(2)} {currency}</Text>
                                    </View>
                                    <View style={styles.divider} />
                                </>
                            )}
                            <View style={styles.totalRow}>
                                <Text>Total H.T.</Text>
                                <Text>{sale.subtotalAmount.toFixed(2)} {currency}</Text>
                            </View>
                            <View style={styles.totalRow}>
                                <Text>TVA ({sale.taxRate * 100}%)</Text>
                                <Text>{sale.taxAmount.toFixed(2)} {currency}</Text>
                            </View>
                            <View style={styles.totalRowBold}>
                                <Text>Total TTC</Text>
                                <Text>{sale.totalAmount.toFixed(2)} {currency}</Text>
                            </View>
                            {(sale.creditedAmount || 0) > 0 && (
                                <View style={[styles.totalRow, { color: '#DC2626', fontSize: 7 }]}>
                                    <Text>Avoirs / Retours</Text>
                                    <Text>-{(sale.creditedAmount || 0).toFixed(2)} {currency}</Text>
                                </View>
                            )}
                            <View style={styles.totalRow}>
                                <Text>Déjà réglé</Text>
                                <Text style={{ color: '#059669' }}>{sale.amountPaid.toFixed(2)} {currency}</Text>
                            </View>
                            <View style={[styles.totalRow, { fontWeight: 'bold', fontSize: 9 }]}>
                                <Text>Reste à Payer</Text>
                                <Text>{remainingBalance.toFixed(2)} {currency}</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Volume Discount Savings Banner — shown when items have fixed discounts (new tier system) */}
                {type !== 'QUOTE' && (() => {
                    const volumeSavingsTTC = Math.round(sale.items.reduce((sum, item) => {
                        if (item.discountType !== 'fixed' || (item.discount ?? 0) <= 0) return sum;
                        const unitsQty = item.quantity * (item.sellMode === 'box' ? (item.unitsPerBox || 1) : 1);
                        return sum + item.discount * unitsQty;
                    }, 0) * 100) / 100;
                    if (volumeSavingsTTC < 0.01) return null;
                    return (
                        <View wrap={false} style={{
                            marginTop: 10,
                            borderWidth: 1.5,
                            borderColor: '#16A34A',
                            borderRadius: 4,
                            padding: 10,
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}>
                            <View>
                                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#15803D' }}>
                                    Remise Fidélité
                                </Text>
                                <Text style={{ fontSize: 7, color: '#475569', marginTop: 3 }}>
                                    Appliquée sur cette commande
                                </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ fontSize: 7, color: '#475569' }}>Vous avez économisé</Text>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#16A34A' }}>
                                    {volumeSavingsTTC.toFixed(2)} {currency}
                                </Text>
                            </View>
                        </View>
                    );
                })()}

                {/* Conditions de paiement — INVOICE only */}
                {type === 'INVOICE' && (() => {
                    const hasDeferredPayment = sale.payments?.some(p => p.method === 'Check' || p.method === 'Traite');
                    const latestDueDate = hasDeferredPayment
                        ? sale.payments
                            ?.filter(p => p.dueDate)
                            .sort((a, b) => new Date(b.dueDate!).getTime() - new Date(a.dueDate!).getTime())[0]?.dueDate
                        : null;
                    const isPaid = sale.paymentStatus === 'Paid';
                    const hasBalance = remainingBalance > 0.005;
                    const label = isPaid
                        ? 'Paiement reçu — Comptant'
                        : hasDeferredPayment && latestDueDate
                            ? `Paiement différé — Échéance : ${new Date(latestDueDate).toLocaleDateString('fr-FR')}`
                            : hasBalance
                                ? `Solde à régler : ${remainingBalance.toFixed(2)} ${currency} TTC`
                                : 'Paiement à réception de facture';
                    return (
                        <View wrap={false} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 4, borderTopWidth: 0.5, borderTopColor: '#E2E8F0' }}>
                            <Text style={{ fontSize: 7, color: '#475569', fontStyle: 'italic' }}>
                                Conditions de paiement :
                            </Text>
                            <Text style={{ fontSize: 7, fontWeight: 'bold', color: isPaid ? '#16A34A' : hasBalance ? '#DC2626' : '#0F172A' }}>
                                {label}
                            </Text>
                        </View>
                    );
                })()}

                {/* Payment Details — compact 4-column layout */}
                {sale.payments && sale.payments.length > 0 && (
                    <View style={styles.paymentSection}>
                        <Text style={styles.paymentTitle}>Détails de Paiement</Text>
                        <View style={styles.paymentTableHeader} wrap={false}>
                            <Text style={[styles.paymentTableHeaderCell, styles.payCol1]}>Méthode</Text>
                            <Text style={[styles.paymentTableHeaderCell, styles.payCol2]}>Date</Text>
                            <Text style={[styles.paymentTableHeaderCell, styles.payCol3]}>Détails</Text>
                            <Text style={[styles.paymentTableHeaderCell, styles.payCol4]}>Montant</Text>
                        </View>
                        {sale.payments.map((payment, idx) => {
                            const methodLabel = payment.method === 'Cash' ? 'Espèces' :
                                payment.method === 'Check' ? 'Chèque' :
                                payment.method === 'Traite' ? 'Traite' :
                                payment.method === 'Bank Transfer' ? 'Virement' :
                                payment.method === 'Credit Card' ? 'CB' : payment.method;
                            const details: string[] = [];
                            if ((payment.method === 'Check' || payment.method === 'Traite') && payment.checkNumber)
                                details.push(`N°${payment.checkNumber}`);
                            if ((payment.method === 'Check' || payment.method === 'Traite') && payment.dueDate)
                                details.push(`Éch: ${new Date(payment.dueDate).toLocaleDateString('fr-FR')}`);
                            if (payment.reference)
                                details.push(`Réf: ${payment.reference}`);
                            if (payment.paymentStatus && payment.paymentStatus !== 'Cashed')
                                details.push(payment.paymentStatus === 'Pending' ? 'Attente' : payment.paymentStatus === 'Bounced' ? 'Impayé' : '');
                            return (
                                <View key={payment.id || idx} style={styles.paymentTableRow} wrap={false}>
                                    <Text style={[styles.paymentTableCellBold, styles.payCol1]}>{methodLabel}</Text>
                                    <Text style={[styles.paymentTableCell, styles.payCol2]}>
                                        {new Date(payment.date).toLocaleDateString('fr-FR')}
                                    </Text>
                                    <Text style={[styles.paymentTableCell, styles.payCol3, { fontSize: 6 }]}>
                                        {details.filter(Boolean).join(' • ') || '-'}
                                    </Text>
                                    <Text style={[styles.paymentTableCellBold, styles.payCol4, { color: '#059669' }]}>
                                        {payment.amount.toFixed(2)} {currency}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* ANNULÉ watermark — facture totalement remboursée/avoir */}
                {(sale.creditedAmount || 0) >= sale.totalAmount && sale.totalAmount > 0 && (
                    <View fixed style={{
                        position: 'absolute',
                        top: 290,
                        left: 40,
                        transform: 'rotate(-32deg)',
                    }}>
                        <Text style={{
                            fontSize: 88,
                            fontWeight: 'bold',
                            color: '#DC2626',
                            opacity: 0.13,
                            letterSpacing: 6,
                        }}>
                            ANNULÉ
                        </Text>
                    </View>
                )}

                {/* RÉGLÉ watermark — fixed so it appears on every page when paid */}
                {sale.paymentStatus === 'Paid' && !((sale.creditedAmount || 0) >= sale.totalAmount && sale.totalAmount > 0) && (
                    <View fixed style={{
                        position: 'absolute',
                        top: 310,
                        left: 55,
                        transform: 'rotate(-32deg)',
                    }}>
                        <Text style={{
                            fontSize: 88,
                            fontWeight: 'bold',
                            color: '#16A34A',
                            opacity: 0.13,
                            letterSpacing: 6,
                        }}>
                            RÉGLÉ
                        </Text>
                    </View>
                )}

                {/* Page number — fixed, bottom right of every page */}
                <Text
                    fixed
                    style={{ fontSize: 6, color: '#94A3B8', textAlign: 'right', position: 'absolute', bottom: 10, right: 25 }}
                    render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
                />

                {/* Continuation header — pages 2+ only, fits inside the 25pt top padding */}
                <View
                    fixed
                    style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
                    render={({ pageNumber, ...rest }: any) => {
                        const totalPages = rest.totalPages;
                        if (pageNumber === 1) return null;
                        return (
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingHorizontal: 25,
                            paddingVertical: 5,
                            backgroundColor: '#F1F5F9',
                            borderBottomWidth: 0.5,
                            borderBottomColor: '#94A3B8',
                        }}>
                            <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#1E293B' }}>
                                {companySettings.name}
                            </Text>
                            <Text style={{ fontSize: 7.5, color: '#475569' }}>
                                {`${type === 'INVOICE' ? 'FACTURE' : type === 'QUOTE' ? 'DEVIS' : 'BON DE LIVRAISON'} ${sale.invoiceNumber || sale.deliveryNoteNumber || `#${sale.id.slice(0, 8).toUpperCase()}`} — Suite (${pageNumber}/${totalPages})`}
                            </Text>
                        </View>
                        );
                    }}
                />

                {/* Footer — QR + Arrêté + bank + signature + legal — fixed at bottom every page */}
                <View fixed style={styles.footer}>
                    {/* Arrêté line — INVOICE only */}
                    {type === 'INVOICE' && (
                        <Text style={{ fontSize: 7, fontStyle: 'italic', color: '#1E293B', marginBottom: 4 }}>
                            {'Arrêté la présente facture à la somme de : '}
                            {numberToWordsFr(sale.totalAmount).toUpperCase()}
                            {' TTC'}
                        </Text>
                    )}

                    {/* Row: QR (left) | Bank info (center) | Signature+Stamp (right) */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'stretch', marginBottom: 6 }}>
                        {/* QR code — left */}
                        <View style={{
                            width: qrCodeDataUrl ? '18%' : '0%',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: qrCodeDataUrl ? 1 : 0,
                            borderColor: '#CBD5E1',
                            borderRadius: 3,
                            padding: qrCodeDataUrl ? 4 : 0,
                        }}>
                            {qrCodeDataUrl && (
                                <>
                                    <Image src={qrCodeDataUrl} style={{ width: 52, height: 52 }} />
                                    <Text style={{ fontSize: 5, color: '#94A3B8', marginTop: 2 }}>Vérifier</Text>
                                </>
                            )}
                        </View>

                        {/* Bank info — center (INVOICE only) */}
                        {type === 'INVOICE' && (
                            <View style={{
                                width: qrCodeDataUrl ? '40%' : '58%',
                                borderWidth: 1,
                                borderColor: '#CBD5E1',
                                borderRadius: 3,
                                padding: 6,
                                justifyContent: 'center',
                                marginHorizontal: 4,
                            }}>
                                <Text style={{ fontWeight: 'bold', fontSize: 7, marginBottom: 2 }}>Informations Bancaires (RIB):</Text>
                                <Text style={{ fontSize: 7 }}>Banque: {companySettings.bankName}</Text>
                                <Text style={{ fontSize: 7, marginTop: 2 }}>{companySettings.rib}</Text>
                            </View>
                        )}

                        {/* Signature + Stamp — right */}
                        <View style={{
                            width: type === 'INVOICE' ? (qrCodeDataUrl ? '40%' : '40%') : (qrCodeDataUrl ? '80%' : '100%'),
                            borderWidth: 1,
                            borderColor: '#CBD5E1',
                            borderRadius: 3,
                            padding: 6,
                            position: 'relative',
                            justifyContent: 'flex-end',
                            minHeight: 65,
                        }}>
                            {type === 'INVOICE' ? (
                                <>
                                    <Text style={{ fontSize: 6, fontStyle: 'italic', color: '#475569', marginBottom: 2 }}>Lu et approuvé</Text>
                                    {/* Company signature + stamp only on fully paid invoices */}
                                    {remainingBalance <= 0 && signatureBase64 && (
                                        <View style={{ alignItems: 'center' }}>
                                            <Image src={signatureBase64} style={{ width: 120, height: 52, objectFit: 'contain' }} />
                                        </View>
                                    )}
                                    {remainingBalance <= 0 && stampDataUrl && (
                                        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
                                            <Image src={stampDataUrl} style={{ width: 72, height: 72 }} />
                                        </View>
                                    )}
                                    <View style={{ borderBottomWidth: 0.5, borderColor: '#64748B', marginTop: remainingBalance <= 0 && signatureBase64 ? 2 : 30, marginRight: 10 }} />
                                    <Text style={{ fontSize: 6, color: '#64748B', marginTop: 2 }}>Cachet et Signature</Text>
                                </>
                            ) : type === 'QUOTE' ? (
                                <>
                                    <Text style={{ fontSize: 6, fontStyle: 'italic', color: '#475569', marginBottom: 2 }}>Bon pour accord</Text>
                                    <View style={{ borderBottomWidth: 0.5, borderColor: '#64748B', marginTop: 35, marginRight: 10 }} />
                                    <Text style={{ fontSize: 6, color: '#64748B', marginTop: 2 }}>Signature et cachet du client</Text>
                                </>
                            ) : (
                                <>
                                    {/* Bon de livraison: client reception signature */}
                                    <Text style={{ fontSize: 6, fontStyle: 'italic', color: '#475569', marginBottom: 2 }}>Marchandises reçues en bon état</Text>
                                    <View style={{ borderBottomWidth: 0.5, borderColor: '#64748B', marginTop: 35, marginRight: 10 }} />
                                    <Text style={{ fontSize: 6, color: '#64748B', marginTop: 2 }}>Signature du réceptionnaire</Text>
                                </>
                            )}
                        </View>
                    </View>

                    {/* Legal / validity text */}
                    <Text style={{ fontSize: 6, color: '#64748B', fontStyle: 'italic', textAlign: 'center', marginTop: 6 }}>
                        {type === 'QUOTE'
                            ? 'Ce devis est valable 30 jours à compter de sa date d\'émission. Hors taxes applicables sauf mention contraire.'
                            : 'Tout retard de paiement entraîne des pénalités conformément à la loi 15-95 formant Code de Commerce.'}
                    </Text>

                </View>
            </Page>
        </Document>
    );
};
