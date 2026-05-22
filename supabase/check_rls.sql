-- Script para verificar qué tablas NO tienen RLS habilitado
SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN rowsecurity = true THEN '✅ RLS HABILITADO'
        ELSE '❌ VULNERABILIDAD - RLS DESHABILITADO'
    END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity, tablename;
