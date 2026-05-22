# PASO 1: Ejecutar SQL en Supabase

**⏱️ Tiempo estimado:** 2 minutos
**🎯 Objetivo:** Crear las tablas restantes en Supabase

---

## 📋 Instrucciones Paso a Paso

### 1. Abrir Supabase Dashboard

1. **Abre tu navegador**
2. **Ve a:** https://supabase.com/dashboard
3. **Inicia sesión** con tu cuenta
4. **Selecciona tu proyecto:** `azmol-stockerp` (o como se llame tu proyecto)

### 2. Abrir el SQL Editor

1. **En el menú lateral izquierdo**, busca y haz clic en:
   - 🔧 **"SQL Editor"** o **"Editor SQL"**

2. **Haz clic en:**
   - ➕ **"New Query"** o **"Nueva Consulta"**

### 3. Copiar y Pegar el SQL

1. **Abre el archivo:** [migrate-remaining-tables.sql](migrate-remaining-tables.sql)

2. **Selecciona TODO el contenido** (Ctrl+A)

3. **Copia** (Ctrl+C)

4. **Vuelve a Supabase Dashboard** → SQL Editor

5. **Pega el SQL** (Ctrl+V) en el editor

### 4. Ejecutar el Script

1. **Revisa que el SQL se haya pegado correctamente**

2. **Haz clic en el botón:**
   - ▶️ **"Run"** o **"Ejecutar"** (botón verde en la esquina inferior derecha)

3. **Espera** 5-10 segundos mientras se ejecuta

### 5. Verificar el Resultado

**Deberías ver un mensaje de éxito como:**

```
✅ Migración completada!
✅ Tablas creadas/verificadas: audit_logs, transfers, transfer_items, returns, return_items
✅ RLS habilitado en todas las tablas
✅ Realtime configurado
✅ Índices creados para performance
```

**Y una tabla con el resumen:**

| tabla | registros | estado |
|-------|-----------|--------|
| audit_logs | 0 | NUEVA |
| transfers | 0 | VACÍA |
| transfer_items | 0 | VACÍA |
| returns | 0 | VACÍA |
| return_items | 0 | VACÍA |

---

## ✅ Verificación Adicional

### Verificar que las Tablas se Crearon:

1. **En el menú lateral**, haz clic en:
   - 📊 **"Table Editor"** o **"Editor de Tablas"**

2. **Deberías ver las siguientes tablas nuevas:**
   - ✅ `audit_logs`
   - ✅ `transfers`
   - ✅ `transfer_items`
   - ✅ `returns`
   - ✅ `return_items`

3. **Si NO ves estas tablas:**
   - Actualiza la página (F5)
   - Verifica que no hubo errores al ejecutar el SQL
   - Revisa la consola de errores en Supabase

---

## 🔍 ¿Qué Hace Este Script?

### Crea 5 Tablas Nuevas:

1. **audit_logs** - Registros de auditoría (quién hizo qué y cuándo)
2. **transfers** - Transferencias de productos entre almacenes
3. **transfer_items** - Items individuales de cada transferencia
4. **returns** - Devoluciones de clientes
5. **return_items** - Items individuales de cada devolución

### Configura Seguridad:

- ✅ Habilita RLS (Row Level Security) en todas las tablas
- ✅ Crea políticas de acceso por rol
- ✅ Admins y Managers pueden ver/gestionar todo
- ✅ Otros roles tienen permisos limitados

### Habilita Realtime:

- ✅ Cambios en tiempo real para todas las tablas
- ✅ Múltiples usuarios ven actualizaciones instantáneas

### Optimiza Performance:

- ✅ Crea índices para búsquedas rápidas
- ✅ Índices por fecha, estado, relaciones

---

## ⚠️ Posibles Errores y Soluciones

### Error: "relation already exists"

**Significa:** La tabla ya existe (esto es normal si ya ejecutaste el schema completo)

**Solución:** Está bien, el script usa `CREATE TABLE IF NOT EXISTS`, así que no hay problema

### Error: "permission denied"

**Significa:** No tienes permisos de administrador en Supabase

**Solución:** Verifica que estás usando la cuenta correcta de Supabase

### Error: "syntax error"

**Significa:** El SQL no se pegó correctamente

**Solución:**
1. Borra todo del editor
2. Copia de nuevo el archivo completo
3. Pega de nuevo
4. Ejecuta otra vez

---

## 📝 Siguiente Paso

Una vez que hayas ejecutado el SQL exitosamente:

✅ **Continúa con:** PASO 2 - Implementar los Hooks

**Avísame cuando hayas terminado este paso y podemos continuar.**

---

## 🆘 ¿Necesitas Ayuda?

Si encuentras algún error:

1. **Copia el mensaje de error completo**
2. **Toma una captura de pantalla** si es posible
3. **Dime qué paso estabas haciendo**

Y te ayudaré a resolverlo.

---

**Creado:** 2026-01-03
**Parte de:** Migración Completa a Supabase (100%)
