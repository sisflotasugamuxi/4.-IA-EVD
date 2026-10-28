"use client";

import React, { useState, useEffect } from "react";
import { FolderTree, Plus, Edit2, Trash2, Scale, AlertCircle } from "lucide-react";
import { getEvaluationConfig, saveCategory, deleteCategory } from "@/app/actions/evaluations";
import { toast } from "sonner";
import { LoadingProgress, useLoadingProgress } from "@/components/ui/loading-progress";

interface Category {
  id: string;
  name: string;
  weight: number;
  description?: string;
  is_critical: boolean;
  min_score_required: number;
}

export default function CategoriasPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoading: showLoading, progress: loadProgress } = useLoadingProgress(isLoading);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // State for form
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [weight, setWeight] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [isCritical, setIsCritical] = useState(false);
  const [minScoreRequired, setMinScoreRequired] = useState<number>(4.0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const config = await getEvaluationConfig();
      if (config.categories) {
        setCategories(config.categories.map((c: any) => ({
          id: c.id,
          name: c.name,
          weight: Number(c.weight || 0),
          description: c.description || "",
          is_critical: c.is_critical || false,
          min_score_required: Number(c.min_score_required || 4.0)
        })));
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar categorías");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setName("");
    setWeight(0);
    setDescription("");
    setIsCritical(false);
    setMinScoreRequired(4.0);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setWeight(cat.weight);
    setDescription(cat.description || "");
    setIsCritical(cat.is_critical || false);
    setMinScoreRequired(cat.min_score_required || 4.0);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("El nombre de la categoría es obligatorio");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await saveCategory({
        id: editingCategory?.id,
        name,
        weight,
        description,
        is_critical: isCritical,
        min_score_required: minScoreRequired
      });

      if (res.error) {
        toast.error("Error al guardar: " + res.error);
      } else {
        toast.success(editingCategory ? `Categoría actualizada: ${JSON.stringify(res.data)}` : "Categoría creada");
        setIsModalOpen(false);
        loadCategories();
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al procesar la categoría");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta categoría? Se eliminarán todas sus preguntas asociadas de forma permanente.")) {
      return;
    }

    try {
      const res = await deleteCategory(id);
      if (res.error) {
        toast.error("Error al eliminar: " + res.error);
      } else {
        toast.success("Categoría eliminada correctamente");
        loadCategories();
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar la categoría");
    }
  };

  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-brand-500" />
            Categorías de Evaluación
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Agrupa las preguntas por bloques temáticos y define sus pesos
          </p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nueva Categoría
        </button>
      </div>

      {/* Info Banner */}
      <div className="flex flex-col gap-3 p-4 rounded-xl border bg-muted/20 text-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-brand-500" />
            <span>Suma de pesos de las categorías: <strong className={totalWeight === 100 ? "text-success-600 font-bold" : "text-warning-600 font-bold"}>{totalWeight}%</strong></span>
          </div>
          {totalWeight !== 100 && (
            <span className="text-xs text-warning-600 font-medium hidden sm:inline">⚠️ El peso total acumulado debería sumar 100%</span>
          )}
        </div>
        
        <div className="pt-2 border-t border-border/60 text-xs text-muted-foreground flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <span>🛡️ <strong>Regla de Criterios Críticos:</strong> Calificación mínima de 4.0 requerida. El incumplimiento genera un Plan de Mejoramiento Individual.</span>
          <a href="/configuracion/preguntas" className="text-brand-600 hover:text-brand-700 font-bold underline">
            Parametrizar preguntas y criterios crí­ticos →
          </a>
        </div>
      </div>

      {showLoading ? (
        <LoadingProgress
          icon={FolderTree}
          title="Cargando categorías de evaluación..."
          description="Consultando ponderaciones y criterios críticos activos..."
          progress={loadProgress}
        />
      ) : categories.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground border border-dashed rounded-xl bg-muted/10">
          No hay categorías configuradas en la evaluación activa.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat) => (
            <div 
              key={cat.id} 
              className="p-5 rounded-xl border bg-card hover:shadow-md transition-all group relative overflow-hidden"
            >
              {cat.is_critical && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-danger-500 z-10" />
              )}
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg leading-tight pr-12">{cat.name}</h3>
                <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleOpenEdit(cat)}
                    className="p-1.5 text-muted-foreground hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(cat.id)}
                    className="p-1.5 text-muted-foreground hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors cursor-pointer"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                  Peso: {cat.weight}%
                </div>
                {cat.is_critical && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-danger-50 dark:bg-danger-950/20 text-danger-700 dark:text-danger-400 border border-danger-200/60 shadow-sm">
                    <AlertCircle className="w-3.5 h-3.5 text-danger-500" />
                    Criterio Crítico (Mín. {cat.min_score_required})
                  </div>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                {cat.description || "Sin descripción disponible."}
              </p>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b flex justify-between items-center select-none">
              <h3 className="font-bold text-lg">{editingCategory ? "Editar Categoría" : "Nueva Categoría"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nombre de la Categoría *</label>
                <input 
                  required 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" 
                  placeholder="Ej. Seguridad Vial, Servicio al Cliente"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Peso (%)</label>
                <input 
                  type="number" 
                  min={0}
                  max={100}
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" 
                  placeholder="Ej. 25"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Descripción</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full min-h-[80px] rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" 
                  placeholder="Escribe el propósito de esta categoría..."
                />
              </div>

              <div className="flex items-center gap-2 py-1 select-none">
                <input
                  type="checkbox"
                  id="is_critical"
                  checked={isCritical}
                  onChange={(e) => setIsCritical(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30 cursor-pointer"
                />
                <label htmlFor="is_critical" className="text-sm font-medium cursor-pointer">
                  Categoría Crítica Obligatoria (PMI si promedio &lt; nota mínima)
                </label>
              </div>

              {isCritical && (
                <div className="space-y-1.5 animate-fade-in">
                  <label className="text-sm font-medium">Calificación Mínima Requerida *</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    step={0.1}
                    required
                    value={minScoreRequired}
                    onChange={(e) => setMinScoreRequired(Number(e.target.value))}
                    className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Ej. 4.0"
                  />
                  <p className="text-xs text-muted-foreground">Si el promedio ponderado de esta categoría es menor a este valor, se requiere un PMI.</p>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="flex-1 px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 rounded-xl gradient-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-55"
                >
                  {isSubmitting ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
