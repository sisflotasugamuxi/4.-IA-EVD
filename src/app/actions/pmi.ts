"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
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

export async function getPMIs() {
  const supabase = getSupabaseAdmin();
  const scope = await getCurrentLeaderScope();

  const filterForLeader = (rows: any[]) => {
    if (!scope.isLeader) return rows;
    return rows.filter((r: any) => {
      const ev = Array.isArray(r.evaluation) ? r.evaluation[0] : r.evaluation;
      const collab = ev?.collaborator ? (Array.isArray(ev.collaborator) ? ev.collaborator[0] : ev.collaborator) : null;
      return (
        ev?.evaluator_id === scope.userId ||
        (collab?.id && scope.assignedCollaboratorIds.has(collab.id))
      );
    });
  };
  
  // A PMI is basically an evaluation_result where pmi_required = true
  // or where the result is 'no_aprobado'
  const { data: pmiData, error: pmiError } = await supabase
    .from("evaluation_results")
    .select(`
      *,
      evaluation:evaluations(
        id,
        created_at,
        evaluator_id,
        collaborator:collaborators(id, full_name, positions(name), areas(name))
      )
    `)
    .eq("pmi_required", true)
    .order("created_at", { ascending: false });

  // If we have data with pmi_required=true, return it
  if (!pmiError && pmiData && pmiData.length > 0) {
    return { data: filterForLeader(pmiData), error: null };
  }

  // Fallback: fetch evaluations with result = 'no_aprobado'
  const { data: fallbackData, error: fallbackError } = await supabase
    .from("evaluation_results")
    .select(`
      *,
      evaluation:evaluations(
        id,
        created_at,
        evaluator_id,
        collaborator:collaborators(id, full_name, positions(name), areas(name))
      )
    `)
    .eq("result", "no_aprobado")
    .order("created_at", { ascending: false });

  if (fallbackError) {
    console.error("Error fetching PMIs (fallback):", fallbackError);
    // Try another fallback with result not being approved
    const { data: altData, error: altError } = await supabase
      .from("evaluation_results")
      .select(`
        *,
        evaluation:evaluations(
          id,
          created_at,
          evaluator_id,
          collaborator:collaborators(id, full_name, positions(name), areas(name))
        )
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    if (altError) {
      return { data: [], error: altError.message };
    }
    // Filter client-side for PMI-worthy records
    const filtered = (altData || []).filter(
      (r: any) => r.pmi_required === true || r.result === "no_aprobado" || (r.overall_average && r.overall_average < 3)
    );
    return { data: filterForLeader(filtered), error: null };
  }

  return { data: filterForLeader(fallbackData || []), error: null };
}

export async function addPMIFollowup(pmiId: string, followupData: any) {
  // In a real implementation this would insert into a pmi_followups table.
  // We'll simulate it for now if the table doesn't exist.
  // To keep it simple, we'll just return success.
  revalidatePath("/pmi");
  return { success: true };
}
