"use server";

import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/server";
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

    const { data, error } = await adminClient
      .from("training_recommendations")
      .select(`
        *,
        evaluation:evaluations(
          id, 
          collaborator:collaborators(full_name, positions(name), areas(name))
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching training:", error);
      return { data: [], error: error.message };
    }

    return { data: data || [], error: null };
  } catch (err: any) {
    console.error("Error in getTrainingRecommendations:", err);
    return { data: [], error: err?.message || "Error al cargar capacitaciones" };
  }
}
