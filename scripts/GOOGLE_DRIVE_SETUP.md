# Configuración de Google Drive API - Guía Rápida

## Paso 1: Crear Proyecto en Google Cloud

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear un nuevo proyecto:
   - Clic en el selector de proyectos (arriba)
   - Clic en "Nuevo proyecto"
   - Nombre: **AZMOL-ERP-Backups**
   - Clic en "Crear"

## Paso 2: Habilitar Google Drive API

1. En el menú lateral: **APIs y servicios** > **Biblioteca**
2. Buscar: **Google Drive API**
3. Clic en **Google Drive API**
4. Clic en **HABILITAR**

## Paso 3: Crear Service Account

1. En el menú lateral: **APIs y servicios** > **Credenciales**
2. Clic en **+ CREAR CREDENCIALES** > **Cuenta de servicio**
3. Configurar:
   - Nombre de la cuenta de servicio: **azmol-backup-service**
   - ID de la cuenta: (se genera automáticamente)
   - Descripción: **Servicio para backups automáticos de AZMOL ERP**
4. Clic en **CREAR Y CONTINUAR**
5. Rol: **Propietario del proyecto** (o "Editor")
6. Clic en **CONTINUAR** > **LISTO**

## Paso 4: Descargar credentials.json

1. En la página de **Credenciales**, buscar la cuenta de servicio recién creada
2. Clic en el email de la cuenta de servicio (ej: `azmol-backup-service@...iam.gserviceaccount.com`)
3. Ir a la pestaña **CLAVES**
4. Clic en **AGREGAR CLAVE** > **Crear clave nueva**
5. Tipo: **JSON**
6. Clic en **CREAR**
7. Se descargará un archivo JSON (ej: `azmol-erp-backups-abc123.json`)

## Paso 5: Instalar credentials.json

1. Renombrar el archivo descargado a: **credentials.json**
2. Mover el archivo a la carpeta: `c:\Users\basma\Downloads\azmol-stockerp\scripts\`
3. El archivo debe quedar en: `scripts/credentials.json`

## Paso 6: Compartir la carpeta de Drive con el Service Account

1. Abrir [Google Drive](https://drive.google.com/)
2. Buscar tu carpeta de backup (ID: `1h-kJ2GVVNQwiwOIgjfMGfjVtRs8K2Kl0`)
3. Clic derecho > **Compartir**
4. Agregar el email del Service Account:
   - Email: `azmol-backup-service@azmol-erp-backups.iam.gserviceaccount.com`
   - (lo encuentras en el archivo credentials.json, campo "client_email")
5. Permisos: **Editor**
6. Desmarcar "Notificar a las personas"
7. Clic en **Compartir**

## Paso 7: Probar el Sistema

```bash
cd c:\Users\basma\Downloads\azmol-stockerp
npm run backup:test
```

Si todo está bien configurado, verás:
```
📁 Usando carpeta existente de Drive: 1h-kJ2GVVNQwiwOIgjfMGfjVtRs8K2Kl0
📦 Iniciando backup weekly de base de datos...
✅ SQL exportado: azmol-db-weekly-...
✅ Comprimido: azmol-db-weekly-...
🔒 Archivo cifrado: azmol-db-weekly-...
✓ Integridad verificada: azmol-db-weekly-...
☁️  Subido a Drive: azmol-db-weekly-...
✅ BACKUP SEMANAL COMPLETADO
```

## Archivos Importantes

- **credentials.json**: Credenciales del Service Account (NO subir a Git)
- **.env.backup**: Variables de entorno con passwords (NO subir a Git)
- **BACKUP_ENCRYPTION_KEY**: Guardar en lugar seguro, sin ella no podrás restaurar

## Seguridad

⚠️ **NUNCA** subir estos archivos a Git:
- `scripts/credentials.json`
- `scripts/.env.backup`
- `scripts/token.json`

Están ya incluidos en `.gitignore`.

## Solución de Problemas

### Error: "Carpeta de Drive no encontrada"
- Verificar que el ID de carpeta es correcto en `.env.backup`
- Verificar que compartiste la carpeta con el Service Account

### Error: "Authentication failed"
- Verificar que `credentials.json` está en `scripts/`
- Verificar que el Service Account tiene permisos en la carpeta

### Error: "pg_dump command not found"
- Instalar PostgreSQL client tools
- Windows: Agregar `C:\Program Files\PostgreSQL\XX\bin` al PATH
