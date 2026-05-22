/**
 * Utilidades para Importación y Exportación de Productos CSV
 * Permite cargar masivamente productos desde Excel/CSV
 */

import { Product } from '../types';
import { logger } from './logger';
import { generateAutoSKU } from './helpers';

// Formato del CSV para productos
export interface ProductCSVRow {
  sku?: string; // Ahora opcional - se genera automáticamente si no se proporciona
  barcode?: string;
  name: string;
  category: string;
  viscosity?: string;
  packSize: number;
  unit: string;
  price: number; // IMPORTANTE: Precio TTC (con IVA incluido) - Lo que ve el cliente
  cost: number;  // Costo de compra (sin IVA)
  customTaxRate?: number; // Tasa de IVA personalizada (opcional, ej: 0.20 para 20%)
  minStock?: number;
}

/**
 * Genera una plantilla CSV vacía para que el usuario la llene
 */
export const downloadCSVTemplate = () => {
  const headers = [
    'SKU (Opcional - Auto)',
    'Codigo de Barras (Opcional)',
    'Nombre del Producto',
    'Categoria',
    'Viscosidad (Opcional)',
    'Tamano del Paquete',
    'Unidad',
    'Precio TTC (Con IVA)',
    'Costo',
    'IVA % (Opcional)',
    'Stock Minimo (Opcional)'
  ];

  const exampleRows = [
    // Ejemplo 1: Con SKU manual y TVA estándar 20%
    ['AZM-HM-00001', '7891234567890', 'Aceite Motor 5W30 1L', 'Huile Moteur', '5W30', '1', 'L', '120.00', '80.00', '20', '10'],
    // Ejemplo 2: Sin SKU (se generará automáticamente), TVA 20% por defecto
    ['', '7891234567891', 'Aceite Motor 5W30 4L', 'Huile Moteur', '5W30', '4', 'L', '450.00', '350.00', '', '5'],
    // Ejemplo 3: Sin SKU ni código de barras, TVA reducida 7%
    ['', '', 'Grasa Multiproposito 1kg', 'Graisses', '', '1', 'kg', '85.60', '80.00', '7', '15'],
  ];

  // Crear CSV con formato correcto para Excel en español (punto y coma como separador)
  const noteRows = [
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'IMPORTANTE - SISTEMA DE PRECIOS:',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '✓ PRECIO TTC = Precio CON IVA incluido (lo que ve el cliente)',
    '✓ COSTO = Precio de compra SIN IVA',
    '✓ IVA % = Tasa de IVA aplicable (20%, 14%, 10%, 7%, 0%)',
    '',
    'Ejemplo de cálculo:',
    '  - Costo: 80 DH (sin IVA)',
    '  - Margen deseado: 25% → Precio HT = 80 × 1.25 = 100 DH',
    '  - IVA 20%: 100 × 1.20 = 120 DH TTC ← Este es el precio a escribir',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'CAMPOS OPCIONALES:',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '✓ SKU: Si lo dejas vacío, se genera automáticamente: AZM-[CATEGORÍA]-[NÚMERO]',
    '✓ Código de Barras: Opcional (EAN-13 o UPC)',
    '✓ Viscosidad: Opcional (ej: 5W30, 10W40)',
    '✓ IVA %: Si lo dejas vacío, se usa 20% por defecto',
    '✓ Stock Mínimo: Si lo dejas vacío, se usa 10 por defecto',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'CATEGORÍAS VÁLIDAS:',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    'Huile Moteur | Transmission | Graisses | Hydraulique | Liquide de Frein | Additifs',
    ''
  ];

  const csvRows = [
    headers.join(';'),
    ...exampleRows.map(row => row.join(';')),
    ...noteRows
  ];

  const csvContent = '\uFEFF' + csvRows.join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `PLANTILLA_PRODUCTOS_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Exporta productos existentes a CSV
 */
export const exportProductsToCSV = (products: Product[], warehouses: any[]) => {
  const headers = [
    'SKU',
    'Codigo de Barras',
    'Nombre',
    'Categoria',
    'Viscosidad',
    'Tamano',
    'Unidad',
    'Precio TTC (Con IVA)',
    'Costo',
    'IVA %',
    'Stock Minimo',
    ...warehouses.map(w => `Stock ${w.name}`)
  ];

  const rows = products.map(p => {
    const stockValues = warehouses.map(w => {
      const stock = p.stockLevels?.[w.id] || 0;
      return stock;
    });

    // Convertir customTaxRate a porcentaje (0.20 → 20)
    const taxRatePercent = p.customTaxRate !== undefined && p.customTaxRate !== null
      ? (p.customTaxRate * 100).toFixed(0)
      : '';

    return [
      p.sku,
      p.barcode || '',
      p.name,
      p.category,
      p.viscosity || '',
      p.packSize,
      p.unit,
      p.price,  // Ya es TTC
      p.cost,
      taxRatePercent,
      p.minStock || 0,
      ...stockValues
    ];
  });

  // Crear CSV con formato correcto para Excel en español (punto y coma como separador)
  const csvRows = [
    headers.join(';'),
    ...rows.map(row => row.join(';'))
  ];

  const csvContent = '\uFEFF' + csvRows.join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `PRODUCTOS_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Parsea un archivo CSV y retorna array de productos
 */
export const parseCSVFile = (file: File): Promise<ProductCSVRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
          reject(new Error('El archivo CSV está vacío o no tiene datos'));
          return;
        }

        // Detectar el separador (punto y coma o coma) contando en la primera línea
        const firstLine = lines[0];
        const semicolonCount = (firstLine.match(/;/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;
        const delimiter = semicolonCount > commaCount ? ';' : ',';

        logger.debug(`CSV delimiter detected: "${delimiter}" (semicolons: ${semicolonCount}, commas: ${commaCount})`);

        // Ignorar la primera línea (headers)
        const dataLines = lines.slice(1);

        const products: ProductCSVRow[] = [];

        for (let i = 0; i < dataLines.length; i++) {
          const line = dataLines[i].trim();
          if (!line) continue;

          // Parse CSV line (handle quoted fields)
          const values = parseCSVLine(line, delimiter);

          // Ahora necesitamos al menos 10 columnas (con IVA %)
          // Pero el IVA y Stock Mínimo son opcionales, así que aceptamos 8+
          if (values.length < 8) {
            logger.warn(`Línea ${i + 2} ignorada: no tiene suficientes columnas (mínimo 8)`);
            continue;
          }

          // Parse tax rate (puede venir como "20" o "0.20", convertir a 0.20)
          let taxRate: number | undefined = undefined;
          if (values[9]) {
            const taxValue = parseFloat(values[9]);
            if (!isNaN(taxValue)) {
              // Si el valor es > 1, asumimos que es porcentaje (20 → 0.20)
              taxRate = taxValue > 1 ? taxValue / 100 : taxValue;
            }
          }

          const product: ProductCSVRow = {
            sku: values[0]?.trim() || undefined, // SKU opcional
            barcode: values[1]?.trim() || undefined,
            name: values[2]?.trim() || '',
            category: values[3]?.trim() || '',
            viscosity: values[4]?.trim() || undefined,
            packSize: parseFloat(values[5]) || 0,
            unit: values[6]?.trim() || '',
            price: parseFloat(values[7]) || 0,  // Precio TTC
            cost: parseFloat(values[8]) || 0,
            customTaxRate: taxRate,
            minStock: parseFloat(values[10]) || 10,
          };

          // Validación básica (solo nombre es obligatorio, SKU se generará automáticamente)
          if (!product.name) {
            logger.warn(`Línea ${i + 2} ignorada: falta nombre`);
            continue;
          }

          products.push(product);
        }

        resolve(products);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Error al leer el archivo'));
    };

    reader.readAsText(file, 'UTF-8');
  });
};

/**
 * Parse una línea CSV manejando campos con comillas
 * @param line La línea a parsear
 * @param delimiter El separador a usar (';' o ',')
 */
function parseCSVLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Valida un array de productos CSV y retorna errores
 */
export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export const validateCSVProducts = (
  products: ProductCSVRow[],
  existingProducts: Product[] = []
): ValidationError[] => {
  const errors: ValidationError[] = [];
  const skus = new Set<string>();

  // Crear un Set con los SKUs existentes en la base de datos para búsqueda rápida
  const existingSKUs = new Set<string>(existingProducts.map(p => p.sku));

  products.forEach((product, index) => {
    const row = index + 2; // +2 porque línea 1 es header y empezamos en 0

    // Validar SKU único solo si se proporcionó
    if (product.sku) {
      // Verificar duplicados dentro del CSV
      if (skus.has(product.sku)) {
        errors.push({
          row,
          field: 'SKU',
          message: `SKU duplicado en CSV: ${product.sku}`
        });
      }

      // Verificar si el SKU ya existe en la base de datos
      if (existingSKUs.has(product.sku)) {
        errors.push({
          row,
          field: 'SKU',
          message: `SKU ya existe en la base de datos: ${product.sku}`
        });
      }

      skus.add(product.sku);
    }

    // Validar campos requeridos (SKU ya NO es requerido)
    if (!product.name) {
      errors.push({ row, field: 'Nombre', message: 'Nombre es requerido' });
    }
    if (!product.category) {
      errors.push({ row, field: 'Categoría', message: 'Categoría es requerida' });
    }
    if (!product.unit) {
      errors.push({ row, field: 'Unidad', message: 'Unidad es requerida' });
    }

    // Validar números positivos
    if (product.packSize <= 0) {
      errors.push({ row, field: 'Tamaño', message: 'Tamaño debe ser mayor a 0' });
    }
    if (product.price < 0) {
      errors.push({ row, field: 'Precio', message: 'Precio no puede ser negativo' });
    }
    if (product.cost < 0) {
      errors.push({ row, field: 'Costo', message: 'Costo no puede ser negativo' });
    }
  });

  return errors;
};

/**
 * Convierte ProductCSVRow a Product para insertar en la base de datos
 * @param row Fila del CSV
 * @param warehouseId ID del almacén por defecto
 * @param existingProducts Lista de productos existentes (para generar SKU automático)
 * @returns Producto listo para insertar (sin ID)
 */
export const csvRowToProduct = (
  row: ProductCSVRow,
  warehouseId?: string,
  existingProducts: Product[] = []
): Omit<Product, 'id'> => {
  // Generar SKU automáticamente si no se proporcionó
  const finalSKU = row.sku || generateAutoSKU(row.category, existingProducts);

  return {
    sku: finalSKU,
    barcode: row.barcode || undefined,
    name: row.name,
    category: row.category as any,
    viscosity: row.viscosity || undefined,
    packSize: row.packSize,
    unit: row.unit,
    price: row.price,  // Precio TTC (con IVA incluido)
    cost: row.cost,
    customTaxRate: row.customTaxRate,  // Tasa de IVA personalizada (opcional)
    minStock: row.minStock || 10,
    stockLevels: warehouseId ? { [warehouseId]: 0 } : {},
    lastRestock: new Date().toISOString(),
  };
};
