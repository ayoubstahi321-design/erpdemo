# ✅ CHECKLIST DE PRODUCCIÓN - AZMOL STOCKERP

## 🔐 Seguridad (CRÍTICO)

- [ ] **Variables de entorno configuradas en Vercel**
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
  - [ ] Verificar que NO esté la Service Role Key en frontend

- [ ] **Supabase RLS activo**
  - [ ] Ejecutar `VERIFICACION-SISTEMA-COMPLETO.md`
  - [ ] Probar que usuarios no pueden ver datos de otros
  - [ ] Verificar permisos por rol (Admin, Manager, Sales, etc.)

- [ ] **Autenticación probada**
  - [ ] Login funciona
  - [ ] Logout funciona
  - [ ] Session expiration redirige a login
  - [ ] No hay tokens expuestos en console

## 💾 Backups (CRÍTICO)

- [ ] **Backup automático de Supabase configurado**
  - [ ] Daily backups habilitados (Settings → Database → Backups)
  - [ ] Google Drive backup script probado (`npm run backup:test`)
  - [ ] Probar restore de un backup

- [ ] **Código versionado**
  - [ ] Todo commiteado en GitHub
  - [ ] `.env` en `.gitignore`
  - [ ] README actualizado

## 📊 Monitoreo (IMPORTANTE)

- [ ] **Vercel Analytics configurado** ✅ (Ya hecho)
  - [ ] `@vercel/analytics` instalado
  - [ ] `inject()` en main.tsx
  - [ ] Verificar en Vercel Dashboard → Analytics

- [ ] **Error Boundary activo** ✅ (Ya hecho)
  - [ ] Componente creado
  - [ ] Envuelve toda la app
  - [ ] Probado lanzando error de prueba

- [ ] **Logs de errores**
  - [ ] Ejecutar `supabase/migrations/error-logs-table.sql`
  - [ ] Verificar que errores se guardan en Supabase
  - [ ] Ver logs en Vercel Dashboard

## 🧪 Testing (IMPORTANTE)

- [ ] **GitHub Actions funcionando** ✅ (Ya configurado)
  - [ ] Tests pasan: `npm run test`
  - [ ] Build funciona: `npm run build`
  - [ ] Lint pasa: `npm run lint`
  - [ ] Workflow ejecutándose en GitHub

- [ ] **Pruebas manuales en producción**
  - [ ] Login/Logout
  - [ ] Crear producto
  - [ ] Crear venta
  - [ ] Transferencia entre almacenes
  - [ ] Crear cliente
  - [ ] POS funciona
  - [ ] Reportes se generan
  - [ ] Devoluciones funcionan

## 🚀 Performance (DESEABLE)

- [ ] **Build optimizado**
  - [ ] `npm run build` sin errores
  - [ ] Bundle size < 1 MB (verificar en build output)
  - [ ] Lazy loading en componentes grandes

- [ ] **Imágenes optimizadas**
  - [ ] Logo en formato WebP
  - [ ] Tamaño adecuado (no más de 500 KB)

## 🌐 Dominio y SEO (DESEABLE)

- [ ] **Dominio personalizado**
  - [ ] Configurado en Vercel (Settings → Domains)
  - [ ] SSL activo (automático en Vercel)
  - [ ] Redirección de www a apex (o viceversa)

- [ ] **Meta tags básicos**
  - [ ] Title tag
  - [ ] Description
  - [ ] Favicon
  - [ ] manifest.json para PWA

## 📱 PWA (DESEABLE)

- [ ] **Service Worker**
  - [ ] `sw.js` funciona
  - [ ] Caché offline básico
  - [ ] Probado en modo offline

- [ ] **Instalable**
  - [ ] manifest.json correcto
  - [ ] Iconos en todos los tamaños
  - [ ] "Agregar a inicio" funciona en móvil

## 📞 Soporte (IMPORTANTE)

- [ ] **Documentación actualizada**
  - [ ] README con instrucciones claras
  - [ ] Guía de usuario básica
  - [ ] FAQs comunes

- [ ] **Plan de contingencia**
  - [ ] Contacto de emergencia definido
  - [ ] Proceso de rollback documentado
  - [ ] Backup reciente confirmado

---

## 🎯 VALIDACIÓN FINAL

Antes de declarar "LISTO PARA PRODUCCIÓN":

1. ✅ Ejecutar checklist completo
2. ✅ Probar todas las funciones críticas
3. ✅ Verificar backups recientes
4. ✅ Confirmar monitoreo activo
5. ✅ Hacer commit final
6. ✅ Verificar deployment en Vercel
7. ✅ Probar en dispositivo móvil
8. ✅ Probar con usuario real (no admin)

---

**Fecha de última verificación**: _______________
**Verificado por**: _______________
**Próxima revisión**: _______________ (cada 3 meses)
