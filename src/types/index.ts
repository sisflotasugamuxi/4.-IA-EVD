// ============================================================
// EVD Flota Sugamuxi — Tipos TypeScript Completos
// ============================================================

// ---- ENUMS ----
export type UserRole = "admin" | "rrhh" | "gerencia" | "lider" | "colaborador";
export type ContractType = "indefinido" | "fijo" | "obra_labor" | "aprendizaje" | "prestacion_servicios" | "temporal";
export type EvaluationStatus = "borrador" | "en_proceso" | "pendiente_firma" | "finalizada" | "reabierta" | "anulada";
export type EvaluationResult = "aprobado" | "plan_mejoramiento" | "no_aprobado" | "pendiente";
export type PMIStatus = "activo" | "en_seguimiento" | "cerrado" | "vencido";
export type FollowupStatus = "pendiente" | "completado" | "vencido";
export type NotificationType = "evaluacion_creada" | "evaluacion_pendiente" | "evaluacion_finalizada" | "pmi_generado" | "seguimiento_vencido" | "colaborador_nuevo" | "correo_fallido" | "sistema";
export type AuditAction = "crear" | "editar" | "eliminar" | "finalizar" | "reabrir" | "correo_enviado" | "descarga_pdf" | "descarga_excel" | "cambio_configuracion" | "login" | "logout";
export type DocumentType = "CC" | "CE" | "TI" | "PP" | "NIT" | "RUT";
export type GenderType = "masculino" | "femenino" | "otro" | "no_informa";
export type CollaboratorStatus = "activo" | "inactivo" | "retirado" | "vacaciones" | "incapacidad";
export type EmailStatus = "enviado" | "fallido" | "pendiente" | "bounced";

// ---- BASE ----
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

// ---- COMPANY ----
export interface Company extends BaseEntity {
  name: string;
  nit?: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  email?: string;
  city?: string;
  country: string;
  active: boolean;
}

// ---- ROLES & PERMISSIONS ----
export interface Role extends BaseEntity {
  name: UserRole;
  display_name: string;
  description?: string;
  active: boolean;
}

export interface Permission extends BaseEntity {
  role_id: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
  can_approve: boolean;
}

// ---- PROFILE ----
export interface Profile extends BaseEntity {
  id: string;
  company_id?: string;
  role_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  collaborator_id?: string;
  active: boolean;
  last_login?: string;
  // Joined
  role?: Role;
  company?: Company;
}

// ---- AREAS, PROCESSES, POSITIONS ----
export interface Area extends BaseEntity {
  company_id: string;
  name: string;
  code?: string;
  description?: string;
  manager_id?: string;
  active: boolean;
}

export interface Process extends BaseEntity {
  area_id: string;
  name: string;
  code?: string;
  description?: string;
  active: boolean;
}

export interface Position extends BaseEntity {
  company_id: string;
  area_id?: string;
  process_id?: string;
  name: string;
  code?: string;
  level: number;
  description?: string;
  active: boolean;
}

export interface CostCenter extends BaseEntity {
  company_id: string;
  name: string;
  code?: string;
  description?: string;
  active: boolean;
}

// ---- COLLABORATOR ----
export interface Collaborator extends BaseEntity {
  company_id: string;
  // Personal
  document_type: DocumentType;
  document_number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  birth_date?: string;
  gender?: GenderType;
  // Laboral
  internal_code?: string;
  area_id?: string;
  process_id?: string;
  position_id?: string;
  cost_center_id?: string;
  workplace_city?: string;
  workplace?: string;
  contract_type?: ContractType;
  hire_date?: string;
  termination_date?: string;
  status: CollaboratorStatus;
  // Jerarquía
  immediate_boss_id?: string;
  area_leader_id?: string;
  responsible_manager_id?: string;
  // Foto
  photo_url?: string;
  active: boolean;
  // Joined
  area?: Area;
  areas?: Area;
  position?: Position;
  positions?: Position;
  process?: Process;
  processes?: Process;
  cost_center?: CostCenter;
  immediate_boss?: Pick<Collaborator, "id" | "full_name" | "position_id">;
}

// ---- EVALUATION VERSIONS ----
export interface EvaluationVersion extends BaseEntity {
  company_id: string;
  year: number;
  name: string;
  description?: string;
  is_active: boolean;
  is_published: boolean;
  questions_count: number;
  scale_min: number;
  scale_max: number;
  approved_threshold: number;
  pmi_threshold: number;
}

// ---- EVALUATION CATEGORIES ----
export interface EvaluationCategory extends BaseEntity {
  version_id: string;
  name: string;
  description?: string;
  sort_order: number;
  weight: number;
  active: boolean;
  // Joined
  questions?: EvaluationQuestion[];
}

// ---- EVALUATION QUESTIONS ----
export interface EvaluationQuestion extends BaseEntity {
  category_id: string;
  version_id: string;
  code?: string;
  question: string;
  description?: string;
  sort_order: number;
  is_required: boolean;
  is_active: boolean;
  is_critical: boolean;
  min_score_required: number;
  weight: number;
  applies_to_positions?: string[];
  // Joined
  category?: EvaluationCategory;
}

// ---- CRITICAL RULES ----
export interface CriticalRule extends BaseEntity {
  version_id: string;
  question_id?: string;
  category_id?: string;
  name: string;
  description?: string;
  min_score_required: number;
  action: string;
  active: boolean;
}

// ---- EVALUATION ----
export interface Evaluation extends BaseEntity {
  company_id: string;
  version_id: string;
  evaluatee_id: string;
  evaluator_id: string;
  evaluator_position?: string;
  evaluator_area?: string;
  evaluation_date: string;
  evaluation_year: number;
  evaluation_type: string;
  observations?: string;
  strengths?: string;
  improvement_opportunities?: string;
  training_needs?: string;
  status: EvaluationStatus;
  draft_data?: Record<string, unknown>;
  finalized_at?: string;
  finalized_by?: string;
  reopened_at?: string;
  reopened_by?: string;
  reopen_reason?: string;
  evaluator_signed_at?: string;
  evaluatee_signed_at?: string;
  evaluatee_accepted: boolean;
  pdf_url?: string;
  // Joined
  evaluatee?: Collaborator;
  evaluator?: Profile;
  version?: EvaluationVersion;
  result?: EvaluationResultData;
  answers?: EvaluationAnswer[];
}

// ---- EVALUATION ANSWERS ----
export interface EvaluationAnswer extends BaseEntity {
  evaluation_id: string;
  question_id: string;
  category_id: string;
  score: number;
  comment?: string;
  is_critical_fail: boolean;
  // Joined
  question?: EvaluationQuestion;
}

// ---- EVALUATION RESULTS ----
export interface EvaluationResultData extends BaseEntity {
  evaluation_id: string;
  overall_average: number;
  result: EvaluationResult;
  category_scores?: Record<string, { name: string; average: number; count: number }>;
  has_critical_fails: boolean;
  critical_fails_detail?: Array<{ question_id: string; question: string; score: number; min_required: number }>;
  pmi_required: boolean;
  pmi_reason?: string;
  score_distribution?: Record<string, number>;
  calculated_at: string;
}

// ---- PMI ----
export interface ImprovementPlan extends BaseEntity {
  evaluation_id: string;
  collaborator_id: string;
  company_id: string;
  reason: string;
  actions: string;
  responsible_id?: string;
  start_date: string;
  end_date: string;
  status: PMIStatus;
  final_evaluation_id?: string;
  final_result?: string;
  final_score?: number;
  closed_at?: string;
  closed_by?: string;
  closure_notes?: string;
  // Joined
  collaborator?: Collaborator;
  responsible?: Profile;
  evaluation?: Evaluation;
  followups?: ImprovementFollowup[];
}

// ---- PMI FOLLOWUPS ----
export interface ImprovementFollowup extends BaseEntity {
  pmi_id: string;
  followup_number: 30 | 60 | 90;
  scheduled_date: string;
  completed_date?: string;
  status: FollowupStatus;
  responsible_id?: string;
  observations?: string;
  progress_percentage: number;
}

// ---- FEEDBACK ----
export interface FeedbackSession extends BaseEntity {
  evaluation_id: string;
  evaluator_id: string;
  evaluatee_id: string;
  session_date: string;
  comments?: string;
  agreements?: string;
  commitments?: string;
  observations?: string;
  evaluatee_accepted: boolean;
  evaluatee_accepted_at?: string;
  evaluatee_signature_ip?: string;
  evaluatee_comments?: string;
}

// ---- TRAINING ----
export interface TrainingRecommendation extends BaseEntity {
  evaluation_id: string;
  collaborator_id: string;
  company_id: string;
  topic: string;
  description?: string;
  priority: "alta" | "media" | "baja";
  type?: string;
  provider?: string;
  estimated_hours?: number;
  estimated_cost?: number;
  status: "pendiente" | "en_proceso" | "completado" | "cancelado";
  completion_date?: string;
}

// ---- NOTIFICATIONS ----
export interface Notification {
  id: string;
  user_id: string;
  company_id: string;
  type: NotificationType;
  title: string;
  message: string;
  action_url?: string;
  related_id?: string;
  related_type?: string;
  read: boolean;
  read_at?: string;
  created_at: string;
}

// ---- EMAIL LOGS ----
export interface EmailLog extends BaseEntity {
  company_id: string;
  evaluation_id?: string;
  pmi_id?: string;
  template: string;
  recipient_email: string;
  recipient_name?: string;
  subject: string;
  status: EmailStatus;
  resend_id?: string;
  error_message?: string;
  sent_at?: string;
  has_pdf: boolean;
  pdf_url?: string;
}

// ---- AUDIT LOGS ----
export interface AuditLog {
  id: string;
  company_id?: string;
  user_id?: string;
  action: AuditAction;
  table_name?: string;
  record_id?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  description?: string;
  ip_address?: string;
  user_agent?: string;
  device?: string;
  created_at: string;
  // Joined
  user?: Profile;
}

// ---- UI TYPES ----
export interface KPICard {
  title: string;
  value: number | string;
  change?: number;
  changeType?: "increase" | "decrease" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  color: "brand" | "violet" | "success" | "warning" | "danger";
  suffix?: string;
  description?: string;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface DashboardStats {
  total_collaborators: number;
  total_evaluated: number;
  pending_evaluations: number;
  approved_evaluations: number;
  pmi_evaluations: number;
  not_approved_evaluations: number;
  active_pmis: number;
  pending_followups: number;
  overall_average: number;
  area_averages: Array<{ area: string; average: number; count: number }>;
  position_averages: Array<{ position: string; average: number; count: number }>;
  monthly_trend: Array<{ month: string; evaluations: number; average: number }>;
  result_distribution: Array<{ result: string; count: number; percentage: number }>;
}

// ---- FORM TYPES ----
export interface CollaboratorFormData {
  // Personal
  document_type: DocumentType;
  document_number: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  birth_date?: string;
  gender?: GenderType;
  // Laboral
  internal_code?: string;
  company_id: string;
  area_id?: string;
  process_id?: string;
  position_id?: string;
  cost_center_id?: string;
  workplace_city?: string;
  workplace?: string;
  contract_type?: ContractType;
  hire_date?: string;
  termination_date?: string;
  status: CollaboratorStatus;
  // Jerarquía
  immediate_boss_id?: string;
  area_leader_id?: string;
  responsible_manager_id?: string;
}

export interface EvaluationFormData {
  evaluatee_id: string;
  evaluator_id: string;
  version_id: string;
  evaluation_date: string;
  evaluation_type: string;
  observations?: string;
  strengths?: string;
  improvement_opportunities?: string;
  training_needs?: string;
  answers: Record<string, { score: number; comment?: string }>;
}

// ---- PAGINATION ----
export interface PaginationParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---- FILTERS ----
export interface ReportFilters {
  year?: number;
  company_id?: string;
  area_id?: string;
  position_id?: string;
  evaluator_id?: string;
  evaluatee_id?: string;
  result?: EvaluationResult;
  has_pmi?: boolean;
  has_critical_fails?: boolean;
  status?: EvaluationStatus;
  date_from?: string;
  date_to?: string;
}

// ---- EVALUATION ASSIGNMENTS ----
export type AssignmentStatus = "pendiente" | "en_proceso" | "pendiente_firma" | "finalizada";

export interface EvaluationAssignment {
  id: string;
  company_id: string;
  evaluation_year: number;
  version_id?: string | null;
  evaluator_id: string;
  collaborator_id: string;
  evaluation_id?: string | null;
  status: AssignmentStatus;
  notes?: string | null;
  assigned_by?: string | null;
  created_at: string;
  updated_at: string;
  evaluator?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    document_number?: string;
    phone?: string;
    positions?: { id?: string; name: string } | null;
  };
  collaborator?: {
    id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    document_number: string;
    email?: string;
    status?: string;
    areas?: { id?: string; name: string } | null;
    positions?: { id?: string; name: string } | null;
  };
  evaluation?: {
    id: string;
    status: string;
    evaluation_date: string;
    created_at?: string;
    finalized_at?: string;
    result?: {
      overall_average: number;
      result: string;
    };
  } | null;
}

export interface AssignmentLeaderSummary {
  leaderId: string;
  leaderName: string;
  leaderEmail: string;
  leaderPosition: string;
  totalAssigned: number;
  finalizedCount: number;
  pendingCount: number;
  inProgressCount: number;
  pendingSignatureCount: number;
  completionPercentage: number;
  averageScore: number;
  assignments: EvaluationAssignment[];
}

