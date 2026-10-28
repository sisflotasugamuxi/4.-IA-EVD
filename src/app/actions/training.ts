"use server";

import { createServerClient } from "@supabase/ssr";
import { createAdminClient, getCurrentLeaderScope } from "@/lib/supabase/server";
import { cookies } from "next/headers";

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

export async function getTrainingRecommendations() {
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
        .from("training_recommendations")
        .select(`
          *,
          evaluation:evaluations(
            id,
            evaluator_id,
            evaluatee_id,
            collaborator:collaborators(id, full_name, positions(name), areas(name))
          )
        `)
        .order("created_at", { ascending: false }),
      getCurrentLeaderScope()
    ]);

    if (res.error) {
      console.error("Error fetching training:", res.error);
      return { data: [], error: res.error.message };
    }

    let items = res.data || [];
    if (scope.isLeader) {
      items = items.filter((t: any) => {
        const ev = Array.isArray(t.evaluation) ? t.evaluation[0] : t.evaluation;
        return (
          ev?.evaluator_id === scope.userId ||
          (ev?.evaluatee_id && scope.assignedCollaboratorIds.has(ev.evaluatee_id))
        );
      });
    }

    return { data: items, error: null };
  } catch (err: any) {
    console.error("Error in getTrainingRecommendations:", err);
    return { data: [], error: err?.message || "Error al cargar capacitaciones" };
  }
}
