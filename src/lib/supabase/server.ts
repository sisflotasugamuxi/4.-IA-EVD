import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const resilientFetch: typeof fetch = async (input, init) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(input, init);
    if (response.status === 401) {
      const cloned = response.clone();
      try {
        const text = await cloned.text();
        if (text.includes("PGRST303") || text.includes("JWT issued at future")) {
          await new Promise((r) => setTimeout(r, 1100));
          continue;
        }
      } catch {
        // Ignore clone read error
      }
    }
    return response;
  }
  return fetch(input, init);
};

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: resilientFetch,
    },
  });
}

/**
 * Garantiza que todos los líderes y usuarios del sistema (profiles) con documento
 * existan también en la tabla collaborators para que puedan ser evaluados por otros líderes.
 */
export async function syncProfilesToCollaborators(adminClient?: any) {
  try {
    const sb = adminClient || createAdminClient();
    const cleanDoc = (d: any) =>
      (d || "").toString().replace(/[^0-9a-zA-Z]/g, "").trim();

    const [{ data: profiles }, { data: collabs }] = await Promise.all([
      sb
        .from("profiles")
        .select(
          "id, company_id, first_name, last_name, email, phone, position_id, document_type, document_number, active, collaborator_id"
        ),
      sb.from("collaborators").select("id, document_number"),
    ]);

    if (!profiles || profiles.length === 0) return;

    const collabByDoc = new Map<string, string>();
    (collabs || []).forEach((c: any) => {
      const cd = cleanDoc(c.document_number);
      if (cd) collabByDoc.set(cd, c.id);
    });

    const toInsert: any[] = [];
    for (const p of profiles) {
      const cd = cleanDoc(p.document_number);
      if (!cd) continue;
      if (collabByDoc.has(cd)) continue;

      toInsert.push({
        company_id: p.company_id || "11111111-0000-0000-0000-000000000001",
        document_type: p.document_type || "CC",
        document_number: p.document_number.toString().trim(),
        first_name: (p.first_name || "").trim(),
        last_name: (p.last_name || "").trim(),
        email: p.email || null,
        phone: p.phone || null,
        position_id: p.position_id || null,
        area_id: "c3d87931-05d5-47ec-8c9b-9aac0409d63c",
        status: p.active === false ? "inactivo" : "activo",
        active: p.active !== false,
        hire_date: "2025-01-01",
      });
      // Evitar duplicados si dos perfiles comparten documento
      collabByDoc.set(cd, "pending");
    }

    if (toInsert.length > 0) {
      const { data: inserted } = await sb
        .from("collaborators")
        .insert(toInsert)
        .select("id, document_number");

      if (inserted && inserted.length > 0) {
        for (const ins of inserted) {
          const cd = cleanDoc(ins.document_number);
          const prof = profiles.find((p: any) => cleanDoc(p.document_number) === cd);
          if (prof && !prof.collaborator_id) {
            await sb
              .from("profiles")
              .update({ collaborator_id: ins.id })
              .eq("id", prof.id);
          }
        }
      }
    }
  } catch (err) {
    console.warn("syncProfilesToCollaborators warning:", err);
  }
}

export interface LeaderScope {
  isLeader: boolean;
  userId: string | null;
  roleName: string;
  assignedCollaboratorIds: Set<string>;
}

/**
 * Obtiene el alcance de visibilidad para el usuario autenticado.
 * Si el usuario tiene el rol 'lider', retorna los IDs de sus colaboradores asignados
 * en evaluation_assignments (y evaluados directamente) para restringir la visualización
 * en todos los módulos exclusivamente a sus colaboradores asignados.
 */
export async function getCurrentLeaderScope(year?: number): Promise<LeaderScope> {
  const assignedCollaboratorIds = new Set<string>();
  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id || null;

    if (!userId) {
      return { isLeader: false, userId: null, roleName: "", assignedCollaboratorIds };
    }

    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, roles(name)")
      .eq("id", userId)
      .maybeSingle();

    const roleObj = Array.isArray(profile?.roles) ? profile?.roles[0] : (profile?.roles as any);
    const roleName = (roleObj?.name || "").toLowerCase();

    if (roleName !== "lider") {
      return { isLeader: false, userId, roleName, assignedCollaboratorIds };
    }

    // Consultar asignaciones de evaluación para este líder
    let assignmentsQuery = adminClient
      .from("evaluation_assignments")
      .select("collaborator_id")
      .eq("evaluator_id", userId);

    if (year) {
      assignmentsQuery = assignmentsQuery.eq("evaluation_year", year);
    }

    const [asgRes, evalsRes] = await Promise.all([
      assignmentsQuery,
      adminClient
        .from("evaluations")
        .select("evaluatee_id")
        .eq("evaluator_id", userId),
    ]);

    if (asgRes.data) {
      asgRes.data.forEach((row: any) => {
        if (row.collaborator_id) assignedCollaboratorIds.add(row.collaborator_id);
      });
    }

    if (evalsRes.data) {
      evalsRes.data.forEach((row: any) => {
        if (row.evaluatee_id) assignedCollaboratorIds.add(row.evaluatee_id);
      });
    }

    return {
      isLeader: true,
      userId,
      roleName,
      assignedCollaboratorIds,
    };
  } catch (err) {
    console.warn("getCurrentLeaderScope warning:", err);
    return { isLeader: false, userId: null, roleName: "", assignedCollaboratorIds };
  }
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: resilientFetch,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — cookies set in middleware
          }
        },
      },
    }
  );
}

export async function createServiceClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: resilientFetch,
      },
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
