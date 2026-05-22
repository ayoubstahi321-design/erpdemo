# Despliegue en Vercel ✅

## Opción 1: Despliegue Automático (Recomendado)

El código ya está en GitHub. Vercel detectará automáticamente los cambios:

1. **Accede a Vercel Dashboard**
   - Ve a https://vercel.com/dashboard

2. **Conecta el repositorio** (si aún no lo has hecho)
   - Click en "Add New..." → "Project"
   - Selecciona "azmolpro/azmol-stockerp"
   - Vercel importará automáticamente la configuración de `vercel.json`

3. **El despliegue es automático**
   - Cada push a `main` en GitHub dispara un nuevo despliegue
   - Vercel ejecutará: `npm run build` y servirá el contenido de `dist/`

## Opción 2: Despliegue Manual con CLI

```bash
# 1. Instalar Vercel CLI (una sola vez)
npm install -g vercel

# 2. Autenticarte
vercel login

# 3. Desplegar
vercel --prod
```

## Estado del Despliegue

✅ **Código actualizado en GitHub**
- Repositorio: https://github.com/azmolpro/azmol-stockerp
- Rama: main
- Commit: feat: Professional PDF generation system...

📦 **Configuración lista**
- `vercel.json` está configurado
- Build command: `npm run build`
- Output: `dist/`
- Framework: Vite

🚀 **Próximo paso**
- Ingresa a Vercel Dashboard y conecta el repositorio
- O ejecuta `vercel --prod` en terminal

## Variables de Entorno

Si necesitas variables de entorno en Vercel:

1. Ve a Project Settings → Environment Variables
2. Agrega las mismas variables que en tu `.env.local`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - Etc.

## URLs Típicas post-Despliegue

- **Production**: https://azmol-stockerp.vercel.app
- **Preview**: Automáticas en cada PR
- **Staging**: Configurable en Settings

---

✨ **¡Sistema de PDFs Profesionales listo para producción!**
