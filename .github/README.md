# CI/CD Pipeline - Azmol StockERP

## Descripción General

Este proyecto utiliza GitHub Actions para automatizar el proceso de integración continua (CI) y despliegue continuo (CD).

## Workflows Implementados

### 1. CI Pipeline (`ci.yml`)
Se ejecuta en cada push y pull request a las ramas `main` y `develop`.

**Jobs:**
- **Lint & Type Check**: Ejecuta ESLint y verificación de tipos TypeScript
- **Test**: Ejecuta tests unitarios con Vitest y genera reportes de cobertura
- **Build**: Compila la aplicación y guarda los artefactos
- **Security Scan**: Ejecuta auditoría de seguridad npm

### 2. Deploy Pipeline (`deploy.yml`)
Se ejecuta automáticamente en push a `main` o manualmente.

**Features:**
- Build de producción
- Soporte para Vercel/Netlify (configurar secrets)
- Upload de artefactos de producción
- Notificaciones de estado

### 3. PR Quality Check (`pr-check.yml`)
Se ejecuta en cada pull request.

**Verificaciones:**
- Formato del título del PR
- Detección de console.log en código
- Análisis de tamaño del bundle
- Comentarios automáticos en PR

### 4. CodeQL Security Analysis (`codeql.yml`)
Análisis de seguridad del código.

**Características:**
- Análisis automático de JavaScript/TypeScript
- Escaneo de vulnerabilidades de seguridad
- Ejecución programada semanal

### 5. Dependabot (`dependabot.yml`)
Mantiene las dependencias actualizadas.

**Configuración:**
- Updates semanales de npm packages
- Updates de GitHub Actions
- PRs automáticos con límite de 5

## Configuración Requerida

### Secrets de GitHub
Para habilitar todas las funcionalidades, configura estos secrets en tu repositorio:

1. **CODECOV_TOKEN** (opcional)
   - Token para subir reportes de cobertura a Codecov
   - Obtener en: https://codecov.io

2. **VERCEL_TOKEN** (opcional)
   - Para despliegue automático a Vercel
   - Obtener en: Vercel Dashboard > Settings > Tokens

3. **NETLIFY_TOKEN** (opcional)
   - Para despliegue automático a Netlify
   - Obtener en: Netlify Dashboard > User Settings > Applications

### Configuración de Environments

Crea un environment llamado `production` en:
```
Settings > Environments > New environment
```

## Badges de Estado

Agrega estos badges a tu README principal:

```markdown
![CI Pipeline](https://github.com/azmolpro/azmol-stockerp/workflows/CI%20Pipeline/badge.svg)
![CodeQL](https://github.com/azmolpro/azmol-stockerp/workflows/CodeQL%20Security%20Analysis/badge.svg)
```

## Formato de Títulos de PR

Los PRs deben seguir este formato:
```
Tipo: Descripción breve
```

Tipos válidos:
- `Feature`: Nueva funcionalidad
- `Fix`: Corrección de bug
- `Docs`: Cambios en documentación
- `Refactor`: Refactorización
- `Test`: Tests
- `Chore`: Tareas de mantenimiento
- `Style`: Cambios de formato
- `Perf`: Mejoras de rendimiento
- `CI`: Cambios en CI/CD
- `Build`: Cambios en build

## Flujo de Trabajo Recomendado

1. Crear una rama desde `develop`:
   ```bash
   git checkout -b feature/nueva-funcionalidad
   ```

2. Hacer commits con mensajes descriptivos

3. Push y crear Pull Request siguiendo el template

4. Los checks automáticos se ejecutarán:
   - Lint
   - Type check
   - Tests
   - Build
   - Security scan

5. Revisar y merge cuando todos los checks pasen

6. El deploy automático se ejecutará al hacer merge a `main`

## Troubleshooting

### Los tests fallan en CI pero pasan localmente
- Verificar versiones de Node.js
- Limpiar cache: `npm ci` en lugar de `npm install`

### El build falla
- Verificar que todas las variables de entorno estén configuradas
- Revisar logs en GitHub Actions

### Dependabot PRs fallan
- Revisar breaking changes en el changelog de la dependencia
- Actualizar código si es necesario

## Mantenimiento

### Actualizar Node.js
Editar la versión en todos los workflows:
```yaml
node-version: '20'  # Cambiar aquí
```

### Deshabilitar un workflow
Agregar al inicio del workflow:
```yaml
on:
  workflow_dispatch:  # Solo manual
```

## Monitoreo

### Ver estado de workflows
```
Actions tab en GitHub
```

### Ver logs de un workflow
```
Actions > Seleccionar workflow > Seleccionar run > Ver job
```

### Re-ejecutar un workflow fallido
```
Actions > Workflow fallido > Re-run all jobs
```

## Recursos

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [CodeQL Documentation](https://codeql.github.com/docs/)
