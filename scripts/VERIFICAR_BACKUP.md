# Verificar que el Backup Está en Google Drive

## Paso 1: Abrir Google Drive

1. Abre tu navegador
2. Ve a: https://drive.google.com
3. Inicia sesión con tu cuenta de Google

## Paso 2: Buscar la Carpeta de Backup

Deberías ver una carpeta llamada **"azmol backup"** en tu Google Drive.

### Opción A: Buscar directamente

1. En la barra de búsqueda de Drive, escribe: `azmol backup`
2. Debería aparecer la carpeta

### Opción B: En "Ordenadores" (Computers)

1. En el menú lateral izquierdo, busca **"Ordenadores"** o **"Computers"**
2. Haz clic en tu ordenador (puede aparecer como "DESKTOP-..." o el nombre de tu PC)
3. Navega a la carpeta sincronizada
4. Deberías ver los archivos de backup

## Paso 3: Verificar el Archivo de Backup

Busca el archivo:
```
azmol-db-test-2026-01-03T09-09-01-405Z.json.gz.enc
```

**Características del archivo:**
- Tamaño: ~433 bytes
- Extensión: `.enc` (cifrado)
- Fecha: 03/01/2026

## ¿Qué Archivos Deberías Ver en Drive?

### ✅ CORRECTO - Solo archivos de backup:
```
azmol-db-test-2026-01-03T09-09-01-405Z.json.gz.enc  (433 bytes)
```

### ❌ INCORRECTO - Muchos archivos .js:
Si ves archivos como:
- HTMLDataListElement.js
- SVGRect-impl.js
- AbortSignal-impl.js
- etc.

**Significa que configuraste la carpeta equivocada en Google Drive Desktop.**

## Solución si Ves Archivos Incorrectos

### Paso 1: Detener la Sincronización Incorrecta

1. Haz clic en el ícono de Google Drive (barra de tareas)
2. Clic en ⚙️ → Preferencias
3. Ve a "Mi PC"
4. Busca la carpeta que está sincronizando
5. Haz clic en ⋮ (tres puntos) o X para **ELIMINARLA**

### Paso 2: Agregar la Carpeta Correcta

1. En "Mi PC", haz clic en "AGREGAR CARPETA"
2. Selecciona EXACTAMENTE:
   ```
   C:\Users\basma\Desktop\azmol backup
   ```
3. Marca "Hacer copias de seguridad en Google Drive"
4. Clic en "Listo" → "Guardar"

### Paso 3: Limpiar Drive (si es necesario)

Si ya subió archivos incorrectos:

1. Ve a https://drive.google.com
2. Busca la carpeta con archivos .js incorrectos
3. Haz clic derecho → "Eliminar" o "Mover a la papelera"

## Siguiente Paso: Ejecutar Backup de Nuevo

Una vez que tengas configurada la carpeta correcta:

```powershell
npm run backup:local
```

El nuevo archivo debería aparecer en Drive en 1-2 minutos.

## Resumen

El backup está funcionando correctamente, solo necesitamos asegurarnos de que:

1. ✅ Los archivos de backup se crean en `C:\Users\basma\Desktop\azmol backup`
2. ✅ Google Drive Desktop está sincronizando ESA carpeta específica
3. ✅ Los archivos aparecen en Drive en la ubicación correcta

Una vez configurado, el flujo será automático:
```
Backup semanal → Archivo .enc → Google Drive → ¡Seguro en la nube!
```
