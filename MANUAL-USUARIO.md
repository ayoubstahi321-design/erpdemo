# 📖 MANUAL DE USUARIO - AZMOL STOCKERP

## 🎯 GUÍAS POR ROL

---

## 👑 ADMINISTRADOR

### Funciones principales:
- ✅ Gestión completa del sistema
- ✅ Crear usuarios y asignar roles
- ✅ Configurar almacenes
- ✅ Ver todos los reportes
- ✅ Auditoría completa

### Tareas diarias:
1. **Revisar dashboard** al inicio del día
2. **Aprobar transferencias** pendientes
3. **Revisar cuentas por cobrar**
4. **Ver log de auditoría** para actividad sospechosa

---

## 👔 MANAGER

### Funciones principales:
- ✅ Todo excepto crear administradores
- ✅ Aprobar transferencias
- ✅ Ver reportes completos
- ✅ Gestionar inventario

### Tareas diarias:
1. **Revisar stock bajo** en alertas
2. **Aprobar transferencias** entre almacenes
3. **Revisar ventas del día**
4. **Ajustar precios** si es necesario

---

## 💼 VENDEDOR (SALES)

### Funciones principales:
- ✅ Crear ventas
- ✅ Gestionar clientes
- ✅ Registrar pagos
- ✅ Ver productos y precios

### NO PUEDE:
- ❌ Eliminar ventas
- ❌ Modificar stock directamente
- ❌ Ver costos de productos
- ❌ Crear usuarios

### Flujo de trabajo típico:

#### 1. Crear una venta
```
POS → Buscar producto → Agregar al carrito → Seleccionar cliente
→ Aplicar descuento (si aplica) → Finalizar venta → Imprimir factura
```

#### 2. Registrar pago de crédito
```
Ventas → Filtrar "Pendiente" → Click en venta → Registrar pago
→ Ingresar monto → Método de pago → Guardar
```

#### 3. Crear cliente nuevo
```
Clientes → Nuevo Cliente → Llenar formulario → Guardar
```

---

## 🚚 DELIVERY

### Funciones principales:
- ✅ Ver productos (sin precios)
- ✅ Ver transferencias
- ✅ Marcar entregas como completadas

### NO PUEDE:
- ❌ Ver precios
- ❌ Crear ventas
- ❌ Modificar productos

---

## 💰 CAJERO (CASHIER)

### Funciones principales:
- ✅ POS completo
- ✅ Registrar pagos
- ✅ Ver ventas del día
- ✅ Imprimir facturas

### Flujo de trabajo:

#### Día completo en POS:
```
1. Login al sistema
2. Abrir POS
3. Por cada venta:
   - Escanear/buscar productos
   - Verificar stock disponible
   - Aplicar descuentos autorizados
   - Finalizar venta
   - Imprimir ticket
4. Al final del día:
   - Ver reporte de ventas del día
   - Cuadrar caja
   - Cerrar sesión
```

---

## 🔧 TAREAS COMUNES

### ❓ ¿Cómo buscar un producto?
1. En cualquier lista, usa el buscador (🔍)
2. Puedes buscar por:
   - Nombre
   - SKU
   - Categoría

### ❓ ¿Cómo aplicar descuento?
**Por línea:**
- En el carrito, click en el ícono de editar (✏️)
- Ingresar % o monto fijo
- Guardar

**Global (toda la venta):**
- Antes de finalizar, usar "Descuento Global"
- Aplicar %

### ❓ ¿Cómo hacer una transferencia?
1. Transferencias → Nueva
2. Seleccionar almacén origen y destino
3. Agregar productos y cantidades
4. Guardar (queda pendiente)
5. Manager/Admin debe aprobar
6. Una vez aprobada, stock se mueve automáticamente

### ❓ ¿Cómo procesar una devolución?
1. Devoluciones → Nueva
2. Buscar venta original
3. Seleccionar productos a devolver
4. Indicar razón
5. Guardar
6. Stock se restaura automáticamente

### ❓ ¿Cómo importar productos desde CSV?
1. Inventario → Importar CSV
2. Descargar plantilla
3. Llenar Excel con:
   - SKU (único)
   - Nombre
   - Costo
   - Precio venta
   - Stock inicial
4. Cargar archivo
5. Revisar preview
6. Confirmar importación

### ❓ ¿Qué hacer si hay un error?
1. Capturar screenshot
2. Anotar:
   - ¿Qué estabas haciendo?
   - ¿Qué esperabas que pasara?
   - ¿Qué pasó en realidad?
3. Contactar a administrador
4. **NO reintentar** operaciones financieras

---

## 🚨 ALERTAS Y NOTIFICACIONES

### 🔴 Stock Bajo
- Aparece en Dashboard
- Producto con menos del 20% del stock mínimo
- **Acción:** Pedir reabastecimiento

### 🟡 Pago Vencido
- Cliente con pago atrasado > 30 días
- **Acción:** Contactar cliente

### 🟢 Transferencia Pendiente
- Requiere aprobación de manager
- **Acción:** Revisar y aprobar/rechazar

---

## 📱 ACCESO MÓVIL

### La app es una PWA (Progressive Web App):

**En Android:**
1. Abrir Chrome
2. Ir a la URL del sistema
3. Menú (⋮) → "Agregar a pantalla de inicio"
4. Usar como app nativa

**En iOS:**
1. Abrir Safari
2. Ir a la URL
3. Tap en "Compartir" (📤)
4. "Agregar a pantalla de inicio"

---

## 🆘 SOPORTE

**Contacto:**
- 📧 Email: [admin@azmol.com]
- 📱 WhatsApp: [+212 XXX XXX XXX]
- ⏰ Horario: 9:00 - 18:00

**Antes de contactar:**
- ✅ Verifica que tienes buena conexión a internet
- ✅ Intenta refrescar la página (F5)
- ✅ Cierra sesión y vuelve a entrar
- ✅ Prueba en otro navegador

---

## 🔐 SEGURIDAD

### Buenas prácticas:
- ✅ **NUNCA** compartas tu contraseña
- ✅ Cierra sesión al terminar
- ✅ No dejes sesión abierta en computadoras públicas
- ✅ Cambia contraseña cada 3 meses
- ✅ Si sospechas acceso no autorizado, reporta inmediatamente

### Permisos:
- Cada usuario solo ve lo que necesita
- Todas las acciones se registran (auditoría)
- Admin puede ver quién hizo qué y cuándo

---

## ✅ ATAJOS DE TECLADO

- `Ctrl + K` → Búsqueda rápida
- `Ctrl + S` → Guardar (en formularios)
- `Esc` → Cerrar modal
- `Enter` → Confirmar acción

---

**Versión: 2.0**
**Última actualización: Enero 2026**
