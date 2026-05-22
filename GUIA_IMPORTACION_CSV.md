# 📦 Guía de Importación/Exportación de Productos CSV

Sistema completo para gestionar productos masivamente usando archivos CSV (Excel).

---

## 🎯 ¿Para qué sirve?

Este sistema te permite:
- ✅ **Exportar** todos tus productos a un archivo CSV
- ✅ **Descargar una plantilla** vacía para llenar en Excel
- ✅ **Importar** hasta 80+ productos en segundos
- ✅ **Actualizar** productos masivamente
- ✅ **Gestionar variantes** fácilmente (mismo producto, diferentes tamaños)

---

## 🚀 Cómo Usar el Sistema

### 1️⃣ Descargar Plantilla CSV

1. Ve a la sección **Inventario**
2. Haz clic en el botón verde **"Plantilla"**
3. Se descargará un archivo `PLANTILLA_PRODUCTOS_[fecha].csv`
4. Ábrelo con Excel o Google Sheets

### 2️⃣ Llenar la Plantilla

El archivo tiene estas columnas:

| Columna | Obligatorio | Ejemplo |
|---------|-------------|---------|
| **SKU** | ✅ Sí | MOT-5W30-1L |
| **Código de Barras** | ❌ No | 7891234567890 |
| **Nombre del Producto** | ✅ Sí | Aceite Motor 5W30 |
| **Categoría** | ✅ Sí | Aceite Motor |
| **Viscosidad** | ❌ No | 5W30 |
| **Tamaño del Paquete** | ✅ Sí | 1 |
| **Unidad** | ✅ Sí | L |
| **Precio de Venta** | ✅ Sí | 150.00 |
| **Costo** | ✅ Sí | 100.00 |
| **Stock Mínimo** | ❌ No (por defecto: 10) | 10 |

#### 💡 Consejos para Variantes (productos iguales, diferentes tamaños)

Para productos como aceites que vienen en diferentes tamaños:

```csv
SKU,Código de Barras,Nombre,Categoría,Viscosidad,Tamaño,Unidad,Precio,Costo,Stock Mínimo
MOT-5W30-1L,7891234567890,Aceite Motor 5W30,Aceite Motor,5W30,1,L,150.00,100.00,10
MOT-5W30-4L,7891234567891,Aceite Motor 5W30,Aceite Motor,5W30,4,L,550.00,400.00,5
MOT-5W30-20L,7891234567892,Aceite Motor 5W30,Aceite Motor,5W30,20,L,2400.00,1800.00,2
```

**Truco:** En Excel, copia la primera fila y solo cambia el SKU, código de barras, tamaño, y precio. ¡Listo!

### 3️⃣ Importar el Archivo

1. En **Inventario**, haz clic en el botón azul **"Importar"**
2. Selecciona tu archivo CSV
3. El sistema validará automáticamente:
   - ✅ SKUs únicos
   - ✅ Campos obligatorios completos
   - ✅ Números válidos
   - ✅ Sin duplicados
4. Verás una **vista previa** con todos los productos
5. Si hay errores, se mostrarán en rojo con la línea exacta
6. Haz clic en **"Importar X productos"** para confirmar
7. ¡Listo! Tus productos se cargan en segundos

### 4️⃣ Exportar Productos Existentes

1. En **Inventario**, haz clic en el botón gris **"Exportar"**
2. Se descargará un CSV con **todos** tus productos actuales
3. Incluye el stock de cada almacén
4. Útil para:
   - Backup de productos
   - Actualización masiva
   - Revisar inventario en Excel

---

## 📋 Categorías Disponibles

- Aceite Motor (Motor Oil)
- Aceite Transmisión (Transmission Oil)
- Aceite Hidráulico (Hydraulic Oil)
- Filtros (Filters)
- Grasas (Greases)
- Refrigerantes (Coolants)
- Aditivos (Additives)
- Otros (Other)

---

## ⚠️ Errores Comunes y Soluciones

### Error: "SKU duplicado"
**Problema:** Tienes dos productos con el mismo SKU en el CSV
**Solución:** Cada producto debe tener un SKU único

### Error: "Falta SKU o nombre"
**Problema:** Alguna fila no tiene SKU o nombre
**Solución:** Revisa que todas las filas tengan al menos SKU y Nombre

### Error: "Tamaño debe ser mayor a 0"
**Problema:** El tamaño del paquete es 0 o negativo
**Solución:** Escribe un número positivo (1, 4, 20, etc.)

### Error: "El archivo CSV está vacío"
**Problema:** El archivo no tiene datos o solo tiene headers
**Solución:** Asegúrate de que el archivo tenga al menos una fila de producto

---

## 🎓 Ejemplo Completo: Importar 3 Aceites

### Paso 1: Crea un archivo llamado `mis_productos.csv`

```csv
SKU,Código de Barras,Nombre del Producto,Categoría,Viscosidad,Tamaño del Paquete,Unidad,Precio de Venta,Costo,Stock Mínimo
MOT-5W30-1L,7891234567890,Aceite Motor 5W30,Aceite Motor,5W30,1,L,150.00,100.00,10
MOT-5W30-4L,7891234567891,Aceite Motor 5W30,Aceite Motor,5W30,4,L,550.00,400.00,5
MOT-10W40-1L,7891234567892,Aceite Motor 10W40,Aceite Motor,10W40,1,L,140.00,95.00,10
```

### Paso 2: Importa el archivo

1. Ve a **Inventario**
2. Clic en **"Importar"**
3. Selecciona `mis_productos.csv`
4. Revisa la vista previa
5. Clic en **"Importar 3 productos"**

### ✅ Resultado

Tendrás 3 productos creados:
- Aceite Motor 5W30 (1L y 4L)
- Aceite Motor 10W40 (1L)

---

## 💡 Tips Profesionales

### Para Productos Similares (Variantes)
1. **Usa Excel/Google Sheets** para copiar y pegar
2. Solo cambia: SKU, tamaño, precio, y código de barras
3. Mantén igual: nombre, categoría, viscosidad

### Para Muchos Productos
1. Empieza con 10-20 productos de prueba
2. Verifica que funcione bien
3. Luego importa el resto

### Para Actualizar Precios
1. Exporta tus productos actuales
2. Modifica los precios en Excel
3. Re-importa el archivo

**IMPORTANTE:** El sistema NO actualiza productos existentes, solo agrega nuevos. Si quieres actualizar precios, hazlo desde la interfaz de edición individual.

---

## 🔐 Seguridad y Validación

El sistema valida automáticamente:
- ✅ SKUs únicos (no duplicados)
- ✅ Campos obligatorios completos
- ✅ Números positivos para tamaño, precio, costo
- ✅ Categorías válidas
- ✅ Formato CSV correcto

---

## 📞 ¿Necesitas Ayuda?

Si tienes problemas:
1. Revisa que tu CSV tenga el formato correcto
2. Verifica los errores en la vista previa
3. Descarga la plantilla de ejemplo y compárala con tu archivo

---

**¡Listo!** Ahora puedes gestionar 80+ productos en minutos en lugar de horas. 🎉
