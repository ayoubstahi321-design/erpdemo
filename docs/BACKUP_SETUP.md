# 🔒 Configuración del Sistema de Backup - AZMOL ERP

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Requisitos](#requisitos)
3. [Instalación](#instalación)
4. [Configuración Google Drive](#configuración-google-drive)
5. [Configuración Cron](#configuración-cron)
6. [Pruebas](#pruebas)
7. [Restauración](#restauración)
8. [Solución de Problemas](#solución-de-problemas)

---

## Visión General

Sistema de backup automatizado que cumple con la normativa marroquí de conservación de documentos fiscales (10 años).

### Características

✅ **Backup Diario** - Facturas nuevas (PDF metadata)
✅ **Backup Semanal** - Base de datos completa
✅ **Backup Trimestral** - Archivo histórico (10 años)
✅ **Cifrado AES-256** - Seguridad máxima
✅ **Compresión GZIP** - Ahorro de espacio (hasta 90%)
✅ **Google Drive** - Almacenamiento en la nube
✅ **Verificación de integridad** - Antes de cada subida
✅ **Retención automática** - Limpieza de backups antiguos

### Retención de Datos

| Tipo | Frecuencia | Retención | Uso de Espacio |
|------|-----------|-----------|----------------|
| **Diario** | 23:00 | 7 días | ~5 MB/semana |
| **Semanal** | Dom 02:00 | 60 días | ~50 MB/año |
| **Mensual** | Automático | 1 año | ~100 MB/año |
| **Trimestral** | Trim 03:00 | 10 años | ~500 MB/10 años |

**Total estimado**: < 1 GB en 10 años ✅ (Muy por debajo del límite gratuito de Google Drive)

---

## Requisitos

### Software

- **Node.js** ≥ 18.0
- **PostgreSQL** ≥ 14 (incluido con Supabase)
- **Git** (para control de versiones)
- **Cron** (Linux/Mac) o **Task Scheduler** (Windows)

### Cuentas

1. **Supabase** - Base de datos (plan gratuito)
2. **Google Cloud Platform** - Drive API (gratis)

---

## Instalación

### 1. Instalar Dependencias

```bash
npm install googleapis @supabase/supabase-js
```

### 2. Crear Directorio de Scripts

```bash
mkdir -p scripts
cd scripts
```

### 3. Copiar Archivos

Los scripts ya están en la carpeta `scripts/`:
- `backup-system.js` - Sistema principal de backup
- `restore-backup.js` - Sistema de restauración
- `.env.backup.example` - Plantilla de configuración

---

## Configuración Google Drive

### Paso 1: Crear Proyecto en Google Cloud

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear nuevo proyecto: "AZMOL ERP Backups"
3. Esperar a que se cree (30 segundos)

### Paso 2: Habilitar Drive API

1. En el menú lateral → **APIs & Services** → **Library**
2. Buscar "Google Drive API"
3. Clic en **Enable**

### Paso 3: Crear Credenciales

1. **APIs & Services** → **Credentials**
2. Clic en **Create Credentials** → **Service Account**
3. Completar:
   - **Name**: `azmol-backup-service`
   - **Description**: "Servicio para backups automáticos"
4. Clic en **Create and Continue**
5. **Grant this service account access to project**:
   - Role: `Editor` (o `Storage Object Admin` para más seguridad)
6. Clic en **Done**

### Paso 4: Descargar Clave JSON

1. En la lista de Service Accounts, clic en el email del servicio creado
2. Ir a la pestaña **Keys**
3. Clic en **Add Key** → **Create new key**
4. Seleccionar **JSON**
5. Clic en **Create**
6. Se descargará un archivo JSON

### Paso 5: Configurar Credenciales

```bash
# Copiar el archivo descargado a la carpeta del proyecto
mv ~/Downloads/azmol-erp-backups-*.json ./scripts/credentials.json

# Asegurar permisos (solo lectura para el usuario)
chmod 400 ./scripts/credentials.json
```

### Paso 6: Compartir Carpeta de Drive (Opcional)

Si quieres acceder manualmente a los backups:

1. Abrir Google Drive
2. Buscar la carpeta "AZMOL_ERP_BACKUPS" (se crea automáticamente)
3. Clic derecho → **Share**
4. Agregar el email del Service Account
5. Dar permisos de **Editor**

---

## Configuración del Sistema

### 1. Configurar Variables de Entorno

```bash
# Copiar plantilla
cp scripts/.env.backup.example scripts/.env.backup

# Editar con tus valores
nano scripts/.env.backup
```

Rellenar con tus valores reales:

```bash
# Supabase
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_DB_PASSWORD=tu_password_aqui

# Google Drive - no necesario si usas service account
# (las credenciales están en credentials.json)

# Cifrado - GENERAR NUEVA CLAVE
BACKUP_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

### 2. Cargar Variables de Entorno

```bash
# Agregar a .bashrc o .zshrc
echo 'export $(cat scripts/.env.backup | xargs)' >> ~/.bashrc
source ~/.bashrc
```

### 3. Agregar a .gitignore

```bash
echo 'scripts/.env.backup' >> .gitignore
echo 'scripts/credentials.json' >> .gitignore
echo 'scripts/temp_*' >> .gitignore
```

---

## Configuración Cron

### Linux/Mac

```bash
# Abrir crontab
crontab -e

# Agregar las siguientes líneas:

# Backup diario (23:00)
0 23 * * * cd /ruta/completa/al/proyecto && node scripts/backup-system.js daily >> /var/log/azmol-backup-daily.log 2>&1

# Backup semanal (Domingos 02:00)
0 2 * * 0 cd /ruta/completa/al/proyecto && node scripts/backup-system.js weekly >> /var/log/azmol-backup-weekly.log 2>&1

# Backup trimestral (Primer día de cada trimestre 03:00)
0 3 1 1,4,7,10 * cd /ruta/completa/al/proyecto && node scripts/backup-system.js quarterly >> /var/log/azmol-backup-quarterly.log 2>&1
```

### Windows (Task Scheduler)

1. Abrir **Task Scheduler**
2. Clic en **Create Basic Task**

#### Backup Diario

- **Name**: AZMOL Backup Diario
- **Trigger**: Daily → 11:00 PM
- **Action**: Start a program
  - **Program**: `node`
  - **Arguments**: `C:\ruta\completa\scripts\backup-system.js daily`
  - **Start in**: `C:\ruta\completa\al\proyecto`

#### Backup Semanal

- **Name**: AZMOL Backup Semanal
- **Trigger**: Weekly → Sunday → 2:00 AM
- **Action**: Start a program
  - **Program**: `node`
  - **Arguments**: `C:\ruta\completa\scripts\backup-system.js weekly`

#### Backup Trimestral

- **Name**: AZMOL Backup Trimestral
- **Trigger**: Monthly → First day → 3:00 AM
- **Months**: January, April, July, October
- **Action**: Start a program
  - **Program**: `node`
  - **Arguments**: `C:\ruta\completa\scripts\backup-system.js quarterly`

---

## Pruebas

### 1. Prueba Manual de Cada Tipo

```bash
# Backup diario (rápido, solo facturas nuevas)
node scripts/backup-system.js daily

# Backup semanal (completo, base de datos)
node scripts/backup-system.js weekly

# Backup trimestral (archivo histórico)
node scripts/backup-system.js quarterly
```

### 2. Verificar en Google Drive

1. Abrir [Google Drive](https://drive.google.com/)
2. Buscar carpeta "AZMOL_ERP_BACKUPS"
3. Verificar estructura:
   ```
   AZMOL_ERP_BACKUPS/
   ├── Database_Backups/
   │   ├── Daily/
   │   ├── Weekly/
   │   ├── Monthly/
   │   └── Quarterly/
   ├── Invoices_PDF/
   ├── Audit_Logs/
   └── Emergency_Restore/
   ```

### 3. Probar Restauración

```bash
# Listar backups disponibles
node scripts/restore-backup.js list

# Restaurar el último backup semanal
node scripts/restore-backup.js restore-latest weekly
```

⚠️ **ADVERTENCIA**: La restauración sobrescribe la base de datos actual. Hacer backup manual primero.

---

## Restauración

### Escenarios de Restauración

#### 1. Restaurar Último Backup

```bash
# Restaurar último backup semanal
node scripts/restore-backup.js restore-latest weekly

# Restaurar último backup trimestral
node scripts/restore-backup.js restore-latest quarterly
```

#### 2. Restaurar Backup Específico

```bash
# 1. Listar todos los backups
node scripts/restore-backup.js list

# 2. Copiar el ID del backup deseado
# 3. Restaurar
node scripts/restore-backup.js restore 1abc2def3ghi4jkl5mno6pqr7stu
```

#### 3. Restauración Manual (Emergencia)

Si los scripts no funcionan:

1. Descargar backup de Google Drive
2. Descifrar:
   ```bash
   openssl enc -d -aes-256-gcm \
     -in backup.sql.gz.enc \
     -out backup.sql.gz \
     -K $BACKUP_ENCRYPTION_KEY
   ```
3. Descomprimir:
   ```bash
   gunzip backup.sql.gz
   ```
4. Restaurar:
   ```bash
   psql "postgresql://postgres:PASSWORD@HOST:5432/postgres" < backup.sql
   ```

---

## Monitoreo

### Ver Logs

```bash
# Ver log de backups diarios
tail -f /var/log/azmol-backup-daily.log

# Ver log de backups semanales
tail -f /var/log/azmol-backup-weekly.log

# Ver errores
grep "ERROR" /var/log/azmol-backup-*.log
```

### Notificaciones por Email (Opcional)

Descomentar y configurar en `backup-system.js`:

```javascript
// TODO: Implementar envío de email
async function sendEmail(message) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  })

  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: process.env.NOTIFICATION_EMAIL,
    subject: `[AZMOL ERP] ${message.type}`,
    text: JSON.stringify(message, null, 2)
  })
}
```

---

## Solución de Problemas

### Error: "BACKUP_ENCRYPTION_KEY no está configurada"

**Solución**:
```bash
# Generar nueva clave
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Agregar a .env.backup
echo "BACKUP_ENCRYPTION_KEY=clave_generada_aqui" >> scripts/.env.backup

# Cargar variables
source <(cat scripts/.env.backup | grep -v '^#' | sed 's/^/export /')
```

### Error: "Carpeta raíz no encontrada"

**Solución**:
```bash
# Ejecutar backup una vez para crear estructura
node scripts/backup-system.js weekly
```

### Error: "Permission denied" al acceder a Google Drive

**Solución**:
1. Verificar que `credentials.json` existe y tiene permisos 400
2. Verificar que el Service Account tiene permisos de Editor
3. Re-generar credenciales si es necesario

### Backup muy grande (> 100 MB)

**Solución**:
```bash
# Limpiar datos antiguos (ejecutar en Supabase SQL Editor)
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '6 months';
DELETE FROM sales WHERE status = 'Completed' AND created_at < NOW() - INTERVAL '2 years';
VACUUM FULL ANALYZE;
```

### Restauración falla

**Solución**:
1. Verificar que `BACKUP_ENCRYPTION_KEY` es la correcta
2. Descargar backup manualmente de Drive
3. Verificar integridad con `file backup.sql.gz.enc`
4. Intentar descifrado manual con openssl

---

## Mejores Prácticas

### ✅ Hacer

- ✅ Probar restauración al menos una vez al trimestre
- ✅ Guardar `BACKUP_ENCRYPTION_KEY` en lugar seguro (password manager)
- ✅ Revisar logs semanalmente
- ✅ Mantener al menos 3 backups trimestrales
- ✅ Verificar que cron jobs están activos (`crontab -l`)

### ❌ No Hacer

- ❌ Subir `credentials.json` o `.env.backup` a Git
- ❌ Compartir `BACKUP_ENCRYPTION_KEY` por email/chat
- ❌ Eliminar backups trimestrales (retención legal 10 años)
- ❌ Ejecutar múltiples backups simultáneamente
- ❌ Modificar scripts sin probar primero

---

## Checklist de Seguridad

- [ ] ¿`credentials.json` tiene permisos 400?
- [ ] ¿`.env.backup` está en `.gitignore`?
- [ ] ¿`BACKUP_ENCRYPTION_KEY` está guardada de forma segura?
- [ ] ¿Carpetas temporales se eliminan después de backup?
- [ ] ¿Backups están cifrados antes de subir?
- [ ] ¿Cron jobs tienen logs configurados?
- [ ] ¿Restauración probada al menos una vez?
- [ ] ¿Notificaciones de error configuradas?

---

## Soporte

Para problemas o dudas:

1. Revisar logs: `/var/log/azmol-backup-*.log`
2. Ejecutar backup manual con `-v` (verbose)
3. Verificar configuración: `node scripts/backup-system.js help`
4. Contactar soporte técnico

---

**Última actualización**: 2026-01-02
**Versión**: 1.0.0
