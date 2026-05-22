# Configurar Google Drive Desktop para Backups Automáticos

## Paso 1: Configurar Backup de Carpeta Local a Drive

### En Google Drive Desktop:

1. **Haz clic en el ícono de Google Drive** en la barra de tareas (abajo a la derecha, cerca del reloj)
   - Si no lo ves, haz clic en la flecha ^ para ver iconos ocultos

2. **Haz clic en el engranaje** ⚙️ (Settings/Configuración)

3. **Selecciona "Preferencias" o "Preferences"**

4. Ve a la pestaña **"Mi PC"** o **"My Computer"** (es la segunda pestaña)

### Configurar Carpeta para Backup:

5. En la sección **"Carpetas"** o **"Folders"**, haz clic en **"AGREGAR CARPETA"** o **"ADD FOLDER"**

6. Navega y selecciona la carpeta de backups:
   ```
   C:\Users\basma\Downloads\azmol-stockerp\scripts\temp_backups
   ```

   **⚠️ Si ves error "es una subcarpeta o carpeta superior":**
   - Verifica que NO hayas agregado ya `C:\Users\basma\Downloads` o una carpeta padre
   - Si es así, ELIMINA la carpeta padre primero
   - Luego agrega solo `temp_backups`

7. **IMPORTANTE - Selecciona la opción correcta:**

   Deberías ver 2 opciones:

   - 🔄 **"Hacer copias de seguridad en Google Fotos"** o **"Back up to Google Photos"** ❌ NO ESTA
   - ☁️ **"Hacer copias de seguridad en Google Drive"** o **"Back up to Google Drive"** ✅ **ESTA SÍ**

   Marca la opción de **Google Drive**

8. Haz clic en **"Listo"** o **"Done"**

9. Haz clic en **"Guardar"** o **"Save"** para aplicar los cambios

## Paso 2: Organizar en Drive (Opcional pero Recomendado)

Una vez que los archivos se suban, puedes moverlos a una carpeta organizada:

1. Ve a https://drive.google.com
2. Busca la carpeta `temp_backups`
3. Mueve los archivos `.enc` a la carpeta que creaste: `AZMOL_ERP_BACKUPS`

O mejor aún, cambia la ruta de sincronización para que suba directamente ahí.

## Paso 3: Verificar que Funciona

### 3.1. Ejecutar un Backup de Prueba

Abre PowerShell o CMD en la carpeta del proyecto y ejecuta:

```powershell
npm run backup:local
```

### 3.2. Verificar la Subida

1. Espera 1-2 minutos
2. Ve a Google Drive Desktop (ícono en barra de tareas)
3. Deberías ver un ícono de "subiendo" 📤
4. Cuando termine, verás ✅

### 3.3. Verificar en la Web

1. Abre https://drive.google.com
2. Busca la carpeta `temp_backups`
3. Deberías ver el archivo `.enc` que acabas de crear

## Paso 4: Configurar Backup Automático Semanal

### Usando Programador de Tareas de Windows:

1. Presiona **Win + R**
2. Escribe: `taskschd.msc` y presiona Enter
3. Haz clic en **"Crear tarea básica"**
4. **Nombre**: `AZMOL ERP Backup Semanal`
5. **Desencadenador**: Selecciona **"Semanalmente"**
   - Día: **Domingo** a las **3:00 AM** (cuando no estés trabajando)
6. **Acción**: Selecciona **"Iniciar un programa"**
   - Programa: `C:\Program Files\nodejs\node.exe`
   - Argumentos: `scripts/backup-local-test.js`
   - Iniciar en: `C:\Users\basma\Downloads\azmol-stockerp`
7. **Finalizar**

### Alternativa más simple: Archivo .bat

Crea un archivo `backup-automatico.bat` en la carpeta del proyecto con:

```batch
@echo off
cd /d "C:\Users\basma\Downloads\azmol-stockerp"
call npm run backup:local
echo Backup completado - %date% %time% >> scripts\backup-log.txt
```

Luego programa este archivo .bat en el Programador de Tareas.

## ¿Qué Pasa si Pierdes el Portátil?

### 🔒 Tus Datos Están SEGUROS:

1. **Los backups están en Google Drive** - No en tu portátil
2. **Puedes acceder desde cualquier dispositivo**:
   - Otro ordenador
   - Teléfono móvil
   - Tablet
   - Cualquier navegador web en https://drive.google.com

3. **Para restaurar en un nuevo ordenador**:
   - Descarga el archivo `.enc` de Drive
   - Instala Node.js
   - Clona el proyecto
   - Copia el archivo `.env.backup` (debes tener una copia guardada)
   - Ejecuta: `node scripts/restore-backup.js restore <nombre-archivo>`

### ⚠️ IMPORTANTE - Guardar en Lugar Seguro:

Copia el archivo `scripts/.env.backup` a un lugar seguro (USB, email, otro servicio de nube):
- Contiene la clave de cifrado: `BACKUP_ENCRYPTION_KEY`
- **Sin esta clave NO podrás descifrar los backups**

## Resumen del Flujo Automático

```
1. Programador de Windows ejecuta backup cada domingo 3:00 AM
   ↓
2. Script crea archivo .enc en scripts/temp_backups/
   ↓
3. Google Drive Desktop detecta nuevo archivo
   ↓
4. Sube automáticamente a Google Drive
   ↓
5. Archivo disponible en la nube para siempre
```

## Comandos Útiles

```powershell
# Backup manual
npm run backup:local

# Ver lista de backups (cuando implementemos restore completo)
npm run restore:list

# Restaurar último backup
npm run restore:latest weekly
```

## Verificación Rápida

Para verificar que todo está funcionando:

```powershell
# 1. Hacer backup
npm run backup:local

# 2. Ver los archivos creados
dir scripts\temp_backups

# 3. Revisar Google Drive Desktop
# Debería mostrar que está subiendo el archivo

# 4. Abrir https://drive.google.com
# Verificar que el archivo aparece
```

## Soporte

Si tienes problemas:
1. Verifica que Google Drive Desktop esté ejecutándose (ícono en barra de tareas)
2. Verifica que la carpeta esté sincronizada (Preferencias → Mi PC)
3. Revisa el espacio disponible en Google Drive (15 GB gratis)
4. Los backups comprimidos y cifrados ocupan muy poco espacio (< 1 MB típicamente)
