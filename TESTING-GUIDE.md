# 🧪 GUÍA COMPLETA DE TESTING - AZMOL STOCKERP

## 📋 PLAN DE TESTING PARA USO INTERNO

### **Objetivo**: Garantizar 100% de funcionalidad antes de uso diario

---

## 1️⃣ **TESTS AUTOMÁTICOS** (Ya configurados)

### **Ejecutar Tests**
```bash
# Todos los tests
npm run test

# Con cobertura
npm run test:coverage

# Modo watch (desarrollo)
npm run test -- --watch

# UI interactiva
npm run test:ui
```

### **Meta de Cobertura**
- ✅ 70% líneas de código
- ✅ 70% funciones
- ✅ 65% branches
- 🎯 80% para servicios críticos (supabaseService, authService)

---

## 2️⃣ **TESTING MANUAL CRÍTICO** (Checklist)

### **A. AUTENTICACIÓN** 🔐
- [ ] **Login exitoso** con usuario admin
- [ ] **Login exitoso** con usuario manager
- [ ] **Login exitoso** con usuario sales
- [ ] **Login fallido** con credenciales incorrectas
- [ ] **Logout** y verificar redirección
- [ ] **Session persistence** (recargar página sin perder sesión)
- [ ] **Session expiration** (esperar 1 hora o forzar)
- [ ] **RLS** - Manager no puede ver datos de admin

### **B. GESTIÓN DE PRODUCTOS** 📦
- [ ] **Crear producto nuevo** con todos los campos
- [ ] **Crear producto** con imagen
- [ ] **Editar producto** existente
- [ ] **Eliminar producto** (verificar que no esté en ventas)
- [ ] **Buscar producto** por nombre/SKU
- [ ] **Filtrar productos** por categoría
- [ ] **Actualizar stock** manualmente
- [ ] **Verificar stock levels** por almacén
- [ ] **Producto con stock bajo** aparece en alertas
- [ ] **Importar productos** desde CSV

### **C. GESTIÓN DE VENTAS** 💰
- [ ] **Crear venta** con 1 producto
- [ ] **Crear venta** con múltiples productos
- [ ] **Aplicar descuento** por línea
- [ ] **Aplicar descuento global**
- [ ] **Aplicar impuesto personalizado** (custom_tax_rate)
- [ ] **Venta a crédito** (payment_status: pending)
- [ ] **Venta contado** (payment_status: paid)
- [ ] **Registrar pago parcial**
- [ ] **Registrar pago completo**
- [ ] **Verificar que stock se descuenta** después de venta
- [ ] **Cancelar venta** y verificar que stock se restaura
- [ ] **Imprimir factura** (PDF)
- [ ] **Generar QR code** en factura

### **D. PUNTO DE VENTA (POS)** 🛒
- [ ] **Escanear/buscar producto**
- [ ] **Agregar producto al carrito**
- [ ] **Modificar cantidad** en carrito
- [ ] **Eliminar producto** del carrito
- [ ] **Aplicar descuento**
- [ ] **Seleccionar cliente**
- [ ] **Crear cliente nuevo** desde POS
- [ ] **Finalizar venta contado**
- [ ] **Finalizar venta crédito**
- [ ] **Verificar stock actualizado** después de venta
- [ ] **Imprimir ticket** inmediatamente

### **E. TRANSFERENCIAS ENTRE ALMACENES** 🚚
- [ ] **Crear transferencia** de Almacén A → B
- [ ] **Verificar stock** se descuenta en origen
- [ ] **Aprobar transferencia** (Manager/Admin)
- [ ] **Verificar stock** se suma en destino después de aprobar
- [ ] **Cancelar transferencia** pendiente
- [ ] **Ver historial** de transferencias
- [ ] **Filtrar transferencias** por almacén

### **F. DEVOLUCIONES** ↩️
- [ ] **Crear devolución** de venta existente
- [ ] **Devolución parcial** (algunos productos)
- [ ] **Devolución total** (todos los productos)
- [ ] **Verificar stock** se restaura después de devolución
- [ ] **Verificar ajuste financiero** en reportes
- [ ] **Devolución con reembolso**
- [ ] **Devolución sin reembolso** (crédito)

### **G. CLIENTES** 👥
- [ ] **Crear cliente nuevo**
- [ ] **Editar cliente** existente
- [ ] **Eliminar cliente** sin ventas
- [ ] **No poder eliminar cliente** con ventas
- [ ] **Buscar cliente** por nombre/teléfono
- [ ] **Ver historial de ventas** del cliente
- [ ] **Ver deuda pendiente** del cliente

### **H. ALMACENES** 🏢
- [ ] **Crear almacén nuevo**
- [ ] **Editar almacén**
- [ ] **Asignar usuario** a almacén
- [ ] **Verificar permisos** por almacén
- [ ] **Usuario solo ve stock** de su almacén asignado
- [ ] **Manager ve todos** los almacenes

### **I. USUARIOS Y PERMISOS** 👤
- [ ] **Crear usuario admin**
- [ ] **Crear usuario manager**
- [ ] **Crear usuario sales**
- [ ] **Crear usuario delivery**
- [ ] **Crear usuario cashier**
- [ ] **Verificar permisos** de cada rol
- [ ] **Admin puede** ver todo
- [ ] **Manager puede** ver todo excepto crear admins
- [ ] **Sales solo puede** crear ventas y ver clientes
- [ ] **Delivery solo ve** productos y transferencias (sin precios)
- [ ] **Cashier solo puede** registrar pagos

### **J. CONTABILIDAD** 📊
- [ ] **Reporte de ventas** por periodo
- [ ] **Reporte de ingresos** por almacén
- [ ] **Reporte de productos más vendidos**
- [ ] **Reporte de clientes top**
- [ ] **Reporte de cuentas por cobrar**
- [ ] **Exportar reporte** a PDF
- [ ] **Gráficos** se actualizan correctamente

### **K. AUDITORÍA** 📝
- [ ] **Ver log completo** de auditoría
- [ ] **Filtrar por usuario**
- [ ] **Filtrar por entidad** (products, sales, etc.)
- [ ] **Filtrar por acción** (create, update, delete)
- [ ] **Verificar timestamp** correcto
- [ ] **Ver cambios** (old_value → new_value)

### **L. CONFIGURACIÓN** ⚙️
- [ ] **Editar información** de la empresa
- [ ] **Cambiar moneda**
- [ ] **Cambiar idioma** (ES/FR/EN)
- [ ] **Actualizar logo**
- [ ] **Ajustar impuesto por defecto**

---

## 3️⃣ **TESTS DE RENDIMIENTO** ⚡

### **A. Con Datos Pequeños (Actual)**
- [ ] Dashboard carga en < 2 segundos
- [ ] Lista de productos carga < 1 segundo
- [ ] Buscar producto < 500ms
- [ ] Crear venta < 1 segundo

### **B. Con Datos Grandes (Simular)**
```bash
# Crear datos de prueba en Supabase
# 1000 productos, 500 ventas, 100 clientes
```
- [ ] Dashboard carga en < 5 segundos
- [ ] Paginación funciona correctamente
- [ ] Búsqueda sigue siendo < 1 segundo
- [ ] Filtros no congelan la UI

---

## 4️⃣ **TESTS DE INTEGRACIÓN SUPABASE** 🔌

### **Conectividad**
- [ ] **Conexión a Supabase** exitosa
- [ ] **Autenticación** funciona
- [ ] **RLS policies** activas
- [ ] **Real-time subscriptions** funcionan
- [ ] **Edge Functions** responden

### **Datos**
- [ ] **Crear registro** en cada tabla
- [ ] **Leer registros** de cada tabla
- [ ] **Actualizar registros**
- [ ] **Eliminar registros** (soft delete donde aplique)
- [ ] **Triggers se ejecutan** (audit logs, stock updates)

---

## 5️⃣ **TESTS DE SEGURIDAD** 🔒

### **Autenticación**
- [ ] **No se puede acceder** sin login
- [ ] **Tokens expiran** correctamente
- [ ] **No hay ANON key** expuesta en código
- [ ] **Service Role Key** solo en Edge Functions

### **RLS (Row Level Security)**
- [ ] Manager **no puede** ver usuarios admin
- [ ] Sales **no puede** eliminar productos
- [ ] Usuario **solo ve** su almacén asignado
- [ ] Usuario **no puede** modificar datos de otros almacenes

### **Validaciones**
- [ ] **No se puede** crear venta con stock insuficiente
- [ ] **No se puede** transferir más stock del disponible
- [ ] **No se puede** eliminar cliente con ventas
- [ ] **Precios negativos** rechazados
- [ ] **Cantidades negativas** rechazadas

---

## 6️⃣ **TESTS DE BACKUP Y RECUPERACIÓN** 💾

- [ ] **Backup manual** funciona (`npm run backup:test`)
- [ ] **Restaurar backup** funciona
- [ ] **Backups automáticos** configurados en Supabase
- [ ] **Backup semanal** en Google Drive
- [ ] **Verificar integridad** del backup

---

## 7️⃣ **TESTS MULTI-DISPOSITIVO** 📱

### **Desktop**
- [ ] Chrome (Windows/Mac)
- [ ] Firefox
- [ ] Edge
- [ ] Safari (Mac)

### **Mobile**
- [ ] Chrome (Android)
- [ ] Safari (iOS)
- [ ] Responsive design en todas las pantallas
- [ ] Touch interactions funcionan

### **Tablet**
- [ ] iPad Safari
- [ ] Android Tablet

---

## 8️⃣ **TESTS DE ERRORES Y RECUPERACIÓN** 🚨

### **Escenarios de Error**
- [ ] **Internet desconectado** → mostrar mensaje
- [ ] **Supabase caído** → error boundary catch
- [ ] **Token expirado** → redirect a login
- [ ] **Operación concurrente** → optimistic locking
- [ ] **Fallo al guardar** → retry automático
- [ ] **Error en componente** → Error Boundary muestra UI

### **Verificar Logs**
- [ ] Errores se guardan en `error_logs` table
- [ ] Stack trace completo disponible
- [ ] User agent y URL capturados
- [ ] Admin puede ver logs desde la app

---

## 9️⃣ **SCRIPT DE PRUEBA RÁPIDA** (15 minutos)

### **Flujo Completo de Negocio**
1. ✅ Login como Admin
2. ✅ Crear 3 productos nuevos
3. ✅ Crear 2 clientes
4. ✅ Crear venta con múltiples productos (contado)
5. ✅ Verificar stock descontado
6. ✅ Crear venta a crédito
7. ✅ Registrar pago parcial
8. ✅ Crear transferencia entre almacenes
9. ✅ Aprobar transferencia
10. ✅ Verificar stock en ambos almacenes
11. ✅ Crear devolución
12. ✅ Verificar stock restaurado
13. ✅ Ver reporte de contabilidad
14. ✅ Ver audit log completo
15. ✅ Logout

---

## 🔟 **TESTS DE ESTRÉS** (Opcional)

### **Cargar Datos Masivos**
```sql
-- Ejecutar en Supabase SQL Editor
-- Crear 1000 productos de prueba
INSERT INTO products (name, sku, cost_price, sale_price, warehouse_id)
SELECT 
  'Producto Test ' || i,
  'TEST-' || LPAD(i::text, 6, '0'),
  random() * 100,
  random() * 200,
  (SELECT id FROM warehouses LIMIT 1)
FROM generate_series(1, 1000) i;
```

- [ ] Dashboard carga con 1000+ productos
- [ ] Búsqueda rápida con 1000+ productos
- [ ] Crear 100 ventas simultáneas (script)

---

## ✅ **CRITERIOS DE ACEPTACIÓN**

### **Mínimo para Producción**
- ✅ 90% de checklist manual completado
- ✅ 70% cobertura de tests automáticos
- ✅ 0 errores críticos en console
- ✅ 0 vulnerabilidades de seguridad
- ✅ Backup funcional probado
- ✅ RLS validado 100%
- ✅ Todos los roles probados

### **Opcional (Nice to Have)**
- ⭐ 95% de checklist completado
- ⭐ 80% cobertura de tests
- ⭐ Tests E2E automatizados
- ⭐ Performance < 2s en todas las operaciones

---

## 📊 **TRACKING DE PROGRESO**

Usa este comando para ver cobertura actual:
```bash
npm run test:coverage
```

Luego abre: `coverage/index.html`

---

## 🚀 **SIGUIENTE PASO**

**Ahora ejecuta el checklist manual** sección por sección. Te recomiendo:

1. **Hoy**: Testing de Autenticación + Productos (A + B)
2. **Mañana**: Ventas + POS (C + D)
3. **Día 3**: Transferencias + Devoluciones (E + F)
4. **Día 4**: Resto del sistema + Reportes
5. **Día 5**: Tests de seguridad + Performance

¿Empezamos creando tests automáticos adicionales para los servicios críticos?
