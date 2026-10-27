-- ============================================================
-- MIGRACIÓN 013: Tabla de Asignaciones de Evaluación
-- ============================================================
-- Permite al rol de Administrador parametrizar y planificar qué
-- evaluaciones debe realizar cada líder a sus colaboradores asignados
-- para un ciclo o año determinado (ej. 2026).
-- ============================================================

CREATE TABLE IF NOT EXISTS evaluation_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  evaluation_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  version_id UUID REFERENCES evaluation_versions(id) ON DELETE SET NULL,
  evaluator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  collaborator_id UUID NOT NULL REFERENCES collaborators(id) ON DELETE CASCADE,
  evaluation_id UUID REFERENCES evaluations(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pendiente', -- 'pendiente', 'en_proceso', 'pendiente_firma', 'finalizada'
  notes TEXT,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Un colaborador solo tiene un líder evaluador asignado por año de evaluación
  CONSTRAINT unique_year_collaborator UNIQUE(evaluation_year, collaborator_id)
);

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_eval_assignments_year ON evaluation_assignments(evaluation_year);
CREATE INDEX IF NOT EXISTS idx_eval_assignments_evaluator ON evaluation_assignments(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_eval_assignments_collab ON evaluation_assignments(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_eval_assignments_status ON evaluation_assignments(status);
CREATE INDEX IF NOT EXISTS idx_eval_assignments_comp ON evaluation_assignments(company_id);

-- Función trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_evaluation_assignments_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_evaluation_assignments_timestamp ON evaluation_assignments;
CREATE TRIGGER trg_update_evaluation_assignments_timestamp
  BEFORE UPDATE ON evaluation_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_evaluation_assignments_timestamp();

-- Función trigger para sincronizar estado de asignación cuando se crea o finaliza una evaluación
CREATE OR REPLACE FUNCTION sync_evaluation_assignment_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE evaluation_assignments
  SET
    evaluation_id = NEW.id,
    status = NEW.status::text,
    updated_at = NOW()
  WHERE collaborator_id = NEW.evaluatee_id
    AND evaluation_year = NEW.evaluation_year;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_eval_assignment_on_insert ON evaluations;
CREATE TRIGGER trg_sync_eval_assignment_on_insert
  AFTER INSERT OR UPDATE OF status ON evaluations
  FOR EACH ROW
  EXECUTE FUNCTION sync_evaluation_assignment_status();

-- Políticas RLS (Seguridad a Nivel de Fila)
ALTER TABLE evaluation_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin, RRHH y Gerencia pueden gestionar asignaciones" ON evaluation_assignments;
CREATE POLICY "Admin, RRHH y Gerencia pueden gestionar asignaciones"
  ON evaluation_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
        AND r.name IN ('admin', 'rrhh', 'gerencia')
    )
  );

DROP POLICY IF EXISTS "Líderes pueden ver sus evaluaciones asignadas" ON evaluation_assignments;
CREATE POLICY "Líderes pueden ver sus evaluaciones asignadas"
  ON evaluation_assignments
  FOR SELECT
  USING (evaluator_id = auth.uid());
