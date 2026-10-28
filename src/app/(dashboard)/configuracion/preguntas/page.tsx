"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  Settings, Plus, GripVertical, Edit, Trash2, Eye, EyeOff,
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Search,
  Copy, Star, Info
} from "lucide-react";
import { cn, isRoadSafetyQuestion } from "@/lib/utils";
import { toast } from "sonner";
import { getEvaluationConfig, saveQuestion, deleteQuestion, updateQuestionStatus } from "@/app/actions/evaluations";
import { LoadingProgress, useLoadingProgress } from "@/components/ui/loading-progress";

// ---- Types ----
interface Question {
  id: string;
  code: string;
  question: string;
  description?: string;
  is_required: boolean;
  is_active: boolean;
  is_critical: boolean;
  min_score_required: number;
  weight: number;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  sort_order: number;
  weight: number;
  active: boolean;
  is_critical?: boolean;
  min_score_required?: number;
  questions: Question[];
}

// ---- Question Row ----
function QuestionRow({ question, onEdit, onDelete, onToggle, onDuplicate }: {
  question: Question;
  onEdit: (q: Question) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onDuplicate: (q: Question) => void;
}) {
  return (
    <Reorder.Item
      value={question}
      id={question.id}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border bg-background transition-all",
        !question.is_active && "opacity-50"
      )}
    >
      {/* Drag handle */}
      <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors">
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Code */}
      <span className="text-xs font-mono font-bold bg-muted px-2 py-0.5 rounded text-muted-foreground w-16 text-center flex-shrink-0">
        {question.code}
      </span>

      {/* Question */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{question.question}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {question.is_required && (
            isRoadSafetyQuestion(question) ? (
              <span className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/40">
                Obligatoria solo para cargos operativos y conductores
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground">Obligatoria</span>
            )
          )}
          <span className="text-[10px] text-muted-foreground">Peso: {question.weight}x</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onDuplicate(question)}
          className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
          title="Duplicar"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onEdit(question)}
          className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
          title="Editar"
        >
          <Edit className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onToggle(question.id)}
          className={cn(
            "p-1.5 rounded-lg transition-colors cursor-pointer",
            question.is_active ? "hover:bg-warning-50 text-warning-500" : "hover:bg-success-50 text-success-500"
          )}
          title={question.is_active ? "Inactivar" : "Activar"}
        >
          {question.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => onDelete(question.id)}
          className="p-1.5 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-950/30 text-muted-foreground hover:text-danger-600 transition-colors cursor-pointer"
          title="Eliminar"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </Reorder.Item>
  );
}

// ---- Category Panel ----
function CategoryPanel({ category, onUpdateQuestions, onReload }: {
  category: Category;
  onUpdateQuestions: (catId: string, questions: Question[]) => void;
  onReload: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [questions, setQuestions] = useState(category.questions);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ question: "", code: "", weight: 1 });

  // Form edit states
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editQuestionText, setEditQuestionText] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsRequired, setEditIsRequired] = useState(true);
  const [editIsActive, setEditIsActive] = useState(true);
  const [editWeight, setEditWeight] = useState(1);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  useEffect(() => {
    setQuestions(category.questions);
  }, [category.questions]);

  const handleReorder = (newOrder: Question[]) => {
    setQuestions(newOrder);
    onUpdateQuestions(category.id, newOrder);
  };

  const handleToggle = async (id: string) => {
    const q = questions.find(item => item.id === id);
    if (!q) return;
    try {
      const res = await updateQuestionStatus(id, !q.is_active);
      if (res.error) {
        toast.error("Error al cambiar estado: " + res.error);
      } else {
        toast.success(q.is_active ? "Pregunta inactivada" : "Pregunta activada");
        onReload();
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al cambiar estado");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta pregunta permanentemente?")) return;
    try {
      const res = await deleteQuestion(id);
      if (res.error) {
        toast.error("Error al eliminar: " + res.error);
      } else {
        toast.success("Pregunta eliminada correctamente");
        onReload();
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar la pregunta");
    }
  };

  const handleDuplicate = async (q: Question) => {
    try {
      const res = await saveQuestion({
        category_id: category.id,
        code: `${q.code}-COPIA`,
        question: `${q.question} (Copia)`,
        description: q.description,
        is_required: q.is_required,
        is_active: true,
        is_critical: false,
        min_score_required: 1.0,
        weight: q.weight,
      });

      if (res.error) {
        toast.error("Error al duplicar: " + res.error);
      } else {
        toast.success("Pregunta duplicada correctamente");
        onReload();
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al duplicar la pregunta");
    }
  };

  const handleAddQuestion = async () => {
    if (!newQuestion.question.trim()) {
      toast.error("La pregunta no puede estar vacía");
      return;
    }
    
    try {
      const res = await saveQuestion({
        category_id: category.id,
        code: newQuestion.code || `Q-${questions.length + 1}`,
        question: newQuestion.question,
        description: "",
        is_required: true,
        is_active: true,
        is_critical: false,
        min_score_required: 1.0,
        weight: newQuestion.weight,
      });

      if (res.error) {
        toast.error("Error al crear pregunta: " + res.error);
      } else {
        toast.success("Pregunta agregada exitosamente");
        setNewQuestion({ question: "", code: "", weight: 1 });
        setShowAddForm(false);
        onReload();
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar la pregunta");
    }
  };

  const handleOpenEdit = (q: Question) => {
    setEditingQuestion(q);
    setEditCode(q.code);
    setEditQuestionText(q.question);
    setEditDescription(q.description || "");
    setEditIsRequired(q.is_required);
    setEditIsActive(q.is_active);
    setEditWeight(q.weight);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;
    if (!editQuestionText.trim()) {
      toast.error("La pregunta no puede estar vacía");
      return;
    }

    setIsEditSubmitting(true);
    try {
      const res = await saveQuestion({
        id: editingQuestion.id,
        category_id: category.id,
        code: editCode,
        question: editQuestionText,
        description: editDescription,
        is_required: editIsRequired,
        is_active: editIsActive,
        is_critical: false,
        min_score_required: 1.0,
        weight: editWeight,
      });

      if (res.error) {
        toast.error("Error al guardar: " + res.error);
      } else {
        toast.success("Pregunta actualizada");
        setEditingQuestion(null);
        onReload();
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al actualizar la pregunta");
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const activeCount = questions.filter(q => q.is_active).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border bg-card overflow-hidden"
    >
      {/* Category Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {category.sort_order}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{category.name}</p>
          <p className="text-xs text-muted-foreground">{activeCount}/{questions.length} preguntas activas · Peso {category.weight}%</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full font-medium",
            category.active ? "bg-success-50 text-success-600 dark:bg-success-950/30" : "bg-muted text-muted-foreground"
          )}>
            {category.active ? "Activa" : "Inactiva"}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t"
          >
            <div className="p-4 space-y-2">
              {/* Drag hint */}
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-3">
                <GripVertical className="w-3.5 h-3.5" />
                Arrastra las preguntas para reordenarlas
              </p>

              <Reorder.Group
                axis="y"
                values={questions}
                onReorder={handleReorder}
                className="space-y-2"
              >
                {questions.map((q) => (
                  <QuestionRow
                    key={q.id}
                    question={q}
                    onEdit={handleOpenEdit}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                    onDuplicate={handleDuplicate}
                  />
                ))}
              </Reorder.Group>

              {/* Add Question Form */}
              <AnimatePresence>
                {showAddForm && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="mt-3 p-4 rounded-xl border border-dashed border-primary/50 bg-primary/3 space-y-3"
                  >
                    <p className="text-sm font-semibold text-primary">Nueva Pregunta</p>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Código</label>
                        <input
                          value={newQuestion.code}
                          onChange={(e) => setNewQuestion(p => ({ ...p, code: e.target.value }))}
                          placeholder="CF-06"
                          className="w-full h-9 rounded-lg border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Pregunta *</label>
                        <input
                          value={newQuestion.question}
                          onChange={(e) => setNewQuestion(p => ({ ...p, question: e.target.value }))}
                          placeholder="Escribe la pregunta..."
                          className="w-full h-9 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground font-semibold">Peso (Multiplicador):</span>
                        <input
                          type="number"
                          min={0.5}
                          max={5}
                          step={0.5}
                          value={newQuestion.weight}
                          onChange={(e) => setNewQuestion(p => ({ ...p, weight: Number(e.target.value) }))}
                          className="w-16 h-7 rounded border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-medium text-foreground"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAddQuestion}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-lg gradient-brand text-white text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Agregar pregunta
                      </button>
                      <button
                        onClick={() => setShowAddForm(false)}
                        className="px-4 py-1.5 rounded-lg border text-xs hover:bg-accent transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-2 w-full p-3 rounded-lg border border-dashed text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-accent/30 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Agregar pregunta a esta categoría
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Question Modal */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-foreground animate-fade-in">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b flex justify-between items-center select-none">
              <h3 className="font-bold text-lg">Editar Pregunta</h3>
              <button onClick={() => setEditingQuestion(null)} className="text-muted-foreground hover:text-foreground cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Código *</label>
                  <input 
                    required 
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full h-9 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Peso (Multiplicador)</label>
                  <input 
                    type="number"
                    step={0.5}
                    min={0.5}
                    value={editWeight}
                    onChange={(e) => setEditWeight(Number(e.target.value))}
                    className="w-full h-9 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Pregunta *</label>
                <textarea 
                  required
                  rows={2}
                  value={editQuestionText}
                  onChange={(e) => setEditQuestionText(e.target.value)}
                  className="w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Descripción / Guía de Calificación</label>
                <input 
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full h-9 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Guía breve para calificar..."
                />
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs select-none">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={editIsRequired}
                    onChange={(e) => setEditIsRequired(e.target.checked)}
                    className="rounded"
                  />
                  <span>Obligatoria</span>
                </label>
                
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="rounded"
                  />
                  <span>Activa</span>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setEditingQuestion(null)}
                  className="flex-1 px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isEditSubmitting}
                  className="flex-1 px-4 py-2 rounded-xl gradient-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-55"
                >
                  {isEditSubmitting ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ---- Main Page ----
export default function PreguntasConfigPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoading: showLoading, progress: loadProgress } = useLoadingProgress(isLoading);
  const [searchQ, setSearchQ] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const config = await getEvaluationConfig();
      if (config.categories) {
        const structured: Category[] = config.categories.map((c: any) => ({
          id: c.id,
          name: c.name,
          description: c.description || "",
          sort_order: c.sort_order || 0,
          weight: Number(c.weight || 0),
          active: c.active !== false,
          is_critical: c.is_critical === true,
          min_score_required: Number(c.min_score_required || 4.0),
          questions: (config.questions || []).filter((q: any) => q.category_id === c.id).map((q: any) => ({
            id: q.id,
            code: q.code || "",
            question: q.question,
            description: q.description || "",
            is_required: q.is_required !== false,
            is_active: q.is_active !== false,
            is_critical: q.is_critical === true,
            min_score_required: Number(q.min_score_required || 1.0),
            weight: Number(q.weight || 1.0),
          }))
        }));
        setCategories(structured);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar configuración de preguntas");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateQuestions = (catId: string, questions: Question[]) => {
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, questions } : c));
  };

  const totalQuestions = categories.reduce((sum, c) => sum + c.questions.length, 0);
  const activeQuestions = categories.reduce((sum, c) => sum + c.questions.filter(q => q.is_active).length, 0);
  const criticalCategories = categories.filter(c => c.is_critical).length;

  // Search filter
  const filteredCategories = categories.map((cat) => {
    const filteredQ = cat.questions.filter((q) => {
      const text = q.question.toLowerCase();
      const code = q.code.toLowerCase();
      const search = searchQ.toLowerCase();
      return text.includes(search) || code.includes(search);
    });
    return {
      ...cat,
      questions: filteredQ
    };
  }).filter((cat) => cat.questions.length > 0 || searchQ === "");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuración de Preguntas</h1>
          <p className="text-muted-foreground text-sm mt-1">Versión Activa · Motor de evaluación dinámico</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-brand-200 bg-brand-50 dark:bg-brand-950/20">
        <Settings className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0 animate-spin-slow" />
        <div className="text-sm">
          <p className="font-semibold text-brand-700 dark:text-brand-400">Motor de evaluación dinámico</p>
          <p className="text-brand-600/80 dark:text-brand-400/80 text-xs mt-0.5">
            Las preguntas y categorías editadas aquí son cargadas directamente en el formulario de "Nueva Evaluación".
            Puedes activar, inactivar, crear y editar el código, peso y condiciones críticas de las preguntas de forma segura.
          </p>
        </div>
      </div>

      {showLoading ? (
        <LoadingProgress
          icon={Settings}
          title="Cargando preguntas de evaluación..."
          description="Sincronizando banco de preguntas y categorías activas..."
          progress={loadProgress}
        />
      ) : categories.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground border border-dashed rounded-xl bg-muted/10">
          No hay preguntas de evaluación configuradas. Cree categorías primero.
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 stagger-children">
            {[
              { label: "Total preguntas", value: totalQuestions },
              { label: "Activas", value: activeQuestions },
              { label: "Categorías críticas", value: criticalCategories },
            ].map((s, i) => (
              <div key={s.label} className="p-4 rounded-xl border bg-card text-center">
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Buscar pregunta..."
              className="w-full h-10 pl-10 pr-4 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>

          {/* Categories + Questions */}
          <div className="space-y-4">
            {filteredCategories.map((cat) => (
              <CategoryPanel
                key={cat.id}
                category={cat}
                onUpdateQuestions={updateQuestions}
                onReload={loadData}
              />
            ))}
            {filteredCategories.length === 0 && searchQ !== "" && (
              <div className="py-12 text-center text-muted-foreground">
                No hay preguntas que coincidan con la búsqueda.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
