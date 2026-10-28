"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
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

import { DEFAULT_FIELDS } from "@/lib/constants";

export async function getCollaboratorFieldsConfig() {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("collaborator_fields_config")
      .select("*")
      .order("step_number", { ascending: true });

    // Si hay un error PGRST116 (no existe la relación) o la tabla está vacía, usamos el fallback
    if (error || !data || data.length === 0) {
      console.warn("Usando campos de colaborador por defecto (tabla no migrada o vacía)");
      return { data: DEFAULT_FIELDS, fromDb: false };
    }

    return { data, fromDb: true };
  } catch (err) {
    console.error("Error al obtener la configuración de campos:", err);
    return { data: DEFAULT_FIELDS, fromDb: false };
  }
}

export async function updateCollaboratorFieldConfig(
  fieldId: string,
  updates: { label?: string; field_type?: string; is_required?: boolean; is_visible?: boolean }
) {
  try {
    const permCheck = await verifyUserPermission("configuracion", "can_edit");
    if (!permCheck.allowed) {
      return { error: permCheck.error || "No tienes permisos para modificar campos en Configuración." };
    }

    const supabase = await getSupabase();
    
    // Validar usuario
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { error: "No autenticado" };

    // Evitar que se desactiven campos críticos del sistema
    const isCriticalSystemField = ["document_type", "document_number", "first_name", "last_name"].includes(fieldId);
    if (isCriticalSystemField) {
      if (updates.is_required === false || updates.is_visible === false) {
        return { error: "No se puede cambiar la obligatoriedad o visibilidad de campos críticos del sistema." };
      }
    }

    const { data, error } = await supabase
      .from("collaborator_fields_config")
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq("id", fieldId)
      .select()
      .single();

    if (error) {
      console.error("Error al actualizar campo:", error);
      if (error.code === "PGRST204" || error.code === "42P01") {
        return {
          error: "La tabla de configuración no existe en Supabase. Por favor ejecute la migración 007_create_collaborator_fields_config.sql en el SQL Editor de su panel Supabase primero."
        };
      }
      return { error: error.message };
    }

    revalidatePath("/configuracion/campos");
    revalidatePath("/colaboradores/nuevo");

    // Registrar auditoría
    try {
      await logAudit(
        "editar",
        "collaborator_fields_config",
        fieldId,
        `Campo '${fieldId}' parametrizado: ${JSON.stringify(updates)}`
      );
    } catch (_) {}

    return { success: true, data };
  } catch (err: any) {
    console.error("Error en updateCollaboratorFieldConfig:", err);
    return { error: err.message || "Error al actualizar la configuración." };
  }
}
