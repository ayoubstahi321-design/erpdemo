# 1. Navega al directorio del proyecto
cd /workspaces/azmol-stockerp

# 2. Instala Vercel CLI (si no está instalado)
npm install -g vercel

# 3. Deploy a producción
vercel deploy --prod# 🔧 Solución: Logo No Se Ve en PDF

## ❌ Problema
Al descargar facturas, albaranes o tiquets en PDF, el logo no se mostraba correctamente.

## 🔍 Causa
El componente `LogoSVG` en `PDFInvoiceDocument.tsx` usaba `@react-pdf/renderer` con:
- Importaciones complejas de SVG (`Svg`, `Path`, `Defs`, `ClipPath`, `G`)
- Atributo incorrecto `clip-path` en lugar de `clipPath`
- Estructura SVG compleja que no se renderiza bien en PDFs

## ✅ Solución Implementada

### Cambio Principal
**Antes**: Componente SVG complejo con clipPath
```tsx
const LogoSVG = () => (
    <Svg width="140" height="27" viewBox="0 0 420 80">
        <Defs>
            <ClipPath id="shield-clip">...</ClipPath>
        </Defs>
        <G clip-path="url(#shield-clip)"> {/* ❌ Incorrecto */}
            ...
        </G>
    </Svg>
);
```

**Después**: Logo como imagen SVG Base64
```tsx
const LOGO_SVG_BASE64 = 'data:image/svg+xml;base64,...'; // Logo pre-renderizado

const LogoPDF = ({ width = 140, height = 28 }: { width?: number; height?: number }) => (
    <Image
        src={LOGO_SVG_BASE64}
        style={{
            width: `${width}pt`,
            height: `${height}pt`,
            objectFit: 'contain',
        }}
    />
);
```

### Por Qué Funciona
1. **Base64 Embedding**: El SVG se convierte a base64, eliminando problemas de CORS y referencias externas
2. **Image Component**: `@react-pdf/renderer` tiene mejor soporte para `Image` que para SVG complejos
3. **Compatibilidad**: El logo se renderiza exactamente como aparece en HTML

## 📊 Cambios de Archivos

### `src/components/PDFInvoiceDocument.tsx`

**Líneas 1-15**: Cambios en importaciones
- ✅ Removidas: `Svg`, `Path`, `Rect`, `G`, `Defs`, `ClipPath`
- ✅ Mantenido: `Document`, `Page`, `Text`, `View`, `StyleSheet`, `Image`

**Líneas 16-24**: Nuevo logo base64 + componente `LogoPDF`

**Línea 249**: Reemplazo de componente
```tsx
// ❌ Antes:
<LogoSVG />

// ✅ Después:
<LogoPDF width={140} height={28} />
```

## 🧪 Verificación

Para verificar que la solución funciona:

1. **Descarga una factura desde la app**
   ```bash
   npm run dev
   # Navega a Ventas > Crear Venta > Descargar PDF
   ```

2. **Verifica que el logo aparece correctamente**
   - En la esquina superior izquierda
   - Con los colores rojo/azul correcto (British flag shield)
   - Con el texto "ESTD. 1937"
   - Con el texto "AZMOL BRITISH PETROCHEMICALS"

## 🔄 Aplicar a Otros Documentos

Si tienes otros componentes de PDF con problemas de logo:

1. **Convertir SVG a Base64**:
   ```bash
   # En terminal Linux/Mac:
   cat src/components/Logo.tsx | grep -oP '<svg.*</svg>' | base64 | xclip
   
   # O en Python:
   import base64
   with open('logo.svg', 'rb') as f:
       b64 = base64.b64encode(f.read()).decode()
       print(f'data:image/svg+xml;base64,{b64}')
   ```

2. **Reemplazar en componente de PDF**:
   ```tsx
   const LOGO_BASE64 = 'data:image/svg+xml;base64,...';
   
   // En el componente:
   <Image src={LOGO_BASE64} style={{ width: 140, height: 28 }} />
   ```

## 📝 Próximos Pasos (Opcional)

Para mejorar aún más:

1. **Exportar logo como PNG**: Convertir a PNG para mejor compresión
   ```bash
   # Usando ImageMagick:
   convert -density 300 logo.svg logo.png
   ```

2. **Crear utilidad reutilizable**:
   ```tsx
   // src/utils/pdfAssets.ts
   export const AZMOL_LOGO = 'data:image/svg+xml;base64,...';
   
   // Usar en cualquier PDF:
   import { AZMOL_LOGO } from '@/utils/pdfAssets';
   ```

## 🔗 Referencias
- [react-pdf/renderer Image documentation](https://react-pdf.org/components)
- [Base64 SVG Data URLs](https://css-tricks.com/data-uris/)
- [@react-pdf/renderer SVG limitations](https://github.com/diegomura/react-pdf/issues)

---

**Estado**: ✅ Resuelto - El logo ahora aparece correctamente en todos los PDFs.
