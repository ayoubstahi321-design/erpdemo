# 🔒 Sistema de Backup - AZMOL ERP

Sistema automatizado de respaldo que cumple con normativa marroquí (retención 10 años).

## 🚀 Inicio Rápido

### 1. Instalar

```bash
npm install
```

### 2. Configurar

```bash
# Copiar plantilla
cp scripts/.env.backup.example scripts/.env.backup

# Editar con tus valores
nano scripts/.env.backup
```

### 3. Configurar Google Drive

Seguir guía completa en: [`docs/BACKUP_SETUP.md`](../docs/BACKUP_SETUP.md)

### 4. Probar

```bash
# Backup de prueba
npm run backup:test

# Listar backups
npm run restore:list
```

## 📅 Backups Automáticos

### Scripts NPM

```bash
# Backup diario (facturas nuevas)
npm run backup:daily

# Backup semanal (base de datos completa)
npm run backup:weekly

# Backup trimestral (archivo histórico 10 años)
npm run backup:quarterly

# Restaurar último backup
npm run restore:latest

# Ver backups disponibles
npm run restore:list
```

### Cron Jobs (Automático)

```cron
# Diario a las 23:00
0 23 * * * cd /ruta/proyecto && npm run backup:daily

# Semanal - Domingos 02:00
0 2 * * 0 cd /ruta/proyecto && npm run backup:weekly

# Trimestral - 1er día trimestre 03:00
0 3 1 1,4,7,10 * cd /ruta/proyecto && npm run backup:quarterly
```

## 🔐 Seguridad

✅ **Cifrado AES-256-GCM** - Máxima seguridad
✅ **Compresión GZIP** - Ahorro 70-90% espacio
✅ **Google Drive** - Almacenamiento en la nube
✅ **Verificación Integridad** - Antes de subir
✅ **Retención Legal** - 10 años para facturas

## 📊 Retención

| Tipo | Frecuencia | Retención | Espacio |
|------|-----------|-----------|---------|
| Diario | 23:00 | 7 días | ~5 MB |
| Semanal | Dom 02:00 | 60 días | ~50 MB |
| Trimestral | Trim 03:00 | 10 años | ~500 MB |

**Total**: < 1 GB en 10 años ✅ Plan Gratuito

## 🆘 Restauración

```bash
# Ver backups
npm run restore:list

# Restaurar último
npm run restore:latest

# Restaurar específico
node scripts/restore-backup.js restore <backup-id>
```

## 📚 Documentación

Ver guía completa: [`docs/BACKUP_SETUP.md`](../docs/BACKUP_SETUP.md)

## ⚠️ Importante

- ❌ **NO** subir `credentials.json` a Git
- ❌ **NO** subir `.env.backup` a Git
- ✅ Guardar `BACKUP_ENCRYPTION_KEY` en lugar seguro
- ✅ Probar restauración trimestralmente

## 🔧 Solución de Problemas

### Error: Clave de cifrado no configurada

```bash
# Generar clave
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Agregar a .env.backup
echo "BACKUP_ENCRYPTION_KEY=clave_aqui" >> scripts/.env.backup
```

### Verificar estado

```bash
# Ver logs
tail -f /var/log/azmol-backup-*.log

# Listar cron jobs
crontab -l

# Probar backup manual
npm run backup:test
```

---

**Documentación completa**: [`docs/BACKUP_SETUP.md`](../docs/BACKUP_SETUP.md)
