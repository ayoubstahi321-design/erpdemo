# 🚨 INSTRUCCIONES URGENTES - CORRECCIÓN DEL SISTEMA

## ⚠️ PROBLEMA IDENTIFICADO

El sistema tiene **falta de triggers automáticos** en la base de datos, lo que causa:
- ❌ Stock NO se actualiza al recibir contenedores
- ❌ Stock NO se actualiza al hacer transferencias
- ❌ Errores de "Connection error" en la API
- ❌ Datos no conectados entre tablas

## ✅ SOLUCIÓN

He creado un script SQL que soluciona **TODOS** estos problemas.

## 📋 PASOS PARA EJECUTAR (5 minutos)

### Paso 1: Acceder a Supabase Dashboard
1. Ve a: https://supabase.com/dashboard
2. Inicia sesión
3. Selecciona tu proyecto: `mkehxermgmdqsogmlaqq`

### Paso 2: Abrir SQL Editor
1. En el menú izquierdo, haz clic en **SQL Editor**
2. Haz clic en **New Query**

### Paso 3: Copiar y Ejecutar el Script
1. Abre el archivo: `fix-complete-system.sql`
2. Copia **TODO** el contenido
3. Pégalo en el editor SQL de Supabase
4. Haz clic en el botón **RUN** (o presiona Ctrl+Enter)

### Paso 4: Verificar Éxito
Deberías ver mensajes como:
```
✅ SISTEMA CORREGIDO EXITOSAMENTE
📋 Triggers creados:
   1. trigger_update_stock_on_transfer_item
   2. trigger_update_stock_on_sale_item
   3. trigger_update_stock_on_return_item
```

## 🔧 QUÉ HACE EL SCRIPT

### 1. Trigger para Transferencias/Recepciones
- ✅ Cuando recibes un contenedor → Stock se suma automáticamente al almacén
- ✅ Cuando haces transferencia interna → Resta del origen, suma al destino
- ✅ Cuando ajustas inventario → Suma o resta según el tipo

### 2. Trigger para Ventas
- ✅ Cuando creas una venta → Stock se resta automáticamente del almacén

### 3. Trigger para Devoluciones
- ✅ Cuando registras devolución → Stock se devuelve al almacén

## 🎯 DESPUÉS DE EJECUTAR

### Todo funcionará automáticamente:
1. **Recepción de Contenedor:**
   - Añade productos a la lista
   - Clic en "Recibir Todo"
   - ✅ Stock se actualiza automáticamente en el almacén seleccionado

2. **Transferencia Interna:**
   - Selecciona origen y destino
   - Añade productos
   - ✅ Stock se mueve automáticamente entre almacenes

3. **Ventas:**
   - Crea venta
   - ✅ Stock se descuenta automáticamente

4. **Clientes:**
   - La tabla `customers` ya existe
   - Puedes añadir clientes sin problemas
   - Si aún no funciona, verifica en SQL Editor: `SELECT * FROM customers LIMIT 5;`

## 🔍 VERIFICACIÓN DE TABLAS

Si quieres verificar que todas las tablas existen, ejecuta esto en SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Deberías ver:
- ✅ audit_logs
- ✅ company_settings
- ✅ customers
- ✅ payments
- ✅ products
- ✅ profiles
- ✅ return_items
- ✅ returns
- ✅ sale_items
- ✅ sales
- ✅ stock_levels
- ✅ transfer_items
- ✅ transfers
- ✅ warehouses

## 🐛 SI AÚN HAY PROBLEMAS

### Error: "Could not find column..."
- Refresca la página del navegador (Ctrl+F5)
- Cierra sesión y vuelve a iniciar
- El cache de Supabase puede tardar unos segundos

### Error: "Connection error"
- Verifica que las variables de entorno estén correctas en `.env`:
  ```
  VITE_SUPABASE_URL=https://mkehxermgmdqsogmlaqq.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  ```
- Reinicia el servidor de desarrollo: `npm run dev`

### Los clientes no se guardan
1. Verifica que la tabla existe:
   ```sql
   SELECT * FROM customers LIMIT 5;
   ```
2. Verifica las políticas RLS:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'customers';
   ```
3. Asegúrate de estar autenticado en la aplicación

## 📞 SOPORTE

Si después de ejecutar el script aún hay problemas:
1. Copia el mensaje de error EXACTO que aparece
2. Copia el resultado de esta consulta SQL:
   ```sql
   SELECT trigger_name, event_object_table
   FROM information_schema.triggers
   WHERE trigger_schema = 'public';
   ```
3. Envíame ambas cosas y te ayudaré inmediatamente

## ⏱️ TIEMPO ESTIMADO
- Ejecución del script: **2 minutos**
- Verificación: **1 minuto**
- **Total: 3 minutos** ⚡

---

**Fecha:** 2026-01-09
**Versión:** 1.0
**Autor:** Claude Code (Anthropic)
