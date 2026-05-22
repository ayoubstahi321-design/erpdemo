# 🚀 Deployment Automático en Vercel - Guía Completa

## 📋 Descripción General

Tu app está configurada para hacer **deployment automático** cada vez que haces `push` a la rama `main`. GitHub Actions ejecutará:
1. ✅ Validación de código
2. ✅ Build
3. ✅ Deploy a Vercel

## 🔧 Configuración Requerida

### Paso 1: Obtén tus Credenciales de Vercel

1. **Ir a Vercel Dashboard**: https://vercel.com/dashboard
2. **Settings → Tokens**
3. **Crear un nuevo token**:
   - Click "Create"
   - Name: `GITHUB_DEPLOY`
   - Scope: `Full Account`
   - Expiration: `No expiration`
   - Copiar el token (aparece una sola vez)

4. **Obtener IDs del Proyecto**:
   - Ir a tu proyecto en Vercel
   - Settings → General
   - Copiar:
     - **Project ID**
     - **Org ID** (si está disponible)

### Paso 2: Configurar GitHub Secrets

1. **Ir a tu repo**: https://github.com/azmolpro/azmol-stockerp
2. **Settings → Secrets and variables → Actions**
3. **New repository secret** - Agregar estos 3 secrets:

```
Name: VERCEL_TOKEN
Value: [Token que copiaste en Paso 1]

Name: VERCEL_ORG_ID
Value: [Org ID de tu account Vercel]

Name: VERCEL_PROJECT_ID
Value: [Project ID de tu proyecto]
```

### Paso 3: Configurar Variables de Entorno

En el mismo lugar (Secrets and variables → Actions):

**New repository variable** - Agregar variables públicas:

```
Name: VITE_SUPABASE_URL
Value: https://mkehxermgmdqsogmlaqq.supabase.co

Name: VITE_SUPABASE_ANON_KEY
Value: [Tu anon key de Supabase]
```

Puedes obtener estas variables de tu `.env` local o del Supabase Dashboard.

## ✅ Verificar que Todo Está Configurado

### Test 1: Ver Secrets Configurados

```bash
# Ir al repo
cd /workspaces/azmol-stockerp

# Hacer un pequeño cambio y commit
echo "# Deploy Test $(date)" >> TEST_DEPLOY.md
git add TEST_DEPLOY.md
git commit -m "test: trigger deployment"
git push origin main
```

### Test 2: Monitorear el Deploy

1. **Ir a Actions**: https://github.com/azmolpro/azmol-stockerp/actions
2. **Ver el workflow** `Deploy to Production`
3. Estados posibles:
   - 🟡 **In Progress**: Se está compilando y desplegando
   - 🟢 **Success**: ¡Deployment listo!
   - 🔴 **Failed**: Hay un error (revisar logs)

### Test 3: Ver la App Desplegada

- **URL en Vercel**: https://azmol-stockerp.vercel.app (o tu custom domain)
- Debería mostrar la versión más reciente de tu código

## 📊 Workflow Automático

```
Tu commit a main
    ↓
GitHub Actions se activa automáticamente
    ↓
1. npm ci (install dependencies)
2. npm run build (compilar)
3. npm run lint (validar código)
    ↓
Si todo pasó:
    ↓
vercel deploy --prod (desplegar a producción)
    ↓
✅ App actualizada en Vercel
    ↓
Puedes acceder inmediatamente
```

## 🔄 Cómo Funciona Ahora

### Cada vez que haces `git push origin main`:

1. **Automáticamente** se inicia un workflow en GitHub
2. Se compila tu código (`npm run build`)
3. Se despliega a Vercel en **~2-5 minutos**
4. Tu app está actualizada en producción

### Ejemplo:

```bash
# Hacer cambios localmente
nano src/components/Sales.tsx

# Commit y push
git add src/components/Sales.tsx
git commit -m "fix: B2B return refresh"
git push origin main

# ✅ En ~2 minutos: cambios vivos en producción
# Ver en: https://azmol-stockerp.vercel.app
```

## ⚠️ Importante: Variables de Entorno

Las variables públicas (`VITE_*`) se pueden ver en el navegador, es SEGURO agregarlas.

**NUNCA agregues en GitHub secrets:**
- `SUPABASE_SERVICE_ROLE_KEY` (este es secreto)
- Claves API de servicios privados

## 🔗 Archivos Configurados

| Archivo | Propósito |
|---------|-----------|
| `.github/workflows/deploy.yml` | Workflow de CI/CD |
| `vercel.json` | Configuración de Vercel |
| `.vercelignore` | Archivos a ignorar en deploy |
| `.env.example` | Template de variables (sin valores reales) |

## 📞 Troubleshooting

### ❌ Error: "VERCEL_TOKEN is not set"

**Solución**:
```
Settings → Secrets and variables → Actions
Verifica que VERCEL_TOKEN esté presente
```

### ❌ Build falla: "Cannot find module"

**Solución**:
```bash
# Limpia y reinstala localmente
rm -rf node_modules package-lock.json
npm install
npm run build

# Si funciona localmente pero falla en CI:
# El problema probablemente es que falta una variable de entorno
```

### ❌ Deploy lento (>10 minutos)

**Puede ser**:
- Vercel está ocupado
- Tu build es muy pesado
- Hay muchos cambios

**No es normal** - debería ser ~2-5 min

## 🎯 Próximos Pasos

1. ✅ Agrega los 3 secrets a GitHub (VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID)
2. ✅ Agrega las 2 variables públicas (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
3. ✅ Haz un pequeño cambio y push
4. ✅ Ve a GitHub Actions y monitorea el deploy
5. ✅ Verifica que tu app está actualizada en Vercel

## 📝 Comandos Útiles

```bash
# Ver el build localmente (como lo hace Vercel)
npm run build
npm run preview

# Desplegar manualmente si algo falla
npx vercel deploy --prod --token $VERCEL_TOKEN

# Verificar que el build es reproducible
npm ci  # Instala exactamente lo del lock file
npm run build
```

---

**Estado**: ✅ Configurado - El deployment automático está listo una vez agregues los secrets a GitHub.

**Siguiente**: Configura los GitHub Secrets y haz tu primer push para ver el deploy en acción.
