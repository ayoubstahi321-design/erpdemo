# Guía de Despliegue - Groq AI Integration

## ✅ Código Completado

Se han creado/modificado los siguientes archivos:

### Backend (Supabase Edge Functions)
- ✅ `supabase/functions/ai-chat/index.ts` - Edge Function principal
- ✅ `supabase/functions/ai-chat/README.md` - Documentación

### Frontend
- ✅ `web/src/services/aiService.ts` - Servicio de comunicación con AI
- ✅ `web/src/components/AIAssistant.tsx` - Componente UI del chat
- ✅ `web/src/App.tsx` - Integración del widget flotante

---

## 🚀 PASO 1: Configurar API Key en Supabase

### Opción A: Via Supabase CLI (Recomendado)

```bash
# Navega al directorio del proyecto
cd c:\Users\basma\Downloads\azmol-stockerp

# Configura el secreto
supabase secrets set GROQ_API_KEY="TU_GROQ_API_KEY_AQUI"

# Verifica que se configuró correctamente
supabase secrets list
```

### Opción B: Via Supabase Dashboard

1. Ve a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto: **mkehxermgmdqsogmlaqq**
3. Ve a **Settings** → **Edge Functions** → **Secrets**
4. Añade un nuevo secreto:
   - **Name:** `GROQ_API_KEY`
   - **Value:** `TU_GROQ_API_KEY_AQUI`
5. Guarda

---

## 🚀 PASO 2: Desplegar Edge Function

```bash
# Asegúrate de estar en el directorio raíz del proyecto
cd c:\Users\basma\Downloads\azmol-stockerp

# Despliega la función
supabase functions deploy ai-chat

# Deberías ver:
# Deploying ai-chat...
# ✓ Deployed ai-chat successfully
```

### Verificar Despliegue

```bash
# Lista todas las funciones
supabase functions list

# Deberías ver:
# - ai-chat
# - validate-inventory
# - validate-sale
```

---

## 🚀 PASO 3: Compilar Frontend

```bash
# Navega al directorio web
cd c:\Users\basma\Downloads\azmol-stockerp\web

# Compila el proyecto para verificar que no hay errores
npm run build

# Deberías ver:
# ✓ built in XXs
```

---

## 🧪 PASO 4: Testing

### Test Local del Frontend

```bash
# Inicia el servidor de desarrollo
cd c:\Users\basma\Downloads\azmol-stockerp\web
npm run dev

# Abre el navegador en http://localhost:5173
```

#### Pasos de Testing Manual:

1. **Login**
   - Inicia sesión con tu cuenta de Supabase
   - Verifica que aparece el botón flotante morado (Sparkles) en la esquina inferior derecha

2. **Abrir Widget AI**
   - Click en el botón flotante
   - Debería aparecer el widget de chat AI
   - Verifica el mensaje de bienvenida

3. **Test Quick Actions**
   - Haz click en una de las acciones rápidas
   - Espera la respuesta del AI (debería tomar 2-5 segundos)
   - Verifica que la respuesta es coherente

4. **Test Pregunta Personalizada**
   - Escribe: "¿Qué productos tienen stock bajo?"
   - Envía el mensaje
   - Verifica la respuesta

5. **Test Página Completa** (Opcional)
   - Si tienes un menú lateral con "AI Assistant", navega a esa sección
   - Deberías ver la versión de página completa con grid de quick actions

### Test de Edge Function (Via curl)

```bash
# Primero, obtén un token JWT
# 1. Inicia sesión en tu app
# 2. Abre DevTools (F12) → Console
# 3. Ejecuta: (await supabase.auth.getSession()).data.session.access_token
# 4. Copia el token

# Prueba la función con curl (reemplaza YOUR_JWT_TOKEN)
curl -X POST "https://mkehxermgmdqsogmlaqq.supabase.co/functions/v1/ai-chat" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Test\",\"context\":{}}"

# Deberías recibir una respuesta JSON con "response", "usage", "timestamp"
```

---

## 🔍 PASO 5: Verificar Logs

### Ver Logs de Edge Function

1. Ve a [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. **Functions** → **ai-chat** → **Logs**
4. Verifica que las peticiones se registran correctamente
5. Busca errores (si hay)

### Logs Frontend

1. Abre DevTools (F12) en el navegador
2. Ve a la pestaña **Console**
3. Envía un mensaje al AI
4. No deberían aparecer errores en rojo

---

## ✅ Checklist de Verificación

- [ ] **API Key configurada** en Supabase Secrets
- [ ] **Edge Function desplegada** (`supabase functions deploy ai-chat`)
- [ ] **Frontend compila** sin errores (`npm run build`)
- [ ] **Botón flotante visible** después del login
- [ ] **Widget abre correctamente** al hacer click
- [ ] **Quick actions funcionan** (envían mensaje automático)
- [ ] **Respuestas del AI son coherentes** y relevantes
- [ ] **No hay errores** en Console del navegador
- [ ] **Logs de Supabase** muestran requests exitosos

---

## 🐛 Troubleshooting

### Error: "GROQ_API_KEY not configured"

**Causa:** La API key no está configurada en Supabase Secrets

**Solución:**
```bash
supabase secrets set GROQ_API_KEY="TU_GROQ_API_KEY_AQUI"
```

### Error: "Unauthorized"

**Causa:** El usuario no está autenticado o la sesión expiró

**Solución:**
1. Cierra sesión y vuelve a iniciar sesión
2. Verifica que Supabase Auth esté configurado correctamente

### Error: "Rate limit exceeded"

**Causa:** Enviaste más de 20 mensajes en 1 minuto

**Solución:**
- Espera 60 segundos antes de enviar más mensajes
- Esto es normal y está diseñado para prevenir abuso

### Widget no aparece

**Causa:** Posible error de compilación o el usuario no está logueado

**Solución:**
1. Verifica que `currentUser` no es null
2. Revisa la consola del navegador por errores
3. Refresca la página

### AI no responde o responde con error

**Causa:** Problema con Groq API o contexto demasiado grande

**Solución:**
1. Verifica logs de Supabase
2. Verifica que la API key de Groq es válida en [console.groq.com](https://console.groq.com)
3. Intenta con un mensaje más simple: "Hola"

---

## 📊 Monitoreo de Costos

### Ver uso de Groq API

1. Ve a [Groq Console](https://console.groq.com)
2. **Usage** → Ver tokens consumidos
3. Con el modelo `llama-3.1-8b-instant`:
   - Entrada: ~$0.05 / 1M tokens
   - Salida: ~$0.08 / 1M tokens

### Uso esperado

- **Por consulta:** ~500-700 tokens (entrada + salida)
- **Costo por consulta:** ~$0.00004
- **1000 consultas:** ~$0.04

---

## 🎉 ¡Listo!

Si completaste todos los pasos y las verificaciones, tu AI Assistant está completamente funcional.

### Próximos Pasos Opcionales

1. **Añadir opción en el menú lateral** para acceder a la versión de página completa del AI
2. **Personalizar prompts** del sistema en `supabase/functions/ai-chat/index.ts`
3. **Ajustar quick actions** en `web/src/services/aiService.ts`
4. **Implementar caché** para respuestas frecuentes
5. **Migrar rate limiting a Redis** para producción

---

## 📞 Soporte

Si encuentras problemas:
1. Revisa los logs de Supabase
2. Revisa la consola del navegador
3. Verifica que la API key de Groq es válida
4. Asegúrate de que tienes créditos en Groq

---

**Creado por:** Claude Code
**Fecha:** 2025-01-15
**Versión:** 1.0
