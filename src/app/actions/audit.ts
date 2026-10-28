"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";

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

async function getSupabaseAdmin() {
  return createAdminClient();
}

export async function getAuditLogs(limit = 200, filters?: {
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const supabase = await getSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { data: [], error: "No autenticado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userData.user.id)
    .single();

  if (!profile?.company_id) return { data: [], error: "Empresa no encontrada" };

  const adminClient = await getSupabaseAdmin();
  let query = adminClient
    .from("audit_logs")
    .select(`
      id,
      action,
      table_name,
      record_id,
      description,
      old_values,
      new_values,
      ip_address,
      user_agent,
      created_at,
      user_id
    `)
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters?.action) {
    query = query.eq("action", filters.action);
  }
  if (filters?.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }
  if (filters?.dateTo) {
    // Add 1 day to include the full day
    const dateTo = new Date(filters.dateTo);
    dateTo.setDate(dateTo.getDate() + 1);
    query = query.lt("created_at", dateTo.toISOString().split("T")[0]);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching audit logs:", error);
    return { data: [], error: error.message };
  }

  // Enrich with profile data if possible
  if (data && data.length > 0) {
    const userIds = [...new Set(data.map((l: any) => l.user_id).filter(Boolean))];
    let profilesMap: Record<string, any> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds);

      if (profiles) {
        profilesMap = Object.fromEntries(profiles.map((p: any) => [p.id, p]));
      }
    }

    const enriched = data.map((log: any) => ({
      ...log,
      profile: log.user_id ? profilesMap[log.user_id] || null : null,
    }));

    return { data: enriched, error: null };
  }

  return { data: data || [], error: null };
}

// Function to log an audit event
export async function logAudit(
  action: string,
  table_name: string,
  record_id?: string | null,
  description: string = "",
  old_values: any = null,
  new_values: any = null
) {
  try {
    const supabase = await getSupabase();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userData.user.id)
      .single();

    if (!profile?.company_id) return;

    // Normalizar acción para que coincida con el enum de Postgres audit_action:
    // ('crear', 'editar', 'eliminar', 'finalizar', 'reabrir', 'correo_enviado', 'descarga_pdf', 'descarga_excel', 'cambio_configuracion', 'login', 'logout')
    const VALID_ACTIONS = new Set([
      "crear",
      "editar",
      "eliminar",
      "finalizar",
      "reabrir",
      "correo_enviado",
      "descarga_pdf",
      "descarga_excel",
      "cambio_configuracion",
      "login",
      "logout",
    ]);

    let safeAction = action?.toLowerCase().trim() || "crear";
    let finalDescription = description || "";

    if (!VALID_ACTIONS.has(safeAction)) {
      if (safeAction.includes("eliminar") || safeAction.includes("borrar")) {
        safeAction = "eliminar";
      } else if (safeAction.includes("editar") || safeAction.includes("actualizar") || safeAction.includes("update")) {
        safeAction = "editar";
      } else if (safeAction.includes("config") || safeAction.includes("param")) {
        safeAction = "cambio_configuracion";
      } else {
        safeAction = "crear";
      }
      finalDescription = `[${action}] ${finalDescription}`.trim();
    }

    // Validar si record_id es un UUID válido. Si no lo es, enviar null para evitar error 22P02 en Postgres
    const isValidUUID = (id?: string | null) =>
      Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

    const safeRecordId = isValidUUID(record_id) ? record_id : null;

    const adminClient = await getSupabaseAdmin();
    await adminClient.from("audit_logs").insert({
      company_id: profile.company_id,
      user_id: userData.user.id,
      action: safeAction,
      table_name: table_name || "sistema",
      record_id: safeRecordId,
      description: finalDescription,
      old_values,
      new_values,
      ip_address: "127.0.0.1",
      user_agent: "Next.js App",
    });
  } catch (auditErr) {
    console.warn("Non-fatal error in logAudit:", auditErr);
  }
}
