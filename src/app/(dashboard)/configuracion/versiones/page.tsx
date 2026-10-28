"use client";
import React, { useState, useEffect } from "react";
import { FileCode2, Plus, Calendar, CheckCircle2, Copy, Edit3, X, AlertTriangle, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { getEvaluationVersions, saveEvaluationVersion, cloneEvaluationVersion } from "@/app/actions/evaluations";
import { LoadingProgress, useLoadingProgress } from "@/components/ui/loading-progress";

interface EvaluationVersion {
  id: string;
  name: string;
  year: number;
  description: string;
  is_active: boolean;
  is_published: boolean;
  approved_threshold: number;
  pmi_threshold: number;
  questions_count?: number;
  created_at: string;
}

export default function VersionesPage() {
  const [versiones, setVersiones] = useState<EvaluationVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoading: showLoading, progress: loadProgress } = useLoadingProgress(isLoading);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [isCloningId, setIsCloningId] = useState<string | null>(null);
  const [editingVersion, setEditingVersion] = useState<Partial<EvaluationVersion> | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formYear, setFormYear] = useState<number>(new Date().getFullYear());
  const [formDescription, setFormDescription] = useState("");
  const [formApprovedThreshold, setFormApprovedThreshold] = useState<number>(4.0);
  const [formPmiThreshold, setFormPmiThreshold] = useState<number>(3.1);
  const [formIsActive, setFormIsActive] = useState(false);
  const [formIsPublished, setFormIsPublished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadVersiones = async () => {
    setIsLoading(true);
    try {
      const res = await getEvaluationVersions();
      if (res.error) {
        toast.error("Error al cargar versiones: " + res.error);
      } else {
        setVersiones(res.data || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar versiones");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVersiones();
  }, []);

  const openCreateModal = () => {
    setEditingVersion(null);
    setFormName("");
    setFormYear(new Date().getFullYear());
    setFormDescription("");
    setFormApprovedThreshold(4.0);
    setFormPmiThreshold(3.1);
    setFormIsActive(false);
    setFormIsPublished(false);
    setShowModal(true);
  };

  const openEditModal = (v: EvaluationVersion) => {
    setEditingVersion(v);
    setFormName(v.name);
    setFormYear(v.year);
    setFormDescription(v.description || "");
    setFormApprovedThreshold(Number(v.approved_threshold || 4.0));
    setFormPmiThreshold(Number(v.pmi_threshold || 3.1));
    setFormIsActive(v.is_active);
    setFormIsPublished(v.is_published);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading(editingVersion ? "Actualizando versión..." : "Creando versión...");

    try {
      const payload = {
        id: editingVersion?.id,
        name: formName,
        year: formYear,
        description: formDescription,
        approved_threshold: formApprovedThreshold,
        pmi_threshold: formPmiThreshold,
        is_active: formIsActive,
        is_published: formIsPublished
      };

      const res = await saveEvaluationVersion(payload);
      if (res.error) {
        toast.error("Error al guardar: " + res.error, { id: toastId });
      } else {
        toast.success(editingVersion ? "Versión actualizada con éxito" : "Versión creada con éxito", { id: toastId });
        setShowModal(false);
        loadVersiones();
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar la versión", { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClone = async (id: string, name: string) => {
    if (isCloningId) return;
    setIsCloningId(id);
    const toastId = toast.loading(`Clonando configuración de: ${name}...`);

    try {
      const res = await cloneEvaluationVersion(id);
      if (res.error) {
        toast.error("Error al clonar versión: " + res.error, { id: toastId });
      } else {
        toast.success("Versión y preguntas clonadas exitosamente", { id: toastId });
        loadVersiones();
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al procesar la clonación", { id: toastId });
    } finally {
      setIsCloningId(null);
    }
  };

  const handleToggleActive = async (v: EvaluationVersion) => {
    if (v.is_active) {
      toast.info("Debe activar otra versión para dar de baja esta.");
      return;
    }

    const toastId = toast.loading(`Activando versión: ${v.name}...`);
    try {
      const payload = {
        id: v.id,
        name: v.name,
        year: v.year,
        description: v.description,
        approved_threshold: v.approved_threshold,
        pmi_threshold: v.pmi_threshold,
        is_active: true,
        is_published: v.is_published
      };

      const res = await saveEvaluationVersion(payload);
      if (res.error) {
        toast.error("Error al activar: " + res.error, { id: toastId });
      } else {
        toast.success(`Versión "${v.name}" activada como formato oficial`, { id: toastId });
        loadVersiones();
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al cambiar estado activo", { id: toastId });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in px-4 py-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileCode2 className="w-6 h-6 text-brand-500" />
            Versiones de Evaluación
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Administra los diferentes formatos, umbrales y versiones aplicables en los periodos de evaluación
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-md self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nueva Versión
        </button>
      </div>

      {/* Loading state */}
      {showLoading ? (
        <LoadingProgress
          icon={FileCode2}
          title="Cargando formatos de evaluación..."
          description="Consultando versiones, periodos fiscales y umbrales..."
          progress={loadProgress}
        />
      ) : versiones.length === 0 ? (
        <div className="py-16 text-center border rounded-xl bg-card space-y-3">
          <AlertTriangle className="w-10 h-10 text-warning-500 mx-auto" />
          <p className="text-muted-foreground font-semibold">No se encontraron versiones de evaluación registradas.</p>
          <button
            onClick={openCreateModal}
            className="text-primary hover:underline text-sm font-medium"
          >
            Crear la primera versión
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {versiones.map((v) => (
            <div
              key={v.id}
              className={`p-5 rounded-xl border bg-card hover:shadow-card-hover transition-all duration-200 flex flex-col justify-between ${
                v.is_active
                  ? "border-l-4 border-l-success-500 shadow-sm"
                  : "opacity-85 hover:opacity-100"
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-4 gap-2">
                  <h3 className="font-bold text-lg text-foreground truncate" title={v.name}>{v.name}</h3>
                  <div className="flex flex-col gap-1 items-end flex-shrink-0">
                    <span
                      onClick={() => handleToggleActive(v)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase cursor-pointer transition-colors ${
                        v.is_active
                          ? "bg-success-100 dark:bg-success-950/30 text-success-700 dark:text-success-400 border border-success-200"
                          : "bg-muted text-muted-foreground hover:bg-success-50 hover:text-success-600 border"
                      }`}
                      title={v.is_active ? "Versión Activa Oficial" : "Haga clic para activar esta versión"}
                    >
                      {v.is_active ? "Activa" : "Inactiva"}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        v.is_published
                          ? "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200"
                          : "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200"
                      }`}
                    >
                      {v.is_published ? "Publicada" : "Borrador"}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mb-4 line-clamp-2 min-h-8">
                  {v.description || "Sin descripción proporcionada."}
                </p>

                <div className="space-y-2.5 mb-6 text-sm text-muted-foreground border-t border-b border-border/50 py-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-brand-500" />
                      Preguntas Asignadas:
                    </span>
                    <span className="font-semibold text-foreground">{v.questions_count || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-brand-500" />
                      Año Fiscal:
                    </span>
                    <span className="font-semibold text-foreground">{v.year}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Umbral Aprobación:</span>
                    <span className="font-bold text-success-600 bg-success-50 dark:bg-success-950/20 px-2 py-0.5 rounded border border-success-100">
                      ≥ {Number(v.approved_threshold || 4.0).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Umbral Plan de Mejoramiento (PMI):</span>
                    <span className="font-bold text-warning-600 bg-warning-50 dark:bg-warning-950/20 px-2 py-0.5 rounded border border-warning-100">
                      &lt; {Number(v.pmi_threshold || 3.1).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-auto">
                <button
                  onClick={() => openEditModal(v)}
                  className="flex-1 py-2 rounded-lg border text-sm font-semibold hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Editar
                </button>
                <button
                  onClick={() => handleClone(v.id, v.name)}
                  disabled={isCloningId !== null}
                  className="flex-1 py-2 rounded-lg border text-sm font-semibold hover:bg-muted transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Clonar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Creation / Editing Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-5 border-b border-border/80">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileCode2 className="w-5 h-5 text-brand-500" />
                {editingVersion ? "Editar Versión de Evaluación" : "Nueva Versión de Evaluación"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Nombre de la Versión</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej. Evaluación de Desempeño 2027"
                  className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Año Fiscal</label>
                  <input
                    type="number"
                    value={formYear}
                    onChange={(e) => setFormYear(Number(e.target.value))}
                    min={2020}
                    max={2035}
                    className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    required
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Umbral de Aprobación</label>
                  <input
                    type="number"
                    value={formApprovedThreshold}
                    onChange={(e) => setFormApprovedThreshold(Number(e.target.value))}
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Umbral de PMI (Plan de Mejora)</label>
                  <input
                    type="number"
                    value={formPmiThreshold}
                    onChange={(e) => setFormPmiThreshold(Number(e.target.value))}
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    required
                  />
                </div>

                <div className="flex items-center justify-between border rounded-lg px-3 py-2 bg-muted/20">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold">Publicada</span>
                    <span className="text-[10px] text-muted-foreground">Visible para evaluar</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formIsPublished}
                    onChange={(e) => setFormIsPublished(e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Descripción / Observaciones</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Detalle los objetivos o cambios aplicables a esta versión formativa..."
                  rows={3}
                  className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 p-3 bg-brand-50/20 dark:bg-brand-950/10 rounded-lg border border-brand-100/30 text-xs">
                <input
                  type="checkbox"
                  id="formIsActive"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary flex-shrink-0"
                />
                <label htmlFor="formIsActive" className="text-muted-foreground select-none cursor-pointer">
                  <strong>Establecer como Versión Activa Oficial.</strong> Si se marca, esta versión se utilizará inmediatamente para todas las nuevas evaluaciones y se desactivará la versión anterior.
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-accent transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-lg gradient-brand text-white text-sm font-semibold hover:opacity-95 disabled:opacity-50 transition-opacity"
                >
                  {isSaving ? "Guardando..." : "Guardar Versión"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
