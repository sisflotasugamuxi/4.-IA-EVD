"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { Resend } from "resend";
import { logAudit } from "./audit";
import { verifyUserPermission } from "./admin";

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
          } catch (error) {
            // Ignore
          }
        },
      },
    }
  );
}

// ==========================================
// CONFIGURACIÓN (VERSIONES, CATEGORÍAS, PREGUNTAS)
// ==========================================

export async function getActiveVersion() {
  try {
    const adminClient = await getSupabaseAdmin();
    const { data, error } = await adminClient
      .from("evaluation_versions")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching active version:", error);
      return null;
    }
    return data;
  } catch (err) {
    console.error("Exception in getActiveVersion:", err);
    return null;
  }
}

export async function getEvaluationConfig() {
  noStore();
  try {
    const adminClient = await getSupabaseAdmin();
    const version = await getActiveVersion();

    if (!version) return { categories: [], questions: [], version: null };

    const [categoriesRes, questionsRes] = await Promise.all([
      adminClient
        .from("evaluation_categories")
        .select("*")
        .eq("version_id", version.id)
        .order("sort_order"),
      adminClient
        .from("evaluation_questions")
        .select("*")
        .eq("version_id", version.id)
        .order("sort_order"),
    ]);

    return {
      categories: categoriesRes.data || [],
      questions: questionsRes.data || [],
      version,
    };
  } catch (err) {
    console.error("Exception in getEvaluationConfig:", err);
    return { categories: [], questions: [], version: null };
  }
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

export async function updateQuestionStatus(questionId: string, isActive: boolean) {
  const supabase = await getSupabaseAdmin();
  const { error } = await supabase
    .from("evaluation_questions")
    .update({ is_active: isActive })
    .eq("id", questionId);

  if (error) return { error: error.message };
  revalidatePath("/configuracion/preguntas");
  revalidatePath("/evaluaciones/nueva");
  return { success: true };
}

export async function saveCategory(category: { 
  id?: string; 
  name: string; 
  weight: number; 
  description?: string;
  is_critical?: boolean;
  min_score_required?: number;
}) {
  const permCheck = await verifyUserPermission("configuracion", category.id ? "can_edit" : "can_create");
  if (!permCheck.allowed) return { error: permCheck.error || "No tienes permisos para modificar categorías en Configuración." };

  const supabase = await getSupabaseAdmin();
  const version = await getActiveVersion();
  if (!version) return { error: "No hay versión de evaluación activa" };

  if (category.id) {
    const { error } = await supabase
      .from("evaluation_categories")
      .update({
        name: category.name,
        weight: category.weight,
        description: category.description,
        is_critical: category.is_critical ?? false,
        min_score_required: category.min_score_required ?? 4.00,
        updated_at: new Date().toISOString()
      })
      .eq("id", category.id);

    if (error) return { error: error.message };
  } else {
    const { count } = await supabase
      .from("evaluation_categories")
      .select("*", { count: "exact", head: true })
      .eq("version_id", version.id);

    const { error } = await supabase
      .from("evaluation_categories")
      .insert({
        version_id: version.id,
        name: category.name,
        weight: category.weight,
        description: category.description,
        is_critical: category.is_critical ?? false,
        min_score_required: category.min_score_required ?? 4.00,
        sort_order: (count || 0) + 1,
        active: true
      });

    if (error) return { error: error.message };
  }

  revalidatePath("/configuracion/categorias");
  revalidatePath("/configuracion/preguntas");
  revalidatePath("/evaluaciones/nueva");
  return { success: true, data: category };
}

export async function deleteCategory(id: string) {
  const permCheck = await verifyUserPermission("configuracion", "can_delete");
  if (!permCheck.allowed) return { error: permCheck.error || "No tienes permisos para eliminar categorías en Configuración." };

  const supabase = await getSupabaseAdmin();
  const { error } = await supabase
    .from("evaluation_categories")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/configuracion/categorias");
  revalidatePath("/configuracion/preguntas");
  revalidatePath("/evaluaciones/nueva");
  return { success: true };
}

export async function saveQuestion(question: {
  id?: string;
  category_id: string;
  code: string;
  question: string;
  description?: string;
  is_required: boolean;
  is_active: boolean;
  is_critical: boolean;
  min_score_required: number;
  weight: number;
}) {
  const permCheck = await verifyUserPermission("configuracion", question.id ? "can_edit" : "can_create");
  if (!permCheck.allowed) return { error: permCheck.error || "No tienes permisos para modificar preguntas en Configuración." };

  const supabase = await getSupabaseAdmin();
  const version = await getActiveVersion();
  if (!version) return { error: "No hay versión de evaluación activa" };

  if (question.id) {
    const { error } = await supabase
      .from("evaluation_questions")
      .update({
        category_id: question.category_id,
        code: question.code,
        question: question.question,
        description: question.description,
        is_required: question.is_required,
        is_active: question.is_active,
        is_critical: question.is_critical,
        min_score_required: question.min_score_required,
        weight: question.weight,
        updated_at: new Date().toISOString()
      })
      .eq("id", question.id);

    if (error) return { error: error.message };
  } else {
    const { count } = await supabase
      .from("evaluation_questions")
      .select("*", { count: "exact", head: true })
      .eq("category_id", question.category_id);

    const { error } = await supabase
      .from("evaluation_questions")
      .insert({
        category_id: question.category_id,
        version_id: version.id,
        code: question.code,
        question: question.question,
        description: question.description,
        is_required: question.is_required,
        is_active: question.is_active,
        is_critical: question.is_critical,
        min_score_required: question.min_score_required,
        weight: question.weight,
        sort_order: (count || 0) + 1
      });

    if (error) return { error: error.message };
  }

  revalidatePath("/configuracion/preguntas");
  revalidatePath("/evaluaciones/nueva");
  return { success: true };
}

export async function deleteQuestion(id: string) {
  const permCheck = await verifyUserPermission("configuracion", "can_delete");
  if (!permCheck.allowed) return { error: permCheck.error || "No tienes permisos para eliminar preguntas en Configuración." };

  const supabase = await getSupabaseAdmin();
  const { error } = await supabase
    .from("evaluation_questions")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/configuracion/preguntas");
  revalidatePath("/evaluaciones/nueva");
  return { success: true };
}

// ==========================================
// EVALUACIONES Y RESULTADOS
// ==========================================

export async function getEvaluations() {
  try {
    const adminClient = await getSupabaseAdmin();
    const { data, error } = await adminClient
      .from("evaluations")
      .select(`
        *,
        collaborator:collaborators(
          full_name, 
          document_number, 
          position_id,
          hire_date,
          position:positions(name),
          areas:areas(name)
        ),
        evaluator:profiles!evaluator_id(first_name, last_name),
        version:evaluation_versions(name),
        result:evaluation_results(*)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching evaluations:", error);
      return { error: error.message, data: [] };
    }
    return { data: data || [] };
  } catch (err: any) {
    console.error("Exception in getEvaluations:", err);
    return { error: err?.message || "Error al cargar evaluaciones", data: [] };
  }
}

export async function getEvaluationById(evaluationId: string) {
  const supabase = await getSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "No autenticado", data: null };

  const adminClient = await getSupabaseAdmin();
  const { data, error } = await adminClient
    .from("evaluations")
    .select(`
      *,
      collaborator:collaborators(
        id,
        full_name,
        document_type,
        document_number,
        position_id,
        area_id,
        email,
        workplace_city,
        workplace,
        contract_type,
        hire_date,
        status,
        position:positions(name),
        areas:areas(name)
      ),
      evaluator:profiles!evaluations_evaluator_id_fkey(first_name, last_name, email, avatar_url, role:roles(display_name)),
      version:evaluation_versions(name),
      result:evaluation_results(*),
      answers:evaluation_answers(
        question_id,
        category_id,
        score,
        comment,
        question:evaluation_questions(question, code, is_critical),
        category:evaluation_categories(name)
      )
    `)
    .eq("id", evaluationId)
    .single();

  if (error) return { error: error.message, data: null };

  // Fetch evaluator cargo (position name) if their email is registered as a collaborator
  if (data && data.evaluator?.email) {
    const { data: evaluatorCollab } = await adminClient
      .from("collaborators")
      .select("position:positions(name)")
      .eq("email", data.evaluator.email)
      .maybeSingle();

    const positionData = evaluatorCollab?.position;
    const cargoName = Array.isArray(positionData) 
      ? positionData[0]?.name 
      : (positionData as any)?.name;

    if (cargoName) {
      data.evaluator.cargo = cargoName;
    }
  }

  return { data };
}

export async function updateEvaluation(evaluationId: string, payload: any) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("evaluations")
    .update(payload)
    .eq("id", evaluationId)
    .select()
    .single();

  if (error) return { error: error.message, data: null };
  revalidatePath("/evaluaciones");
  return { data };
}

export async function saveEvaluation(payload: any) {
  const supabase = await getSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("No autenticado");

  const adminClient = await getSupabaseAdmin();

  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("id", userData.user.id)
    .single();

  if (!profile?.company_id) throw new Error("Compañía no encontrada");

  // Obtener datos del evaluado
  const { data: evaluatee } = await adminClient
    .from("collaborators")
    .select("document_type, document_number, email")
    .eq("id", payload.evaluatee_id)
    .single();

  // Obtener datos del evaluador y su rol
  const { data: evaluator } = await adminClient
    .from("profiles")
    .select("document_type, document_number, email, roles(name)")
    .eq("id", userData.user.id)
    .single();

  if (evaluatee && evaluator) {
    // 1. Validar autoevaluación (mismo documento o correo)
    const isSameDocument = evaluator.document_type && evaluator.document_number &&
      evaluatee.document_type === evaluator.document_type &&
      evaluatee.document_number === evaluator.document_number;
      
    const isSameEmail = evaluatee.email && evaluator.email &&
      evaluatee.email.toLowerCase() === evaluator.email.toLowerCase();

    if (isSameDocument || isSameEmail) {
      return { error: "No puedes realizar tu propia evaluación de desempeño." };
    }
    
    // 2. Validar rol del evaluador
    const roleName = (evaluator.roles as any)?.name;
    const allowedRoles = ["admin", "rrhh", "gerencia", "lider"];
    if (!allowedRoles.includes(roleName)) {
      return { error: "No tienes permisos para realizar evaluaciones de desempeño. Solo los roles de Líder, Administrador, RRHH y Gerencia pueden realizar evaluaciones." };
    }
  }

  // Determinar modo: 'finalizar' (default) o 'pendiente_firma'
  const mode = payload.mode || 'finalizar';
  const isPendienteFirma = mode === 'pendiente_firma';

  const { data: evalData, error: evalError } = await supabase
    .from("evaluations")
    .insert({
      company_id: profile.company_id,
      version_id: payload.version_id,
      evaluatee_id: payload.evaluatee_id,
      evaluator_id: userData.user.id,
      evaluation_year: payload.evaluation_year || new Date().getFullYear(),
      evaluation_type: '90',
      status: isPendienteFirma ? 'pendiente_firma' : 'finalizada',
      observations: payload.observations,
      strengths: payload.strengths,
      improvement_opportunities: payload.improvement_opportunities,
      training_needs: payload.training_needs,
      finalized_at: isPendienteFirma ? null : new Date().toISOString(),
      finalized_by: isPendienteFirma ? null : userData.user.id,
      draft_data: isPendienteFirma ? null : (payload.signature ? { collaborator_signature: payload.signature } : null),
      evaluatee_signed_at: isPendienteFirma ? null : (payload.signature ? new Date().toISOString() : null),
      evaluator_signed_at: new Date().toISOString(),
      evaluatee_accepted: isPendienteFirma ? false : (payload.signature ? true : false),
    })
    .select()
    .single();

  if (evalError) return { error: evalError.message };

  const answers = payload.answers.map((ans: any) => ({
    evaluation_id: evalData.id,
    question_id: ans.question_id,
    category_id: ans.category_id,
    score: ans.score,
    comment: ans.comment,
  }));

  const { error: answersError } = await supabase
    .from("evaluation_answers")
    .insert(answers);

  if (answersError) return { error: answersError.message };

  const { data: resultData, error: rpcError } = await supabase.rpc(
    "calculate_evaluation_result",
    { p_evaluation_id: evalData.id }
  );

  if (rpcError) return { error: rpcError.message };

  // Sincronizar estado en evaluation_assignments
  try {
    await adminClient
      .from("evaluation_assignments")
      .update({
        evaluation_id: evalData.id,
        status: isPendienteFirma ? "pendiente_firma" : "finalizada",
        updated_at: new Date().toISOString()
      })
      .eq("collaborator_id", payload.evaluatee_id)
      .eq("evaluation_year", payload.evaluation_year || new Date().getFullYear());
  } catch (_) { /* No bloquear si la tabla aún no existe */ }

  revalidatePath("/evaluaciones");
  revalidatePath("/evaluaciones/firmas-pendientes");
  revalidatePath("/administracion/asignaciones");
  revalidatePath("/dashboard");

  // Registrar en auditoría
  try {
    const auditAction = isPendienteFirma ? "guardar_pendiente_firma" : "finalizar";
    const auditDesc = isPendienteFirma
      ? `Evaluación guardada pendiente de firma del colaborador ID: ${payload.evaluatee_id}. Resultado calculado.`
      : `Evaluación finalizada para colaborador ID: ${payload.evaluatee_id}. Resultado calculado.`;
    await logAudit(
      auditAction,
      "evaluations",
      evalData.id,
      auditDesc
    );
  } catch (_) { /* no bloquear si falla la auditoría */ }

  return { success: true, evaluation_id: evalData.id, result: resultData, mode };
}

// ==========================================
// FIRMA PENDIENTE — Completar firma del colaborador
// ==========================================

export async function completeCollaboratorSignature(evaluationId: string, signatureBase64: string) {
  const supabase = await getSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("No autenticado");

  const adminClient = await getSupabaseAdmin();

  // Verificar que la evaluación existe y está en estado pendiente_firma
  const { data: evaluation, error: fetchError } = await adminClient
    .from("evaluations")
    .select("id, status, evaluatee_id")
    .eq("id", evaluationId)
    .single();

  if (fetchError || !evaluation) {
    return { error: "Evaluación no encontrada." };
  }

  if (evaluation.status !== "pendiente_firma") {
    return { error: "Esta evaluación no está pendiente de firma." };
  }

  // Actualizar con la firma del colaborador y finalizar
  const { error: updateError } = await adminClient
    .from("evaluations")
    .update({
      status: "finalizada",
      draft_data: { collaborator_signature: signatureBase64 },
      evaluatee_signed_at: new Date().toISOString(),
      evaluatee_accepted: true,
      finalized_at: new Date().toISOString(),
      finalized_by: userData.user.id,
    })
    .eq("id", evaluationId);

  if (updateError) return { error: updateError.message };

  revalidatePath("/evaluaciones");
  revalidatePath("/evaluaciones/firmas-pendientes");
  revalidatePath("/dashboard");

  // Registrar en auditoría
  try {
    await logAudit(
      "completar_firma",
      "evaluations",
      evaluationId,
      `Firma del colaborador completada. Evaluación finalizada para colaborador ID: ${evaluation.evaluatee_id}.`
    );
  } catch (_) { /* no bloquear si falla la auditoría */ }

  return { success: true };
}

export async function getPendingSignatureEvaluations() {
  try {
    const adminClient = await getSupabaseAdmin();
    let roleName = "admin";
    let currentUserId: string | null = null;

    try {
      const supabase = await getSupabase();
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.id) {
        currentUserId = userData.user.id;
        const { data: profile } = await adminClient
          .from("profiles")
          .select("id, roles(name)")
          .eq("id", currentUserId)
          .single();
        roleName = (profile?.roles as any)?.name || "admin";
      }
    } catch (authErr) {
      console.warn("Non-fatal: session check in getPendingSignatureEvaluations:", authErr);
    }

    let query = adminClient
      .from("evaluations")
      .select(`
        id,
        code,
        evaluation_year,
        evaluation_date,
        created_at,
        status,
        evaluator_id,
        evaluatee_id,
        strengths,
        improvement_opportunities,
        training_needs,
        observations,
        collaborator:collaborators(
          id,
          full_name,
          document_type,
          document_number,
          email,
          position:positions(name),
          areas:areas(name)
        ),
        evaluator:profiles!evaluator_id(id, first_name, last_name, email, avatar_url),
        result:evaluation_results(*)
      `)
      .eq("status", "pendiente_firma");

    // Si es rol líder, filtrar para que solo vea las evaluaciones donde él fue el evaluador
    if (roleName === "lider" && currentUserId) {
      query = query.eq("evaluator_id", currentUserId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error in getPendingSignatureEvaluations:", error);
      return { error: error.message, data: [] };
    }
    return { data: data || [] };
  } catch (err: any) {
    console.error("Exception in getPendingSignatureEvaluations:", err);
    return { error: err?.message || "Error al cargar evaluaciones pendientes", data: [] };
  }
}

export async function sendEvaluationEmail({
  evaluationId,
  pdfBase64,
  fileName,
  recipientEmail,
  recipientName,
  evaluationYear,
  score,
  result
}: {
  evaluationId: string;
  pdfBase64: string;
  fileName: string;
  recipientEmail: string;
  recipientName: string;
  evaluationYear: number;
  score: number;
  result: string;
}) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return { error: "RESEND_API_KEY no configurado en el servidor." };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    // Determinar remitente: usar dominio verificado si existe, sino el de prueba de Resend
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@flotasugamuxisa.com.co";
    const fromName = process.env.RESEND_FROM_NAME || "Evaluaciones Flota Sugamuxi";

    const resultColor =
      result.toLowerCase() === "aprobado" ? "#047857" :
      result.toLowerCase() === "plan_mejoramiento" ? "#b45309" : "#b91c1c";
    const resultBg =
      result.toLowerCase() === "aprobado" ? "#ecfdf5" :
      result.toLowerCase() === "plan_mejoramiento" ? "#fffbeb" : "#fef2f2";
    const resultBorder =
      result.toLowerCase() === "aprobado" ? "#a7f3d0" :
      result.toLowerCase() === "plan_mejoramiento" ? "#fde68a" : "#fecaca";

    const resultLabel =
      result.toLowerCase() === "aprobado" ? "APROBADO" :
      result.toLowerCase() === "plan_mejoramiento" ? "PLAN DE MEJORAMIENTO" : "NO APROBADO";

    const emailHtml = `
      <div style="font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background-color: #f1f5f9; padding: 40px 20px; color: #1e293b; min-height: 100%;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0;">
          <!-- Top Accent Bar -->
          <div style="height: 6px; background-color: #012169;"></div>
          
          <!-- Corporate Header -->
          <div style="background-color: #012169; padding: 24px 32px; border-bottom: 3px solid #0084D5; text-align: left;">
            <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 1px; font-family: 'Segoe UI', Arial, sans-serif;">FLOTA SUGAMUXI S.A.</h1>
            <p style="color: #93c5fd; margin: 4px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-family: 'Segoe UI', Arial, sans-serif;">Sistema de Evaluación de Desempeño (EVD)</p>
          </div>
          
          <!-- Body Content -->
          <div style="padding: 32px;">
            <h2 style="color: #012169; font-size: 18px; font-weight: 700; margin-top: 0; margin-bottom: 16px; font-family: 'Segoe UI', Arial, sans-serif;">Registro de Evaluación de Desempeño</h2>
            
            <p style="font-size: 14.5px; line-height: 1.6; margin-bottom: 20px; color: #334155;">
              Estimado(a) <strong style="color: #0f172a;">${recipientName}</strong>,
            </p>
            
            <p style="font-size: 14.5px; line-height: 1.6; margin-bottom: 24px; color: #334155;">
              Le informamos que se ha registrado y finalizado exitosamente su **Evaluación de Desempeño (EVD)** correspondiente al periodo fiscal **${evaluationYear}**.
            </p>
            
            <!-- Result Summary Card -->
            <div style="background-color: #f8fafc; border-left: 4px solid #0084D5; border-radius: 4px 8px 8px 4px; padding: 20px; margin-bottom: 28px; border-top: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;">
              <h3 style="margin-top: 0; margin-bottom: 16px; color: #012169; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; font-family: 'Segoe UI', Arial, sans-serif;">Resumen Ejecutivo de Resultados</h3>
              
              <table style="width: 100%; border-collapse: collapse; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;">
                <tr>
                  <td style="padding: 8px 0; color: #475569; width: 45%;">Calificación Promedio:</td>
                  <td style="padding: 8px 0; font-weight: 700; color: #0f172a; font-size: 15px;">${score.toFixed(2)} / 5.00</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #475569; vertical-align: middle;">Resultado General:</td>
                  <td style="padding: 8px 0; vertical-align: middle;">
                    <span style="display: inline-block; background-color: ${resultBg}; color: ${resultColor}; border: 1px solid ${resultBorder}; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 12px; letter-spacing: 0.5px;">
                      ${resultLabel}
                    </span>
                  </td>
                </tr>
              </table>
            </div>
            
            <p style="font-size: 13.5px; line-height: 1.6; color: #475569; margin-bottom: 8px;">
              En el archivo adjunto encontrará el reporte formal en formato PDF con la firma de conformidad del evaluador y el colaborador evaluado, así como el desglose detallado de calificaciones por categoría.
            </p>
          </div>
          
          <!-- Corporate Footer -->
          <div style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5; font-family: 'Segoe UI', Arial, sans-serif;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">FLOTA SUGAMUXI S.A.</p>
            <p style="margin: 0 0 12px 0;">Este es un mensaje automático generado por el Sistema de Evaluación de Desempeño (EVD). Por favor no responda a este correo.</p>
            <p style="margin: 0; font-style: italic; font-size: 10px;">
              CONFIDENCIALIDAD: La información contenida en este correo electrónico y sus anexos es confidencial y está dirigida únicamente al destinatario. Si usted ha recibido este mensaje por error, por favor notifíquelo al remitente y elimínelo de su sistema.
            </p>
          </div>
        </div>
      </div>
    `;

    // Convertir base64 a Buffer para el adjunto (requerido por Resend v6+)
    const pdfBuffer = Buffer.from(pdfBase64, "base64");

    const response = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: recipientEmail,
      subject: `Reporte EVD ${evaluationYear} - ${recipientName}`,
      html: emailHtml,
      attachments: [
        {
          filename: fileName,
          content: pdfBuffer,
        },
      ],
    });

    if (response.error) {
      console.error("Resend error detail:", response.error);
      const errMsg = (response.error as any)?.message || JSON.stringify(response.error);
      // Error de dominio no verificado — instrucción clara
      if (errMsg.includes("not allowed") || errMsg.includes("verify") || errMsg.includes("domain") || errMsg.includes("authorized")) {
        return {
          error: `Dominio no verificado: con el plan gratuito de Resend solo puedes enviar al correo del propietario de la cuenta. Para enviar a cualquier destinatario, verifica tu dominio en resend.com/domains y agrega RESEND_FROM_EMAIL=noreply@tudominio.com al archivo .env.local`
        };
      }
      return { error: `Error al enviar: ${errMsg}` };
    }

    // Registrar en auditoría
    try {
      await logAudit(
        "correo_enviado",
        "evaluations",
        evaluationId,
        `Reporte de evaluación enviado a ${recipientName} (${recipientEmail})`
      );
    } catch (_) { /* no bloquear si falla la auditoría */ }

    return { success: true };
  } catch (error: any) {
    console.error("Error sending email:", error);
    return { error: error?.message || "Error inesperado al enviar el correo." };
  }
}

// ==========================================
// VERSIONES DE EVALUACIÓN
// ==========================================

export async function getEvaluationVersions() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("evaluation_versions")
    .select(`
      *,
      questions:evaluation_questions(count)
    `)
    .order("year", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };

  const formatted = (data || []).map((v: any) => ({
    ...v,
    questions_count: v.questions?.[0]?.count || 0
  }));

  return { data: formatted };
}

export async function saveEvaluationVersion(version: {
  id?: string;
  year: number;
  name: string;
  description?: string;
  is_active?: boolean;
  is_published?: boolean;
  approved_threshold?: number;
  pmi_threshold?: number;
}) {
  const permCheck = await verifyUserPermission("configuracion", version.id ? "can_edit" : "can_create");
  if (!permCheck.allowed) return { error: permCheck.error || "No tienes permisos para gestionar versiones en Configuración." };

  const supabase = await getSupabaseAdmin();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "No autenticado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userData.user.id)
    .single();

  if (!profile?.company_id) return { error: "Compañía no encontrada" };

  if (version.is_active) {
    await supabase
      .from("evaluation_versions")
      .update({ is_active: false })
      .eq("company_id", profile.company_id);
  }

  if (version.id) {
    const { error } = await supabase
      .from("evaluation_versions")
      .update({
        year: version.year,
        name: version.name,
        description: version.description,
        is_active: version.is_active ?? false,
        is_published: version.is_published ?? false,
        approved_threshold: version.approved_threshold ?? 4.0,
        pmi_threshold: version.pmi_threshold ?? 3.1,
        updated_at: new Date().toISOString()
      })
      .eq("id", version.id);

    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("evaluation_versions")
      .insert({
        company_id: profile.company_id,
        year: version.year,
        name: version.name,
        description: version.description,
        is_active: version.is_active ?? false,
        is_published: version.is_published ?? false,
        approved_threshold: version.approved_threshold ?? 4.0,
        pmi_threshold: version.pmi_threshold ?? 3.1,
        created_by: userData.user.id
      });

    if (error) return { error: error.message };
  }

  revalidatePath("/configuracion/versiones");
  return { success: true };
}

export async function cloneEvaluationVersion(versionId: string) {
  const permCheck = await verifyUserPermission("configuracion", "can_create");
  if (!permCheck.allowed) return { error: permCheck.error || "No tienes permisos para duplicar versiones en Configuración." };

  const supabase = await getSupabaseAdmin();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "No autenticado" };

  const { data: original, error: origError } = await supabase
    .from("evaluation_versions")
    .select("*")
    .eq("id", versionId)
    .single();

  if (origError || !original) return { error: "Versión original no encontrada: " + origError?.message };

  const newName = `${original.name} (Copia)`;
  const { data: newVersion, error: createError } = await supabase
    .from("evaluation_versions")
    .insert({
      company_id: original.company_id,
      year: original.year,
      name: newName,
      description: original.description,
      is_active: false,
      is_published: false,
      approved_threshold: original.approved_threshold,
      pmi_threshold: original.pmi_threshold,
      created_by: userData.user.id
    })
    .select()
    .single();

  if (createError || !newVersion) return { error: "Error al crear la versión clonada: " + createError?.message };

  const { data: categories } = await supabase
    .from("evaluation_categories")
    .select("*")
    .eq("version_id", original.id);

  if (categories && categories.length > 0) {
    for (const cat of categories) {
      const { data: newCat, error: catError } = await supabase
        .from("evaluation_categories")
        .insert({
          version_id: newVersion.id,
          name: cat.name,
          description: cat.description,
          sort_order: cat.sort_order,
          weight: cat.weight,
          active: cat.active
        })
        .select()
        .single();

      if (catError || !newCat) continue;

      const { data: questions } = await supabase
        .from("evaluation_questions")
        .select("*")
        .eq("category_id", cat.id)
        .eq("version_id", original.id);

      if (questions && questions.length > 0) {
        const questionsToInsert = questions.map((q) => ({
          category_id: newCat.id,
          version_id: newVersion.id,
          code: q.code,
          question: q.question,
          description: q.description,
          sort_order: q.sort_order,
          is_required: q.is_required,
          is_active: q.is_active,
          is_critical: q.is_critical,
          min_score_required: q.min_score_required,
          weight: q.weight
        }));

        await supabase
          .from("evaluation_questions")
          .insert(questionsToInsert);
      }
    }
  }

  revalidatePath("/configuracion/versiones");
  return { success: true };
}

export async function getLeaderProfiles(): Promise<{ data: { id: string; name: string }[]; error?: string }> {
  try {
    const supabase = await getSupabaseAdmin();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, roles!inner(id, name, display_name)")
      .eq("roles.name", "lider")
      .order("first_name", { ascending: true });

    if (error) {
      console.error("Error fetching leader profiles:", error);
      return { data: [], error: error.message };
    }

    const seen = new Set<string>();
    const leaders: { id: string; name: string }[] = [];

    for (const p of data || []) {
      const fullName = `${p.first_name || ""} ${p.last_name || ""}`.replace(/\s+/g, " ").trim();
      if (fullName && !seen.has(fullName.toLowerCase())) {
        seen.add(fullName.toLowerCase());
        leaders.push({
          id: p.id,
          name: fullName,
        });
      }
    }

    leaders.sort((a, b) => a.name.localeCompare(b.name));

    return { data: leaders };
  } catch (err: any) {
    console.error("Exception fetching leader profiles:", err);
    return { data: [], error: err?.message || "Error al obtener líderes" };
  }
}

export interface LeaderReportItem {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  position: string;
  active: boolean;
  totalEvaluations: number;
  finalizedCount: number;
  pendingSignatureCount: number;
  inProgressCount: number;
  draftCount: number;
  averageScore: number;
  hasEvaluations: boolean;
  lastEvaluationDate: string | null;
}

export async function getLeadersReportData(): Promise<{
  data: LeaderReportItem[];
  summary: {
    totalLeaders: number;
    leadersWithEvaluations: number;
    leadersWithoutEvaluations: number;
    totalEvaluations: number;
    completionPercentage: number;
  };
  error?: string;
}> {
  try {
    const supabase = await getSupabaseAdmin();
    
    // 1. Fetch all leader profiles with positions and document number
    const { data: leaders, error: leadersError } = await supabase
      .from("profiles")
      .select(`
        id, first_name, last_name, email, phone, active, document_number,
        roles!inner(id, name, display_name),
        positions(id, name)
      `)
      .eq("roles.name", "lider")
      .order("first_name", { ascending: true });

    if (leadersError) {
      console.error("Error fetching leaders for report:", leadersError);
      return {
        data: [],
        summary: { totalLeaders: 0, leadersWithEvaluations: 0, leadersWithoutEvaluations: 0, totalEvaluations: 0, completionPercentage: 0 },
        error: leadersError.message
      };
    }

    // 2. Fallback positions lookup from collaborators table by doc or email
    const { data: collabs } = await supabase
      .from("collaborators")
      .select("document_number, email, positions(name)");

    const collabsByDoc: Record<string, string> = {};
    const collabsByEmail: Record<string, string> = {};
    (collabs || []).forEach((c: any) => {
      const pName = Array.isArray(c.positions) ? c.positions[0]?.name : c.positions?.name;
      if (pName) {
        if (c.document_number) collabsByDoc[c.document_number] = pName;
        if (c.email) collabsByEmail[c.email.toLowerCase().trim()] = pName;
      }
    });

    // 3. Fetch all evaluations with status and results
    const { data: evaluations, error: evalError } = await supabase
      .from("evaluations")
      .select(`
        id,
        evaluator_id,
        status,
        created_at,
        finalized_at,
        result:evaluation_results(overall_average, result)
      `);

    if (evalError) {
      console.error("Error fetching evaluations for leaders report:", evalError);
    }

    const evalsByLeader: Record<string, any[]> = {};
    (evaluations || []).forEach((ev) => {
      if (ev.evaluator_id) {
        if (!evalsByLeader[ev.evaluator_id]) {
          evalsByLeader[ev.evaluator_id] = [];
        }
        evalsByLeader[ev.evaluator_id].push(ev);
      }
    });

    const reportItems: LeaderReportItem[] = (leaders || []).map((l: any) => {
      const fullName = `${l.first_name || ""} ${l.last_name || ""}`.replace(/\s+/g, " ").trim();
      const myEvals = evalsByLeader[l.id] || [];
      const total = myEvals.length;
      
      const posObj = Array.isArray(l.positions) ? l.positions[0] : l.positions;
      let posName = posObj?.name || "";
      if (!posName && l.document_number && collabsByDoc[l.document_number]) {
        posName = collabsByDoc[l.document_number];
      }
      if (!posName && l.email && collabsByEmail[l.email.toLowerCase().trim()]) {
        posName = collabsByEmail[l.email.toLowerCase().trim()];
      }
      if (!posName) posName = "Sin Cargo Asignado";

      const finalized = myEvals.filter((e) => e.status === "finalizada").length;
      const pendingSig = myEvals.filter((e) => e.status === "pendiente_firma").length;
      const inProgress = myEvals.filter((e) => e.status === "en_proceso").length;
      const draft = myEvals.filter((e) => e.status === "borrador").length;

      let scoreSum = 0;
      let scoreCount = 0;
      let lastDate: string | null = null;

      myEvals.forEach((e) => {
        const dateVal = e.finalized_at || e.created_at;
        if (dateVal && (!lastDate || new Date(dateVal) > new Date(lastDate))) {
          lastDate = dateVal;
        }

        const resObj = Array.isArray(e.result) ? e.result[0] : e.result;
        if (resObj && resObj.overall_average != null) {
          const score = Number(resObj.overall_average);
          if (!isNaN(score) && score > 0) {
            scoreSum += score;
            scoreCount++;
          }
        }
      });

      const avgScore = scoreCount > 0 ? Number((scoreSum / scoreCount).toFixed(2)) : 0;

      return {
        id: l.id,
        name: fullName,
        firstName: l.first_name || "",
        lastName: l.last_name || "",
        email: l.email || "—",
        phone: l.phone || null,
        position: posName,
        active: l.active !== false,
        totalEvaluations: total,
        finalizedCount: finalized,
        pendingSignatureCount: pendingSig,
        inProgressCount: inProgress,
        draftCount: draft,
        averageScore: avgScore,
        hasEvaluations: total > 0,
        lastEvaluationDate: lastDate,
      };
    });

    // Sort by total evaluations descending by default, then alphabetically
    reportItems.sort((a, b) => {
      if (b.totalEvaluations !== a.totalEvaluations) {
        return b.totalEvaluations - a.totalEvaluations;
      }
      return a.name.localeCompare(b.name);
    });

    const totalLeaders = reportItems.length;
    const leadersWithEvaluations = reportItems.filter((l) => l.hasEvaluations).length;
    const leadersWithoutEvaluations = totalLeaders - leadersWithEvaluations;
    const totalEvalsCount = reportItems.reduce((acc, curr) => acc + curr.totalEvaluations, 0);
    const completionPercentage = totalLeaders > 0 ? Number(((leadersWithEvaluations / totalLeaders) * 100).toFixed(1)) : 0;

    return {
      data: reportItems,
      summary: {
        totalLeaders,
        leadersWithEvaluations,
        leadersWithoutEvaluations,
        totalEvaluations: totalEvalsCount,
        completionPercentage,
      },
    };
  } catch (err: any) {
    console.error("Exception in getLeadersReportData:", err);
    return {
      data: [],
      summary: { totalLeaders: 0, leadersWithEvaluations: 0, leadersWithoutEvaluations: 0, totalEvaluations: 0, completionPercentage: 0 },
      error: err?.message || "Error al obtener informe de líderes",
    };
  }
}

