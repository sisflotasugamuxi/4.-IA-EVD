"use server";

import { createServerClient } from "@supabase/ssr";
import { createAdminClient, getCurrentLeaderScope } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

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
        getAll() { return cookieStore.getAll(); },
        setAll() {}
      },
    }
  );
}

export async function getFeedbackSessions() {
  try {
    const supabase = await getSupabase();
    const adminClient = getSupabaseAdmin();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: [], error: "No autenticado" };

    const { data: profile } = await adminClient
      .from("profiles")
      .select("company_id")
      .eq("id", userData.user.id)
      .single();

    if (!profile?.company_id) return { data: [], error: "Empresa no encontrada" };

    const [res, scope] = await Promise.all([
      adminClient
        .from("feedback_sessions")
        .select(`
          *,
          evaluation:evaluations(
            id, 
            created_at,
            evaluator_id,
            evaluatee_id,
            collaborator:collaborators(id, full_name, positions(name))
          )
        `)
        .order("created_at", { ascending: false }),
      getCurrentLeaderScope()
    ]);

    if (res.error) {
      console.error("Error fetching feedback:", res.error);
      return { data: [], error: res.error.message };
    }

    let items = res.data || [];
    if (scope.isLeader) {
      items = items.filter((s: any) => {
        const ev = Array.isArray(s.evaluation) ? s.evaluation[0] : s.evaluation;
        return (
          s.manager_id === scope.userId ||
          ev?.evaluator_id === scope.userId ||
          (ev?.evaluatee_id && scope.assignedCollaboratorIds.has(ev.evaluatee_id))
        );
      });
    }

    return { data: items, error: null };
  } catch (err: any) {
    console.error("Error in getFeedbackSessions:", err);
    return { data: [], error: err?.message || "Error al cargar retroalimentación" };
  }
}

export async function createFeedbackSession(evaluationId: string, notes: string, commitments: string) {
  const supabase = await getSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "No autenticado" };

  const { error } = await supabase
    .from("feedback_sessions")
    .insert({
      evaluation_id: evaluationId,
      scheduled_date: new Date().toISOString(),
      status: "realizada",
      notes,
      commitments,
      manager_id: userData.user.id
    });

  if (error) {
    console.error("Error creating feedback:", error);
    return { error: error.message };
  }

  revalidatePath("/retroalimentacion");
  return { success: true };
}
