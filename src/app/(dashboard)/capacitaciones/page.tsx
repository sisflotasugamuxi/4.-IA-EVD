"use client";

import React, { useState, useEffect } from "react";
import { GraduationCap, Search, CheckCircle2, AlertCircle, Clock, BookOpen } from "lucide-react";
import { getTrainingRecommendations } from "@/app/actions/training";
import { formatDateTime } from "@/lib/utils";
import { LoadingProgress, useLoadingProgress } from "@/components/ui/loading-progress";

export default function CapacitacionesPage() {
  const [trainings, setTrainings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoading: showLoading, progress: loadProgress } = useLoadingProgress(isLoading);

  useEffect(() => {
    async function loadTrainings() {
      const { data } = await getTrainingRecommendations();
      setTrainings(data || []);
      setIsLoading(false);
    }
    loadTrainings();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-brand-500" />
            Capacitaciones
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Necesidades de formación detectadas en evaluaciones
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-accent transition-colors">
            Exportar Plan
          </button>
          <button className="px-4 py-2 rounded-xl gradient-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-md">
            Nueva Capacitación
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {showLoading ? (
          <div className="col-span-full py-6">
            <LoadingProgress
              icon={GraduationCap}
              title="Cargando capacitaciones recomendadas..."
              description="Consultando necesidades de formación detectadas en evaluaciones..."
              progress={loadProgress}
            />
          </div>
        ) : trainings.length === 0 ? (
          <div className="col-span-full py-12 flex flex-col items-center justify-center border-2 border-dashed rounded-xl">
            <GraduationCap className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">No hay necesidades de formación detectadas</p>
          </div>
        ) : (
          trainings.map((t) => (
            <div key={t.id} className="p-5 rounded-xl border bg-card hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm capitalize">{t.topic}</h3>
                    <p className="text-xs text-muted-foreground">Recomendada: {formatDateTime(t.created_at)}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                  t.status === 'completada' ? 'bg-success-100 text-success-700' :
                  t.status === 'programada' ? 'bg-brand-100 text-brand-700' :
                  'bg-warning-100 text-warning-700'
                }`}>
                  {t.status.toUpperCase()}
                </span>
              </div>
              
              <div className="p-3 bg-muted/30 rounded-lg space-y-2 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">Colaborador:</span>
                  <span className="font-medium text-xs">{t.evaluation?.collaborator?.full_name || 'Desconocido'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">Área:</span>
                  <span className="font-medium text-xs">{t.evaluation?.collaborator?.areas?.name || 'N/A'}</span>
                </div>
              </div>

              {t.notes && (
                <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
                  <span className="font-semibold">Notas:</span> {t.notes}
                </p>
              )}

              <button className="w-full py-2 rounded-lg border border-primary/20 text-primary text-sm font-semibold hover:bg-primary/5 transition-colors">
                Gestionar Capacitación
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
