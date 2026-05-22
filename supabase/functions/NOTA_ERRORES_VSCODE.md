# 📝 Nota sobre Errores de TypeScript en VSCode

Si ves errores como **"Cannot find name 'Deno'"** en VSCode, **no te preocupes**. Esto es completamente normal y **NO afectará el funcionamiento** de tus Edge Functions en Supabase.

## ¿Por qué aparecen estos errores?

VSCode usa el compilador de TypeScript de **Node.js** por defecto, pero las Edge Functions de Supabase se ejecutan en **Deno** (un runtime diferente). Por eso VSCode muestra errores al no reconocer objetos globales de Deno como:
- `Deno.env.get()`
- Otros APIs de Deno

## ✅ El código funciona perfectamente

Cuando despliegues la función a Supabase, funcionará sin problemas porque Supabase usa Deno, que **sí** reconoce estos objetos.

## 🔧 Solución (Opcional)

Si quieres eliminar los errores de VSCode:

### Opción 1: Instalar la extensión de Deno (Recomendado)

1. Abre VSCode
2. Ve a la vista de **Extensiones** (`Ctrl+Shift+X`)
3. Busca **"Deno"**
4. Instala la extensión oficial: **"denoland.vscode-deno"**
5. **Recarga VSCode** (`Ctrl+Shift+P` → "Reload Window")
6. Los errores deberían desaparecer automáticamente en la carpeta `supabase/functions/`

### Opción 2: Ignorar los errores

Si no quieres instalar la extensión:
- Los errores son solo visuales en VSCode
- El código desplegado funcionará perfectamente
- Puedes ignorarlos con seguridad

## 📚 Más información

- [Documentación de Deno](https://deno.land/manual)
- [Edge Functions de Supabase](https://supabase.com/docs/guides/functions)
- [Extensión VSCode de Deno](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno)

---

**TL;DR**: Los errores de "Cannot find name 'Deno'" son normales en VSCode y no afectan el funcionamiento. Instala la extensión de Deno para VSCode si quieres eliminarlos.
