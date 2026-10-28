"use server";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { logAudit } from "./audit";
import type { EvaluationAssignment, AssignmentLeaderSummary } from "@/types";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

async function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

/**
 * Obtiene todas las asignaciones de evaluación según filtros
 */
export async function getEvaluationAssignments(filters?: {
  year?: number;
  leaderId?: string;
  status?: string;
  search?: string;
}): Promise<{
  data: EvaluationAssignment[];
  tableNotCreated?: boolean;
  error?: string;
}> {
  noStore();
  try {
    const supabase = await getSupabaseAdmin();
    const currentYear = filters?.year || new Date().getFullYear();

    let query = supabase
      .from("evaluation_assignments")
      .select(`
        id, company_id, evaluation_year, version_id, evaluator_id, collaborator_id, evaluation_id,
        status, notes, assigned_by, created_at, updated_at,
        evaluator:profiles!evaluator_id(id, first_name, last_name, email, document_number, phone, positions(id, name)),
        collaborator:collaborators!collaborator_id(id, first_name, last_name, full_name, document_number, email, status, areas(id, name), positions(id, name)),
        evaluation:evaluations!evaluation_id(id, status, evaluation_date, created_at, finalized_at, result:evaluation_results(overall_average, result))
      `)
      .eq("evaluation_year", currentYear);

    if (filters?.leaderId) {
      query = query.eq("evaluator_id", filters.leaderId);
    }
    if (filters?.status && filters.status !== "todos") {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    let result: EvaluationAssignment[] = [];

    if (error) {
      if (
        error.code === "PGRST205" ||
        (error.message.includes("does not exist") && error.message.includes("evaluation_assignments"))
      ) {
        return { data: [], tableNotCreated: true, error: "La tabla evaluation_assignments aún no ha sido creada en Supabase." };
      }

      // Si el error es por relaciones en el schema cache (PGRST200 / relationship)
      if (error.message.includes("relationship") || error.code === "PGRST200" || error.message.includes("schema cache")) {
        let simpleQuery = supabase
          .from("evaluation_assignments")
          .select("id, company_id, evaluation_year, version_id, evaluator_id, collaborator_id, evaluation_id, status, notes, assigned_by, created_at, updated_at")
          .eq("evaluation_year", currentYear);

        if (filters?.leaderId) {
          simpleQuery = simpleQuery.eq("evaluator_id", filters.leaderId);
        }
        if (filters?.status && filters.status !== "todos") {
          simpleQuery = simpleQuery.eq("status", filters.status);
        }

        const simpleRes = await simpleQuery.order("created_at", { ascending: false });

        if (simpleRes.error) {
          if (simpleRes.error.code === "PGRST205" || simpleRes.error.message.includes("does not exist")) {
            return { data: [], tableNotCreated: true, error: "La tabla evaluation_assignments aún no ha sido creada en Supabase." };
          }
          return { data: [], error: simpleRes.error.message };
        }

        const assignmentsRaw = simpleRes.data || [];
        if (assignmentsRaw.length > 0) {
          const [evaluatorsRes, collabsRes] = await Promise.all([
            supabase.from("profiles").select("id, first_name, last_name, email, document_number, phone, positions(id, name)"),
            supabase.from("collaborators").select("id, first_name, last_name, full_name, document_number, email, status, areas(id, name), positions(id, name)")
          ]);

          const evMap = new Map((evaluatorsRes.data || []).map((e: any) => [e.id, e]));
          const colMap = new Map((collabsRes.data || []).map((c: any) => [c.id, c]));

          result = assignmentsRaw.map((item: any) => ({
            ...item,
            evaluator: evMap.get(item.evaluator_id) || null,
            collaborator: colMap.get(item.collaborator_id) || null,
            evaluation: null,
          })) as EvaluationAssignment[];
        }
      } else {
        console.error("Error fetching evaluation assignments:", error);
        return { data: [], error: error.message };
      }
    } else {
      result = (data || []) as unknown as EvaluationAssignment[];
    }

    // Filtro de búsqueda en memoria (nombre o cédula)
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter((item) => {
        const collabName = (item.collaborator?.full_name || `${item.collaborator?.first_name || ""} ${item.collaborator?.last_name || ""}`).toLowerCase();
        const collabDoc = (item.collaborator?.document_number || "").toLowerCase();
        const leaderName = `${item.evaluator?.first_name || ""} ${item.evaluator?.last_name || ""}`.toLowerCase();
        const leaderDoc = (item.evaluator?.document_number || "").toLowerCase();
        return collabName.includes(q) || collabDoc.includes(q) || leaderName.includes(q) || leaderDoc.includes(q);
      });
    }

    return { data: result };
  } catch (err: any) {
    console.error("Exception in getEvaluationAssignments:", err);
    return { data: [], error: err?.message || "Error al cargar asignaciones" };
  }
}

/**
 * Obtiene todos los datos consolidados del dashboard de asignaciones en una sola consulta
 */
export async function getEvaluationAssignmentsDashboard(year?: number): Promise<{
  assignments: EvaluationAssignment[];
  summaries: AssignmentLeaderSummary[];
  stats: {
    totalAssignments: number;
    totalCompleted: number;
    totalPendingSignature: number;
    totalInProgress: number;
    totalPending: number;
    totalLeaders: number;
    overallCompletion: number;
  };
  tableNotCreated?: boolean;
  error?: string;
}> {
  noStore();
  const emptyStats = {
    totalAssignments: 0,
    totalCompleted: 0,
    totalPendingSignature: 0,
    totalInProgress: 0,
    totalPending: 0,
    totalLeaders: 0,
    overallCompletion: 0,
  };

  try {
    const res = await getEvaluationAssignments({ year });
    if (res.tableNotCreated) {
      return {
        assignments: [],
        summaries: [],
        stats: emptyStats,
        tableNotCreated: true,
        error: res.error,
      };
    }
    if (res.error) {
      return {
        assignments: [],
        summaries: [],
        stats: emptyStats,
        error: res.error,
      };
    }

    const items = res.data || [];

    // 1. Agrupar por líder
    const byLeader: Record<string, AssignmentLeaderSummary> = {};

    items.forEach((item) => {
      const leader = item.evaluator;
      const leaderId = item.evaluator_id || "sin_lider";
      if (!byLeader[leaderId]) {
        const fullName = leader ? `${leader.first_name || ""} ${leader.last_name || ""}`.trim() : "Líder Desconocido";
        const posName = Array.isArray(leader?.positions) ? leader?.positions[0]?.name : leader?.positions?.name;
        byLeader[leaderId] = {
          leaderId,
          leaderName: fullName || "Sin Nombre",
          leaderEmail: leader?.email || "—",
          leaderPosition: posName || "Sin Cargo",
          totalAssigned: 0,
          finalizedCount: 0,
          pendingCount: 0,
          inProgressCount: 0,
          pendingSignatureCount: 0,
          completionPercentage: 0,
          averageScore: 0,
          assignments: [],
        };
      }

      const current = byLeader[leaderId];
      current.totalAssigned += 1;
      current.assignments.push(item);

      const st = (item.status || "").toLowerCase();
      if (st === "finalizada") current.finalizedCount += 1;
      else if (st === "pendiente_firma") current.pendingSignatureCount += 1;
      else if (st === "en_proceso") current.inProgressCount += 1;
      else current.pendingCount += 1;
    });

    const summaries = Object.values(byLeader).map((l) => {
      const completed = l.finalizedCount;
      l.completionPercentage = l.totalAssigned > 0 ? Math.round((completed / l.totalAssigned) * 100) : 0;

      let scoreSum = 0;
      let scoreCount = 0;
      l.assignments.forEach((a) => {
        const resObj = Array.isArray(a.evaluation?.result) ? a.evaluation.result[0] : a.evaluation?.result;
        const avg = resObj?.overall_average;
        if (avg != null && Number(avg) > 0) {
          scoreSum += Number(avg);
          scoreCount += 1;
        }
      });
      l.averageScore = scoreCount > 0 ? Number((scoreSum / scoreCount).toFixed(2)) : 0;
      return l;
    });

    summaries.sort((a, b) => (a.leaderName || "").localeCompare(b.leaderName || ""));

    // 2. Métricas globales
    const total = items.length;
    const completed = items.filter((i) => i.status === "finalizada").length;
    const pendingSig = items.filter((i) => i.status === "pendiente_firma").length;
    const inProgress = items.filter((i) => i.status === "en_proceso").length;
    const pending = items.filter((i) => !i.status || i.status === "pendiente").length;
    const distinctLeaders = new Set(items.map((i) => i.evaluator_id)).size;
    const overallCompletion = total > 0 ? Math.round((completed / total) * 100) : 0;

    const stats = {
      totalAssignments: total,
      totalCompleted: completed,
      totalPendingSignature: pendingSig,
      totalInProgress: inProgress,
      totalPending: pending,
      totalLeaders: distinctLeaders,
      overallCompletion,
    };

    return {
      assignments: items,
      summaries,
      stats,
    };
  } catch (err: any) {
    console.error("Exception in getEvaluationAssignmentsDashboard:", err);
    return {
      assignments: [],
      summaries: [],
      stats: emptyStats,
      error: err?.message || "Error al procesar resumen de asignaciones",
    };
  }
}

/**
 * Obtiene el resumen consolidado agrupado por líder
 */
export async function getAssignmentsSummaryByLeader(year?: number): Promise<{
  data: AssignmentLeaderSummary[];
  tableNotCreated?: boolean;
  error?: string;
}> {
  noStore();
  try {
    const dash = await getEvaluationAssignmentsDashboard(year);
    if (dash.tableNotCreated) {
      return { data: [], tableNotCreated: true, error: dash.error };
    }
    if (dash.error) {
      return { data: [], error: dash.error };
    }
    return { data: dash.summaries };
  } catch (err: any) {
    console.error("Error in getAssignmentsSummaryByLeader:", err);
    return { data: [], error: err?.message || "Error al agrupar por líder" };
  }
}

/**
 * Obtiene métricas globales de asignaciones
 */
export async function getAssignmentsStats(year?: number) {
  noStore();
  const emptyStats = {
    tableNotCreated: false,
    totalAssignments: 0,
    totalCompleted: 0,
    totalPendingSignature: 0,
    totalInProgress: 0,
    totalPending: 0,
    totalLeaders: 0,
    overallCompletion: 0,
  };

  try {
    const dash = await getEvaluationAssignmentsDashboard(year);
    if (dash.tableNotCreated) {
      return { ...emptyStats, tableNotCreated: true, error: dash.error };
    }
    return {
      ...dash.stats,
      tableNotCreated: false,
      error: dash.error,
    };
  } catch (err: any) {
    console.error("Error in getAssignmentsStats:", err);
    return { ...emptyStats, error: err?.message };
  }
}

/**
 * Crea o actualiza una asignación individual
 */
export async function createOrUpdateAssignment(payload: {
  evaluator_id: string;
  collaborator_id: string;
  evaluation_year?: number;
  notes?: string;
}) {
  try {
    const supabase = await getSupabase();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { error: "No autenticado" };

    const adminClient = await getSupabaseAdmin();
    const year = payload.evaluation_year || new Date().getFullYear();

    // Obtener company_id del usuario
    const { data: profile } = await adminClient
      .from("profiles")
      .select("company_id")
      .eq("id", userData.user.id)
      .single();

    if (!profile?.company_id) return { error: "Compañía no encontrada" };

    // Buscar si ya existe una evaluación registrada para este colaborador y año
    const { data: existingEval } = await adminClient
      .from("evaluations")
      .select("id, status")
      .eq("evaluatee_id", payload.collaborator_id)
      .eq("evaluation_year", year)
      .maybeSingle();

    const insertData: any = {
      company_id: profile.company_id,
      evaluation_year: year,
      evaluator_id: payload.evaluator_id,
      collaborator_id: payload.collaborator_id,
      notes: payload.notes || null,
      assigned_by: userData.user.id,
      updated_at: new Date().toISOString(),
    };

    if (existingEval) {
      insertData.evaluation_id = existingEval.id;
      insertData.status = existingEval.status;
    } else {
      insertData.status = "pendiente";
    }

    const { data, error } = await adminClient
      .from("evaluation_assignments")
      .upsert(insertData, { onConflict: "evaluation_year,collaborator_id" })
      .select()
      .single();

    if (error) {
      console.error("Error upserting assignment:", error);
      return { error: error.message };
    }

    await logAudit(
      "asignacion_evaluacion",
      "evaluation_assignments",
      data.id,
      `Colaborador ID ${payload.collaborator_id} asignado a evaluador ID ${payload.evaluator_id} para ciclo ${year}`
    );

    revalidatePath("/administracion/asignaciones");
    revalidatePath("/evaluaciones");
    revalidatePath("/reportes");

    return { success: true, data };
  } catch (err: any) {
    console.error("Exception in createOrUpdateAssignment:", err);
    return { error: err?.message || "Error al crear la asignación" };
  }
}

/**
 * Asignación masiva de colaboradores a un líder
 */
export async function bulkAssignCollaborators(payload: {
  evaluator_id: string;
  collaborator_ids: string[];
  evaluation_year?: number;
  notes?: string;
}) {
  try {
    const supabase = await getSupabase();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { error: "No autenticado" };

    const adminClient = await getSupabaseAdmin();
    const year = payload.evaluation_year || new Date().getFullYear();

    const { data: profile } = await adminClient
      .from("profiles")
      .select("company_id")
      .eq("id", userData.user.id)
      .single();

    if (!profile?.company_id) return { error: "Compañía no encontrada" };

    // Buscar evaluaciones existentes para estos colaboradores
    const { data: existingEvals } = await adminClient
      .from("evaluations")
      .select("id, evaluatee_id, status")
      .in("evaluatee_id", payload.collaborator_ids)
      .eq("evaluation_year", year);

    const evalsMap: Record<string, { id: string; status: string }> = {};
    (existingEvals || []).forEach((ev) => {
      evalsMap[ev.evaluatee_id] = { id: ev.id, status: ev.status };
    });

    const rowsToUpsert = payload.collaborator_ids.map((collabId) => {
      const existing = evalsMap[collabId];
      return {
        company_id: profile.company_id,
        evaluation_year: year,
        evaluator_id: payload.evaluator_id,
        collaborator_id: collabId,
        evaluation_id: existing?.id || null,
        status: existing?.status || "pendiente",
        notes: payload.notes || null,
        assigned_by: userData.user.id,
        updated_at: new Date().toISOString(),
      };
    });

    const { data, error } = await adminClient
      .from("evaluation_assignments")
      .upsert(rowsToUpsert, { onConflict: "evaluation_year,collaborator_id" });

    if (error) {
      console.error("Error bulk upserting assignments:", error);
      return { error: error.message };
    }

    await logAudit(
      "asignacion_masiva_evaluacion",
      "evaluation_assignments",
      payload.evaluator_id,
      `Asignados ${payload.collaborator_ids.length} colaboradores al evaluador ID ${payload.evaluator_id} para ciclo ${year}`
    );

    revalidatePath("/administracion/asignaciones");
    revalidatePath("/evaluaciones");
    revalidatePath("/reportes");

    return { success: true, count: payload.collaborator_ids.length };
  } catch (err: any) {
    console.error("Exception in bulkAssignCollaborators:", err);
    return { error: err?.message || "Error en asignación masiva" };
  }
}

/**
 * Elimina una asignación existente
 */
export async function deleteAssignment(id: string) {
  try {
    const supabase = await getSupabase();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { error: "No autenticado" };

    const adminClient = await getSupabaseAdmin();
    const { error } = await adminClient
      .from("evaluation_assignments")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting assignment:", error);
      return { error: error.message };
    }

    await logAudit(
      "eliminar_asignacion_evaluacion",
      "evaluation_assignments",
      id,
      `Eliminada asignación de evaluación ID ${id}`
    );

    revalidatePath("/administracion/asignaciones");
    revalidatePath("/evaluaciones");
    revalidatePath("/reportes");

    return { success: true };
  } catch (err: any) {
    console.error("Exception in deleteAssignment:", err);
    return { error: err?.message || "Error al eliminar asignación" };
  }
}

export interface ExcelAssignmentImportRow {
  doc_colaborador: string;
  nombre_colaborador?: string;
  cargo_colaborador?: string;
  doc_lider?: string;
  nombre_lider?: string;
  email_lider?: string;
  notas?: string;
}

export interface ExcelImportErrorItem {
  fila: number;
  documento_colaborador: string;
  nombre_colaborador?: string;
  cargo_colaborador?: string;
  documento_lider?: string;
  nombre_lider?: string;
  motivo: string;
  accion_sugerida?: string;
}

/**
 * Importa asignaciones masivas desde datos leídos de Excel
 */
export async function importAssignmentsFromExcelData(
  rows: ExcelAssignmentImportRow[],
  year?: number
): Promise<{
  success: boolean;
  totalRows: number;
  importedCount: number;
  errorCount?: number;
  errors: ExcelImportErrorItem[];
  error?: string;
}> {
  try {
    const supabase = await getSupabase();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { success: false, totalRows: 0, importedCount: 0, errors: [], error: "No autenticado" };

    const adminClient = await getSupabaseAdmin();
    const currentYear = year || new Date().getFullYear();

    const { data: profile } = await adminClient
      .from("profiles")
      .select("company_id")
      .eq("id", userData.user.id)
      .single();

    if (!profile?.company_id) return { success: false, totalRows: 0, importedCount: 0, errors: [], error: "Compañía no encontrada" };

    // 1. Cargar todos los colaboradores para mapear por número de documento
    const { data: collabs } = await adminClient
      .from("collaborators")
      .select("id, document_number, full_name");

    const collabsByDoc: Record<string, { id: string; name: string }> = {};
    (collabs || []).forEach((c) => {
      if (c.document_number) {
        collabsByDoc[c.document_number.toString().trim()] = { id: c.id, name: c.full_name };
      }
    });

    // 2. Cargar todos los usuarios con rol de líder o administrador
    const { data: leaders } = await adminClient
      .from("profiles")
      .select("id, first_name, last_name, email, document_number, roles(name)")
      .in("roles.name", ["lider", "admin", "rrhh", "gerencia"]);

    const leadersByDoc: Record<string, { id: string; name: string }> = {};
    const leadersByEmail: Record<string, { id: string; name: string }> = {};

    (leaders || []).forEach((l: any) => {
      const name = `${l.first_name || ""} ${l.last_name || ""}`.trim();
      if (l.document_number) {
        leadersByDoc[l.document_number.toString().trim()] = { id: l.id, name };
      }
      if (l.email) {
        leadersByEmail[l.email.toLowerCase().trim()] = { id: l.id, name };
      }
    });

    // 3. Cargar evaluaciones ya creadas para ese año
    const { data: existingEvals } = await adminClient
      .from("evaluations")
      .select("id, evaluatee_id, status")
      .eq("evaluation_year", currentYear);

    const evalsMap: Record<string, { id: string; status: string }> = {};
    (existingEvals || []).forEach((ev) => {
      evalsMap[ev.evaluatee_id] = { id: ev.id, status: ev.status };
    });

    // 4. Validar cada fila
    const validRows: any[] = [];
    const errors: ExcelImportErrorItem[] = [];

    rows.forEach((r, idx) => {
      const rowNum = idx + 2; // Considerando encabezado en fila 1
      const docCollab = (r.doc_colaborador || "").toString().trim();
      const docLeader = (r.doc_lider || "").toString().trim();
      const emailLeader = (r.email_lider || "").toString().toLowerCase().trim();
      const nameCollab = (r.nombre_colaborador || "").toString().trim();
      const cargoCollab = (r.cargo_colaborador || "").toString().trim();
      const nameLeader = (r.nombre_lider || "").toString().trim();

      if (!docCollab) {
        errors.push({
          fila: rowNum,
          documento_colaborador: "Sin Documento",
          nombre_colaborador: nameCollab || "—",
          cargo_colaborador: cargoCollab || "—",
          documento_lider: docLeader || "—",
          nombre_lider: nameLeader || "—",
          motivo: "Falta el número de documento del colaborador en esta fila",
          accion_sugerida: "Completar la columna de documento del colaborador en el archivo Excel",
        });
        return;
      }

      const collab = collabsByDoc[docCollab];
      if (!collab) {
        errors.push({
          fila: rowNum,
          documento_colaborador: docCollab,
          nombre_colaborador: nameCollab || "—",
          cargo_colaborador: cargoCollab || "—",
          documento_lider: docLeader || "—",
          nombre_lider: nameLeader || "—",
          motivo: `Colaborador con documento ${docCollab} no existe en el sistema`,
          accion_sugerida: "Registrar al colaborador en el módulo de Colaboradores antes de asignarlo",
        });
        return;
      }

      let leader = docLeader ? leadersByDoc[docLeader] : null;
      if (!leader && emailLeader) {
        leader = leadersByEmail[emailLeader];
      }

      if (!leader) {
        errors.push({
          fila: rowNum,
          documento_colaborador: docCollab,
          nombre_colaborador: nameCollab || collab.name || "—",
          cargo_colaborador: cargoCollab || "—",
          documento_lider: docLeader || "—",
          nombre_lider: nameLeader || "—",
          motivo: `Líder evaluador no encontrado con doc: "${docLeader}" o correo: "${emailLeader}" (debe tener rol de Líder en Usuarios)`,
          accion_sugerida: "Verificar documento o correo del líder y asignarle el rol de Líder en Administración > Usuarios",
        });
        return;
      }

      const existingEval = evalsMap[collab.id];

      validRows.push({
        company_id: profile.company_id,
        evaluation_year: currentYear,
        evaluator_id: leader.id,
        collaborator_id: collab.id,
        evaluation_id: existingEval?.id || null,
        status: existingEval?.status || "pendiente",
        notes: r.notas || "Carga masiva Excel",
        assigned_by: userData.user.id,
        updated_at: new Date().toISOString(),
      });
    });

    if (validRows.length === 0) {
      return {
        success: false,
        totalRows: rows.length,
        importedCount: 0,
        errors,
        error: "No se encontraron filas válidas para importar. Revisa los errores detallados.",
      };
    }

    // 5. Upsert masivo
    const { error: upsertError } = await adminClient
      .from("evaluation_assignments")
      .upsert(validRows, { onConflict: "evaluation_year,collaborator_id" });

    if (upsertError) {
      console.error("Error inserting excel assignments:", upsertError);
      return {
        success: false,
        totalRows: rows.length,
        importedCount: 0,
        errors,
        error: upsertError.message,
      };
    }

    await logAudit(
      "importacion_excel_asignaciones",
      "evaluation_assignments",
      userData.user.id,
      `Importadas ${validRows.length} asignaciones desde archivo Excel para ciclo ${currentYear}`
    );

    revalidatePath("/administracion/asignaciones");
    revalidatePath("/evaluaciones");
    revalidatePath("/reportes");

    return {
      success: true,
      totalRows: rows.length,
      importedCount: validRows.length,
      errorCount: errors.length,
      errors,
    };
  } catch (err: any) {
    console.error("Exception in importAssignmentsFromExcelData:", err);
    return {
      success: false,
      totalRows: rows.length,
      importedCount: 0,
      errors: [],
      error: err?.message || "Error al procesar el archivo Excel",
    };
  }
}

/**
 * Obtiene la lista de líderes disponibles para asignar
 */
export async function getAvailableLeaders() {
  noStore();
  try {
    const adminClient = await getSupabaseAdmin();
    const { data, error } = await adminClient
      .from("profiles")
      .select(`
        id, first_name, last_name, email, document_number, phone,
        roles!inner(name, display_name),
        positions(name)
      `)
      .in("roles.name", ["lider", "admin", "rrhh", "gerencia"])
      .order("first_name", { ascending: true });

    if (error) {
      console.error("Error fetching leaders:", error);
      return { data: [] };
    }

    const leaders = (data || []).map((l: any) => ({
      id: l.id,
      name: `${l.first_name || ""} ${l.last_name || ""}`.trim(),
      email: l.email,
      document_number: l.document_number,
      role: l.roles?.display_name || l.roles?.name,
      position: Array.isArray(l.positions) ? l.positions[0]?.name : l.positions?.name || "Sin Cargo",
    }));

    return { data: leaders };
  } catch (err) {
    console.error(err);
    return { data: [] };
  }
}

/**
 * Obtiene la lista de colaboradores con su estado de asignación para el año
 */
export async function getCollaboratorsWithAssignmentStatus(year?: number) {
  noStore();
  try {
    const adminClient = await getSupabaseAdmin();
    const currentYear = year || new Date().getFullYear();

    const [collabsRes, assignmentsRes] = await Promise.all([
      adminClient
        .from("collaborators")
        .select(`
          id, first_name, last_name, full_name, document_number, email, status,
          areas(name), positions(name)
        `)
        .eq("status", "activo")
        .order("first_name", { ascending: true }),
      adminClient
        .from("evaluation_assignments")
        .select("collaborator_id, evaluator_id, evaluator:profiles!evaluator_id(first_name, last_name)")
        .eq("evaluation_year", currentYear),
    ]);

    const assignmentsMap: Record<string, { evaluatorId: string; evaluatorName: string }> = {};
    let assignmentsRaw: any[] = assignmentsRes.data || [];

    if (assignmentsRes.error && (assignmentsRes.error.message.includes("relationship") || assignmentsRes.error.code === "PGRST200")) {
      const fallbackAssignments = await adminClient
        .from("evaluation_assignments")
        .select("collaborator_id, evaluator_id")
        .eq("evaluation_year", currentYear);
      assignmentsRaw = fallbackAssignments.data || [];
    }

    if (assignmentsRaw.length > 0) {
      assignmentsRaw.forEach((a: any) => {
        const evName = a.evaluator ? `${a.evaluator.first_name || ""} ${a.evaluator.last_name || ""}`.trim() : "Líder Asignado";
        assignmentsMap[a.collaborator_id] = { evaluatorId: a.evaluator_id, evaluatorName: evName };
      });
    }

    const result = (collabsRes.data || []).map((c: any) => ({
      id: c.id,
      full_name: c.full_name || `${c.first_name || ""} ${c.last_name || ""}`.trim(),
      document_number: c.document_number,
      area: Array.isArray(c.areas) ? c.areas[0]?.name : c.areas?.name || "Sin Área",
      position: Array.isArray(c.positions) ? c.positions[0]?.name : c.positions?.name || "Sin Cargo",
      isAssigned: !!assignmentsMap[c.id],
      assignedLeaderId: assignmentsMap[c.id]?.evaluatorId || null,
      assignedLeaderName: assignmentsMap[c.id]?.evaluatorName || null,
    }));

    return { data: result };
  } catch (err) {
    console.error(err);
    return { data: [] };
  }
}
