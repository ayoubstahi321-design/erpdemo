# Supabase Edge Functions

Este directorio contiene las Edge Functions de Supabase para el proyecto Azmol Stock ERP.

## 📁 Funciones Disponibles

### `create-user`
Permite a los administradores crear nuevos usuarios desde la aplicación web.

**Endpoint:** `https://<tu-proyecto>.supabase.co/functions/v1/create-user`

**Método:** POST

**Headers:**
```json
{
  "Authorization": "Bearer <user-token>",
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "contraseña123",
  "name": "Nombre Completo",
  "role": "Sales"
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "usuario@ejemplo.com",
    "name": "Nombre Completo",
    "role": "Sales",
    "lastActive": "2024-01-01T00:00:00.000Z"
  }
}
```

## 🚀 Despliegue

### Con Supabase CLI

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Vincular proyecto
supabase link --project-ref <tu-project-id>

# Desplegar todas las funciones
supabase functions deploy

# Desplegar una función específica
supabase functions deploy create-user
```

### Desde el Dashboard

1. Ve a **Edge Functions** en el dashboard de Supabase
2. Haz clic en **Create a new function**
3. Nombre: `create-user`
4. Copia y pega el contenido de `create-user/index.ts`
5. Haz clic en **Deploy**

## 🧪 Testing Local

```bash
# Servir funciones localmente
supabase functions serve create-user

# En otra terminal, hacer una request de prueba
curl -i --location --request POST 'http://localhost:54321/functions/v1/create-user' \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{"email":"test@test.com","password":"test123","name":"Test User","role":"Sales"}'
```

## ⚙️ Configuración de VSCode

Si ves errores de TypeScript en VSCode (como "Cannot find name 'Deno'"), esto es normal. El código funciona correctamente en Supabase.

Para mejorar la experiencia de desarrollo:

1. **Instala la extensión de Deno para VSCode:**
   - Busca "Deno" en el marketplace de VSCode
   - Instala "denoland.vscode-deno"

2. **Recarga VSCode** después de instalar la extensión

3. **Los errores deberían desaparecer** ya que VSCode ahora reconocerá la sintaxis de Deno

## 📝 Notas Importantes

- Las Edge Functions de Supabase usan **Deno**, no Node.js
- Usa `Deno.env.get()` en lugar de `process.env`
- Los imports deben ser URLs completas (https://...)
- Las variables de entorno se configuran automáticamente en Supabase:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_ANON_KEY`

## 🔒 Seguridad

- La función `create-user` verifica que el usuario actual sea Admin o Manager
- Usa `SUPABASE_SERVICE_ROLE_KEY` para operaciones administrativas
- Los tokens de usuario se validan antes de procesar la solicitud
- Las contraseñas nunca se exponen en los logs
