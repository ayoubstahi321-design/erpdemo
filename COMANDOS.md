# 🎮 Comandos Útiles - Azmol Stock ERP

Referencia rápida de todos los comandos disponibles.

---

## 📦 Setup Inicial

### Instalar Dependencias
```bash
# Frontend
cd web
npm install

# Volver a raíz
cd ..
```

### Configurar Variables de Entorno
```bash
# Copiar templates
cp .env.example .env
cp web/.env.example web/.env

# Editar archivos
# Windows:
notepad .env
notepad web/.env

# Linux/Mac:
nano .env
nano web/.env
```

---

## 🧪 Testing

### Ejecutar Tests
```bash
cd web

# Ejecutar todos los tests (modo watch)
npm test

# Ejecutar una sola vez
npm test -- --run

# Ver UI interactiva
npm run test:ui

# Ver cobertura
npm run test:coverage

# Ejecutar tests específicos
npm test fuzzySearch
npm test usePagination
```

### Ver Reporte de Cobertura
```bash
cd web
npm run test:coverage

# Abrir reporte HTML (después de generar)
# Windows:
start coverage/index.html

# Linux/Mac:
open coverage/index.html
```

---

## 🚀 Desarrollo

### Servidor de Desarrollo
```bash
cd web
npm run dev

# Abre en: http://localhost:5173
```

### Build para Producción
```bash
cd web

# Build
npm run build

# Vista previa del build
npm run preview

# Build con análisis de bundle
npm run build -- --analyze
```

### Verificar TypeScript
```bash
cd web

# Verificar errores sin generar archivos
npx tsc --noEmit

# Ver errores de imports no usados
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
```

### Linter
```bash
cd web

# Ejecutar ESLint
npm run lint

# Arreglar problemas automáticamente
npm run lint -- --fix
```

---

## 🗄️ Supabase

### Supabase Local
```bash
# Iniciar Supabase local
npx supabase start

# Ver status
npx supabase status

# Detener
npx supabase stop

# Aplicar migraciones
npx supabase db push

# Reset de base de datos
npx supabase db reset
```

### Edge Functions
```bash
# Servir función localmente
npx supabase functions serve validate-sale

# Deploy a producción
npx supabase functions deploy validate-sale
npx supabase functions deploy validate-inventory
npx supabase functions deploy ai-assistant
```

---

## 🔍 Debugging

### Ver Logs en Producción
```bash
# Logs de funciones edge
npx supabase functions logs validate-sale

# Ver logs en tiempo real
npx supabase functions logs validate-sale --tail
```

### Limpiar Caché
```bash
cd web

# Limpiar node_modules y reinstalar
rm -rf node_modules package-lock.json
npm install

# Limpiar caché de Vite
rm -rf node_modules/.vite

# Limpiar build
rm -rf dist
```

### Desregistrar Service Worker (Debugging)
```javascript
// Ejecutar en consola del navegador:
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.unregister());
  console.log('Service Workers unregistered');
});
```

### Limpiar Caché del Navegador
```javascript
// Ejecutar en consola del navegador:
caches.keys().then(keys => {
  keys.forEach(key => caches.delete(key));
  console.log('All caches cleared');
});
```

---

## 📊 Análisis

### Tamaño de Bundle
```bash
cd web
npm run build

# Ver distribución de tamaño
npx vite-bundle-visualizer
```

### Análisis de Performance
```bash
# Con Lighthouse (Chrome DevTools)
# 1. Abrir Chrome DevTools (F12)
# 2. Ir a pestaña "Lighthouse"
# 3. Click en "Generate report"
```

### Verificar Dependencias
```bash
cd web

# Ver paquetes outdated
npm outdated

# Auditoría de seguridad
npm audit

# Arreglar vulnerabilidades
npm audit fix
```

---

## 🗂️ Git

### Verificar .env no está en Git
```bash
# Ver archivos que Git rastreará
git status

# Ver archivos ignorados
git status --ignored

# Si .env aparece en cambios:
git rm --cached .env
git rm --cached web/.env
```

### Commits Recomendados
```bash
# Añadir mejoras
git add .
git commit -m "feat: añadir Zustand store y hooks reutilizables"

# Añadir tests
git add web/src/**/__tests__
git commit -m "test: añadir tests para fuzzySearch y usePagination"

# Añadir seguridad
git add .gitignore .env.example web/.env.example SECURITY.md
git commit -m "security: proteger variables de entorno"
```

---

## 📱 PWA

### Probar PWA Localmente
```bash
cd web

# Build
npm run build

# Servir con preview
npm run preview

# Abrir en navegador en modo incógnito
# Chrome: http://localhost:4173
# Abrir DevTools > Application > Service Workers
```

### Verificar Manifest
```bash
# Abrir en navegador:
# http://localhost:5173/manifest.json

# Validar con:
# https://manifest-validator.appspot.com/
```

### Probar Instalación PWA
```bash
# 1. Ejecutar build y preview
cd web && npm run build && npm run preview

# 2. Abrir en Chrome/Edge
# 3. Click en icono de instalación en barra de direcciones
# 4. O: Menú > Instalar Azmol Stock ERP
```

---

## 🔧 Mantenimiento

### Actualizar Dependencias
```bash
cd web

# Actualizar a versiones patch/minor seguras
npm update

# Ver qué se puede actualizar
npm outdated

# Actualizar a latest (cuidado)
npx npm-check-updates -u
npm install
```

### Limpiar Proyecto Completo
```bash
# Desde raíz
rm -rf web/node_modules
rm -rf web/dist
rm -rf web/.vite
rm -rf web/coverage
rm -rf .supabase

# Reinstalar
cd web && npm install
```

---

## 📈 Monitoreo

### Ver Estado de Tests en CI
```bash
# Si tienes GitHub Actions configurado:
git push origin main

# Ver en: https://github.com/tu-usuario/azmol-stockerp/actions
```

### Verificar Service Worker Activo
```javascript
// En consola del navegador:
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Registrados:', regs.length);
  regs.forEach((reg, i) => {
    console.log(`SW ${i}:`, reg.scope);
  });
});
```

### Ver Espacio de Almacenamiento Usado
```javascript
// En consola del navegador:
if (navigator.storage && navigator.storage.estimate) {
  navigator.storage.estimate().then(estimate => {
    console.log('Usado:', estimate.usage);
    console.log('Cuota:', estimate.quota);
    console.log('% Usado:', (estimate.usage / estimate.quota * 100).toFixed(2) + '%');
  });
}
```

---

## 🚢 Deploy

### Build Optimizado
```bash
cd web

# Build con optimizaciones
npm run build

# Verificar tamaño de archivos
ls -lh dist/assets/

# Preview antes de deploy
npm run preview
```

### Deploy a Vercel
```bash
cd web

# Si tienes Vercel CLI instalado:
vercel deploy

# Producción:
vercel --prod
```

### Deploy a Netlify
```bash
cd web

# Si tienes Netlify CLI instalado:
netlify deploy

# Producción:
netlify deploy --prod
```

---

## 🆘 Troubleshooting

### "Cannot find module"
```bash
cd web
rm -rf node_modules package-lock.json
npm install
```

### "Port already in use"
```bash
# Cambiar puerto
cd web
npm run dev -- --port 3000
```

### Tests no ejecutan
```bash
cd web

# Verificar Vitest instalado
npm list vitest

# Reinstalar dependencias de test
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

### Build falla con errores TypeScript
```bash
cd web

# Ver errores específicos
npx tsc --noEmit

# Build ignorando algunos checks (temporal)
npm run build -- --mode development
```

---

## 📚 Comandos Personalizados

### Crear Nuevo Hook
```bash
# Template
touch web/src/hooks/useMyHook.ts
touch web/src/hooks/__tests__/useMyHook.test.ts
```

### Crear Nuevo Componente con Test
```bash
# Template
touch web/src/components/MyComponent.tsx
touch web/src/components/__tests__/MyComponent.test.tsx
```

### Ejecutar Tests de un Directorio
```bash
cd web

# Tests de hooks
npm test -- src/hooks

# Tests de utils
npm test -- src/utils
```

---

## 🎯 Scripts Personalizados Útiles

Añadir a `web/package.json`:

```json
{
  "scripts": {
    "clean": "rm -rf node_modules dist .vite coverage",
    "fresh": "npm run clean && npm install",
    "type-check": "tsc --noEmit",
    "analyze": "npm run build -- --mode analyze",
    "preview:https": "vite preview --https"
  }
}
```

Uso:
```bash
cd web
npm run fresh    # Limpiar y reinstalar todo
npm run type-check  # Solo verificar TypeScript
```

---

## 🔗 Enlaces Rápidos

### Localhost
- **Dev**: http://localhost:5173
- **Preview**: http://localhost:4173
- **Supabase Studio**: http://localhost:54323

### Documentación
- [Vitest](https://vitest.dev/)
- [Zustand](https://github.com/pmndrs/zustand)
- [Testing Library](https://testing-library.com/)
- [Vite](https://vitejs.dev/)

---

## 💡 Tips

### Ejecutar tests en watch mode
```bash
cd web
npm test
# Presiona 'a' para ejecutar todos
# Presiona 'p' para filtrar por archivo
# Presiona 'q' para salir
```

### Ver solo tests que fallan
```bash
cd web
npm test -- --reporter=verbose --bail=1
```

### Generar reporte de cobertura HTML
```bash
cd web
npm run test:coverage
# Abre: coverage/index.html
```

---

**¡Guarda este archivo como referencia rápida! 📖**

_Actualizado: 2025-12-29_
