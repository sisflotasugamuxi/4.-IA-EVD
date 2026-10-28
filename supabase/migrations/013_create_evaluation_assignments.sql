-- ============================================================
-- MIGRACIÓN 013: Tabla de Asignaciones de Evaluación
-- ============================================================
-- Permite al rol de Administrador parametrizar y planificar qué
-- evaluaciones debe realizar cada líder a sus colaboradores asignados
-- para un ciclo o año determinado (ej. 2026).
-- ============================================================

-- 1. Fijar el esquema de trabajo seguro
SET search_path TO public, extensions;

-- 2. Creación de la tabla evaluation_assignments
CREATE TABLE IF NOT EXISTS public.evaluation_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL DEFAULT '11111111-0000-0000-0000-000000000001',
  evaluation_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  version_id UUID REFERENCES public.evaluation_versions(id) ON DELETE SET NULL,
  evaluator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  collaborator_id UUID NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  evaluation_id UUID REFERENCES public.evaluations(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pendiente', -- 'pendiente', 'en_proceso', 'pendiente_firma', 'finalizada'
  notes TEXT,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Un colaborador solo tiene un líder evaluador asignado por año de evaluación
  CONSTRAINT unique_year_collaborator UNIQUE(evaluation_year, collaborator_id)
);

-- 3. Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_eval_assignments_year ON public.evaluation_assignments(evaluation_year);
CREATE INDEX IF NOT EXISTS idx_eval_assignments_evaluator ON public.evaluation_assignments(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_eval_assignments_collab ON public.evaluation_assignments(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_eval_assignments_status ON public.evaluation_assignments(status);
CREATE INDEX IF NOT EXISTS idx_eval_assignments_comp ON public.evaluation_assignments(company_id);

-- 4. Función trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_evaluation_assignments_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_evaluation_assignments_timestamp ON public.evaluation_assignments;
CREATE TRIGGER trg_update_evaluation_assignments_timestamp
  BEFORE UPDATE ON public.evaluation_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_evaluation_assignments_timestamp();

-- 5. Función trigger para sincronizar estado de asignación cuando se crea o finaliza una evaluación
CREATE OR REPLACE FUNCTION public.sync_evaluation_assignment_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.evaluation_assignments
  SET
    evaluation_id = NEW.id,
    status = NEW.status::text,
    updated_at = NOW()
  WHERE collaborator_id = NEW.evaluatee_id
    AND evaluation_year = NEW.evaluation_year;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_eval_assignment_on_insert ON public.evaluations;
CREATE TRIGGER trg_sync_eval_assignment_on_insert
  AFTER INSERT OR UPDATE OF status ON public.evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_evaluation_assignment_status();

-- 6. Políticas RLS (Seguridad a Nivel de Fila)
ALTER TABLE public.evaluation_assignments ENABLE ROW LEVEL SECURITY;

-- Permitir a service_role acceso completo
DROP POLICY IF EXISTS "Permitir acceso completo a service_role" ON public.evaluation_assignments;
CREATE POLICY "Permitir acceso completo a service_role"
  ON public.evaluation_assignments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admin, RRHH y Gerencia pueden gestionar asignaciones" ON public.evaluation_assignments;
CREATE POLICY "Admin, RRHH y Gerencia pueden gestionar asignaciones"
  ON public.evaluation_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name::text IN ('admin', 'rrhh', 'gerencia')
    )
  );

DROP POLICY IF EXISTS "Líderes pueden ver sus evaluaciones asignadas" ON public.evaluation_assignments;
CREATE POLICY "Líderes pueden ver sus evaluaciones asignadas"
  ON public.evaluation_assignments
  FOR SELECT
  USING (evaluator_id = auth.uid());
