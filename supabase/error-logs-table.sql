-- ✅ TABLA PARA ERROR TRACKING GRATUITO
-- Ejecuta esto en Supabase SQL Editor
-- Almacena errores de producción sin servicios de pago

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT NOT NULL,
  stack TEXT,
  component_stack TEXT,
  user_agent TEXT,
  url TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  notes TEXT
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_error_logs_timestamp ON error_logs(timestamp DESC);
CREATE INDEX idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX idx_error_logs_user ON error_logs(user_id);

-- RLS: Solo admins pueden ver errores
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all error logs"
ON error_logs FOR SELECT
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  )
);

CREATE POLICY "System can insert error logs"
ON error_logs FOR INSERT
WITH CHECK (true);

-- Limpieza automática: borrar errores antiguos resueltos (cada 30 días)
-- Ejecutar manualmente o con cron job gratuito
DELETE FROM error_logs 
WHERE resolved = true 
AND timestamp < NOW() - INTERVAL '30 days';

COMMENT ON TABLE error_logs IS 'Error tracking gratuito - alternativa a Sentry';
