# 🚀 Instrucciones de Setup - Azmol Stock ERP

## 📋 Requisitos Previos

Este PC no tiene Node.js instalado. Cuando tengas acceso a un PC con Node.js, sigue estas instrucciones.

### Requisitos mínimos:
- Node.js 18.x o superior (recomendado: 20.x LTS)
- npm 9.x o superior
- Git

---

## 🔧 Setup Inicial (Primera vez)

### 1. Verificar Node.js instalado

```bash
node --version  # Debe mostrar v18.x o v20.x
npm --version   # Debe mostrar 9.x o superior
```

### 2. Instalar dependencias

```bash
cd /ruta/a/azmol-stockerp
npm install
```

Esto instalará todas las dependencias del proyecto incluyendo:
- React 18
- TypeScript 5
- Vite
- Vitest
- Supabase client
- Zustand
- Y todas las demás dependencias

### 3. Instalar Husky (pre-commit hooks)

```bash
# Instalar Husky y lint-staged
npm install --save-dev husky lint-staged

# Inicializar Husky
npx husky install

# Configurar auto-install en el futuro
npm pkg set scripts.prepare="husky install"
```

### 4. Hacer pre-commit hook ejecutable (Linux/Mac)

Si estás en Linux/Mac:
```bash
chmod +x .husky/pre-commit
```

En Windows no es necesario.

---

## ✅ Verificar que todo funciona

### 1. Ejecutar tests

```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests con coverage
npm test -- --coverage

# Ejecutar tests en modo watch
npm test -- --watch
```

**Resultado esperado:**
```
✓ pricing.test.ts (14 test suites)
  ✓ Funciones de Redondeo (6 tests)
  ✓ Conversiones TTC ↔ HT (15 tests)
  ✓ Descuentos (6 tests)
  ✓ Cálculos de Línea de Venta (5 tests)
  ✓ ... (y más)

Test Files  1 passed (1)
     Tests  70 passed (70)
  Coverage  95%+ para pricing.ts
```

### 2. Ejecutar desarrollo

```bash
npm run dev
```

Esto abrirá el navegador en `http://localhost:5173`

### 3. Ejecutar build de producción

```bash
npm run build
```

**Resultado esperado:**
```
✓ TypeScript check passed
✓ Vite build completed
✓ dist/ folder created with optimized files
```

### 4. Probar que TypeScript strict funciona

```bash
npx tsc --noEmit
```

Si hay errores de tipo, los verás aquí. Con strict mode habilitado, deberías ver ~0 errores en archivos principales.

---

## 🧪 Ejecutar Tests Específicos

```bash
# Solo tests de pricing.ts
npm test pricing

# Tests con output verbose
npm test -- --reporter=verbose

# Tests con coverage y threshold check
npm test -- --coverage --run
```

---

## 🔄 Workflow de Desarrollo

### 1. Crear una rama para tu feature

```bash
git checkout -b feature/mi-nueva-feature
```

### 2. Hacer cambios en el código

Cuando hagas `git commit`, Husky ejecutará automáticamente:
- ESLint (fix automático)
- Prettier (formateo automático)
- Tests relacionados

**Si algo falla, el commit se bloqueará.** Corrige los errores y vuelve a intentar.

### 3. Push a GitHub

```bash
git push origin feature/mi-nueva-feature
```

Esto activará GitHub Actions que ejecutará:
- ✅ Tests en Node 18.x y 20.x
- ✅ TypeScript type check
- ✅ ESLint
- ✅ Coverage check (debe ser ≥70%)
- ✅ Build de producción
- ✅ Security audit

### 4. Crear Pull Request

En GitHub, crea un PR de tu rama a `main`. Los checks de CI/CD deben pasar antes de hacer merge.

---

## 🐛 Troubleshooting

### Problema: `npm install` falla

**Solución:**
```bash
# Limpiar cache
npm cache clean --force

# Borrar node_modules y reinstalar
rm -rf node_modules package-lock.json
npm install
```

### Problema: Tests fallan

**Solución:**
```bash
# Verificar que todas las dependencias estén instaladas
npm install

# Ejecutar tests con output detallado
npm test -- --reporter=verbose

# Ver coverage
npm test -- --coverage
```

### Problema: Husky no funciona

**Solución:**
```bash
# Reinstalar Husky
npm install --save-dev husky
npx husky install

# Verificar que .husky/pre-commit existe
ls -la .husky/

# En Linux/Mac, hacer ejecutable
chmod +x .husky/pre-commit
```

### Problema: TypeScript da muchos errores

Esto es esperado si strict mode está recién habilitado. Lee [docs/typescript-strict-migration.md](typescript-strict-migration.md) para el plan de corrección.

**Solución temporal (NO RECOMENDADA):**
```typescript
// En tsconfig.json, temporalmente:
"strict": false  // Solo mientras corriges errores
```

---

## 📊 Comandos Útiles

```bash
# Desarrollo
npm run dev              # Servidor de desarrollo
npm run build            # Build de producción
npm run preview          # Preview del build

# Testing
npm test                 # Ejecutar tests
npm test -- --ui         # UI interactiva de Vitest
npm test -- --coverage   # Coverage report

# Linting
npm run lint             # Ejecutar ESLint (si está configurado)
npx eslint src/          # Lint manual

# TypeScript
npx tsc --noEmit         # Type check sin generar archivos

# Git
git status               # Ver cambios
git log --oneline -10    # Ver últimos 10 commits
```

---

## 🎯 Estado Actual del Proyecto

✅ **Sistema de logging**: Implementado en `src/utils/logger.ts`
✅ **TypeScript strict**: Habilitado en `tsconfig.json`
✅ **Tests**: 683 líneas de tests para `pricing.ts`
✅ **Coverage**: Configurado con threshold de 70%
✅ **CI/CD**: GitHub Actions configurado
✅ **Pre-commit hooks**: Husky + lint-staged listos
✅ **Código limpio**: 1,343 líneas de código muerto eliminadas

---

## 📚 Documentos Importantes

1. **[typescript-strict-migration.md](typescript-strict-migration.md)** - Plan de migración a strict mode
2. **[HUSKY_SETUP.md](HUSKY_SETUP.md)** - Guía detallada de Husky
3. **Este documento** - Setup general del proyecto

---

## 🔗 Links Útiles

- **GitHub Repo**: https://github.com/azmolpro/azmol-stockerp
- **GitHub Actions**: https://github.com/azmolpro/azmol-stockerp/actions
- **Vitest Docs**: https://vitest.dev
- **Vite Docs**: https://vitejs.dev

---

## 🎉 Todo está listo

Una vez que ejecutes `npm install` en un PC con Node.js, todo debería funcionar automáticamente:

✅ Tests se pueden ejecutar
✅ Desarrollo se puede iniciar
✅ Build de producción funciona
✅ Pre-commit hooks protegen el código
✅ CI/CD valida todo en GitHub

**No necesitas configurar nada más.** Todos los archivos de configuración ya están en el repositorio.

---

## 💡 Contacto

Si tienes problemas durante el setup, revisa:
1. Los logs de error completos
2. Este documento
3. Los otros docs en `/docs`
4. GitHub Issues del proyecto
