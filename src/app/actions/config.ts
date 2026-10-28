"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
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
// ÁREAS
// ==========================================
export async function getAreas() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("areas")
    .select("*")
    .order("name");
  
  if (error) throw error;
  return data;
}

export async function createArea(areaData: any) {
  const permCheck = await verifyUserPermission("administracion", "can_create");
  if (!permCheck.allowed) return { error: permCheck.error || "No tienes permisos para crear áreas." };

  const supabase = await getSupabase();
  
  // Obtener la empresa del usuario actual
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("No autenticado");
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userData.user.id)
    .single();

  const { error } = await supabase.from("areas").insert({
    ...areaData,
    company_id: profile?.company_id,
  });

  if (error) return { error: error.message };
  revalidatePath("/administracion/areas");
  return { success: true };
}

export async function updateArea(areaId: string, areaData: {
  name?: string;
  code?: string;
  description?: string;
}) {
  const permCheck = await verifyUserPermission("administracion", "can_edit");
  if (!permCheck.allowed) return { error: permCheck.error || "No tienes permisos para editar áreas." };

  const supabase = await getSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "No autenticado" };

  const { error } = await supabase
    .from("areas")
    .update({ ...areaData, updated_at: new Date().toISOString() })
    .eq("id", areaId);

  if (error) return { error: error.message };
  revalidatePath("/administracion/areas");
  return { success: true };
}

export async function deleteArea(areaId: string) {
  const permCheck = await verifyUserPermission("administracion", "can_delete");
  if (!permCheck.allowed) return { error: permCheck.error || "No tienes permisos para eliminar áreas." };

  const supabase = await getSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "No autenticado" };

  // Check if area is in use
  const { count } = await supabase
    .from("collaborators")
    .select("id", { count: "exact", head: true })
    .eq("area_id", areaId);

  if (count && count > 0) {
    return { error: `No se puede eliminar: el área tiene ${count} colaborador(es) asignado(s)` };
  }

  const { error } = await supabase
    .from("areas")
    .delete()
    .eq("id", areaId);

  if (error) return { error: error.message };
  revalidatePath("/administracion/areas");
  return { success: true };
}

// ==========================================
// CARGOS (POSITIONS)
// ==========================================
export async function getPositions() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("positions")
    .select(`
      *,
      areas(name)
    `)
    .order("name");
  
  if (error) throw error;
  return data;
}

export async function createPosition(positionData: any) {
  const permCheck = await verifyUserPermission("administracion", "can_create");
  if (!permCheck.allowed) return { error: permCheck.error || "No tienes permisos para crear cargos." };

  const supabase = await getSupabase();
  
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("No autenticado");
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userData.user.id)
    .single();

  const { error } = await supabase.from("positions").insert({
    ...positionData,
    company_id: profile?.company_id,
  });

  if (error) return { error: error.message };
  revalidatePath("/administracion/cargos");
  return { success: true };
}

export async function updatePosition(positionId: string, positionData: {
  name?: string;
  code?: string;
  description?: string;
  area_id?: string;
  level?: number;
}) {
  const permCheck = await verifyUserPermission("administracion", "can_edit");
  if (!permCheck.allowed) return { error: permCheck.error || "No tienes permisos para editar cargos." };

  const supabase = await getSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "No autenticado" };

  const { error } = await supabase
    .from("positions")
    .update({ ...positionData, updated_at: new Date().toISOString() })
    .eq("id", positionId);

  if (error) return { error: error.message };
  revalidatePath("/administracion/cargos");
  return { success: true };
}

export async function deletePosition(positionId: string) {
  const permCheck = await verifyUserPermission("administracion", "can_delete");
  if (!permCheck.allowed) return { error: permCheck.error || "No tienes permisos para eliminar cargos." };

  const supabase = await getSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "No autenticado" };

  // Check if position is in use
  const { count } = await supabase
    .from("collaborators")
    .select("id", { count: "exact", head: true })
    .eq("position_id", positionId);

  if (count && count > 0) {
    return { error: `No se puede eliminar: el cargo tiene ${count} colaborador(es) asignado(s)` };
  }

  const { error } = await supabase
    .from("positions")
    .delete()
    .eq("id", positionId);

  if (error) return { error: error.message };
  revalidatePath("/administracion/cargos");
  return { success: true };
}
