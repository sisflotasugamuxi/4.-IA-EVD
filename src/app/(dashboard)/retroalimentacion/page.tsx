"use client";

import React, { useState, useEffect } from "react";
import { MessageSquare, Calendar, CheckCircle2, User, Clock, FileText } from "lucide-react";
import { getFeedbackSessions } from "@/app/actions/feedback";
import { formatDateTime } from "@/lib/utils";
import { LoadingProgress, useLoadingProgress } from "@/components/ui/loading-progress";

export default function RetroalimentacionPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoading: showLoading, progress: loadProgress } = useLoadingProgress(isLoading);

  useEffect(() => {
    async function loadSessions() {
      const { data } = await getFeedbackSessions();
      setSessions(data || []);
      setIsLoading(false);
    }
    loadSessions();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-brand-500" />
            Retroalimentación (1 a 1)
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Registro y seguimiento de sesiones de feedback post-evaluación
          </p>
        </div>
        <button className="px-4 py-2 rounded-xl gradient-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-md">
          Nueva Sesión
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {showLoading ? (
          <div className="col-span-full py-6">
            <LoadingProgress
              icon={MessageSquare}
              title="Cargando sesiones de retroalimentación..."
              description="Sincronizando seguimientos 1 a 1 post-evaluación..."
              progress={loadProgress}
            />
          </div>
        ) : sessions.length === 0 ? (
          <div className="col-span-full py-12 flex flex-col items-center justify-center border-2 border-dashed rounded-xl">
            <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">No hay sesiones registradas</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="p-5 rounded-xl border bg-card hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 dark:text-brand-300 font-bold">
                    {session.evaluation?.collaborator?.full_name?.charAt(0) || "U"}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">{session.evaluation?.collaborator?.full_name || "Usuario Eliminado"}</h3>
                    <p className="text-xs text-muted-foreground">{session.evaluation?.collaborator?.positions?.name}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                  session.status === 'realizada' ? 'bg-success-100 text-success-700 dark:bg-success-950/40 dark:text-success-300' : 'bg-warning-100 text-warning-700 dark:bg-warning-950/40 dark:text-warning-300'
                }`}>
                  {session.status.toUpperCase()}
                </span>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Programada: {formatDateTime(session.scheduled_date)}</span>
                </div>
                {session.notes && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg">
                    <FileText className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{session.notes}</span>
                  </div>
                )}
              </div>

              <button className="w-full py-2 rounded-lg border text-sm font-medium hover:bg-accent transition-colors">
                Ver Detalles
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
