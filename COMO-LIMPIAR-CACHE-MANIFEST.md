# 🔥 INSTRUCCIONES PARA ELIMINAR CACHE DE MANIFEST BLOB

## El Problema:
Tu navegador tiene CACHE PERSISTENTE del manifest.json antiguo con blob URLs.
El código está correcto en producción, pero el navegador no lo ve porque
tiene cacheado todo a nivel profundo.

## ✅ SOLUCIÓN DEFINITIVA (Paso a Paso):

### OPCIÓN 1: Modo Incógnito (MÁS RÁPIDO)
1. Abre ventana **incógnito/privada**:
   - Chrome: `Ctrl + Shift + N`
   - Firefox: `Ctrl + Shift + P`
   - Edge: `Ctrl + Shift + N`

2. Ve a: `https://azmol-stockerp.vercel.app`

3. Abre F12 → Console

4. Debes ver:
   ```
   [Init] Starting aggressive cleanup...
   [✅] Cleanup completed
   [✅] Fresh manifest loaded: /app.webmanifest?v=...
   ```

5. **NO DEBE aparecer** ningún blob UUID

---

### OPCIÓN 2: Limpiar Cache Completo (SI OPCIÓN 1 NO FUNCIONA)

1. **Cerrar TODAS las pestañas** de azmol-stockerp.vercel.app

2. Abrir nueva pestaña → F12 → **Application** tab

3. Ir a **Storage** en el panel izquierdo

4. Click **"Clear storage"**

5. Marcar TODO:
   - [x] Cookies
   - [x] Local storage
   - [x] Session storage
   - [x] IndexedDB
   - [x] Web SQL (si aparece)
   - [x] Cache storage
   - [x] Application cache

6. Click **"Clear site data"**

7. Cerrar DevTools

8. En la barra de direcciones escribir:
   ```
   chrome://serviceworker-internals/
   ```
   O en Firefox:
   ```
   about:serviceworkers
   ```

9. Buscar `azmol-stockerp` y click **"Unregister"** en TODOS

10. Cerrar pestaña

11. **Hard Refresh** en nueva pestaña:
    - Windows: `Ctrl + Shift + R`
    - Mac: `Cmd + Shift + R`

12. Repetir 3 veces el hard refresh

13. Abrir `https://azmol-stockerp.vercel.app`

14. F12 → Console → Verificar logs limpios

---

### OPCIÓN 3: Nuclear (SI TODO FALLA)

1. **Cerrar navegador completamente**

2. Ejecutar en CMD/PowerShell:

**Windows (Chrome):**
```powershell
Remove-Item -Path "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Service Worker" -Recurse -Force
Remove-Item -Path "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cache" -Recurse -Force
```

**Windows (Edge):**
```powershell
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Service Worker" -Recurse -Force
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Cache" -Recurse -Force
```

3. Reiniciar navegador

4. Ir a la app

---

## 🔍 Verificación Final:

Cuando funcione correctamente, en F12 → Console verás:

```
[Init] Starting aggressive cleanup...
[Cleanup] Removing old manifest link: (si había)
[Cleanup] Unregistering SW: / (si había)
[Cleanup] Deleting cache: ... (si había)
[✅] Cleanup completed
[✅] Fresh manifest loaded: /app.webmanifest?v=1705...
```

Y en F12 → Network → buscar "app.webmanifest":
- Status: **200**
- Type: **application/manifest+json**
- NO debe haber warnings de "property ignored"

---

## ⚠️ SI SIGUE FALLANDO:

El problema puede ser:
1. **Proxy corporativo** cacheando
2. **Antivirus** interceptando requests
3. **CDN de Vercel** no propagado (esperar 5 minutos)
4. **DNS cache** - ejecutar: `ipconfig /flushdns`

En ese caso, espera 5-10 minutos y prueba Opción 1 (Incógnito) de nuevo.
