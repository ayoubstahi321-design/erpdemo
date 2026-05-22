# ✅ CHECKLIST PRE-DEPLOY (100% Gratis)

**Ejecutar antes de cada deploy a producción**

## 🔐 SEGURIDAD

- [ ] Variables de entorno configuradas en Vercel
  - [ ] `VITE_SUPABASE_URL` ✅
  - [ ] `VITE_SUPABASE_ANON_KEY` ✅
- [ ] RLS (Row Level Security) activo en todas las tablas
- [ ] Auth configurado en Supabase
- [ ] Service Role Key NO expuesta en frontend

## 🧪 CALIDAD DE CÓDIGO

- [ ] `npm run build` sin errores
- [ ] `npm run lint` sin errores críticos
- [ ] `npm test` pasa todos los tests
- [ ] Sin warnings de TypeScript

## 📊 MONITOREO (Gratis)

- [ ] Vercel Analytics instalado ✅
- [ ] Error Boundary implementado ✅
- [ ] Tabla `error_logs` creada en Supabase ✅
- [ ] Console.logs de producción limpios

## 💾 BACKUPS

- [ ] Backups automáticos de Supabase activados
- [ ] Google Drive configurado (opcional)
- [ ] Probado restore de backup al menos 1 vez

## 🚀 PERFORMANCE

- [ ] Build size < 500KB (revisar con `npm run build`)
- [ ] Lazy loading en componentes grandes
- [ ] Imágenes optimizadas
- [ ] Service Worker actualizado

## 🌐 PRODUCCIÓN

- [ ] Probado en diferentes navegadores
- [ ] Responsive en móvil
- [ ] PWA funcionando (offline)
- [ ] Dominio personalizado configurado (opcional)

## 📝 DOCUMENTACIÓN

- [ ] README actualizado con instrucciones
- [ ] Variables de entorno documentadas
- [ ] Changelog actualizado

---

## 🎯 COMANDOS RÁPIDOS

```bash
# Antes de commit
npm run lint
npm test
npm run build

# Después de deploy
# Ver logs en: vercel.com → Tu proyecto → Logs
# Ver analytics en: vercel.com → Tu proyecto → Analytics
```

## 🆘 EN CASO DE ERROR EN PRODUCCIÓN

1. Ver logs en Vercel Dashboard
2. Revisar tabla `error_logs` en Supabase
3. Rollback: Vercel Dashboard → Deployments → Promote to Production
4. Fix local → Commit → Auto-deploy

---

**Costo total: $0/mes** 💰
