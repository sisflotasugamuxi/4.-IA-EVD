"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { logAudit } from "./audit";
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

export async function createCollaborator(collaboratorData: any) {
  const supabase = await getSupabase();
  const adminClient = getSupabaseAdmin();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("No autenticado");

  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id, collaborator_id, roles(name)")
    .eq("id", userData.user.id)
    .single();

  if (!profile?.company_id) throw new Error("Compañía no encontrada");

  const roleObj = Array.isArray(profile.roles) ? profile.roles[0] : (profile.roles as any);
  const isCreatorLeader = (roleObj?.name || "").toLowerCase() === "lider";
  const creatorCollaboratorId = (profile as any).collaborator_id || null;

  // Format data
  let responsibleManagerId = collaboratorData.responsible_manager_id || (isCreatorLeader ? userData.user.id : null);
  if (responsibleManagerId) {
    const { data: managerProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("id", responsibleManagerId)
      .eq("company_id", profile.company_id)
      .maybeSingle();

    responsibleManagerId = managerProfile?.id || (isCreatorLeader ? userData.user.id : null);
  }

  const dataToInsert = {
    company_id: profile.company_id,
    document_type: collaboratorData.document_type,
    document_number: collaboratorData.document_number,
    first_name: collaboratorData.first_name,
    last_name: collaboratorData.last_name,
    email: collaboratorData.email || null,
    phone: collaboratorData.phone || null,
    address: collaboratorData.address || null,
    city: collaboratorData.city || null,
    birth_date: collaboratorData.birth_date || null,
    gender: collaboratorData.gender || null,
    internal_code: collaboratorData.internal_code || null,
    area_id: collaboratorData.area_id || null,
    position_id: collaboratorData.position_id || null,
    workplace_city: collaboratorData.workplace_city || null,
    workplace: collaboratorData.workplace || null,
    contract_type: collaboratorData.contract_type || null,
    payroll_type: collaboratorData.payroll_type || null,
    hire_date: collaboratorData.hire_date || null,
    status: collaboratorData.status || "activo",
    immediate_boss_id: collaboratorData.immediate_boss_id || (isCreatorLeader ? creatorCollaboratorId : null),
    area_leader_id: collaboratorData.area_leader_id || (isCreatorLeader ? creatorCollaboratorId : null),
    responsible_manager_id: responsibleManagerId,
  };

  const { data, error } = await adminClient
    .from("collaborators")
    .insert(dataToInsert)
    .select()
    .single();

  if (error) {
    console.error("Error creating collaborator:", error);
    return { error: error.message };
  }

  // Si un líder crea el colaborador (o si se especificó un líder responsable), enlazarlo automáticamente en evaluation_assignments
  const targetLeaderProfileId = isCreatorLeader ? userData.user.id : responsibleManagerId;
  if (targetLeaderProfileId && data?.id) {
    try {
      const currentYear = new Date().getFullYear();
      await adminClient
        .from("evaluation_assignments")
        .upsert(
          {
            company_id: profile.company_id,
            evaluation_year: currentYear,
            evaluator_id: targetLeaderProfileId,
            collaborator_id: data.id,
            status: "pendiente",
            notes: isCreatorLeader
              ? "Asignado automáticamente al ser creado por el líder."
              : "Asignado automáticamente al crear el colaborador.",
            assigned_by: userData.user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "evaluation_year,collaborator_id" }
        );
    } catch (asgErr) {
      console.warn("Warning linking new collaborator to leader assignment:", asgErr);
    }
  }

  revalidatePath("/colaboradores");
  revalidatePath("/administracion/asignaciones");
  revalidatePath("/dashboard");
  revalidatePath("/evaluaciones/nueva");
  revalidatePath("/reportes");

  // Registrar en auditoría
  try {
    await logAudit(
      "crear",
      "collaborators",
      data.id,
      `Colaborador creado: ${dataToInsert.first_name} ${dataToInsert.last_name} (${dataToInsert.document_number})${isCreatorLeader ? " y asignado automáticamente al líder creador" : ""}`
    );
  } catch (_) { /* no bloquear */ }

  return { success: true, data };
}

export async function getCollaborators() {
  try {
    const adminClient = getSupabaseAdmin();
    const currentYear = new Date().getFullYear();

    const [collabsRes, evalsRes, scope] = await Promise.all([
      adminClient
        .from("collaborators")
        .select(`
          *,
          areas(name),
          positions(name)
        `)
        .order("created_at", { ascending: false }),
      adminClient
        .from("evaluations")
        .select("id, evaluatee_id, evaluation_year, status, created_at"),
      getCurrentLeaderScope()
    ]);

    if (collabsRes.error) {
      console.error("Error fetching collaborators:", collabsRes.error);
      return { data: [], error: collabsRes.error.message };
    }

    // Set of collaborator IDs who completed or have an evaluation for current year
    const completedCurrentYearCollabs = new Set<string>();

    if (evalsRes.data) {
      evalsRes.data.forEach((ev: any) => {
        const year = ev.evaluation_year || (ev.created_at ? new Date(ev.created_at).getFullYear() : currentYear);
        const collabId = ev.evaluatee_id || (ev as any).collaborator_id;
        if (collabId && Number(year) === currentYear) {
          const st = (ev.status || "").toLowerCase();
          if (st === "finalizada" || st === "pendiente_firma" || st === "completada" || st === "completado" || st === "aprobada" || st === "activo") {
            completedCurrentYearCollabs.add(collabId);
          }
        }
      });
    }

    let sourceCollabs = collabsRes.data || [];
    if (scope.isLeader) {
      sourceCollabs = sourceCollabs.filter((collab: any) => scope.assignedCollaboratorIds.has(collab.id));
    }

    const enhancedData = sourceCollabs.map((collab: any) => ({
      ...collab,
      has_evaluated_current_year: completedCurrentYearCollabs.has(collab.id)
    }));

    return { data: enhancedData, error: null };
  } catch (err: any) {
    console.error("Exception in getCollaborators:", err);
    return { data: [], error: err?.message || "Error al cargar colaboradores" };
  }
}

export async function getCollaboratorById(collaboratorId: string) {
  try {
    const scope = await getCurrentLeaderScope();
    if (scope.isLeader && !scope.assignedCollaboratorIds.has(collaboratorId)) {
      return {
        data: null,
        error: "Acceso restringido: solo puedes visualizar la información de tus colaboradores asignados.",
      };
    }

    const adminClient = getSupabaseAdmin();
    const { data, error } = await adminClient
      .from("collaborators")
      .select(`
        *,
        areas(id, name),
        positions(id, name),
        immediate_boss:collaborators!immediate_boss_id(full_name),
        area_leader:collaborators!area_leader_id(full_name),
        manager:profiles!responsible_manager_id(first_name, last_name)
      `)
      .eq("id", collaboratorId)
      .single();

    if (error) {
      console.error("Error fetching collaborator:", error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    console.error("Exception in getCollaboratorById:", err);
    return { data: null, error: err?.message || "Error al consultar colaborador" };
  }
}

export async function updateCollaborator(collaboratorId: string, updates: any) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("collaborators")
    .update(updates)
    .eq("id", collaboratorId)
    .select(`
      *,
      areas(name),
      positions(name)
    `)
    .single();

  if (error) {
    console.error("Error updating collaborator:", error);
    return { data: null, error: error.message };
  }

  // Sync email update with auth user / profile if they exist
  if (updates.email && data.document_number) {
    try {
      const adminClient = getSupabaseAdmin();
      const { data: profile } = await adminClient
        .from("profiles")
        .select("id, email")
        .eq("company_id", data.company_id)
        .eq("document_number", data.document_number)
        .single();

      if (profile && profile.email?.toLowerCase() !== updates.email.toLowerCase()) {
        console.log(`Syncing email update to auth and profile for user ${profile.id}: ${updates.email}`);
        
        // Update profile
        await adminClient
          .from("profiles")
          .update({ email: updates.email, updated_at: new Date().toISOString() })
          .eq("id", profile.id);

        // Update auth
        await adminClient.auth.admin.updateUserById(profile.id, {
          email: updates.email
        });
      }
    } catch (syncError) {
      console.error("Error syncing email to auth/profile:", syncError);
    }
  }

  revalidatePath("/colaboradores");

  // Registrar en auditoría
  try {
    await logAudit(
      "editar",
      "collaborators",
      collaboratorId,
      `Colaborador actualizado: ID ${collaboratorId}`
    );
  } catch (_) { /* no bloquear */ }

  return { data, error: null };
}

export async function importCollaborators(rows: any[]) {
  const supabase = await getSupabase();
  const adminClient = getSupabaseAdmin();
  
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "No autenticado" };
  
  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id, collaborator_id, roles(name)")
    .eq("id", userData.user.id)
    .single();

  if (!profile?.company_id) return { error: "Compañía no encontrada" };

  const companyId = profile.company_id;
  const roleObj = Array.isArray(profile.roles) ? profile.roles[0] : (profile.roles as any);
  const isCreatorLeader = (roleObj?.name || "").toLowerCase() === "lider";
  const creatorCollaboratorId = (profile as any).collaborator_id || null;

  // Fetch existing areas and positions
  const { data: existingAreas } = await supabase.from("areas").select("id, name").eq("company_id", companyId);
  const { data: existingPositions } = await supabase.from("positions").select("id, name").eq("company_id", companyId);

  let areasMap = new Map((existingAreas || []).map(a => [a.name.toLowerCase(), a.id]));
  let posMap = new Map((existingPositions || []).map(p => [p.name.toLowerCase(), p.id]));

  const recordsToInsert = [];

  for (const row of rows) {
    const areaName = row["area"] || row["Area"] || row["Área"] || row["área"];
    const posName = row["cargo"] || row["Cargo"];
    
    let areaId = null;
    if (areaName) {
      const key = String(areaName).trim().toLowerCase();
      if (areasMap.has(key)) {
        areaId = areasMap.get(key);
      } else {
        const { data: newArea } = await supabase
          .from("areas")
          .insert({ name: String(areaName).trim(), company_id: companyId, code: key.substring(0,3).toUpperCase() })
          .select("id")
          .single();
        if (newArea) {
          areaId = newArea.id;
          areasMap.set(key, areaId);
        }
      }
    }

    let posId = null;
    if (posName) {
      const key = String(posName).trim().toLowerCase();
      if (posMap.has(key)) {
        posId = posMap.get(key);
      } else {
        const { data: newPos } = await supabase
          .from("positions")
          .insert({ name: String(posName).trim(), company_id: companyId })
          .select("id")
          .single();
        if (newPos) {
          posId = newPos.id;
          posMap.set(key, posId);
        }
      }
    }

    // Extract names
    let firstName = "";
    let lastName = "";
    if (row["nombres"]) {
      firstName = String(row["nombres"]).trim();
      lastName = String(row["apellidos"] || "").trim();
    } else if (row["first_name"]) {
      firstName = String(row["first_name"]).trim();
      lastName = String(row["last_name"] || "").trim();
    } else if (row["Nombres Completos"]) {
      const parts = String(row["Nombres Completos"]).trim().split(" ");
      firstName = parts[0] || "";
      lastName = parts.slice(1).join(" ") || "";
    }

    const docType = String(row["tipo_documento"] || row["document_type"] || row["Tipo Documento"] || "CC").toUpperCase();
    const docNum = String(row["numero_documento"] || row["document_number"] || row["Numero Documento"] || row["Número Documento"] || "");
    const email = row["correo"] || row["email"] || row["Email"] ? String(row["correo"] || row["email"] || row["Email"]).trim() : null;
    const phone = row["celular"] || row["phone"] || row["Celular"] ? String(row["celular"] || row["phone"] || row["Celular"]).trim() : null;
    const hireDate = row["fecha_ingreso"] || row["hire_date"] || row["Fecha Ingreso"] ? String(row["fecha_ingreso"] || row["hire_date"] || row["Fecha Ingreso"]).trim() : null;
    const birthDate = row["fecha_nacimiento"] || row["birth_date"] ? String(row["fecha_nacimiento"] || row["birth_date"]).trim() : null;
    const terminationDate = row["fecha_retiro"] || row["termination_date"] ? String(row["fecha_retiro"] || row["termination_date"]).trim() : null;
    const contractType = row["tipo_contrato"] || row["contract_type"] || row["Tipo Contrato"] ? String(row["tipo_contrato"] || row["contract_type"] || row["Tipo Contrato"]).trim().toLowerCase() : null;
    const statusVal = row["estado"] || row["status"] || row["Estado"] ? String(row["estado"] || row["status"] || row["Estado"]).trim().toLowerCase() : "activo";

    recordsToInsert.push({
      company_id: companyId,
      document_type: docType,
      document_number: docNum,
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone: phone,
      area_id: areaId,
      position_id: posId,
      hire_date: hireDate,
      birth_date: birthDate,
      termination_date: terminationDate,
      contract_type: contractType,
      payroll_type: row["payroll_type"] || null,
      status: statusVal,
      ...(isCreatorLeader
        ? {
            responsible_manager_id: userData.user.id,
            ...(creatorCollaboratorId
              ? { immediate_boss_id: creatorCollaboratorId, area_leader_id: creatorCollaboratorId }
              : {}),
          }
        : {}),
    });
  }

  // Bulk upsert
  if (recordsToInsert.length > 0) {
    const { data: upsertedCollabs, error } = await adminClient
      .from("collaborators")
      .upsert(recordsToInsert, { onConflict: 'company_id,document_number' })
      .select("id");

    if (error) {
      console.error("Error bulk upserting:", error);
      return { error: error.message };
    }

    // Si quien importa es un líder, asignar automáticamente los colaboradores importados a este líder
    if (isCreatorLeader && upsertedCollabs && upsertedCollabs.length > 0) {
      try {
        const currentYear = new Date().getFullYear();
        const assignmentsPayload = upsertedCollabs.map((c: any) => ({
          company_id: companyId,
          evaluation_year: currentYear,
          evaluator_id: userData.user.id,
          collaborator_id: c.id,
          status: "pendiente",
          notes: "Asignado automáticamente al ser importado por el líder.",
          assigned_by: userData.user.id,
          updated_at: new Date().toISOString(),
        }));

        await adminClient
          .from("evaluation_assignments")
          .upsert(assignmentsPayload, { onConflict: "evaluation_year,collaborator_id" });
      } catch (asgErr) {
        console.warn("Warning linking imported collaborators to leader:", asgErr);
      }
    }

    // Sync emails with auth / profiles if they exist
    try {
      const adminClient = getSupabaseAdmin();
      const { data: dbProfiles } = await adminClient
        .from("profiles")
        .select("id, email, document_number")
        .eq("company_id", companyId);

      if (dbProfiles && dbProfiles.length > 0) {
        const profilesMap = new Map(dbProfiles.map(p => [p.document_number, p]));
        
        for (const record of recordsToInsert) {
          if (record.email && record.document_number) {
            const profile = profilesMap.get(record.document_number);
            if (profile && profile.email?.toLowerCase() !== record.email.toLowerCase()) {
              console.log(`Syncing bulk email update to auth and profile for user ${profile.id}: ${record.email}`);
              
              // Update profile
              await adminClient
                .from("profiles")
                .update({ email: record.email, updated_at: new Date().toISOString() })
                .eq("id", profile.id);

              // Update auth
              await adminClient.auth.admin.updateUserById(profile.id, {
                email: record.email
              });
            }
          }
        }
      }
    } catch (syncError) {
      console.error("Error syncing bulk emails to auth/profiles:", syncError);
    }
  }

  revalidatePath("/colaboradores");
  return { success: true, count: recordsToInsert.length };
}
