# 🚀 Guía de Despliegue en Vercel

Esta guía te ayudará a desplegar tu aplicación AZMOL StockERP en Vercel.

## 📋 Requisitos Previos

1. Cuenta de GitHub con el repositorio del proyecto
2. Cuenta de Vercel (puedes usar tu cuenta de GitHub)
3. Base de datos Supabase configurada

## 🔧 Paso 1: Preparar el Repositorio

1. **Asegúrate de que todos los cambios estén en GitHub:**
   ```bash
   git add .
   git commit -m "Preparar para despliegue en Vercel"
   git push origin main
   ```

## 🌐 Paso 2: Conectar con Vercel

1. Ve a [vercel.com](https://vercel.com) e inicia sesión con GitHub
2. Click en **"Add New..."** → **"Project"**
3. Importa tu repositorio `azmol-stockerp`
4. Vercel detectará automáticamente que es un proyecto Vite

## ⚙️ Paso 3: Configurar Variables de Entorno

En la sección **"Environment Variables"** de Vercel, agrega:

### Variables Requeridas:

| Nombre | Valor | Descripción |
|--------|-------|-------------|
| `VITE_SUPABASE_URL` | `https://tu-proyecto.supabase.co` | URL de tu proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGc...` | Clave pública (anon) de Supabase |

**⚠️ IMPORTANTE:**
- Usa la clave **ANON** (pública), NO la Service Role Key
- Encuentra estas claves en: Supabase Dashboard → Settings → API

### Cómo agregar las variables:

1. En el formulario de Vercel, desplázate hasta **"Environment Variables"**
2. Agrega cada variable:
   - Name: `VITE_SUPABASE_URL`
   - Value: (pega tu URL de Supabase)
   - Environments: Selecciona **Production**, **Preview**, y **Development**
3. Click **"Add"**
4. Repite para `VITE_SUPABASE_ANON_KEY`

## 🏗️ Paso 4: Configuración de Build

Vercel debería detectar automáticamente la configuración gracias al `vercel.json`:

- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

Si no se detecta automáticamente, configura estos valores manualmente.

## 🚀 Paso 5: Deploy

1. Click en **"Deploy"**
2. Espera 2-3 minutos mientras Vercel construye tu aplicación
3. Una vez completado, verás un mensaje de éxito con la URL de tu aplicación

## ✅ Paso 6: Verificar el Despliegue

1. Haz click en la URL generada (ej: `https://azmol-stockerp.vercel.app`)
2. Prueba el login con tu cuenta de Supabase
3. Verifica que todas las funciones trabajen correctamente

## 🔄 Despliegues Automáticos

Cada vez que hagas push a tu rama `main`, Vercel desplegará automáticamente:

```bash
git add .
git commit -m "Actualización de funcionalidad"
git push origin main
# Vercel desplegará automáticamente en ~2 minutos
```

## 🐛 Solución de Problemas Comunes

### Error: "Failed to compile"

**Solución:**
1. Verifica que todas las dependencias estén en `package.json`
2. Ejecuta localmente: `npm run build`
3. Corrige cualquier error de TypeScript

### Error: "VITE_SUPABASE_URL is not defined"

**Solución:**
1. Verifica que agregaste las variables de entorno en Vercel
2. Asegúrate de que tienen el prefijo `VITE_`
3. Re-despliega manualmente: Deployments → Click en los tres puntos → Redeploy

### Error 404 al recargar la página

**Solución:**
- El archivo `vercel.json` ya incluye las reglas de reescritura necesarias
- Si el error persiste, verifica que `vercel.json` esté en la raíz del proyecto

### La aplicación no conecta con Supabase

**Solución:**
1. Verifica las variables de entorno en Vercel Dashboard
2. Asegúrate de usar la clave **ANON**, no la Service Role
3. En Supabase Dashboard → Authentication → URL Configuration, agrega tu dominio de Vercel a "Site URL" y "Redirect URLs"

## 🔒 Configurar Dominio Personalizado (Opcional)

1. En tu proyecto de Vercel, ve a **Settings** → **Domains**
2. Agrega tu dominio personalizado
3. Configura los DNS según las instrucciones de Vercel
4. Actualiza en Supabase: Settings → Authentication → URL Configuration

## 📊 Monitoreo

Vercel proporciona:
- **Analytics**: Uso y rendimiento
- **Logs**: Errores en tiempo real
- **Speed Insights**: Métricas de velocidad

Accede a estos en tu dashboard de Vercel.

## 🔐 Seguridad - Configuración de Supabase

Después del despliegue, configura en Supabase:

1. **Authentication → URL Configuration:**
   - Site URL: `https://tu-app.vercel.app`
   - Redirect URLs: `https://tu-app.vercel.app/**`

2. **API Settings:**
   - Verifica que RLS (Row Level Security) esté habilitado en todas las tablas

## 📝 Comandos Útiles de Vercel CLI (Opcional)

Instala Vercel CLI para más control:

```bash
npm i -g vercel

# Desplegar desde línea de comandos
vercel

# Desplegar a producción
vercel --prod

# Ver logs en tiempo real
vercel logs
```

## 🆘 Soporte

- [Documentación de Vercel](https://vercel.com/docs)
- [Documentación de Vite](https://vitejs.dev/)
- [Documentación de Supabase](https://supabase.com/docs)

---

**✨ ¡Tu aplicación AZMOL StockERP está lista para el mundo!**
