-- ✅ Tabla para logs de errores en producción (100% GRATIS en Supabase)
-- Ejecuta esto en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT NOT NULL,
  stack TEXT,
  component_stack TEXT,
  user_agent TEXT,
  url TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsquedas rápidas
CREATE INDEX idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX idx_error_logs_user_id ON error_logs(user_id);

-- RLS: Solo admins pueden ver errores
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view error logs"
  ON error_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Permitir insertar errores desde el frontend (anon key)
CREATE POLICY "Anyone can insert error logs"
  ON error_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Función para limpiar logs antiguos (ejecutar mensualmente)
CREATE OR REPLACE FUNCTION cleanup_old_error_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM error_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios
COMMENT ON TABLE error_logs IS 'Logs de errores de frontend para debugging en producción';
