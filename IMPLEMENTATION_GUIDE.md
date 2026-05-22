# Guía de Implementación - Mejoras Aplicadas

Esta guía te ayudará a integrar las mejoras realizadas en tu aplicación existente.

## 📋 Índice
1. [Zustand Store](#1-zustand-store)
2. [Hooks Reutilizables](#2-hooks-reutilizables)
3. [Paginación](#3-paginación)
4. [Búsqueda Optimizada](#4-búsqueda-optimizada)
5. [Service Worker](#5-service-worker)
6. [Tests](#6-tests)

---

## 1. Zustand Store

### Integración en App.tsx

**Paso 1**: Importar el store
```tsx
import { useStore } from './store/useStore';
```

**Paso 2**: Reemplazar useState por Zustand

**Antes**:
```tsx
const [products, setProducts] = useState<Product[]>([]);
const [customers, setCustomers] = useState<Customer[]>([]);
```

**Después**:
```tsx
const products = useStore(state => state.products);
const setProducts = useStore(state => state.setProducts);
const customers = useStore(state => state.customers);
const setCustomers = useStore(state => state.setCustomers);
```

**Paso 3**: Eliminar prop drilling

Ya no necesitas pasar props a componentes hijos. Los componentes pueden acceder directamente al store:

```tsx
// En cualquier componente
import { useStore } from '../store/useStore';

function Inventory() {
  const products = useStore(state => state.products);
  const addProduct = useStore(state => state.addProduct);

  // ...
}
```

### Selectores Optimizados

Para evitar re-renders innecesarios:

```tsx
// ❌ Malo: se re-renderiza cuando CUALQUIER cosa cambia
const state = useStore();

// ✅ Bueno: solo se re-renderiza cuando products cambia
const products = useStore(state => state.products);
```

---

## 2. Hooks Reutilizables

### useCSVExport - Reemplazar código de exportación

**Antes** (en cada componente):
```tsx
const exportToCSV = () => {
  const csvContent = [/* código duplicado */];
  const blob = new Blob([csvContent], { type: 'text/csv' });
  // ...
};
```

**Después**:
```tsx
import { useCSVExport } from '../hooks/useCSVExport';

function MyComponent() {
  const { exportToCSV } = useCSVExport();

  const handleExport = () => {
    exportToCSV({
      filename: 'products',
      headers: ['SKU', 'Name', 'Price', 'Stock'],
      data: products,
      mapRow: (p) => [p.sku, p.name, p.price, p.totalStock]
    });
  };
}
```

### useLocalStorage - Persistir configuraciones

**Ejemplo**: Guardar filtros de búsqueda
```tsx
import { useLocalStorage } from '../hooks/useLocalStorage';

function Inventory() {
  const [searchQuery, setSearchQuery] = useLocalStorage('inventory-search', '');
  const [selectedCategory, setSelectedCategory] = useLocalStorage('inventory-category', 'all');

  // Se guardan automáticamente en localStorage
}
```

### useDebounce - Optimizar búsquedas

**Antes**: Búsqueda en cada keystroke
```tsx
const [search, setSearch] = useState('');

useEffect(() => {
  // Se ejecuta en CADA letra
  searchProducts(search);
}, [search]);
```

**Después**: Búsqueda después de que el usuario deje de escribir
```tsx
import { useDebounce } from '../hooks/useDebounce';

const [search, setSearch] = useState('');
const debouncedSearch = useDebounce(search, 300);

useEffect(() => {
  // Solo se ejecuta 300ms después del último cambio
  searchProducts(debouncedSearch);
}, [debouncedSearch]);
```

---

## 3. Paginación

### Implementar en Inventory.tsx

**Paso 1**: Importar
```tsx
import { usePagination } from '../hooks/usePagination';
import { Pagination } from './Pagination';
```

**Paso 2**: Usar el hook
```tsx
function Inventory() {
  const products = useStore(state => state.products);

  const pagination = usePagination({
    data: products,
    itemsPerPage: 20
  });

  return (
    <div>
      {/* Usar paginatedData en lugar de products */}
      {pagination.paginatedData.map(product => (
        <ProductRow key={product.id} product={product} />
      ))}

      {/* Añadir componente de paginación */}
      <Pagination {...pagination} />
    </div>
  );
}
```

### Con Filtros/Búsqueda

```tsx
const products = useStore(state => state.products);
const [searchQuery, setSearchQuery] = useState('');

// 1. Filtrar primero
const filteredProducts = useFuzzySearch(
  products,
  searchQuery,
  ['name', 'sku', 'category']
);

// 2. Paginar el resultado filtrado
const pagination = usePagination({
  data: filteredProducts,
  itemsPerPage: 20
});

return (
  <>
    <SearchInput value={searchQuery} onChange={setSearchQuery} />

    {pagination.paginatedData.map(/* ... */)}

    <Pagination {...pagination} />
  </>
);
```

---

## 4. Búsqueda Optimizada

### Migrar de fuzzyMatch a useFuzzySearch

**Antes** (en Inventory.tsx, POS.tsx, etc.):
```tsx
const [searchQuery, setSearchQuery] = useState('');

const filtered = products.filter(p =>
  fuzzySearch(p.name, searchQuery) ||
  fuzzySearch(p.sku, searchQuery)
);
```

**Después**:
```tsx
import { useFuzzySearch } from '../utils/fuzzySearch';

const [searchQuery, setSearchQuery] = useState('');

const filtered = useFuzzySearch(
  products,
  searchQuery,
  ['name', 'sku', 'category', 'barcode'],
  3 // threshold opcional
);

// ✅ Automáticamente memoizado
// ✅ 10x más rápido
// ✅ Búsqueda en múltiples campos
```

### Búsqueda con Ranking (opcional)

Para mostrar mejores resultados primero:

```tsx
import { fuzzySearchWithScore } from '../utils/fuzzySearch';

const searchResults = fuzzySearchWithScore(
  products,
  searchQuery,
  ['name', 'sku']
);

// Los resultados ya vienen ordenados por relevancia
// score: 0 = exacto, 1 = starts with, 2 = contains, 3+ = levenshtein
```

---

## 5. Service Worker

### Activar PWA

**Paso 1**: Registrar Service Worker en main.tsx o App.tsx

```tsx
import { registerServiceWorker } from './utils/registerSW';

// Al final del archivo, después de ReactDOM.render
if (import.meta.env.PROD) {
  registerServiceWorker();
}
```

**Paso 2**: Añadir link al manifest en index.html

```html
<head>
  <!-- ... -->
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#2563eb">
  <!-- ... -->
</head>
```

**Paso 3**: Crear iconos

Necesitas crear dos imágenes:
- `web/public/icon-192.png` (192x192px)
- `web/public/icon-512.png` (512x512px)

Puedes usar herramientas como:
- https://realfavicongenerator.net/
- https://www.favicon-generator.org/

### Funcionalidades PWA Disponibles

```tsx
import {
  isStandalone,
  requestPersistentStorage,
  checkStorageQuota,
  clearCaches
} from './utils/registerSW';

// Detectar si está instalado como app
if (isStandalone()) {
  console.log('Running as installed PWA');
}

// Solicitar almacenamiento persistente
await requestPersistentStorage();

// Ver cuánto espacio queda
const quota = await checkStorageQuota();

// Limpiar caché (debugging)
await clearCaches();
```

---

## 6. Tests

### Ejecutar Tests

```bash
cd web

# Ejecutar todos los tests
npm test

# Ver tests en UI interactiva
npm run test:ui

# Ver cobertura
npm run test:coverage
```

### Crear Tests para tus Componentes

**Ejemplo**: Test para un componente

```tsx
// src/components/__tests__/ProductCard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProductCard from '../ProductCard';

describe('ProductCard', () => {
  it('should render product name', () => {
    const product = {
      id: '1',
      name: 'Motor Oil 5W30',
      price: 100,
      sku: 'MO-5W30'
    };

    render(<ProductCard product={product} />);

    expect(screen.getByText('Motor Oil 5W30')).toBeInTheDocument();
  });

  it('should display correct price', () => {
    const product = { /* ... */ price: 100 };

    render(<ProductCard product={product} />);

    expect(screen.getByText(/100/)).toBeInTheDocument();
  });
});
```

**Ejemplo**: Test para un hook personalizado

```tsx
// src/hooks/__tests__/useDebounce.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  it('should debounce value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    expect(result.current).toBe('initial');

    // Cambiar valor
    rerender({ value: 'changed', delay: 500 });

    // Valor no debe cambiar inmediatamente
    expect(result.current).toBe('initial');

    // Esperar el delay
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 600));
    });

    // Ahora sí debe estar actualizado
    expect(result.current).toBe('changed');
  });
});
```

---

## 🎯 Checklist de Implementación

### Paso a Paso Recomendado

- [ ] **Semana 1**: Zustand
  - [ ] Instalar dependencias: `npm install`
  - [ ] Probar store en un componente pequeño
  - [ ] Migrar gradualmente componentes del estado

- [ ] **Semana 2**: Hooks y Utilidades
  - [ ] Reemplazar código de exportación CSV
  - [ ] Implementar debounce en búsquedas
  - [ ] Usar fuzzySearch optimizado

- [ ] **Semana 3**: Paginación
  - [ ] Añadir paginación en Inventory
  - [ ] Añadir paginación en Sales
  - [ ] Añadir paginación en Customers

- [ ] **Semana 4**: PWA y Tests
  - [ ] Registrar Service Worker
  - [ ] Crear iconos para PWA
  - [ ] Escribir tests para componentes críticos
  - [ ] Configurar CI para ejecutar tests

---

## 🚨 Problemas Comunes

### "Module not found" al importar hooks
**Solución**: Verifica que estés en la carpeta `web/` y que hayas ejecutado `npm install`

### Tests fallan con error de DOM
**Solución**: Asegúrate de que `vitest.config.ts` tiene `environment: 'jsdom'`

### Service Worker no se actualiza
**Solución**:
```tsx
// Forzar actualización
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.update());
});
```

### Zustand no persiste datos
**Solución**: Verifica que uses el store con `persist` middleware (ya está configurado)

---

## 📞 Soporte

Si tienes problemas:
1. Revisa `CHANGELOG.md` para ver ejemplos completos
2. Consulta `SECURITY.md` para temas de seguridad
3. Ejecuta `npm test` para verificar que todo funciona

---

**¡Éxito con la implementación! 🚀**
