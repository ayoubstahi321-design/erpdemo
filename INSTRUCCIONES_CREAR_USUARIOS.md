# Instrucciones para Habilitar la Creación de Usuarios

Este documento explica cómo configurar tu proyecto para permitir que los administradores creen usuarios desde la aplicación web.

## 📋 Pasos a seguir

### 1. Actualizar el esquema de la base de datos

Primero, necesitas agregar las columnas `email` y `last_active` a la tabla `profiles`:

1. Abre tu [Dashboard de Supabase](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **SQL Editor** en el menú lateral
4. Haz clic en **New Query**
5. Copia y pega el contenido del archivo `fix-profiles-add-email.sql`
6. Haz clic en **Run** o presiona `Ctrl+Enter`

### 1.5. Actualizar políticas RLS (IMPORTANTE)

Para que los administradores puedan editar perfiles de otros usuarios:

1. En el mismo **SQL Editor**
2. Haz clic en **New Query**
3. Copia y pega el contenido del archivo `fix-profiles-rls-update.sql`
4. Haz clic en **Run** o presiona `Ctrl+Enter`

**Este paso es crucial para poder editar usuarios y cambiar sus roles.**

### 2. Desplegar la Edge Function

La Edge Function `create-user` permite crear usuarios usando la API de administración de Supabase.

#### Opción A: Desplegar usando Supabase CLI (Recomendado)

```bash
# Si no tienes Supabase CLI instalado:
npm install -g supabase

# Iniciar sesión en Supabase
supabase login

# Vincular tu proyecto (sustituye con tu project-id)
supabase link --project-ref tu-project-id

# Desplegar la función
supabase functions deploy create-user
```

#### Opción B: Desplegar manualmente desde el Dashboard

1. Ve a **Edge Functions** en el dashboard de Supabase
2. Haz clic en **Create a new function**
3. Nombre: `create-user`
4. Copia el contenido de `supabase/functions/create-user/index.ts`
5. Pégalo en el editor
6. Haz clic en **Deploy**

### 3. Verificar que todo funcione

1. Inicia sesión en la aplicación web como **Admin** o **Manager**
2. Ve a la sección de **Usuarios**
3. Haz clic en **Agregar Usuario**
4. Completa el formulario:
   - Nombre completo
   - Email
   - **Contraseña** (nueva - mínimo 6 caracteres)
   - Rol
5. Haz clic en **Guardar**

Si todo está configurado correctamente, el usuario será creado en `auth.users` y su perfil en la tabla `profiles`.

## 🔧 Solución de Problemas

### Error: "Could not find the 'email' column"
- Asegúrate de haber ejecutado el script `fix-profiles-add-email.sql`
- Verifica que las columnas existan: `SELECT * FROM profiles LIMIT 1;`

### Error: "Cannot coerce the result to a single JSON object" al editar usuario
- Este error ocurre por políticas RLS que impiden actualizar perfiles
- **Solución**: Ejecuta el script `fix-profiles-rls-update.sql` en Supabase SQL Editor
- Este script permite que Admin/Manager puedan editar cualquier perfil

### Error: "Edge function not found"
- Verifica que hayas desplegado la función `create-user`
- Comprueba el estado en **Edge Functions** del dashboard

### Error: "No autorizado" o "Solo los administradores pueden crear usuarios"
- Asegúrate de estar logueado como Admin o Manager
- Verifica que tu perfil tenga el rol correcto: `SELECT * FROM profiles WHERE id = auth.uid();`

### Error: "User already registered"
- El email ya existe en el sistema
- Usa un email diferente o elimina el usuario existente primero

## 🔒 Seguridad

- Solo usuarios con rol **Admin** o **Manager** pueden crear usuarios
- Las contraseñas deben tener al menos 6 caracteres
- Los emails de los usuarios se confirman automáticamente
- La Edge Function usa `SUPABASE_SERVICE_ROLE_KEY` que tiene permisos de administrador
- Todas las operaciones se registran en los logs de Supabase

## 📝 Notas Adicionales

- **Editar usuarios**: Al editar un usuario existente, NO se puede cambiar la contraseña desde el formulario. Para cambiar contraseñas, usa el panel de Supabase Auth o implementa una función adicional de "reset password"
- **Eliminar usuarios**: Al eliminar un usuario, se elimina tanto de `auth.users` como de `profiles` (CASCADE)
- **Roles disponibles**: Admin, Manager, Sales, Cashier, Delivery

## 🎯 ¿Cómo funciona?

1. El administrador completa el formulario con los datos del nuevo usuario
2. El frontend llama a la Edge Function `create-user`
3. La Edge Function verifica que el usuario actual sea Admin/Manager
4. La función crea el usuario en `auth.users` usando la Admin API
5. El trigger `handle_new_user` crea automáticamente el perfil en `profiles`
6. El nuevo usuario puede iniciar sesión con su email y contraseña

---

¿Necesitas ayuda? Revisa los logs de Supabase en la sección **Logs** > **Edge Functions** del dashboard.
