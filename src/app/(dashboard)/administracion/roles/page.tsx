"use client";

import React, { useState, useEffect } from "react";
import {
  Shield, Key, Edit2, Save, X, Loader2,
  Check, Eye, Pencil, Trash2, Download, ThumbsUp,
  ChevronDown, ChevronUp, CheckSquare, Square
} from "lucide-react";
import { getRoles, updateRole, getPermissions, updatePermissions } from "@/app/actions/admin";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Role {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  active: boolean;
}

interface Permission {
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
  can_approve: boolean;
}

const MODULE_LABELS: Record<string, string> = {
  colaboradores: "Colaboradores",
  evaluaciones: "Evaluaciones",
  configuracion: "Configuración",
  pmi: "Planes de Mejora (PMI)",
  reportes: "Reportes",
  auditoria: "Auditoría",
  administracion: "Administración",
  dashboard: "Dashboard",
};

const ALL_MODULES = Object.keys(MODULE_LABELS);

const PERM_COLS: Array<{ key: keyof Omit<Permission, "module">; label: string; Icon: React.ElementType }> = [
  { key: "can_view",    label: "Ver",      Icon: Eye },
  { key: "can_create",  label: "Crear",    Icon: Pencil },
  { key: "can_edit",    label: "Editar",   Icon: Edit2 },
  { key: "can_delete",  label: "Eliminar", Icon: Trash2 },
  { key: "can_export",  label: "Exportar", Icon: Download },
  { key: "can_approve", label: "Aprobar",  Icon: ThumbsUp },
];

type RoleColorKey = "purple" | "blue" | "amber" | "teal" | "slate";

const ROLE_COLOR_MAP: Record<string, RoleColorKey> = {
  admin: "purple",
  rrhh: "blue",
  gerencia: "amber",
  lider: "teal",
  colaborador: "slate",
};

const ROLE_STYLES: Record<RoleColorKey, {
  cardBg: string;
  cardBorder: string;
  text: string;
  tagBg: string;
  tagText: string;
  tagBorder: string;
  iconBg: string;
  headerBg: string;
}> = {
  purple: {
    cardBg: "bg-purple-50/60 dark:bg-purple-950/20",
    cardBorder: "border-purple-300 dark:border-purple-800",
    text: "text-purple-700 dark:text-purple-300",
    tagBg: "bg-purple-100 dark:bg-purple-900/40",
    tagText: "text-purple-800 dark:text-purple-200",
    tagBorder: "border-purple-300 dark:border-purple-700",
    iconBg: "bg-purple-600",
    headerBg: "bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800",
  },
  blue: {
    cardBg: "bg-blue-50/60 dark:bg-blue-950/20",
    cardBorder: "border-blue-300 dark:border-blue-800",
    text: "text-blue-700 dark:text-blue-300",
    tagBg: "bg-blue-100 dark:bg-blue-900/40",
    tagText: "text-blue-800 dark:text-blue-200",
    tagBorder: "border-blue-300 dark:border-blue-700",
    iconBg: "bg-blue-600",
    headerBg: "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800",
  },
  amber: {
    cardBg: "bg-amber-50/60 dark:bg-amber-950/20",
    cardBorder: "border-amber-300 dark:border-amber-800",
    text: "text-amber-700 dark:text-amber-300",
    tagBg: "bg-amber-100 dark:bg-amber-900/40",
    tagText: "text-amber-800 dark:text-amber-200",
    tagBorder: "border-amber-300 dark:border-amber-700",
    iconBg: "bg-amber-600",
    headerBg: "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800",
  },
  teal: {
    cardBg: "bg-teal-50/60 dark:bg-teal-950/20",
    cardBorder: "border-teal-300 dark:border-teal-800",
    text: "text-teal-700 dark:text-teal-300",
    tagBg: "bg-teal-100 dark:bg-teal-900/40",
    tagText: "text-teal-800 dark:text-teal-200",
    tagBorder: "border-teal-300 dark:border-teal-700",
    iconBg: "bg-teal-600",
    headerBg: "bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800",
  },
  slate: {
    cardBg: "bg-slate-50/60 dark:bg-slate-900/20",
    cardBorder: "border-slate-300 dark:border-slate-700",
    text: "text-slate-700 dark:text-slate-300",
    tagBg: "bg-slate-100 dark:bg-slate-800/60",
    tagText: "text-slate-800 dark:text-slate-200",
    tagBorder: "border-slate-300 dark:border-slate-600",
    iconBg: "bg-slate-600",
    headerBg: "bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700",
  },
};

// ─── Checkbox toggle component ─────────────────────────────────────────────
function PermCheckbox({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        "w-6 h-6 rounded-md border-2 flex items-center justify-center mx-auto transition-all",
        value
          ? "bg-brand-500 border-brand-500 text-white shadow-sm shadow-brand-500/30"
          : "border-muted-foreground/30 hover:border-brand-400 bg-background"
      )}
    >
      {value && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
    </button>
  );
}

// ─── Inline role editor panel ──────────────────────────────────────────────
function RoleEditorPanel({
  role,
  onClose,
  onSave,
}: {
  role: Role;
  onClose: () => void;
  onSave: () => void;
}) {
  const colorKey = ROLE_COLOR_MAP[role.name] ?? "slate";
  const styles = ROLE_STYLES[colorKey];

  const [displayName, setDisplayName] = useState(role.display_name);
  const [description, setDescription] = useState(role.description ?? "");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoadingPerms, setIsLoadingPerms] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoadingPerms(true);
      try {
        const { data } = await getPermissions(role.id);
        if (cancelled) return;
        const existing = new Map((data ?? []).map((p: any) => [p.module, p]));
        const full: Permission[] = ALL_MODULES.map((mod) => ({
          module: mod,
          can_view:    existing.get(mod)?.can_view    ?? false,
          can_create:  existing.get(mod)?.can_create  ?? false,
          can_edit:    existing.get(mod)?.can_edit    ?? false,
          can_delete:  existing.get(mod)?.can_delete  ?? false,
          can_export:  existing.get(mod)?.can_export  ?? false,
          can_approve: existing.get(mod)?.can_approve ?? false,
        }));
        setPermissions(full);
      } catch {
        toast.error("Error cargando permisos");
      } finally {
        if (!cancelled) setIsLoadingPerms(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [role.id]);

  function toggleCell(module: string, key: keyof Omit<Permission, "module">) {
    setPermissions((prev) =>
      prev.map((p) => p.module === module ? { ...p, [key]: !p[key] } : p)
    );
  }

  function toggleColumn(key: keyof Omit<Permission, "module">) {
    const allOn = permissions.every((p) => p[key]);
    setPermissions((prev) => prev.map((p) => ({ ...p, [key]: !allOn })));
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const r1 = await updateRole(role.id, { display_name: displayName, description });
      if (r1.error) throw new Error(r1.error);
      const r2 = await updatePermissions(role.id, permissions);
      if (r2.error) throw new Error(r2.error);
      toast.success("Rol y permisos guardados");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("permissions-updated"));
      }
      onSave();
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? "Error al guardar");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={cn(
      "rounded-xl border bg-card shadow-lg overflow-hidden mt-1",
    )}>
      {/* Panel header */}
      <div className={cn("px-6 py-4 border-b flex items-center justify-between", styles.headerBg)}>
        <div className="flex items-center gap-3">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white", styles.iconBg)}>
            <Shield className="w-4 h-4" />
          </div>
          <span className={cn("font-bold text-sm", styles.text)}>
            Editando: {role.display_name}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Basic info fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Nombre visible</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Descripción</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del rol..."
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
            />
          </div>
        </div>

        {/* Permissions matrix */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand-500" />
            <h4 className="text-sm font-bold text-foreground">Matriz de Permisos por Módulo</h4>
          </div>

          {isLoadingPerms ? (
            <div className="flex items-center justify-center py-10 gap-3 text-muted-foreground border rounded-xl bg-muted/20">
              <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
              <span className="text-sm">Cargando permisos del rol...</span>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  {/* Header row */}
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground min-w-[180px]">
                        Módulo
                      </th>
                      {PERM_COLS.map(({ key, label, Icon }) => (
                        <th key={key} className="px-2 py-3 text-center min-w-[64px]">
                          <div className="flex flex-col items-center gap-1">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                              {label}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                    {/* Toggle-all row */}
                    <tr className="bg-muted/25 border-b">
                      <td className="px-4 py-2 text-xs font-semibold text-muted-foreground italic">
                        ↳ Marcar / desmarcar columna
                      </td>
                      {PERM_COLS.map(({ key }) => {
                        const allOn = permissions.length > 0 && permissions.every((p) => p[key]);
                        return (
                          <td key={key} className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => toggleColumn(key)}
                              title={allOn ? "Desmarcar todos" : "Marcar todos"}
                              className="mx-auto block text-muted-foreground hover:text-brand-500 transition-colors"
                            >
                              {allOn
                                ? <CheckSquare className="w-5 h-5 text-brand-500" />
                                : <Square className="w-5 h-5" />
                              }
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  </thead>

                  {/* Data rows */}
                  <tbody>
                    {permissions.map((perm, idx) => (
                      <tr
                        key={perm.module}
                        className={cn(
                          "border-b last:border-0 hover:bg-muted/30 transition-colors",
                          idx % 2 === 0 ? "bg-background" : "bg-muted/10"
                        )}
                      >
                        <td className="px-4 py-3 font-medium text-foreground">
                          {MODULE_LABELS[perm.module] ?? perm.module}
                        </td>
                        {PERM_COLS.map(({ key }) => (
                          <td key={key} className="px-2 py-3 text-center">
                            <PermCheckbox
                              value={perm[key] as boolean}
                              onChange={() => toggleCell(perm.module, key)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoadingPerms}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl gradient-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-md"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Role summary card ─────────────────────────────────────────────────────
function RoleSummaryCard({
  role,
  isOpen,
  onToggle,
}: {
  role: Role;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const colorKey = ROLE_COLOR_MAP[role.name] ?? "slate";
  const styles = ROLE_STYLES[colorKey];

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "w-full text-left p-5 rounded-xl border-2 transition-all duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40",
        isOpen
          ? `${styles.cardBg} ${styles.cardBorder} shadow-md`
          : "bg-card border-border hover:border-primary/30"
      )}
    >
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0",
          styles.iconBg
        )}>
          <Key className="w-6 h-6" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={cn("font-bold text-base leading-tight", isOpen && styles.text)}>
              {role.display_name}
            </h3>
            <span className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider",
              styles.tagBg, styles.tagText, styles.tagBorder
            )}>
              {role.name}
            </span>
          </div>
          {role.description && (
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
              {role.description}
            </p>
          )}
        </div>

        {/* Chevron */}
        <div className={cn(
          "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
          isOpen ? `${styles.tagBg}` : "bg-muted/50"
        )}>
          {isOpen
            ? <ChevronUp className={cn("w-4 h-4", styles.text)} />
            : <ChevronDown className="w-4 h-4 text-muted-foreground" />
          }
        </div>
      </div>
    </button>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openRoleId, setOpenRoleId] = useState<string | null>(null);

  useEffect(() => {
    loadRoles();
  }, []);

  async function loadRoles() {
    setIsLoading(true);
    try {
      const { data, error } = await getRoles();
      if (error) throw new Error(error as string);
      setRoles((data as Role[]) ?? []);
    } catch (err: any) {
      toast.error(err.message ?? "Error al cargar roles");
    } finally {
      setIsLoading(false);
    }
  }

  function toggle(id: string) {
    setOpenRoleId((prev) => (prev === id ? null : id));
  }

  const openRole = roles.find((r) => r.id === openRoleId) ?? null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-brand-500" />
            Roles y Permisos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configura niveles de acceso y permisos por módulo para cada rol del sistema
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg border self-start whitespace-nowrap">
          <Shield className="w-3.5 h-3.5 flex-shrink-0" />
          Selecciona un rol para editarlo
        </div>
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <div className="w-9 h-9 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
          <p className="text-sm">Cargando roles del sistema...</p>
        </div>
      )}

      {/* ── Role list ── */}
      {!isLoading && roles.length === 0 && (
        <div className="py-16 flex flex-col items-center justify-center border-2 border-dashed rounded-xl text-muted-foreground">
          <Key className="w-12 h-12 opacity-20 mb-3" />
          <p className="font-medium">No hay roles registrados</p>
        </div>
      )}

      {!isLoading && roles.length > 0 && (
        <div className="space-y-3">
          {roles.map((role) => (
            <div key={role.id}>
              <RoleSummaryCard
                role={role}
                isOpen={openRoleId === role.id}
                onToggle={() => toggle(role.id)}
              />
              {openRoleId === role.id && (
                <RoleEditorPanel
                  key={role.id}
                  role={role}
                  onClose={() => setOpenRoleId(null)}
                  onSave={loadRoles}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
