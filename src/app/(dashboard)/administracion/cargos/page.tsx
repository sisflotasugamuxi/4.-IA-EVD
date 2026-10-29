"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Plus, Edit2, Trash2, Save, X, Loader2, AlertTriangle,
  ArrowUpDown, ChevronUp, ChevronDown
} from "lucide-react";
import { getPositions, getAreas, createPosition, updatePosition, deletePosition } from "@/app/actions/config";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LoadingProgress, useLoadingProgress } from "@/components/ui/loading-progress";

interface Area {
  id: string;
  name: string;
}

interface Position {
  id: string;
  name: string;
  code?: string;
  description?: string;
  level: number;
  area_id?: string;
  areas?: { name: string };
}

type ModalMode = "create" | "edit" | "delete" | null;

const INITIAL_FORM = { name: "", code: "", description: "", area_id: "", level: 1 };

const LEVEL_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Operativo",    color: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" },
  2: { label: "Profesional",  color: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800" },
  3: { label: "Coordinación", color: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800" },
  4: { label: "Jefatura",     color: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" },
  5: { label: "Gerencia",     color: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800" },
};

export default function CargosPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoading: showLoading, progress: loadProgress } = useLoadingProgress(isLoading);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
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

  const sortedPositions = [...positions].sort((a, b) => {
    let valA: any = a[sortField as keyof typeof a];
    let valB: any = b[sortField as keyof typeof b];

    if (sortField === "name") {
      valA = (a.name || "").toLowerCase();
      valB = (b.name || "").toLowerCase();
    } else if (sortField === "code") {
      valA = (a.code || "").toLowerCase();
      valB = (b.code || "").toLowerCase();
    } else if (sortField === "area") {
      valA = (a.areas?.name || "").toLowerCase();
      valB = (b.areas?.name || "").toLowerCase();
    } else if (sortField === "level") {
      valA = Number(a.level) || 0;
      valB = Number(b.level) || 0;
    }

    if (valA === undefined || valA === null) return 1;
    if (valB === undefined || valB === null) return -1;

    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [posData, areasData] = await Promise.all([getPositions(), getAreas()]);
      setPositions((posData as Position[]) || []);
      setAreas((areasData as Area[]) || []);
    } catch (err) {
      toast.error("Error al cargar datos");
    } finally {
      setIsLoading(false);
    }
  }

  function openCreate() {
    setFormData(INITIAL_FORM);
    setSelectedPos(null);
    setModalMode("create");
  }

  function openEdit(pos: Position) {
    setSelectedPos(pos);
    setFormData({
      name: pos.name,
      code: pos.code || "",
      description: pos.description || "",
      area_id: pos.area_id || "",
      level: pos.level || 1,
    });
    setModalMode("edit");
  }

  function openDelete(pos: Position) {
    setSelectedPos(pos);
    setModalMode("delete");
  }

  function closeModal() {
    setModalMode(null);
    setSelectedPos(null);
    setFormData(INITIAL_FORM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("El nombre del cargo es obligatorio");
      return;
    }

    setIsSubmitting(true);
    try {
      if (modalMode === "create") {
        const result = await createPosition({
          ...formData,
          area_id: formData.area_id || null,
        });
        if (result?.error) throw new Error(result.error);
        toast.success("Cargo creado correctamente");
      } else if (modalMode === "edit" && selectedPos) {
        const result = await updatePosition(selectedPos.id, {
          name: formData.name.trim(),
          code: formData.code.trim() || undefined,
          description: formData.description.trim() || undefined,
          area_id: formData.area_id || undefined,
          level: formData.level,
        });
        if (result?.error) throw new Error(result.error);
        toast.success("Cargo actualizado correctamente");
      }
      closeModal();
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar el cargo");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!selectedPos) return;
    setIsSubmitting(true);
    try {
      const result = await deletePosition(selectedPos.id);
      if (result?.error) throw new Error(result.error);
      toast.success("Cargo eliminado correctamente");
      closeModal();
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar el cargo");
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
            <BookOpen className="w-6 h-6 text-brand-500" />
            Cargos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Administra los cargos y niveles jerárquicos de la empresa
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-md whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Nuevo Cargo
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-card text-center">
          <p className="text-2xl font-bold text-brand-600">{positions.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total cargos</p>
        </div>
        {Object.entries(LEVEL_LABELS).slice(0, 3).map(([lvl, info]) => (
          <div key={lvl} className="p-4 rounded-xl border bg-card text-center">
            <p className="text-2xl font-bold text-muted-foreground">
              {positions.filter((p) => p.level === parseInt(lvl)).length}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{info.label}</p>
          </div>
        ))}
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
                    Nombre del Cargo
                    {sortField === "name" ? (
                      sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-55" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 font-semibold text-muted-foreground hidden sm:table-cell cursor-pointer select-none" onClick={() => handleSort("area")}>
                  <div className="flex items-center gap-1 hover:text-foreground transition-colors">
                    Área
                    {sortField === "area" ? (
                      sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-55" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 font-semibold text-muted-foreground cursor-pointer select-none" onClick={() => handleSort("level")}>
                  <div className="flex items-center gap-1 hover:text-foreground transition-colors">
                    Nivel
                    {sortField === "level" ? (
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
                  <td colSpan={5} className="py-8 text-center">
                    <LoadingProgress
                      icon={BookOpen}
                      title="Cargando catálogo de cargos..."
                      description="Sincronizando niveles jerárquicos y áreas asociadas..."
                      progress={loadProgress}
                    />
                  </td>
                </tr>
              ) : positions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    No hay cargos registrados
                  </td>
                </tr>
              ) : (
                sortedPositions.map((pos) => {
                  const levelInfo = LEVEL_LABELS[pos.level] || LEVEL_LABELS[1];
                  return (
                    <motion.tr
                      key={pos.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      <td className="px-4 py-3">
                        {pos.code ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-950/30 dark:text-brand-300 dark:border-brand-800">
                            {pos.code}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold">{pos.name}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {pos.areas?.name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
                          levelInfo.color
                        )}>
                          <span className="w-3.5 h-3.5 rounded-full bg-current opacity-60 flex-shrink-0 text-[8px] flex items-center justify-center font-black">{pos.level}</span>
                          {levelInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(pos)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-colors"
                            title="Editar cargo"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openDelete(pos)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-950/30 transition-colors"
                            title="Eliminar cargo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
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
                    <BookOpen className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-bold text-lg">
                    {modalMode === "create" ? "Nuevo Cargo" : `Editar: ${selectedPos?.name}`}
                  </h3>
                </div>
                <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Nombre del Cargo *</label>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Ej: Analista de Nómina"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Código</label>
                    <input
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="NOM-01"
                      maxLength={20}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Nivel Jerárquico</label>
                    <select
                      value={formData.level}
                      onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
                      className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {Object.entries(LEVEL_LABELS).map(([lvl, info]) => (
                        <option key={lvl} value={lvl}>{lvl} — {info.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Área Perteneciente</label>
                  <select
                    value={formData.area_id}
                    onChange={(e) => setFormData({ ...formData, area_id: e.target.value })}
                    className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Sin área asignada</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Descripción</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full min-h-[70px] rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    placeholder="Funciones principales del cargo..."
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl gradient-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSubmitting ? "Guardando..." : modalMode === "create" ? "Guardar Cargo" : "Guardar Cambios"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {modalMode === "delete" && selectedPos && (
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
                  <h3 className="font-bold text-lg">¿Eliminar cargo?</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Estás a punto de eliminar el cargo <strong>"{selectedPos.name}"</strong>.
                    Esta acción no se puede deshacer.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={closeModal} className="flex-1 px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
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
