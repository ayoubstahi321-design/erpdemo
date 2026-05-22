@echo off
REM ============================================
REM BACKUP AUTOMATICO AZMOL ERP
REM ============================================
REM Este script ejecuta el backup y registra el resultado
REM Los backups se guardan en: C:\Users\basma\Desktop\azmol backup
REM Google Drive Desktop los sube automaticamente a la nube

echo.
echo ========================================
echo BACKUP AUTOMATICO AZMOL ERP
echo ========================================
echo Fecha: %date% %time%
echo Destino: C:\Users\basma\Desktop\azmol backup
echo.

cd /d "C:\Users\basma\Downloads\azmol-stockerp"

echo Ejecutando backup...
call npm run backup:local

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✓ Backup completado exitosamente
    echo ✓ Google Drive Desktop subira el archivo automaticamente
    echo [%date% %time%] Backup exitoso >> scripts\backup-log.txt
) else (
    echo.
    echo ✗ Error en el backup
    echo [%date% %time%] Error en backup >> scripts\backup-log.txt
)

echo.
echo Presiona cualquier tecla para salir...
pause > nul
