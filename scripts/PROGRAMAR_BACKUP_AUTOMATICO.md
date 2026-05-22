# Programar Backup Automático Semanal

## 📅 Configuración: Cada Domingo a las 3:00 AM

### Paso 1: Abrir el Programador de Tareas de Windows

1. **Presiona las teclas:** `Win + R` (Windows + R al mismo tiempo)
2. **Escribe:** `taskschd.msc`
3. **Presiona:** Enter

Se abrirá el "Programador de tareas" (Task Scheduler)

### Paso 2: Crear Nueva Tarea Básica

1. En el menú de la derecha, haz clic en **"Crear tarea básica..."** o **"Create Basic Task..."**

2. **Nombre de la tarea:**
   ```
   AZMOL ERP Backup Semanal
   ```

3. **Descripción:**
   ```
   Backup automático semanal de la base de datos AZMOL ERP a Google Drive
   ```

4. Haz clic en **"Siguiente"** o **"Next"**

### Paso 3: Configurar el Desencadenador (Trigger)

1. Selecciona: **"Semanalmente"** o **"Weekly"**
2. Haz clic en **"Siguiente"**

3. **Configuración semanal:**
   - **Iniciar:** Elige la fecha de inicio (hoy o próximo domingo)
   - **Hora:** `03:00:00` (3:00 AM)
   - **Repetir cada:** `1` semana
   - **Día:** Marca solo **"Domingo"** o **"Sunday"** ✅
   - Desmarca los demás días

4. Haz clic en **"Siguiente"**

### Paso 4: Configurar la Acción

1. Selecciona: **"Iniciar un programa"** o **"Start a program"**
2. Haz clic en **"Siguiente"**

3. **Programa o script:**
   ```
   C:\Users\basma\Downloads\azmol-stockerp\scripts\backup-automatico.bat
   ```

   💡 **Tip:** Haz clic en "Examinar..." y navega a:
   - `C:\Users\basma\Downloads\azmol-stockerp\scripts\`
   - Selecciona el archivo `backup-automatico.bat`

4. **Dejar en blanco:**
   - "Agregar argumentos"
   - "Iniciar en"

5. Haz clic en **"Siguiente"**

### Paso 5: Revisar y Finalizar

1. **Revisa el resumen:**
   - ✅ Nombre: AZMOL ERP Backup Semanal
   - ✅ Desencadenador: Semanalmente los domingos a las 3:00 AM
   - ✅ Acción: Ejecutar backup-automatico.bat

2. **IMPORTANTE:** Marca la casilla:
   - ☑️ **"Abrir el cuadro de diálogo Propiedades para esta tarea al hacer clic en Finalizar"**
   - O en inglés: ☑️ **"Open the Properties dialog for this task when I click Finish"**

3. Haz clic en **"Finalizar"** o **"Finish"**

### Paso 6: Configuraciones Avanzadas (Ventana de Propiedades)

Se abrirá automáticamente la ventana de "Propiedades" de la tarea.

#### Pestaña "General":

1. **Opciones de seguridad:**
   - ⚪ Deja seleccionado: "Ejecutar solo cuando el usuario haya iniciado sesión"
   - O si prefieres que funcione aunque no hayas iniciado sesión:
     - ⚪ Selecciona: "Ejecutar tanto si el usuario inició sesión como si no"
     - Esto pedirá tu contraseña de Windows

2. **Configurar para:**
   - Selecciona `Windows 10` o `Windows 11` (según tu versión)

#### Pestaña "Condiciones":

1. **Energía:**
   - ☑️ Marca: "Iniciar la tarea solo si el equipo está conectado a alimentación de CA"
   - ☑️ Marca: "Detener si el equipo deja de utilizar alimentación de CA"

   💡 Esto asegura que el backup solo se ejecute si el portátil está conectado

2. **Red (Opcional):**
   - Si quieres asegurar que haya internet, marca:
   - ☑️ "Iniciar solo si está disponible la siguiente conexión de red: Cualquier conexión"

#### Pestaña "Configuración":

1. Configura estas opciones:
   - ☑️ "Permitir que la tarea se ejecute a petición"
   - ☑️ "Ejecutar la tarea lo antes posible después de un inicio programado perdido"
   - ☑️ "Si la tarea falla, reiniciar cada: 1 minuto"
   - "Intentar reiniciar hasta: 3 veces"

2. **Haz clic en "Aceptar"** o **"OK"**

### Paso 7: Probar la Tarea

Para verificar que funciona SIN esperar hasta el domingo:

1. **En el Programador de Tareas:**
   - Busca tu tarea en la lista (Biblioteca del Programador de tareas)
   - Busca: "AZMOL ERP Backup Semanal"

2. **Haz clic derecho** sobre la tarea

3. **Selecciona "Ejecutar"** o **"Run"**

4. **Verifica:**
   - Debería aparecer una ventana de CMD ejecutando el backup
   - Espera a que termine (1-2 minutos)
   - Verifica que se creó un nuevo archivo en `C:\Users\basma\Desktop\azmol backup`
   - En 1-2 minutos, verifica en Google Drive que se subió el archivo

## 📋 Verificación Final

### ✅ Checklist:

- [ ] Tarea creada: "AZMOL ERP Backup Semanal"
- [ ] Programada para: Domingos a las 3:00 AM
- [ ] Script: backup-automatico.bat
- [ ] Tarea probada manualmente y funciona
- [ ] Archivo aparece en Desktop\azmol backup
- [ ] Archivo se sube a Google Drive automáticamente

## 🎯 Resultado Final

A partir de ahora, **cada domingo a las 3:00 AM**:

1. ⏰ Windows ejecutará automáticamente el backup
2. 💾 Se creará un archivo cifrado en Desktop\azmol backup
3. ☁️ Google Drive Desktop lo subirá automáticamente
4. ✅ Tus datos estarán seguros en la nube

## 📝 Ver Historial de Backups

Para ver cuándo se ejecutaron los backups:

1. Abre: `C:\Users\basma\Downloads\azmol-stockerp\scripts\backup-log.txt`
2. Verás un registro como:
   ```
   [03/01/2026 03:00:15] Backup exitoso
   [10/01/2026 03:00:12] Backup exitoso
   [17/01/2026 03:00:09] Backup exitoso
   ```

## ⚠️ Importante: Mantén el Portátil Conectado

Para que el backup se ejecute los domingos a las 3:00 AM:

- 🔌 El portátil debe estar **ENCENDIDO** o en **SUSPENSIÓN** (no apagado)
- 🔋 Debe estar **CONECTADO a la corriente**
- 🌐 Debe tener **conexión a internet** (para subir a Drive)

💡 **Alternativa:** Si prefieres que se ejecute en otro momento (cuando estés usando el PC), puedes cambiar el horario a uno más conveniente.

## 🔧 Cambiar Horario en el Futuro

1. Abre el Programador de Tareas (`Win + R` → `taskschd.msc`)
2. Busca "AZMOL ERP Backup Semanal"
3. Haz clic derecho → "Propiedades"
4. Ve a la pestaña "Desencadenadores"
5. Selecciona el desencadenador y haz clic en "Editar"
6. Cambia la hora o el día
7. Haz clic en "Aceptar"

## 🆘 Solución de Problemas

### La tarea no se ejecuta:

1. **Verifica en el Programador de Tareas:**
   - Estado: Debe decir "Preparado" o "Ready"
   - Si dice "Deshabilitado", haz clic derecho → "Habilitar"

2. **Revisa el historial:**
   - Haz clic derecho en la tarea → "Propiedades"
   - Pestaña "Historial"
   - Verás los intentos de ejecución y errores

3. **Verifica el archivo .bat:**
   - Ejecuta manualmente: doble clic en `backup-automatico.bat`
   - Debe funcionar sin errores

### El portátil estaba apagado el domingo:

- La configuración "Ejecutar la tarea lo antes posible después de un inicio programado perdido" hará que se ejecute cuando enciendas el PC
