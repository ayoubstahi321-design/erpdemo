# 📊 Nuevos Widgets para Dashboard - Código de Implementación

## Instrucciones de Integración

Agregar estos 3 casos al switch en la función `renderWidget()` del archivo `Dashboard.tsx`, después del caso `'chart_cashflow'`:

```typescript
// NUEVO WIDGET 1: Gráfico de Ventas Mensuales (POS vs B2B)
case 'chart_monthly_sales':
    // Preparar datos mensuales
    const monthlySalesData = useMemo(() => {
        const monthlyData: Record<string, { month: string; POS: number; B2B: number; total: number }> = {};

        // Últimos 12 meses
        for (let i = 11; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' });
            monthlyData[key] = { month: key, POS: 0, B2B: 0, total: 0 };
        }

        // Agrupar ventas por mes y source
        filteredSales.forEach(sale => {
            const saleDate = new Date(sale.date);
            const monthKey = saleDate.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' });

            if (monthlyData[monthKey]) {
                const amount = sale.totalAmount || 0;
                if (sale.source === 'POS') {
                    monthlyData[monthKey].POS += amount;
                } else {
                    monthlyData[monthKey].B2B += amount;
                }
                monthlyData[monthKey].total += amount;
            }
        });

        return Object.values(monthlyData);
    }, [filteredSales]);

    return (
        <div className="h-full bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-blue-500" />
                {t('monthly_sales_trend')}
            </h3>
            <div className="flex-1 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlySalesData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" fontSize={11} angle={-45} textAnchor="end" height={80} />
                        <YAxis fontSize={12} />
                        <Tooltip
                            formatter={(value: number) => `${value.toFixed(0)} ${CURRENCY}`}
                            contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="POS" stroke="#3b82f6" strokeWidth={3} name="🧾 POS" />
                        <Line type="monotone" dataKey="B2B" stroke="#10b981" strokeWidth={3} name="💼 B2B" />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );

// NUEVO WIDGET 2: Comparativa POS vs B2B (Pie + Stats)
case 'chart_pos_vs_b2b':
    const posVsB2BData = useMemo(() => {
        const stats = {
            POS: { revenue: 0, count: 0, avgTicket: 0 },
            B2B: { revenue: 0, count: 0, avgTicket: 0 }
        };

        filteredSales.forEach(sale => {
            const amount = sale.totalAmount || 0;
            if (sale.source === 'POS') {
                stats.POS.revenue += amount;
                stats.POS.count += 1;
            } else {
                stats.B2B.revenue += amount;
                stats.B2B.count += 1;
            }
        });

        stats.POS.avgTicket = stats.POS.count > 0 ? stats.POS.revenue / stats.POS.count : 0;
        stats.B2B.avgTicket = stats.B2B.count > 0 ? stats.B2B.revenue / stats.B2B.count : 0;

        const total = stats.POS.revenue + stats.B2B.revenue;
        const pieData = [
            { name: '🧾 POS', value: stats.POS.revenue, percent: total > 0 ? (stats.POS.revenue / total * 100).toFixed(1) : '0', color: '#3b82f6' },
            { name: '💼 B2B', value: stats.B2B.revenue, percent: total > 0 ? (stats.B2B.revenue / total * 100).toFixed(1) : '0', color: '#10b981' }
        ];

        return { pieData, stats };
    }, [filteredSales]);

    return (
        <div className="h-full bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="text-lg font-bold text-slate-900 mb-4">{t('pos_vs_b2b_comparison')}</h3>

            <div className="flex flex-row gap-6">
                {/* Pie Chart */}
                <div className="flex-1">
                    <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                            <Pie
                                data={posVsB2BData.pieData}
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                label={({ percent }) => `${percent}%`}
                            >
                                {posVsB2BData.pieData.map((entry, index) => (
                                    <Cell key={index} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value: number) => `${value.toFixed(0)} ${CURRENCY}`}
                                contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                            />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Stats Cards */}
                <div className="flex-1 space-y-3">
                    {/* POS Stats */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-blue-900">🧾 POS</span>
                            <span className="text-xs text-blue-600">{posVsB2BData.stats.POS.count} ventas</span>
                        </div>
                        <div className="text-2xl font-black text-blue-600">
                            {posVsB2BData.stats.POS.revenue.toFixed(0)} {CURRENCY}
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                            Promedio: {posVsB2BData.stats.POS.avgTicket.toFixed(0)} {CURRENCY}
                        </div>
                    </div>

                    {/* B2B Stats */}
                    <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-emerald-900">💼 B2B</span>
                            <span className="text-xs text-emerald-600">{posVsB2BData.stats.B2B.count} ventas</span>
                        </div>
                        <div className="text-2xl font-black text-emerald-600">
                            {posVsB2BData.stats.B2B.revenue.toFixed(0)} {CURRENCY}
                        </div>
                        <div className="text-xs text-emerald-600 mt-1">
                            Promedio: {posVsB2BData.stats.B2B.avgTicket.toFixed(0)} {CURRENCY}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

// NUEVO WIDGET 3: Top Productos (Gráfico de Barras)
case 'chart_top_products':
    const topProductsChartData = useMemo(() => {
        const productSales: Record<string, { product: string; quantity: number; revenue: number }> = {};

        filteredSales.forEach(sale => {
            if (sale.items) {
                sale.items.forEach(item => {
                    const product = products.find(p => p.id === item.productId);
                    if (product) {
                        if (!productSales[product.id]) {
                            productSales[product.id] = { product: product.name, quantity: 0, revenue: 0 };
                        }
                        productSales[product.id].quantity += item.quantity;
                        productSales[product.id].revenue += item.total;
                    }
                });
            }
        });

        return Object.values(productSales)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);
    }, [filteredSales, products]);

    return (
        <div className="h-full bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
                <Package className="w-5 h-5 mr-2 text-amber-500" />
                {t('top_products_chart')}
            </h3>
            <div className="flex-1 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProductsChartData} layout="vertical" margin={{ left: 120 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" fontSize={11} />
                        <YAxis type="category" dataKey="product" fontSize={11} width={110} />
                        <Tooltip
                            formatter={(value: number, name: string) => {
                                if (name === 'revenue') return [`${value.toFixed(0)} ${CURRENCY}`, 'Ingresos'];
                                return [`${value}`, 'Cantidad'];
                            }}
                            contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                        />
                        <Legend />
                        <Bar dataKey="revenue" fill="#f59e0b" name="Ingresos" radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
```

## Ubicación en el Código

Estos 3 casos deben agregarse en el archivo:
**`src/components/Dashboard.tsx`**

Dentro de la función `renderWidget()`, en el switch statement, después de:
```typescript
case 'chart_cashflow':
    // ... código existente ...
    return ( ... );
```

Agregar los 3 nuevos casos antes de:
```typescript
case 'list_payment_alerts':
```

## ✅ Checklist de Integración

1. [ ] Abrir `src/components/Dashboard.tsx`
2. [ ] Buscar la función `renderWidget()`
3. [ ] Encontrar `case 'chart_cashflow':`
4. [ ] Después del cierre de ese caso, pegar los 3 nuevos casos
5. [ ] Guardar el archivo
6. [ ] Reiniciar el servidor de desarrollo

## 🎨 Colores Usados

- **POS**: `#3b82f6` (Azul)
- **B2B**: `#10b981` (Verde)
- **Top Products**: `#f59e0b` (Ámbar)

## 📊 Widgets Disponibles Después de la Integración

- ✅ `chart_monthly_sales` - Ventas mensuales POS vs B2B (líneas)
- ✅ `chart_pos_vs_b2b` - Comparativa POS vs B2B (pie + stats)
- ✅ `chart_top_products` - Top 10 productos (barras horizontales)

Estos widgets estarán disponibles para que los usuarios los agreguen a su dashboard personalizado usando el botón "Agregar Widget".
