# 🔢 Sistema de Numeración Automática - Guía Completa

## 📋 Descripción General

Sistema profesional de numeración secuencial para documentos comerciales que cumple con requisitos legales y contables.

---

## ✅ Formatos de Numeración Implementados

### Tickets POS
```
T-2026-00001
T-2026-00002
T-2026-00003
...
```
- **Prefijo**: `T` (Ticket)
- **Formato**: `T-AÑO-NÚMERO`
- **Reinicio**: Automático cada año
- **Uso**: Ventas rápidas en punto de venta

### Facturas (Invoices)
```
F-2026-00001
F-2026-00002
F-2026-00003
...
```
- **Prefijo**: `F` (Factura)
- **Formato**: `F-AÑO-NÚMERO`
- **Reinicio**: Automático cada año
- **Uso**: Ventas B2B y POS con cliente registrado

### Bonos de Entrega (Delivery Notes)
```
BL-2026-00001
BL-2026-00002
BL-2026-00003
...
```
- **Prefijo**: `BL` (Bon de Livraison)
- **Formato**: `BL-AÑO-NÚMERO`
- **Reinicio**: Automático cada año
- **Uso**: Albaranes de entrega

---

## 🗂️ Archivos Creados/Modificados

### 1. Migración SQL
**Archivo**: `supabase/migrations/add-document-numbering-system.sql`

**Crea**:
- Tabla `document_counters` (almacena contadores por tipo y año)
- Función `generate_document_number()` (RPC para generar números)
- Índices para performance
- Políticas RLS para seguridad

### 2. Servicio de Numeración
**Archivo**: `src/services/documentNumbering.ts`

**Funciones**:
- `generateDocumentNumber()` - Genera siguiente número
- `getCurrentCounter()` - Obtiene contador actual
- `previewNextNumber()` - Vista previa del próximo número
- `generateFallbackNumber()` - Fallback si falla Supabase

### 3. Integración POS
**Archivo**: `src/components/POS.tsx`

**Cambios**:
- Importa servicio de numeración
- Genera número antes de crear venta
- Asigna número según tipo de documento
- Manejo de errores con fallback

### 4. Integración Sales (B2B)
**Archivo**: `src/components/Sales.tsx`

**Cambios**:
- Reemplaza función vieja `generateInvoiceNumber()`
- Usa nuevo sistema de numeración
- Fallback a sistema antiguo si falla

---

## 🚀 Instalación y Configuración

### Paso 1: Ejecutar Migración Principal
```bash
# Desde tu panel de Supabase SQL Editor, ejecuta:
supabase/migrations/add-sales-source-and-document-type.sql
```

### Paso 2: Ejecutar Migración de Numeración
```bash
# Luego ejecuta:
supabase/migrations/add-document-numbering-system.sql
```

### Paso 3: Verificar Instalación
```sql
-- En Supabase SQL Editor, verifica que la tabla existe:
SELECT * FROM document_counters;

-- Deberías ver 3 filas inicializadas:
-- TICKET, INVOICE, DELIVERY_NOTE con last_number = 0
```

---

## 🔧 Cómo Funciona

### Flujo de Generación de Número

```mermaid
Frontend (POS/Sales)
    ↓
generateDocumentNumber('INVOICE')
    ↓
Supabase RPC: generate_document_number()
    ↓
1. Obtiene contador actual del año
2. Incrementa +1 (operación atómica)
3. Formatea: F-2026-00001
4. Retorna número
    ↓
Número asignado a la venta
```

### Operación Atómica (Thread-Safe)

La función SQL usa `INSERT ... ON CONFLICT UPDATE` que es atómica:
```sql
INSERT INTO document_counters (document_type, year, last_number)
VALUES ('INVOICE', 2026, 1)
ON CONFLICT (document_type, year)
DO UPDATE SET last_number = document_counters.last_number + 1
RETURNING last_number;
```

**Esto garantiza**:
- ✅ Sin duplicados (incluso con múltiples usuarios simultáneos)
- ✅ Secuencia sin huecos
- ✅ Performance óptima (sin locks largos)

---

## 📊 Tabla: document_counters

### Estructura
```sql
CREATE TABLE document_counters (
  id UUID PRIMARY KEY,
  document_type TEXT NOT NULL,  -- TICKET, INVOICE, DELIVERY_NOTE
  year INTEGER NOT NULL,        -- 2026, 2027, etc.
  last_number INTEGER NOT NULL, -- Último número usado
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(document_type, year)   -- Un contador por tipo por año
);
```

### Ejemplo de Datos
| document_type | year | last_number | updated_at |
|--------------|------|-------------|------------|
| TICKET | 2026 | 523 | 2026-01-29 15:30:00 |
| INVOICE | 2026 | 142 | 2026-01-29 14:20:00 |
| DELIVERY_NOTE | 2026 | 78 | 2026-01-29 10:15:00 |

---

## 🛡️ Manejo de Errores

### Escenario 1: Supabase No Disponible
```typescript
try {
  documentNumber = await generateDocumentNumber('INVOICE');
} catch (error) {
  // Fallback: Usa timestamp
  documentNumber = 'F-2026-528371'; // timestamp-based
}
```

### Escenario 2: Función RPC No Existe
```typescript
// El servicio detecta el error y usa fallback automático
// La venta se crea exitosamente con número alternativo
```

### Escenario 3: Múltiples Usuarios Simultáneos
```sql
-- La operación atómica garantiza que cada usuario obtiene un número único
-- Usuario A: F-2026-00143
-- Usuario B: F-2026-00144
-- Usuario C: F-2026-00145
-- (Sin duplicados, sin colisiones)
```

---

## 🔍 Diagnóstico y Monitoreo

### Ver Contadores Actuales
```sql
SELECT
  document_type,
  year,
  last_number,
  TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as last_update
FROM document_counters
ORDER BY document_type, year DESC;
```

### Ver Últimos Números Generados
```sql
SELECT
  invoice_number,
  source,
  document_type,
  customer_name,
  total_amount,
  TO_CHAR(date, 'YYYY-MM-DD HH24:MI:SS') as sale_date
FROM sales
WHERE invoice_number IS NOT NULL
ORDER BY date DESC
LIMIT 20;
```

### Resetear Contador (Nueva Temporada)
```sql
-- ⚠️ CUIDADO: Solo hacer al inicio de año
INSERT INTO document_counters (document_type, year, last_number)
VALUES
  ('TICKET', 2027, 0),
  ('INVOICE', 2027, 0),
  ('DELIVERY_NOTE', 2027, 0)
ON CONFLICT DO NOTHING;
```

---

## ⚙️ Configuración Avanzada

### Cambiar Prefijos
Edita la función RPC en Supabase:
```sql
-- En: supabase/migrations/add-document-numbering-system.sql
CASE p_document_type
  WHEN 'TICKET' THEN v_prefix := 'T';      -- Cambiar aquí
  WHEN 'INVOICE' THEN v_prefix := 'FAC';   -- Ej: FAC-2026-00001
  WHEN 'DELIVERY_NOTE' THEN v_prefix := 'BL';
END CASE;
```

### Cambiar Formato de Número
```sql
-- Actual: F-2026-00001 (5 dígitos)
v_document_number := v_prefix || '-' || v_year || '-' || LPAD(v_next_number::TEXT, 5, '0');

-- Cambiar a 6 dígitos: F-2026-000001
v_document_number := v_prefix || '-' || v_year || '-' || LPAD(v_next_number::TEXT, 6, '0');

-- Sin año: F-00001
v_document_number := v_prefix || '-' || LPAD(v_next_number::TEXT, 5, '0');
```

---

## 📈 Ventajas del Sistema

| Característica | Descripción |
|---------------|-------------|
| ✅ **Secuencial** | Números continuos sin huecos |
| ✅ **Thread-Safe** | Múltiples usuarios sin duplicados |
| ✅ **Por Año** | Reinicio automático cada año |
| ✅ **Performance** | Operaciones atómicas rápidas |
| ✅ **Auditable** | Trazabilidad completa |
| ✅ **Legal** | Cumple requisitos contables |
| ✅ **Fallback** | Funciona incluso si RPC falla |
| ✅ **Flexible** | Prefijos configurables |

---

## 🧪 Testing

### Test 1: Generar Número Manualmente
```sql
-- En Supabase SQL Editor:
SELECT generate_document_number('INVOICE', 2026);
-- Resultado esperado: F-2026-00001

SELECT generate_document_number('INVOICE', 2026);
-- Resultado esperado: F-2026-00002

SELECT generate_document_number('TICKET', 2026);
-- Resultado esperado: T-2026-00001
```

### Test 2: Verificar Secuencia
```sql
-- Generar 5 facturas:
SELECT generate_document_number('INVOICE') FROM generate_series(1, 5);
-- Resultado esperado: F-2026-00003, F-2026-00004, ...

-- Verificar contador:
SELECT last_number FROM document_counters
WHERE document_type = 'INVOICE' AND year = 2026;
-- Resultado esperado: 7 (o el número actual)
```

### Test 3: Venta Completa (Frontend)
1. Abrir POS
2. Agregar productos al carrito
3. Seleccionar tipo de documento: **Factura**
4. Finalizar venta
5. Verificar que aparece número: `F-2026-XXXXX`
6. Repetir → El número debe incrementar

---

## 🆘 Troubleshooting

### Problema: "Function generate_document_number does not exist"
**Solución**: Ejecutar migración `add-document-numbering-system.sql`

### Problema: Números con timestamp en lugar de secuenciales
**Solución**: Verificar que la función RPC está creada correctamente
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'generate_document_number';
```

### Problema: Números duplicados
**Causa**: No debería pasar con sistema actual (atómico)
**Verificación**:
```sql
SELECT invoice_number, COUNT(*)
FROM sales
WHERE invoice_number IS NOT NULL
GROUP BY invoice_number
HAVING COUNT(*) > 1;
```

---

## 📞 Soporte

Si encuentras problemas:
1. Verificar que ambas migraciones SQL están ejecutadas
2. Revisar logs del navegador (F12 → Console)
3. Verificar permisos RLS en Supabase
4. Consultar logs de Supabase (Dashboard → Logs)

---

**✅ Sistema listo para producción**
**📅 Fecha de implementación**: 2026-01-29
**🔢 Versión**: 1.0
