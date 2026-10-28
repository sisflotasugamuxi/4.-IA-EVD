"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, Search, Edit2, Shield, Mail, Phone,
  X, Save, Loader2, UserCheck, UserX, Eye, EyeOff, Briefcase, KeyRound
} from "lucide-react";
import { getProfiles, updateProfile, inviteUser, getRoles, resetUserPassword, getCurrentUserProfile } from "@/app/actions/admin";
import { getPositions } from "@/app/actions/config";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SignatureInput } from "@/components/ui/signature-input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { LoadingProgress, useLoadingProgress } from "@/components/ui/loading-progress";

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  active: boolean;
  role_id?: string;
  roles?: { id: string; name: string; display_name: string };
  position_id?: string;
  positions?: { id: string; name: string };
  created_at: string;
  avatar_url?: string;
  document_type?: string;
  document_number?: string;
}

interface Role {
  id: string;
  name: string;
  display_name: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700 border-purple-200",
  rrhh: "bg-blue-100 text-blue-700 border-blue-200",
  gerencia: "bg-amber-100 text-amber-700 border-amber-200",
  lider: "bg-teal-100 text-teal-700 border-teal-200",
  colaborador: "bg-slate-100 text-slate-700 border-slate-200",
};

function UserModal({
  user,
  roles,
  positions,
  isAdmin,
  currentUserRole,
  onClose,
  onSave,
}: {
  user: UserProfile | null;
  roles: Role[];
  positions: any[];
  isAdmin: boolean;
  currentUserRole: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const isEdit = !!user;
  const isLider = currentUserRole === "lider";
  const [formData, setFormData] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    email: user?.email || "",
    password: "",
    confirmPassword: "",
    phone: user?.phone || "",
    role_id: user?.role_id || user?.roles?.id || "",
    position_id: user?.position_id || user?.positions?.id || "",
    active: user?.active ?? true,
    avatar_url: user?.avatar_url || "",
    document_type: user?.document_type || "",
    document_number: user?.document_number || "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedDataPolicy, setAcceptedDataPolicy] = useState(!!user?.avatar_url);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      toast.error("El nombre y apellido son obligatorios");
      return;
    }

    if (formData.avatar_url && !acceptedDataPolicy) {
      toast.error("Debes aceptar la política de tratamiento de datos personales (Habeas Data) para poder guardar la firma.");
      return;
    }

    if (formData.password) {
      if (formData.password !== formData.confirmPassword) {
        toast.error("Las contraseñas no coinciden");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isEdit && user) {
        const result = await updateProfile(user.id, {
          email: formData.email.trim() || undefined,
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          phone: formData.phone.trim() || undefined,
          role_id: formData.role_id || undefined,
          position_id: formData.position_id || null,
          active: formData.active,
          avatar_url: formData.avatar_url || null,
          document_type: formData.document_type || null,
          document_number: formData.document_number.trim() || null,
        });
        if (result.error) throw new Error(result.error);

        if (formData.password) {
          const resetRes = await resetUserPassword(user.id, formData.password.trim());
          if (resetRes?.error) {
            throw new Error(`Perfil actualizado, pero no se pudo cambiar la contraseña: ${resetRes.error}`);
          }
        }

        toast.success("Usuario actualizado correctamente");
      } else {
        if (!formData.email.trim()) {
          toast.error("El correo electrónico es obligatorio para crear un usuario");
          setIsSubmitting(false);
          return;
        }
        const result = await inviteUser({
          email: formData.email.trim(),
          password: formData.password?.trim() || undefined,
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          phone: formData.phone.trim() || undefined,
          role_id: formData.role_id || undefined,
          position_id: formData.position_id || undefined,
          avatar_url: formData.avatar_url || null,
          document_type: formData.document_type || null,
          document_number: formData.document_number.trim() || null,
        });
        if (result.error) throw new Error(result.error);
        toast.success("Usuario creado correctamente");
      }
      onSave();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar el usuario");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-lg">
              {isEdit ? "Editar Usuario" : "Nuevo Usuario"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nombres *</label>
              <input
                required
                disabled={isLider}
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className={cn(
                  "w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30",
                  isLider && "opacity-60 cursor-not-allowed"
                )}
                placeholder="Carlos Alberto"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Apellidos *</label>
              <input
                required
                disabled={isLider}
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className={cn(
                  "w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30",
                  isLider && "opacity-60 cursor-not-allowed"
                )}
                placeholder="Martínez Rojas"
              />
            </div>
          </div>

          {/* Document Type and Document Number */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5 col-span-1">
              <label className="text-sm font-medium">Tipo Doc.</label>
              <select
                disabled={isLider}
                value={formData.document_type}
                onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
                className={cn(
                  "w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30",
                  isLider && "opacity-60 cursor-not-allowed"
                )}
              >
                <option value="">Ninguno</option>
                <option value="CC">Cédula Ciudadanía</option>
                <option value="CE">Cédula Extranjería</option>
                <option value="TI">Tarjeta Identidad</option>
                <option value="PP">Pasaporte</option>
                <option value="NIT">NIT</option>
                <option value="RUT">RUT</option>
              </select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-sm font-medium">Número de Documento</label>
              <input
                disabled={isLider}
                value={formData.document_number}
                onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                className={cn(
                  "w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30",
                  isLider && "opacity-60 cursor-not-allowed"
                )}
                placeholder="Ej: 1012345678"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Correo Electrónico {!isEdit && "*"}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={isLider || (isEdit && !isAdmin)}
                className={cn(
                  "w-full h-10 rounded-lg border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30",
                  (isLider || (isEdit && !isAdmin)) && "opacity-60 cursor-not-allowed"
                )}
                placeholder="usuario@empresa.com"
              />
            </div>
            {isEdit && !isAdmin && (
              <p className="text-xs text-muted-foreground">El correo no puede modificarse</p>
            )}
          </div>

          {(!isEdit || isAdmin) && !isLider && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {isEdit ? "Nueva Contraseña (Opcional)" : "Contraseña (Opcional)"}
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full h-10 rounded-lg border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder={isEdit ? "Dejar en blanco para no cambiar" : "Si no se ingresa, se usará Sugamuxi2026*"}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Confirmación de la contraseña
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full h-10 rounded-lg border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder={isEdit ? "Confirmar nueva contraseña" : "Confirmar contraseña"}
                  />
                </div>
              </div>
            </>
          )}

          {/* Phone */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Teléfono</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="tel"
                disabled={isLider}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={cn(
                  "w-full h-10 rounded-lg border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30",
                  isLider && "opacity-60 cursor-not-allowed"
                )}
                placeholder="3001234567"
              />
            </div>
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Rol del Sistema</label>
            <select
              disabled={isLider}
              value={formData.role_id}
              onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
              className={cn(
                "w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30",
                isLider && "opacity-60 cursor-not-allowed"
              )}
            >
              <option value="">Sin rol asignado</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.display_name}
                </option>
              ))}
            </select>
          </div>

          {/* Cargo */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Cargo de la Empresa</label>
            <SearchableSelect
              options={positions.map((p) => ({
                value: p.id,
                label: `${p.name}${p.areas?.name ? ` (${p.areas.name})` : ""}`
              }))}
              value={formData.position_id}
              onChange={(val) => setFormData({ ...formData, position_id: val })}
              placeholder="Sin cargo asignado"
              disabled={isLider}
            />
          </div>

          {/* Signature */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Firma del Evaluador</label>
            <SignatureInput
              value={formData.avatar_url || null}
              onChange={(val) => setFormData({ ...formData, avatar_url: val || "" })}
              placeholder="Firme con su mouse/pantalla táctil o cargue una imagen"
            />
            {formData.avatar_url && (
              <div className="flex items-start gap-2.5 pt-2">
                <input
                  type="checkbox"
                  id="data-treatment-policy"
                  checked={acceptedDataPolicy}
                  onChange={(e) => setAcceptedDataPolicy(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                />
                <label htmlFor="data-treatment-policy" className="text-xs text-muted-foreground leading-normal select-none cursor-pointer">
                  Acepto la{" "}
                  <a
                    href="https://flotasugamuxisa.com.co/privacidad/#habeas-data"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:text-brand-700 font-semibold underline"
                  >
                    política de tratamiento de datos personales (Habeas Data)
                  </a>{" "}
                  para el registro, almacenamiento y uso de esta firma digital. <span className="text-danger-500">*</span>
                </label>
              </div>
            )}
          </div>

          {/* Active toggle */}
          {isEdit && (
            <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20">
              <div>
                <p className="font-medium text-sm">Estado del usuario</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Los usuarios inactivos no pueden acceder al sistema
                </p>
              </div>
              <button
                type="button"
                disabled={isLider}
                onClick={() => setFormData({ ...formData, active: !formData.active })}
                className={cn(
                  "relative w-12 h-6 rounded-full transition-colors",
                  formData.active ? "bg-success-500" : "bg-muted-foreground/40",
                  isLider && "opacity-50 cursor-not-allowed"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                    formData.active && "translate-x-6"
                  )}
                />
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl gradient-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSubmitting ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear Usuario"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function UsuariosPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoading: showLoading, progress: loadProgress } = useLoadingProgress(isLoading);
  const [search, setSearch] = useState("");
  const [modalUser, setModalUser] = useState<UserProfile | null | "new">(undefined as any);
  const [showModal, setShowModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>("");

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (currentUserRole === "lider") {
      router.push("/perfil");
    }
  }, [currentUserRole, router]);

  async function loadAll() {
    setIsLoading(true);
    try {
      const [usersRes, rolesRes, positionsData, currentUserProfileRes] = await Promise.all([
        getProfiles(),
        getRoles(),
        getPositions(),
        getCurrentUserProfile(),
      ]);

      if (usersRes.error) {
        toast.error(`Error al cargar usuarios: ${usersRes.error}`);
      }
      if (rolesRes.error) {
        toast.error(`Error al cargar roles: ${rolesRes.error}`);
      }

      setUsers((usersRes.data as UserProfile[]) || []);
      setRoles((rolesRes.data as Role[]) || []);
      setPositions(positionsData || []);
      if (currentUserProfileRes?.data) {
        const profile = currentUserProfileRes.data;
        setCurrentUser(profile);
        const ROLE_MAP: Record<string, string> = {
          "22222222-0000-0000-0000-000000000001": "admin",
          "22222222-0000-0000-0000-000000000002": "rrhh",
          "22222222-0000-0000-0000-000000000003": "gerencia",
          "22222222-0000-0000-0000-000000000004": "lider",
          "22222222-0000-0000-0000-000000000005": "colaborador"
        };
        const resolvedRole = profile.roles?.name || ROLE_MAP[profile.role_id];
        setCurrentUserRole(resolvedRole || "");
      }
    } catch (err) {
      toast.error("Error al cargar usuarios");
    } finally {
      setIsLoading(false);
    }
  }

  function openNew() {
    setModalUser(null);
    setShowModal(true);
  }

  function openEdit(user: UserProfile) {
    setModalUser(user);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setModalUser(undefined as any);
  }

  async function handleToggleActive(user: UserProfile) {
    const result = await updateProfile(user.id, { active: !user.active });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(user.active ? "Usuario desactivado" : "Usuario activado");
      loadAll();
    }
  }

  // handleResetPassword removed, password updates are done inside Edit modal

  const isAdmin = currentUserRole === "admin";

  const filtered = users.filter((u) => {
    const term = search.trim().toLowerCase();
    const fullName = `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase();
    const docNum = String(u.document_number || "").toLowerCase();
    const docWithType = `${u.document_type || ""} ${u.document_number || ""}`.toLowerCase();

    // If the role is lider, they only see themselves
    if (currentUserRole === "lider" && currentUser && u.id !== currentUser.id) {
      return false;
    }

    if (!term) return true;

    return (
      fullName.includes(term) ||
      docNum.includes(term) ||
      docWithType.includes(term) ||
      (u.email || "").toLowerCase().includes(term) ||
      (u.roles?.display_name || "").toLowerCase().includes(term) ||
      (u.positions?.name || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-500" />
            Usuarios del Sistema
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Administra los accesos y cuentas de la plataforma
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, documento, correo o cargo..."
              className="w-full h-10 pl-9 pr-4 text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {isAdmin && (
            <button
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-md whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Nuevo Usuario
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total usuarios", value: users.length, color: "text-brand-600" },
          { label: "Activos", value: users.filter((u) => u.active).length, color: "text-success-600" },
          { label: "Inactivos", value: users.filter((u) => !u.active).length, color: "text-danger-600" },
          { label: "Roles distintos", value: new Set(users.map((u) => u.roles?.name).filter(Boolean)).size, color: "text-amber-600" },
        ].map((stat) => (
          <div key={stat.label} className="p-4 rounded-xl border bg-card text-center">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* User grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {showLoading ? (
          <div className="col-span-full py-6">
            <LoadingProgress
              icon={Users}
              title="Cargando usuarios del sistema..."
              description="Consultando perfiles, roles y permisos activos..."
              progress={loadProgress}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-16 flex flex-col items-center justify-center border-2 border-dashed rounded-xl">
            <Users className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">No se encontraron usuarios</p>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="mt-2 text-sm text-brand-500 hover:underline"
              >
                Limpiar búsqueda
              </button>
            )}
          </div>
        ) : (
          filtered.map((user) => {
            const roleName = user.roles?.name || "";
            const roleColor = ROLE_COLORS[roleName] || "bg-muted text-muted-foreground border-border";
            const initials = `${user.first_name?.charAt(0) || ""}${user.last_name?.charAt(0) || ""}`;

            return (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-xl border bg-card hover:shadow-md transition-all relative overflow-hidden group"
              >
                {/* Background accent */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-bl-full -z-10" />

                {/* Top section */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full gradient-brand flex items-center justify-center text-white font-bold text-lg shadow-md shadow-brand-500/20">
                      {initials || "?"}
                    </div>
                    <div>
                      <h3 className="font-semibold leading-tight">
                        {user.first_name} {user.last_name}
                      </h3>
                      {user.roles && (
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border mt-0.5",
                          roleColor
                        )}>
                          <Shield className="w-2.5 h-2.5" />
                          {user.roles.display_name}
                        </span>
                      )}
                      {user.positions && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border mt-0.5 bg-muted text-muted-foreground ml-1">
                          <Briefcase className="w-2.5 h-2.5" />
                          {user.positions.name}
                        </span>
                      )}
                    </div>
                  </div>
              {/* Reset password button removed from card list */}
                  <button
                    onClick={() => openEdit(user)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-colors opacity-0 group-hover:opacity-100"
                    title="Editar usuario"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Info */}
                <div className="space-y-1.5 mb-4">
                  {user.document_number && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-bold border border-border flex-shrink-0">
                        {user.document_type || "CC"}
                      </span>
                      <span className="font-semibold text-foreground/90">{user.document_number}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  {user.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{user.phone}</span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <button
                    onClick={() => handleToggleActive(user)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all hover:scale-105",
                      user.active
                        ? "bg-success-100 text-success-700 hover:bg-success-200"
                        : "bg-danger-100 text-danger-700 hover:bg-danger-200"
                    )}
                    title={user.active ? "Desactivar usuario" : "Activar usuario"}
                  >
                    {user.active ? (
                      <UserCheck className="w-3 h-3" />
                    ) : (
                      <UserX className="w-3 h-3" />
                    )}
                    {user.active ? "ACTIVO" : "INACTIVO"}
                  </button>

                  <button
                    onClick={() => openEdit(user)}
                    className="text-xs text-brand-500 hover:underline font-medium"
                  >
                    Editar →
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <UserModal
            user={modalUser as UserProfile | null}
            roles={roles}
            positions={positions}
            isAdmin={isAdmin}
            currentUserRole={currentUserRole}
            onClose={closeModal}
            onSave={loadAll}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
