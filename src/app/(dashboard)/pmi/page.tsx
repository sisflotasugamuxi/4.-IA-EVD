"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, Plus, Search, Clock, CheckCircle2, AlertCircle,
  Calendar, ChevronRight, User, ChevronDown, ChevronUp
} from "lucide-react";
import Link from "next/link";
import { cn, formatDate, getPMIStatusColor, getInitials } from "@/lib/utils";

import { getPMIs } from "@/app/actions/pmi";
import { LoadingProgress, useLoadingProgress } from "@/components/ui/loading-progress";

// Helper type based on the UI needs
type PMI = {
  id: string;
  collaborator: string;
  area: string;
  position: string;
  reason: string;
  actions: string;
  start_date: string;
  end_date: string;
  status: string;
  followups: any[];
  evaluation_score: number;
};

function PMICard({ pmi }: { pmi: PMI }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border bg-card overflow-hidden"
    >
      {/* Top border by status */}
      <div className={cn(
        "h-1",
        pmi.status === "activo" ? "bg-warning-500" :
        pmi.status === "cerrado" ? "bg-success-500" :
        pmi.status === "vencido" ? "bg-danger-500" : "bg-brand-500"
      )} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Collaborator info */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full gradient-brand flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {getInitials(pmi.collaborator)}
            </div>
            <div>
              <p className="font-semibold">{pmi.collaborator}</p>
              <p className="text-sm text-muted-foreground">{pmi.position} · {pmi.area}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={cn(
              "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border",
              getPMIStatusColor(pmi.status)
            )}>
              {pmi.status.charAt(0).toUpperCase() + pmi.status.slice(1)}
            </span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Reason + Score */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="col-span-2 p-3 rounded-lg bg-muted/30 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Motivo</p>
            <p className="text-sm">{pmi.reason}</p>
          </div>
          <div className="p-3 rounded-lg border text-center">
            <p className="text-xs text-muted-foreground mb-1">Puntaje evaluación</p>
            <p className={cn(
              "text-2xl font-bold",
              pmi.evaluation_score >= 4 ? "text-success-600" :
              pmi.evaluation_score >= 3.1 ? "text-warning-600" : "text-danger-600"
            )}>
              {pmi.evaluation_score.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Timeline of followups */}
        <div className="mt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Seguimientos</p>
          <div className="flex items-center gap-0">
            {pmi.followups.map((f, i) => (
              <React.Fragment key={f.number}>
                <div className="flex flex-col items-center gap-1.5 flex-1">
                  <div className={cn(
                    "w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all",
                    f.status === "completado" ? "border-success-500 bg-success-50 text-success-600 dark:bg-success-950/30" :
                    f.status === "vencido" ? "border-danger-500 bg-danger-50 text-danger-600 dark:bg-danger-950/30" :
                    "border-border bg-background text-muted-foreground"
                  )}>
                    {f.status === "completado" ? <CheckCircle2 className="w-4 h-4" /> :
                     f.status === "vencido" ? <AlertCircle className="w-4 h-4" /> :
                     `${f.number}d`}
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold">{f.number} días</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(f.date)}</p>
                    {f.progress > 0 && (
                      <div className="mt-1 w-full h-1 bg-muted rounded-full">
                        <div className="h-full bg-brand-500 rounded-full" style={{ width: `${f.progress}%` }} />
                      </div>
                    )}
                  </div>
                </div>
                {i < pmi.followups.length - 1 && (
                  <div className={cn(
                    "flex-1 h-0.5 mb-6",
                    pmi.followups[i + 1].status === "completado" ? "bg-success-500" : "bg-border"
                  )} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Dates */}
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Inicio: {formatDate(pmi.start_date)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Fin: {formatDate(pmi.end_date)}
          </span>
        </div>
      </div>

      {/* Expanded: Actions */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t"
          >
            <div className="p-5 bg-muted/20 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Acciones de Mejoramiento</p>
              <div className="whitespace-pre-line text-sm">{pmi.actions}</div>
              <div className="flex items-center gap-2 pt-2">
                <Link href={`/pmi/${pmi.id}`}>
                  <button className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm hover:bg-accent transition-colors">
                    <User className="w-4 h-4" />
                    Ver detalle
                  </button>
                </Link>
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity">
                  <CheckCircle2 className="w-4 h-4" />
                  Registrar seguimiento
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function PMIPage() {
  const [search, setSearch] = useState("");
  const [pmis, setPmis] = useState<PMI[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoading: showLoading, progress: loadProgress } = useLoadingProgress(isLoading);

  React.useEffect(() => {
    async function fetchPmis() {
      const res = await getPMIs();
      if (!res.error && res.data) {
        const mapped = res.data.map((r: any) => {
          const collab = r.evaluation?.collaborator;
          // Simulated start date based on evaluation creation date
          const startDate = new Date(r.evaluation?.created_at || r.created_at);
          const endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + 3);

          return {
            id: r.id,
            collaborator: collab?.full_name || "Desconocido",
            area: collab?.areas?.name || "N/A",
            position: collab?.positions?.name || "N/A",
            reason: `Promedio general: ${r.overall_average} — ${r.result === 'no_aprobado' ? 'No aprobado' : 'Requiere mejora'}`,
            actions: "1. Seguimiento con jefe inmediato\\n2. Capacitación programada",
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            status: "activo",
            followups: [
              { number: 30, date: new Date(startDate.getTime() + 30*24*60*60*1000).toISOString(), status: "pendiente", progress: 0 },
              { number: 60, date: new Date(startDate.getTime() + 60*24*60*60*1000).toISOString(), status: "pendiente", progress: 0 },
              { number: 90, date: new Date(startDate.getTime() + 90*24*60*60*1000).toISOString(), status: "pendiente", progress: 0 },
            ],
            evaluation_score: r.overall_average || 0,
          };
        });
        setPmis(mapped);
      }
      setIsLoading(false);
    }
    fetchPmis();
  }, []);

  const filtered = pmis.filter(p =>
    !search || p.collaborator.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planes de Mejoramiento Individual</h1>
          <p className="text-muted-foreground text-sm mt-1">Seguimiento de PMI activos — 2026</p>
        </div>
        <Link href="/pmi/nuevo">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-md">
            <Plus className="w-4 h-4" />
            Nuevo PMI
          </button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "PMI Activos", value: pmis.filter(p => p.status === "activo").length, color: "warning" },
          { label: "En Seguimiento", value: pmis.filter(p => p.followups.some((f: any) => f.status === "completado")).length, color: "brand" },
          { label: "Cerrados", value: pmis.filter(p => p.status === "cerrado").length, color: "success" },
          { label: "Vencidos", value: pmis.filter(p => p.status === "vencido").length, color: "danger" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="p-4 rounded-xl border bg-card text-center"
          >
            <p className={cn(
              "text-3xl font-bold",
              s.color === "success" ? "text-success-600" :
              s.color === "warning" ? "text-warning-600" :
              s.color === "danger" ? "text-danger-600" : "text-brand-500"
            )}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar colaborador..."
          className="w-full h-10 pl-10 pr-4 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
        />
      </div>

      {/* PMI Cards */}
      <div className="space-y-4">
        {showLoading ? (
          <LoadingProgress
            icon={Target}
            title="Cargando planes de mejoramiento (PMI)..."
            description="Consultando planes activos, seguimientos y acciones de mejora..."
            progress={loadProgress}
          />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Target className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-semibold">No se encontraron PMI</p>
              <p className="text-sm text-muted-foreground">Los planes de mejoramiento se generan automáticamente al finalizar evaluaciones con puntaje bajo</p>
            </div>
          </div>
        ) : (
          filtered.map((pmi) => (
            <PMICard key={pmi.id} pmi={pmi} />
          ))
        )}
      </div>
    </div>
  );
}
