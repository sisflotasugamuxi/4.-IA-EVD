"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { usePathname, useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { getCurrentUserRoleAndPermissions, UserPermissionItem } from "@/app/actions/admin";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [roleDisplayName, setRoleDisplayName] = useState<string>("");
  const [userPermissions, setUserPermissions] = useState<Record<string, UserPermissionItem>>({});
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  // Inactivity timeout: 15 minutes
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        try {
          console.log("Inactividad detectada. Cerrando sesión...");
          const { logoutAction } = await import("@/app/actions/auth");
          await logoutAction();
          // Force client-side redirect to login with inactivity flag
          window.location.href = "/login?expired=inactivity";
        } catch (err) {
          console.error("Error al cerrar sesión por inactividad:", err);
        }
      }, 15 * 60 * 1000); // 15 minutes
    };

    // Events to track user activity
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"];

    // Initialize timer
    resetTimer();

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, []);

  const loadRoleAndPermissions = async () => {
    try {
      const res = await getCurrentUserRoleAndPermissions();
      if (res.profile) {
        setUserProfile(res.profile);
      }
      if (res.role) {
        setUserRole(res.role.name);
        setRoleDisplayName(res.role.display_name);
      }
      if (res.permissions) {
        setUserPermissions(res.permissions);
      }
    } catch (err) {
      console.error("Error checking role and permissions in layout:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRoleAndPermissions();

    const handlePermUpdate = () => {
      loadRoleAndPermissions();
    };
    window.addEventListener("permissions-updated", handlePermUpdate);
    return () => window.removeEventListener("permissions-updated", handlePermUpdate);
  }, []);

  // Determinar módulo y nombre de sección basado en la ruta actual
  const getModuleInfo = (path: string): { module: string; sectionName: string } | null => {
    if (path.startsWith("/configuracion")) {
      return { module: "configuracion", sectionName: "Configuración" };
    }
    if (path.startsWith("/administracion/asignaciones")) {
      return { module: "evaluaciones", sectionName: "Asignación Evaluaciones" };
    }
    if (path.startsWith("/administracion")) {
      if (userRole === "lider" && path.startsWith("/administracion/usuarios")) {
        return null;
      }
      return { module: "administracion", sectionName: "Administración" };
    }
    if (path.startsWith("/auditoria")) {
      return { module: "auditoria", sectionName: "Auditoría" };
    }
    if (path.startsWith("/reportes")) {
      return { module: "reportes", sectionName: "Reportes" };
    }
    if (path.startsWith("/colaboradores")) {
      return { module: "colaboradores", sectionName: "Colaboradores" };
    }
    if (path.startsWith("/evaluaciones")) {
      return { module: "evaluaciones", sectionName: "Evaluaciones" };
    }
    if (path.startsWith("/pmi")) {
      return { module: "pmi", sectionName: "Planes de Mejora (PMI)" };
    }
    return null;
  };

  const moduleInfo = getModuleInfo(pathname);
  const isSuperAdmin = userRole === "admin";

  let isRestricted = false;
  let restrictedReason = "";

  if (!isSuperAdmin && moduleInfo) {
    const perm = userPermissions[moduleInfo.module];

    // 1. Si en la base de datos se configuró can_view = false para este módulo
    if (perm && perm.can_view === false) {
      isRestricted = true;
      restrictedReason = `Tu rol de ${roleDisplayName || userRole || "usuario"} no tiene permisos para visualizar ni editar la sección de ${moduleInfo.sectionName}.`;
    } 
    // 2. Restricción si es ruta de creación (/nuevo, /nueva) y can_create = false
    else if (perm && perm.can_create === false && (pathname === "/colaboradores/nuevo" || pathname === "/evaluaciones/nueva")) {
      isRestricted = true;
      restrictedReason = `Tu rol de ${roleDisplayName || userRole || "usuario"} no tiene permisos para crear nuevos registros en la sección de ${moduleInfo.sectionName}.`;
    }
    // 3. Restricción si es ruta de edición (/editar) y can_edit = false
    else if (perm && perm.can_edit === false && pathname.endsWith("/editar")) {
      isRestricted = true;
      restrictedReason = `Tu rol de ${roleDisplayName || userRole || "usuario"} no tiene permisos para editar registros en la sección de ${moduleInfo.sectionName}.`;
    }
    // 4. Reglas de compatibilidad históricas si aún no hay permisos cargados en la BD
    else if (userRole === "colaborador" && (moduleInfo.module === "colaboradores" || moduleInfo.module === "evaluaciones" || moduleInfo.module === "administracion" || moduleInfo.module === "configuracion" || moduleInfo.module === "auditoria")) {
      isRestricted = true;
      restrictedReason = `Tu rol de ${roleDisplayName || "Colaborador"} no tiene permisos para acceder a esta sección.`;
    } else if (userRole === "lider" && (moduleInfo.module === "configuracion" || moduleInfo.module === "auditoria" || (moduleInfo.module === "administracion" && !pathname.startsWith("/administracion/usuarios")))) {
      isRestricted = true;
      restrictedReason = `Tu rol de ${roleDisplayName || "Líder"} no tiene permisos para acceder a ${moduleInfo.sectionName}.`;
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Validando credenciales y permisos...</p>
      </div>
    );
  }

  if (isRestricted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-danger-200 dark:border-danger-900/30 p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-danger-100 dark:bg-danger-900/20 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-danger-600 dark:text-danger-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-danger-700 dark:text-danger-300">Acceso Restringido</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {restrictedReason}
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 px-5 py-2.5 text-sm font-semibold transition-all shadow-sm cursor-pointer"
          >
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {!sidebarCollapsed && (
        <div 
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onItemClick={() => setSidebarCollapsed(true)}
        userRole={userRole}
        userPermissions={userPermissions}
      />
      <Topbar
        collapsed={sidebarCollapsed}
        onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        title={title}
      />
      <main
        className={cn(
          "pt-14 min-h-screen transition-all duration-300 ease-in-out flex flex-col justify-between",
          sidebarCollapsed ? "md:pl-[72px]" : "md:pl-[260px]"
        )}
      >
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto w-full">
          {children}
        </div>
        <footer className="py-4 text-center border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-card/10">
          <p className="text-[11px] text-muted-foreground font-medium">
            Desarrollado por Julián Salgado | Flota Sugamuxi S.A.
          </p>
        </footer>
      </main>
    </div>
  );
}
