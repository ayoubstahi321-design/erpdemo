# 📦 Guía de Importación/Exportación de Productos CSV (Actualizada)

Sistema completo para gestionar productos masivamente usando archivos CSV (Excel) con el nuevo sistema de precios TTC.

---

## 🎯 ¿Para qué sirve?

Este sistema te permite:
- ✅ **Exportar** todos tus productos a un archivo CSV
- ✅ **Descargar una plantilla** vacía para llenar en Excel
- ✅ **Importar** hasta 80+ productos en segundos
- ✅ **Actualizar** productos masivamente
- ✅ **Gestionar variantes** fácilmente (mismo producto, diferentes tamaños)
- ✅ **Configurar tasas de IVA personalizadas** por producto

---

## 🚀 Cómo Usar el Sistema

### 1️⃣ Descargar Plantilla CSV

1. Ve a la sección **Inventario**
2. Haz clic en el botón verde **"Plantilla"**
3. Se descargará un archivo `PLANTILLA_PRODUCTOS_[fecha].csv`
4. Ábrelo con Excel o Google Sheets

### 2️⃣ Llenar la Plantilla

El archivo tiene estas columnas:

| Columna | Obligatorio | Descripción | Ejemplo |
|---------|-------------|-------------|---------|
| **SKU** | ❌ No (se auto-genera) | Código único del producto | AZM-HM-00001 |
| **Código de Barras** | ❌ No | EAN-13 o UPC | 7891234567890 |
| **Nombre del Producto** | ✅ Sí | Nombre descriptivo | Aceite Motor 5W30 1L |
| **Categoría** | ✅ Sí | Categoría del producto | Huile Moteur |
| **Viscosidad** | ❌ No | Para aceites | 5W30 |
| **Tamaño del Paquete** | ✅ Sí | Cantidad numérica | 1 |
| **Unidad** | ✅ Sí | L, kg, ml, etc. | L |
| **Precio TTC (Con IVA)** | ✅ Sí | Precio CON IVA incluido | 120.00 |
| **Costo** | ✅ Sí | Precio de compra | 80.00 |
| **IVA %** | ❌ No (20% por defecto) | Tasa de IVA: 20, 14, 10, 7, 0 | 20 |
| **Stock Mínimo** | ❌ No (10 por defecto) | Cantidad mínima | 10 |

---

## 💰 IMPORTANTE: Sistema de Precios

### ¿Qué es el Precio TTC?

**TTC** = **T**outes **T**axes **C**omprises = Precio CON IVA incluido

- ✅ **TTC**: Es el precio FINAL que ve el cliente
- ✅ **Costo**: Es el precio de compra SIN IVA
- ✅ **IVA %**: Es la tasa de impuesto aplicable

### Ejemplo de Cálculo

Supongamos que:
- Compras un producto a: **80 DH** (costo sin IVA)
- Quieres ganar: **25% de margen**
- IVA aplicable: **20%**

**Cálculo:**
1. Precio HT (sin IVA) = 80 × 1.25 = **100 DH**
2. Precio TTC (con IVA 20%) = 100 × 1.20 = **120 DH** ← **Este es el precio a escribir en el CSV**

### Ejemplo en CSV

```csv
SKU;Codigo de Barras;Nombre;Categoria;Viscosidad;Tamano;Unidad;Precio TTC (Con IVA);Costo;IVA %;Stock Minimo
AZM-HM-00001;7891234567890;Aceite Motor 5W30 1L;Huile Moteur;5W30;1;L;120.00;80.00;20;10
```

---

## 📋 Tasas de IVA en Marruecos

| Tasa | Uso | Ejemplo |
|------|-----|---------|
| **20%** | Tasa estándar (por defecto) | Aceites, lubricantes |
| **14%** | Tasa reducida | Algunos productos |
| **10%** | Tasa reducida | Algunos productos |
| **7%** | Tasa reducida | Algunos productos |
| **0%** | Exento de IVA | Productos específicos |

---

## 💡 Ejemplos Prácticos

### Ejemplo 1: Productos con IVA Estándar (20%)

```csv
SKU (Opcional - Auto);Codigo de Barras (Opcional);Nombre del Producto;Categoria;Viscosidad (Opcional);Tamano del Paquete;Unidad;Precio TTC (Con IVA);Costo;IVA % (Opcional);Stock Minimo (Opcional)
AZM-HM-00001;7891234567890;Aceite Motor 5W30 1L;Huile Moteur;5W30;1;L;120.00;80.00;20;10
;;Aceite Motor 5W30 4L;Huile Moteur;5W30;4;L;450.00;350.00;;5
```

**Resultado:**
- Producto 1: SKU manual, IVA 20%, stock mínimo 10
- Producto 2: SKU auto-generado (AZM-HM-00002), IVA 20% por defecto, stock mínimo 5

### Ejemplo 2: Producto con IVA Reducido (7%)

```csv
SKU (Opcional - Auto);Codigo de Barras (Opcional);Nombre del Producto;Categoria;Viscosidad (Opcional);Tamano del Paquete;Unidad;Precio TTC (Con IVA);Costo;IVA % (Opcional);Stock Minimo (Opcional)
;;Grasa Multiproposito 1kg;Graisses;;1;kg;85.60;80.00;7;15
```

**Cálculo:**
- Costo: 80 DH
- Precio HT: 80 DH (sin margen en este caso)
- IVA 7%: 80 × 1.07 = **85.60 DH TTC**

### Ejemplo 3: Variantes de Producto (Diferentes Tamaños)

```csv
SKU (Opcional - Auto);Codigo de Barras (Opcional);Nombre del Producto;Categoria;Viscosidad (Opcional);Tamano del Paquete;Unidad;Precio TTC (Con IVA);Costo;IVA % (Opcional);Stock Minimo (Opcional)
AZM-TR-00001;1234567890001;Aceite Transmision ATF;Transmission;ATF;1;L;180.00;120.00;20;8
AZM-TR-00002;1234567890002;Aceite Transmision ATF;Transmission;ATF;4;L;650.00;450.00;20;3
AZM-TR-00003;1234567890003;Aceite Transmision ATF;Transmission;ATF;20;L;2900.00;2200.00;20;1
```

---

## 🎓 Guía Paso a Paso Completa

### Paso 1: Descargar Plantilla

1. Ir a **Inventario** → Botón **"Plantilla"**
2. Se descarga `PLANTILLA_PRODUCTOS_[fecha].csv`
3. La plantilla incluye:
   - Headers explicativos
   - 3 ejemplos pre-llenados
   - Notas explicativas sobre precios TTC

### Paso 2: Abrir en Excel

1. Abrir el archivo con Excel
2. Verás explicaciones al final del archivo sobre:
   - Sistema de precios TTC
   - Campos opcionales
   - Categorías válidas

### Paso 3: Llenar tus Productos

**Consejos:**
- Copia y pega filas para productos similares
- Deja el SKU vacío si quieres auto-generación
- Si no sabes el IVA %, déjalo vacío (usará 20% por defecto)
- Usa punto decimal (120.00, no 120,00)

**Ejemplo de llenado en Excel:**

| SKU | Código | Nombre | Categoría | Viscosidad | Tamaño | Unidad | Precio TTC | Costo | IVA % | Stock Min |
|-----|--------|--------|-----------|------------|--------|--------|------------|-------|-------|-----------|
| | | Aceite 5W30 1L | Huile Moteur | 5W30 | 1 | L | 120.00 | 80.00 | 20 | 10 |
| | | Aceite 5W30 4L | Huile Moteur | 5W30 | 4 | L | 450.00 | 350.00 | | 5 |
| | | Grasa 1kg | Graisses | | 1 | kg | 85.60 | 80.00 | 7 | 15 |

### Paso 4: Guardar como CSV

1. **Archivo** → **Guardar como**
2. Tipo: **CSV (delimitado por comas)** o **CSV UTF-8**
3. Nombre: `mis_productos.csv`

### Paso 5: Importar en el Sistema

1. Ir a **Inventario** → Botón **"Importar"**
2. Seleccionar `mis_productos.csv`
3. El sistema valida automáticamente:
   - ✅ Nombres completos
   - ✅ Categorías válidas
   - ✅ Precios positivos
   - ✅ SKUs únicos (si se proporcionan)
4. Ver vista previa con todos los productos
5. Si hay errores, se muestran en rojo con número de línea
6. Clic en **"Importar X productos"**
7. ¡Listo! Productos importados

---

## 📊 Exportar Productos Existentes

### Para qué sirve

- Backup de tu inventario
- Actualización masiva de precios
- Revisar datos en Excel
- Plantilla con tus productos actuales

### Cómo exportar

1. Ir a **Inventario** → Botón **"Exportar"**
2. Se descarga `PRODUCTOS_[fecha].csv`
3. Incluye:
   - Todos tus productos actuales
   - Stock de cada almacén
   - IVA % de cada producto
   - Toda la información completa

### Formato del Archivo Exportado

```csv
SKU;Codigo de Barras;Nombre;Categoria;Viscosidad;Tamano;Unidad;Precio TTC (Con IVA);Costo;IVA %;Stock Minimo;Stock Almacén Central;Stock Almacén 2
AZM-HM-00001;7891234567890;Aceite Motor 5W30 1L;Huile Moteur;5W30;1;L;120.00;80.00;20;10;50;30
```

---

## ⚠️ Errores Comunes y Soluciones

### Error: "No tiene suficientes columnas (mínimo 8)"
**Problema:** Falta alguna columna obligatoria
**Solución:** Verifica que todas las columnas obligatorias estén presentes:
- Nombre, Categoría, Tamaño, Unidad, Precio TTC, Costo

### Error: "Falta nombre"
**Problema:** Alguna fila no tiene nombre de producto
**Solución:** El nombre es OBLIGATORIO para todos los productos

### Error: "Tamaño debe ser mayor a 0"
**Problema:** El tamaño es 0 o negativo
**Solución:** Escribe un número positivo (1, 4, 20, 208, etc.)

### Error: "Precio no puede ser negativo"
**Problema:** El precio TTC es negativo
**Solución:** Escribe un precio positivo

### Problema: "¿El precio que escribo incluye IVA o no?"
**Respuesta:** El precio que escribes SIEMPRE incluye IVA (TTC)
**Ejemplo:** Si quieres vender a 120 DH al cliente, escribes 120.00

### Problema: "¿Cómo calculo el Precio TTC desde el margen?"
**Respuesta:** Usa esta fórmula:
```
1. Precio HT = Costo × (1 + Margen%)
2. Precio TTC = Precio HT × (1 + IVA%)
```

**Ejemplo con calculadora:**
- Costo: 80 DH
- Margen: 25%
- IVA: 20%

```
Precio HT = 80 × 1.25 = 100 DH
Precio TTC = 100 × 1.20 = 120 DH ← Escribir esto
```

---

## 📋 Categorías Válidas (Copiar exactamente)

```
Huile Moteur
Transmission
Graisses
Hydraulique
Liquide de Frein
Additifs
```

---

## 🔍 Validación Automática

El sistema valida:

| Validación | Descripción |
|------------|-------------|
| ✅ SKU único | Si proporcionas SKU, debe ser único |
| ✅ Nombre obligatorio | Todos los productos necesitan nombre |
| ✅ Categoría válida | Debe ser una de las categorías permitidas |
| ✅ Números positivos | Tamaño, Precio TTC, Costo deben ser > 0 |
| ✅ IVA válido | Si proporcionas IVA %, debe estar entre 0-100 |
| ✅ Formato CSV | Detección automática de separador (coma o punto y coma) |

---

## 💡 Tips Profesionales

### 1. Para Productos Variantes (Mismo producto, diferentes tamaños)

**Método rápido en Excel:**
1. Llena la primera fila completamente
2. Copia la fila
3. Pega abajo
4. Cambia SOLO: SKU, tamaño, precio, código de barras
5. Mantén igual: nombre, categoría, viscosidad

### 2. Para Muchos Productos

1. **Divide en lotes**: 20-30 productos por archivo
2. **Importa primero un archivo pequeño de prueba**
3. **Verifica que funcione bien**
4. **Luego importa el resto**

### 3. Para Calcular Precios TTC Rápido

**Usa Excel con fórmulas:**

| Costo | Margen % | Precio HT | IVA % | Precio TTC |
|-------|----------|-----------|-------|------------|
| 80 | 25% | `=A2*(1+B2)` | 20% | `=C2*(1+D2)` |

Fórmula en C2: `=A2*(1+B2)`
Fórmula en E2: `=C2*(1+D2)`

Copia las fórmulas hacia abajo para todos tus productos.

### 4. Para Actualizar Solo Precios

1. Exporta tus productos actuales
2. Abre el CSV en Excel
3. Modifica solo la columna "Precio TTC (Con IVA)"
4. **NO re-importes** (duplicaría productos)
5. Actualiza los precios uno por uno en la interfaz

**Nota:** En una futura actualización se permitirá actualización masiva via CSV.

---

## 🎯 Checklist Antes de Importar

Antes de importar, verifica:

- [ ] Los precios están en formato TTC (CON IVA)
- [ ] Los costos son menores que los precios
- [ ] Las categorías están escritas exactamente como se indica
- [ ] Los números usan punto decimal (120.00, no 120,00)
- [ ] El IVA % está entre 0-100 (o vacío para usar 20% por defecto)
- [ ] No hay filas vacías en medio del archivo
- [ ] Guardaste el archivo como CSV

---

## 📞 Ejemplo Completo: Importar 5 Aceites

### Tu archivo: `aceites_2026.csv`

```csv
SKU (Opcional - Auto);Codigo de Barras (Opcional);Nombre del Producto;Categoria;Viscosidad (Opcional);Tamano del Paquete;Unidad;Precio TTC (Con IVA);Costo;IVA % (Opcional);Stock Minimo (Opcional)
AZM-HM-00001;1111111111111;Aceite Motor 5W30 1L;Huile Moteur;5W30;1;L;120.00;80.00;20;10
AZM-HM-00002;2222222222222;Aceite Motor 5W30 4L;Huile Moteur;5W30;4;L;450.00;350.00;20;5
AZM-HM-00003;3333333333333;Aceite Motor 10W40 1L;Huile Moteur;10W40;1;L;110.00;75.00;20;10
AZM-HM-00004;4444444444444;Aceite Motor 10W40 5L;Huile Moteur;10W40;5;L;500.00;400.00;20;4
AZM-HM-00005;5555555555555;Aceite Motor 15W40 208L;Huile Moteur;15W40;208;L;18000.00;15000.00;20;1
```

### Resultado Esperado

- 5 productos creados
- SKUs: AZM-HM-00001 a AZM-HM-00005
- Todos con IVA 20%
- Stock mínimo según especificado
- Precios TTC como se indicó

---

## ✅ Ventajas del Nuevo Sistema

### Antes (Sistema Antiguo)
- ❌ Confusión sobre si el precio incluía IVA o no
- ❌ Errores de cálculo frecuentes
- ❌ No se podía especificar IVA personalizado

### Ahora (Sistema Nuevo)
- ✅ **Claridad total**: Precio TTC = Precio con IVA siempre
- ✅ **IVA personalizado**: Puedes especificar IVA % por producto
- ✅ **Auto-generación de SKU**: No necesitas inventar códigos
- ✅ **Validación inteligente**: Detecta errores antes de importar
- ✅ **Ejemplos incluidos**: La plantilla tiene ejemplos de cálculo

---

**¡Ahora puedes gestionar 80+ productos en minutos con total claridad sobre precios e impuestos!** 🎉

---

**Última actualización:** 2026-01-02
**Versión:** 2.0 (Con sistema de precios TTC mejorado)
