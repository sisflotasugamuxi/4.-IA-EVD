"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Plus, Edit2, Trash2, Save, X, Loader2, AlertTriangle,
  ArrowUpDown, ChevronUp, ChevronDown
} from "lucide-react";
import { getAreas, createArea, updateArea, deleteArea } from "@/app/actions/config";
import { toast } from "sonner";
import { LoadingProgress, useLoadingProgress } from "@/components/ui/loading-progress";

interface Area {
  id: string;
  name: string;
  code?: string;
  description?: string;
  active: boolean;
}

type ModalMode = "create" | "edit" | "delete" | null;

const INITIAL_FORM = { name: "", code: "", description: "" };

export default function AreasPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoading: showLoading, progress: loadProgress } = useLoadingProgress(isLoading);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [sortField, setSortField] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedAreas = [...areas].sort((a, b) => {
    let valA: any = a[sortField as keyof typeof a];
    let valB: any = b[sortField as keyof typeof b];

    if (sortField === "name") {
      valA = (a.name || "").toLowerCase();
      valB = (b.name || "").toLowerCase();
    } else if (sortField === "code") {
      valA = (a.code || "").toLowerCase();
      valB = (b.code || "").toLowerCase();
    } else if (sortField === "description") {
      valA = (a.description || "").toLowerCase();
      valB = (b.description || "").toLowerCase();
    }

    if (valA === undefined || valA === null) return 1;
    if (valB === undefined || valB === null) return -1;

    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  useEffect(() => {
    loadAreas();
  }, []);

  async function loadAreas() {
    setIsLoading(true);
    try {
      const data = await getAreas();
      setAreas((data as Area[]) || []);
    } catch (err) {
      toast.error("Error al cargar áreas");
    } finally {
      setIsLoading(false);
    }
  }

  function openCreate() {
    setFormData(INITIAL_FORM);
    setSelectedArea(null);
    setModalMode("create");
  }

  function openEdit(area: Area) {
    setSelectedArea(area);
    setFormData({
      name: area.name,
      code: area.code || "",
      description: area.description || "",
    });
    setModalMode("edit");
  }

  function openDelete(area: Area) {
    setSelectedArea(area);
    setModalMode("delete");
  }

  function closeModal() {
    setModalMode(null);
    setSelectedArea(null);
    setFormData(INITIAL_FORM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("El nombre del área es obligatorio");
      return;
    }

    setIsSubmitting(true);
    try {
      if (modalMode === "create") {
        const result = await createArea(formData);
        if (result?.error) throw new Error(result.error);
        toast.success("Área creada correctamente");
      } else if (modalMode === "edit" && selectedArea) {
        const result = await updateArea(selectedArea.id, formData);
        if (result?.error) throw new Error(result.error);
        toast.success("Área actualizada correctamente");
      }
      closeModal();
      loadAreas();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar el área");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!selectedArea) return;
    setIsSubmitting(true);
    try {
      const result = await deleteArea(selectedArea.id);
      if (result?.error) throw new Error(result.error);
      toast.success("Área eliminada correctamente");
      closeModal();
      loadAreas();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar el área");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-brand-500" />
            Áreas y Dependencias
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Administra la estructura departamental de la empresa
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-md whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Nueva Área
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border bg-card text-center">
          <p className="text-2xl font-bold text-brand-600">{areas.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total áreas</p>
        </div>
        <div className="p-4 rounded-xl border bg-card text-center">
          <p className="text-2xl font-bold text-success-600">{areas.filter((a) => a.active !== false).length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Activas</p>
        </div>
        <div className="p-4 rounded-xl border bg-card text-center">
          <p className="text-2xl font-bold text-muted-foreground">{areas.filter((a) => a.code).length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Con código</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="px-4 py-3 font-semibold text-muted-foreground cursor-pointer select-none" onClick={() => handleSort("code")}>
                  <div className="flex items-center gap-1 hover:text-foreground transition-colors">
                    Código
                    {sortField === "code" ? (
                      sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-55" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 font-semibold text-muted-foreground cursor-pointer select-none" onClick={() => handleSort("name")}>
                  <div className="flex items-center gap-1 hover:text-foreground transition-colors">
                    Nombre del Área
                    {sortField === "name" ? (
                      sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-55" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell cursor-pointer select-none" onClick={() => handleSort("description")}>
                  <div className="flex items-center gap-1 hover:text-foreground transition-colors">
                    Descripción
                    {sortField === "description" ? (
                      sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-55" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-right select-none">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {showLoading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center">
                    <LoadingProgress
                      icon={Building2}
                      title="Cargando áreas y dependencias..."
                      description="Consultando estructura departamental activa..."
                      progress={loadProgress}
                    />
                  </td>
                </tr>
              ) : areas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-muted-foreground">
                    <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    No hay áreas registradas
                  </td>
                </tr>
              ) : (
                sortedAreas.map((area) => (
                  <motion.tr
                    key={area.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-muted/30 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      {area.code ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-950/30 dark:text-brand-300 dark:border-brand-800">
                          {area.code}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold">{area.name}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-xs">
                      <span className="line-clamp-1">{area.description || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(area)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-colors"
                          title="Editar área"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDelete(area)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-950/30 transition-colors"
                          title="Eliminar área"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {(modalMode === "create" || modalMode === "edit") && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-bold text-lg">
                    {modalMode === "create" ? "Nueva Área" : `Editar: ${selectedArea?.name}`}
                  </h3>
                </div>
                <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Nombre del Área *</label>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Ej: Gestión Humana"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Código Interno</label>
                  <input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 uppercase"
                    placeholder="Ej: GH-001"
                    maxLength={20}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Descripción</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full min-h-[80px] rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    placeholder="Responsabilidades principales del área..."
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl gradient-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSubmitting ? "Guardando..." : modalMode === "create" ? "Guardar Área" : "Guardar Cambios"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete confirm modal */}
      <AnimatePresence>
        {modalMode === "delete" && selectedArea && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border overflow-hidden"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-danger-100 dark:bg-danger-950/30 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-7 h-7 text-danger-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">¿Eliminar área?</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Estás a punto de eliminar el área <strong>"{selectedArea.name}"</strong>.
                    Esta acción no se puede deshacer.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-danger-600 text-white text-sm font-semibold hover:bg-danger-700 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {isSubmitting ? "Eliminando..." : "Sí, eliminar"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
