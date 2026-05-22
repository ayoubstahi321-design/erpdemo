# Configuración de Husky + lint-staged

## 📦 Instalación

Para activar los pre-commit hooks, ejecuta:

```bash
# Instalar Husky y lint-staged
npm install --save-dev husky lint-staged

# Inicializar Husky
npx husky install

# Agregar script de prepare al package.json
npm pkg set scripts.prepare="husky install"

# Hacer el pre-commit hook ejecutable (Linux/Mac)
chmod +x .husky/pre-commit
```

## ⚙️ Configuración

Los archivos de configuración ya están creados:

### `.husky/pre-commit`
Hook que se ejecuta automáticamente antes de cada commit.

### `.lintstagedrc.json`
Define qué comandos ejecutar para cada tipo de archivo:

- **TypeScript/TSX**: ESLint + Prettier
- **JavaScript/JSX**: ESLint + Prettier
- **JSON/Markdown/YAML**: Prettier
- **Tests**: Ejecuta tests relacionados con archivos modificados

## 🚀 Qué hace el pre-commit hook

Cuando hagas `git commit`, automáticamente:

1. ✅ **Formatea** el código con Prettier
2. ✅ **Lintea** el código con ESLint
3. ✅ **Ejecuta tests** relacionados con archivos modificados
4. ✅ **Bloquea el commit** si hay errores

## 📝 Ejemplo de uso

```bash
# Modificas un archivo
echo "const x = 1" >> src/utils/test.ts

# Intentas hacer commit
git add src/utils/test.ts
git commit -m "Add test"

# Husky ejecuta automáticamente:
# → ESLint revisa el código
# → Prettier formatea el código
# → Vitest ejecuta tests relacionados
# → Si todo pasa ✅, el commit se completa
# → Si algo falla ❌, el commit se cancela
```

## 🔧 Comandos útiles

```bash
# Ejecutar lint-staged manualmente
npx lint-staged

# Saltar hooks temporalmente (NO RECOMENDADO)
git commit -m "mensaje" --no-verify

# Actualizar hooks después de pull
npx husky install
```

## 🎯 Beneficios

- ✅ **Código consistente**: Todos los commits tienen el mismo formato
- ✅ **Previene bugs**: Tests se ejecutan antes de commit
- ✅ **Code review más rápido**: Código ya formateado y linted
- ✅ **CI/CD más rápido**: Menos fallos en GitHub Actions

## 🚨 Importante

- Los hooks **NO** se envían a Git por defecto (están en `.husky/`)
- Cada desarrollador debe ejecutar `npm install` + `npx husky install`
- Si no quieres pre-commit hooks, simplemente no ejecutes `npx husky install`

## 🔗 Integración con CI/CD

GitHub Actions (`.github/workflows/ci.yml`) ejecuta los mismos checks que Husky:

1. TypeScript type check
2. ESLint
3. Tests con coverage
4. Build

Esto asegura que incluso si alguien salta los hooks locales, los checks se ejecutan en CI.
