# Sistema de Backup - Guía de Usuario

## Resumen

El sistema de backup de AZMOL ERP tiene dos componentes:

1. **Backup desde la UI Web** - Para respaldo rápido y restauración manual
2. **Backup Profesional (Scripts)** - Para respaldo automático programado con Google Drive

---

## 1. Backup desde la UI Web

### Crear Backup

1. Haz clic en tu perfil de usuario (esquina superior derecha)
2. Selecciona **"Crear Sauvegarde"** / **"Crear Copia de Seguridad"** / **"Create Backup"**
3. El sistema exportará todos los datos de Supabase:
   - Productos
   - Ventas e ítems de venta
   - Clientes
   - Almacenes
   - Transferencias
   - Devoluciones
   - Perfiles de usuario
   - Logs de auditoría (últimos 1000)
4. El archivo se descargará automáticamente con formato:
   - Nombre: `azmol-erp-backup-YYYY-MM-DDTHH-MM-SS.gz`
   - Formato: JSON comprimido con gzip
   - Tamaño aproximado: 50-500 KB (dependiendo de los datos)

### Restaurar Backup

⚠️ **IMPORTANTE: La restauración automática está desactivada por seguridad.**

Para restaurar un backup:

1. Haz clic en tu perfil de usuario
2. Selecciona **"Restaurar"** / **"Restore"**
3. Selecciona el archivo `.gz` de backup
4. El sistema validará el archivo y mostrará:
   - Fecha de creación
   - Versión
   - Cantidad de registros
5. Contacta al administrador del sistema para completar la restauración

**Proceso de restauración manual:**
1. El administrador accede al Dashboard de Supabase
2. Abre el archivo de backup (descomprimir con cualquier herramienta gzip)
3. Revisa el JSON para verificar la integridad
4. Ejecuta scripts SQL para restaurar los datos
5. Verifica la consistencia de los datos

---

## 2. Backup Profesional (Scripts Node.js)

### Características

- ✅ Exportación completa de la base de datos Supabase
- ✅ Compresión gzip para reducir tamaño
- ✅ Cifrado AES-256-GCM para seguridad
- ✅ Subida automática a Google Drive
- ✅ Estructura de carpetas organizada
- ✅ Políticas de retención automática (7 días, 60 días, 10 años)
- ✅ Cumple con normativa marroquí de conservación de datos

### Uso de Scripts

```bash
# Backup semanal (recomendado para uso regular)
npm run backup:weekly

# Backup diario (para empresas con alta actividad)
npm run backup:daily

# Backup trimestral (archivo a largo plazo)
npm run backup:quarterly

# Listar backups disponibles en Google Drive
npm run restore:list

# Restaurar el último backup semanal
npm run restore:latest
```

### Configuración de Google Drive

Los scripts ya están configurados y conectados a Google Drive. Las credenciales están en:
- `scripts/credentials.json` - Credenciales de servicio de Google Cloud
- `scripts/.env.backup` - Variables de entorno (clave de cifrado, folder ID)

### Automatización (Recomendado)

**Windows Task Scheduler:**
1. Abre el Programador de Tareas
2. Crea una nueva tarea básica
3. Programa: Semanal, cada domingo a las 2:00 AM
4. Acción: `cd C:\Users\basma\Desktop\azmol-stockerp && npm run backup:weekly`
5. Guarda la tarea

**Resultado**: Backup automático cada semana sin intervención manual.

---

## Comparación de Sistemas

| Característica | Backup UI Web | Backup Profesional |
|----------------|---------------|-------------------|
| **Velocidad** | Rápido (segundos) | Moderado (minutos) |
| **Cifrado** | No | Sí (AES-256-GCM) |
| **Almacenamiento** | Local (descarga) | Google Drive |
| **Automático** | No | Sí (con scheduler) |
| **Retención** | Manual | Automática (7d-10y) |
| **Restauración** | Manual | Automática |
| **Uso recomendado** | Backup rápido antes de cambios importantes | Backup regular programado |

---

## Mejores Prácticas

### Para Usuarios

1. **Backup antes de cambios importantes:**
   - Antes de importar datos masivos
   - Antes de eliminar registros antiguos
   - Antes de actualizar la aplicación

2. **Verificar backups periódicamente:**
   - Descarga un backup mensual
   - Guárdalo en un disco externo o en la nube personal

### Para Administradores

1. **Configurar backup automático semanal**
   - Usar Windows Task Scheduler
   - Verificar logs de backup en `scripts/backup-log.txt`

2. **Monitorear espacio en Google Drive**
   - Carpeta: `AZMOL_ERP_BACKUPS`
   - Revisar políticas de retención
   - Limpiar backups muy antiguos si es necesario

3. **Probar restauración trimestralmente**
   - Restaurar en un entorno de prueba
   - Verificar integridad de datos
   - Documentar el proceso

---

## Solución de Problemas

### Error: "Backup failed"
- **Causa**: Problema de conexión a Supabase
- **Solución**: Verificar conexión a internet y credenciales en `.env`

### Error: "Invalid backup file"
- **Causa**: Archivo corrupto o formato incorrecto
- **Solución**: Descargar nuevo backup o verificar integridad con `gzip -t archivo.gz`

### Error: "QuotaExceededError"
- **Causa**: Espacio insuficiente en localStorage
- **Solución**: Este error solo aplica al antiguo sistema. El nuevo sistema descarga directo.

### Backup profesional no sube a Google Drive
- **Causa**: Credenciales inválidas o permisos insuficientes
- **Solución**: Verificar `scripts/credentials.json` y regenerar token si es necesario

---

## Seguridad

### Datos Sensibles

Los backups contienen:
- ✅ Datos de productos (precios, stock)
- ✅ Datos de ventas (transacciones, montos)
- ✅ Datos de clientes (nombres, direcciones, deudas)
- ❌ NO contienen contraseñas (están hasheadas en Supabase)

### Recomendaciones

1. **No compartir archivos de backup** por email o redes sociales
2. **Cifrar backups locales** con herramientas como 7-Zip (contraseña fuerte)
3. **Limitar acceso** a la carpeta de Google Drive
4. **Rotar la clave de cifrado** anualmente (`BACKUP_ENCRYPTION_KEY` en `.env.backup`)

---

## Contacto

Para soporte con el sistema de backup:
- **Administrador del Sistema**: [Email del admin]
- **Documentación adicional**: `scripts/README.md`
- **Logs de backup**: `scripts/backup-log.txt`
