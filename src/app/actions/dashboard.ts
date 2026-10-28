"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient, getCurrentLeaderScope } from "@/lib/supabase/server";

function getSupabaseAdmin() {
  return createAdminClient();
}

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

import { getLeadersReportData } from "@/app/actions/evaluations";

function isEligibleByHireDate(hireDateStr: string | null | undefined): boolean {
  if (!hireDateStr) return true;
  const hireDate = new Date(hireDateStr);
  if (isNaN(hireDate.getTime())) return true;
  const now = new Date();
  let months = (now.getFullYear() - hireDate.getFullYear()) * 12 + (now.getMonth() - hireDate.getMonth());
  if (now.getDate() < hireDate.getDate()) {
    months--;
  }
  return months >= 6;
}

export async function getDashboardStats() {
  const supabase = getSupabaseAdmin();
  const scope = await getCurrentLeaderScope();
  
  // 1. Fetch active collaborators with hire_date, payroll_type, and areas
  const { data: collabsList } = await supabase
    .from("collaborators")
    .select("id, hire_date, payroll_type, status, areas(name)");

  let activeCollabs = (collabsList || []).filter((c: any) =>
    scope.isLeader ? scope.assignedCollaboratorIds.has(c.id) : c.status === "activo"
  );

  const totalCollabs = activeCollabs.length;
  const eligibleCollabs = activeCollabs.filter(c => isEligibleByHireDate(c.hire_date)).length;
  const exemptCollabs = totalCollabs - eligibleCollabs;

  // 2. Evaluations with evaluator profiles
  const [evalsRes, leadersRes] = await Promise.all([
    supabase
      .from("evaluations")
      .select(`
        id, created_at, evaluation_year, status, evaluator_id, evaluatee_id,
        evaluator:profiles!evaluations_evaluator_id_fkey(id, first_name, last_name),
        result:evaluation_results(*),
        collaborator:collaborators(full_name, workplace_city, payroll_type, hire_date, positions(name), areas(name))
      `)
      .order("created_at", { ascending: false }),
    getLeadersReportData()
  ]);

  let allEvals = evalsRes.data || [];
  if (scope.isLeader) {
    allEvals = allEvals.filter((e: any) =>
      e.evaluator_id === scope.userId ||
      (e.evaluatee_id && scope.assignedCollaboratorIds.has(e.evaluatee_id))
    );
  }

  const completed = allEvals.filter(e => e.status === 'finalizada' || e.status === 'pendiente_firma');
  
  let aprobados = 0;
  let conPMI = 0;
  let reprobados = 0;
  let sumScore = 0;
  let validScores = 0;

  completed.forEach(e => {
    const res = e.result && !Array.isArray(e.result) ? e.result : e.result?.[0] || null;
    if (res) {
      if (res.result === 'aprobado') aprobados++;
      else if (res.result === 'plan_mejoramiento') conPMI++;
      else if (res.result === 'no_aprobado') reprobados++;
      
      sumScore += Number(res.overall_average || 0);
      validScores++;
    }
  });

  const avgScore = validScores > 0 ? sumScore / validScores : 0;

  // Active PMIs
  let pmisCount = 0;
  if (scope.isLeader) {
    pmisCount = completed.filter(e => {
      const res = e.result && !Array.isArray(e.result) ? e.result : e.result?.[0] || null;
      return res?.pmi_required === true || res?.result === "plan_mejoramiento";
    }).length;
  } else {
    const { count } = await supabase
      .from("evaluation_results")
      .select("*", { count: "exact", head: true })
      .eq("pmi_required", true);
    pmisCount = count || 0;
  }

  return {
    kpis: {
      totalCollabs,
      eligibleCollabs,
      exemptCollabs,
      completedEvals: completed.length,
      aprobados,
      conPMI,
      reprobados,
      avgScore,
      pmisCount: pmisCount || 0,
    },
    collaborators: activeCollabs.map((c: any) => {
      const areaObj = c.areas && !Array.isArray(c.areas) ? c.areas : c.areas?.[0] || null;
      return {
        id: c.id,
        payroll_type: c.payroll_type || "Sin Especificar",
        area: areaObj?.name || "Sin Área",
        hire_date: c.hire_date,
        is_eligible: isEligibleByHireDate(c.hire_date)
      };
    }),
    allEvaluations: allEvals.map((e: any) => {
      const res = e.result && !Array.isArray(e.result) ? e.result : e.result?.[0] || null;
      const collab = e.collaborator && !Array.isArray(e.collaborator) ? e.collaborator : e.collaborator?.[0] || null;
      const posObj = collab?.positions && !Array.isArray(collab.positions) ? collab.positions : collab?.positions?.[0] || null;
      const areaObj = collab?.areas && !Array.isArray(collab.areas) ? collab.areas : collab?.areas?.[0] || null;

      const evalObj = e.evaluator && !Array.isArray(e.evaluator) ? e.evaluator : e.evaluator?.[0] || null;
      const evaluatorName = evalObj ? `${evalObj.first_name || ""} ${evalObj.last_name || ""}`.replace(/\s+/g, " ").trim() : "Sin Asignar";

      return {
        id: e.id,
        evaluator_id: e.evaluator_id || null,
        evaluator_name: evaluatorName,
        collaborator: collab?.full_name || "Desconocido",
        workplace_city: collab?.workplace_city || "Sogamoso",
        position: posObj?.name || "N/A",
        area: areaObj?.name || "N/A",
        payroll_type: collab?.payroll_type || "Sin Especificar",
        hire_date: collab?.hire_date || null,
        is_eligible: isEligibleByHireDate(collab?.hire_date),
        result: res ? res.result : e.status,
        pmi_status: res ? res.pmi_status : null,
        pmi_required: res ? res.pmi_required : false,
        score: Number(res?.overall_average || 0),
        category_scores: res ? res.category_scores : null,
        date: e.created_at,
        year: e.evaluation_year
      };
    }),
    leadersStats: leadersRes.data || [],
    leadersSummary: leadersRes.summary || {
      totalLeaders: 0,
      leadersWithEvaluations: 0,
      leadersWithoutEvaluations: 0,
      totalEvaluations: 0,
      completionPercentage: 0
    }
  };
}
