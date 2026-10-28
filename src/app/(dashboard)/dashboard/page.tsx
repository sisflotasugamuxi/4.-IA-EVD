"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, ClipboardList, CheckCircle2, AlertCircle, TrendingUp,
  Clock, Target, BarChart3, Activity, AlertTriangle, ArrowUpRight,
  ArrowDownRight, Minus, Star, Eye, Maximize2, Minimize2,
  ArrowUpDown, ChevronUp, ChevronDown, GitBranch, Award
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LabelList
} from "recharts";
import { cn, formatNumber, formatScore, getResultLabel, formatDate, formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { getDashboardStats } from "@/app/actions/dashboard";
import { getAreas, getPositions } from "@/app/actions/config";
import MultiSelectSearch from "@/components/ui/MultiSelectSearch";
import { LoadingProgress, useLoadingProgress } from "@/components/ui/loading-progress";

// ---- Mock Data ----
// ---- Helper mapping function for KPIs ----
function buildKpiData(stats: any) {
  if (!stats) return [];
  return [
    { title: "Total Colaboradores", value: stats.totalCollabs, change: 0, icon: Users, color: "brand", suffix: "" },
    { title: "Evaluaciones Finalizadas", value: stats.completedEvals, change: 0, icon: ClipboardList, color: "violet", suffix: "" },
    { title: "Evaluaciones Aprobadas", value: stats.aprobados, change: 0, icon: CheckCircle2, color: "success", suffix: "" },
    { title: "Con Plan de Mejora", value: stats.conPMI, change: 0, icon: Target, color: "warning", suffix: "" },
    { title: "No Aprobados", value: stats.reprobados, change: 0, icon: AlertCircle, color: "danger", suffix: "" },
    { title: "Promedio General", value: stats.avgScore, change: 0, icon: Star, color: "brand", suffix: "/5.0" },
  ];
}

// ---- KPI Card Component ----
function KPICard({ item, index }: { item: any; index: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const target = typeof item.value === "number" ? item.value : 0;
    const duration = 1000;
    const steps = 40;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setDisplayValue(target);
        clearInterval(timer);
      } else {
        setDisplayValue(current);
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [item.value]);

  const colorMap: Record<string, { topBorder: string; iconBg: string; iconText: string }> = {
    brand: { topBorder: "border-t-[#012169]", iconBg: "bg-[#012169]/10 dark:bg-[#012169]/30", iconText: "text-[#012169] dark:text-[#0084d5]" },
    violet: { topBorder: "border-t-[#0084d5]", iconBg: "bg-[#0084d5]/10 dark:bg-[#0084d5]/30", iconText: "text-[#0084d5] dark:text-[#38bdf8]" },
    success: { topBorder: "border-t-[#012169]", iconBg: "bg-[#012169]/10 dark:bg-[#012169]/30", iconText: "text-[#012169] dark:text-[#0084d5]" },
    warning: { topBorder: "border-t-[#0084d5]", iconBg: "bg-[#0084d5]/10 dark:bg-[#0084d5]/30", iconText: "text-[#0084d5] dark:text-[#38bdf8]" },
    danger: { topBorder: "border-t-[#94a3b8]", iconBg: "bg-[#94a3b8]/10 dark:bg-[#94a3b8]/30", iconText: "text-[#475569] dark:text-[#94a3b8]" },
  };

  const colors = colorMap[item.color as keyof typeof colorMap] || colorMap.brand;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={cn(
        "relative bg-card border border-border border-t-[3px] rounded-xl p-3 md:p-3.5 shadow-xs hover:shadow-sm transition-all duration-200 cursor-default flex flex-col items-center justify-center text-center space-y-1.5",
        colors.topBorder
      )}
    >
      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-colors mx-auto", colors.iconBg)}>
        <item.icon className={cn("w-4 h-4", colors.iconText)} />
      </div>

      <div className="space-y-0.5 w-full flex flex-col items-center justify-center">
        <div className="flex items-baseline justify-center gap-0.5">
          <span className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground text-center leading-tight">
            {item.color === "brand" && item.title.includes("Promedio")
              ? formatScore(displayValue)
              : formatNumber(Math.round(displayValue))
            }
          </span>
          {item.suffix && (
            <span className="text-[10px] font-semibold text-muted-foreground">{item.suffix}</span>
          )}
        </div>
        <p className="text-[11px] font-semibold text-muted-foreground text-center leading-tight max-w-[130px] mx-auto">{item.title}</p>
      </div>
    </motion.div>
  );
}

// ---- Alerts Panel ----
function AlertsPanel() {
  const alerts = [
    { type: "danger", message: "7 seguimientos PMI vencidos requieren atención", action: "/pmi" },
    { type: "warning", message: "18 colaboradores pendientes de evaluar en mayo", action: "/colaboradores" },
    { type: "warning", message: "Sandra Pérez - Evaluación no aprobada - PMI requerido", action: "/pmi/nuevo" },
    { type: "info", message: "Nueva versión de evaluación 2027 pendiente de configurar", action: "/configuracion/versiones" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5 }}
      className="rounded-xl border bg-card p-5 space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-[#012169] dark:text-[#0084d5]" />
          <h3 className="font-semibold">Alertas Pendientes</h3>
        </div>
        <span className="text-xs bg-danger-100 dark:bg-danger-950/30 text-danger-600 px-2 py-0.5 rounded-full font-semibold">
          {alerts.filter(a => a.type === "danger").length} críticas
        </span>
      </div>

      <div className="space-y-2">
        {alerts.map((alert, i) => (
          <Link href={alert.action} key={i}>
            <div className={cn(
              "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors",
              alert.type === "danger" ? "bg-danger-50 dark:bg-danger-950/20 hover:bg-danger-100 dark:hover:bg-danger-950/30" :
              alert.type === "warning" ? "bg-warning-50 dark:bg-warning-950/20 hover:bg-warning-100 dark:hover:bg-warning-950/30" :
              "bg-brand-50 dark:bg-brand-950/20 hover:bg-brand-100 dark:hover:bg-brand-950/30"
            )}>
              <div className={cn(
                "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                alert.type === "danger" ? "bg-danger-500" :
                alert.type === "warning" ? "bg-warning-500" : "bg-brand-500"
              )} />
              <p className="text-sm">{alert.message}</p>
            </div>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}

// ---- Recent Evaluations Table ----
function RecentEvaluations({ evaluations }: { evaluations: any[] }) {
  const [sortField, setSortField] = useState<string>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedEvaluations = [...evaluations].sort((a, b) => {
    let valA: any = a[sortField as keyof typeof a];
    let valB: any = b[sortField as keyof typeof b];

    if (sortField === "collaborator") {
      valA = (a.collaborator || "").toLowerCase();
      valB = (b.collaborator || "").toLowerCase();
    } else if (sortField === "position") {
      valA = (a.position || "").toLowerCase();
      valB = (b.position || "").toLowerCase();
    } else if (sortField === "result") {
      valA = (a.result || "").toLowerCase();
      valB = (b.result || "").toLowerCase();
    } else if (sortField === "score") {
      valA = Number(a.score) || 0;
      valB = Number(b.score) || 0;
    } else if (sortField === "date") {
      valA = a.date ? new Date(a.date).getTime() : 0;
      valB = b.date ? new Date(b.date).getTime() : 0;
    }

    if (valA === undefined || valA === null) return 1;
    if (valB === undefined || valB === null) return -1;

    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="rounded-xl border bg-card p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Evaluaciones Recientes</h3>
        <Link href="/evaluaciones" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
          Ver todas <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm data-table">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-3 text-muted-foreground font-semibold cursor-pointer select-none" onClick={() => handleSort("collaborator")}>
                <div className="flex items-center gap-1 hover:text-foreground transition-colors font-semibold">
                  Colaborador
                  {sortField === "collaborator" ? (
                    sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-55" />
                  )}
                </div>
              </th>
              <th className="pb-3 text-muted-foreground font-semibold hidden md:table-cell cursor-pointer select-none" onClick={() => handleSort("position")}>
                <div className="flex items-center gap-1 hover:text-foreground transition-colors font-semibold">
                  Cargo / Área
                  {sortField === "position" ? (
                    sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-55" />
                  )}
                </div>
              </th>
              <th className="pb-3 text-muted-foreground font-semibold cursor-pointer select-none" onClick={() => handleSort("result")}>
                <div className="flex items-center gap-1 hover:text-foreground transition-colors font-semibold">
                  Resultado
                  {sortField === "result" ? (
                    sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-55" />
                  )}
                </div>
              </th>
              <th className="pb-3 text-muted-foreground font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("score")}>
                <div className="flex items-center justify-end gap-1 hover:text-foreground transition-colors font-semibold">
                  Promedio
                  {sortField === "score" ? (
                    sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-55" />
                  )}
                </div>
              </th>
              <th className="pb-3 text-muted-foreground font-semibold text-right cursor-pointer select-none" onClick={() => handleSort("date")}>
                <div className="flex items-center justify-end gap-1 hover:text-foreground transition-colors font-semibold">
                  Fecha
                  {sortField === "date" ? (
                    sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-55" />
                  )}
                </div>
              </th>
              <th className="pb-3 text-muted-foreground font-medium text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedEvaluations.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted-foreground">
                  No hay evaluaciones recientes
                </td>
              </tr>
            ) : (
              sortedEvaluations.map((ev) => (
                <tr key={ev.id} className="hover:bg-muted/40 transition-colors">
                  <td className="py-3 font-medium">{ev.collaborator}</td>
                  <td className="py-3 hidden md:table-cell">
                    <div>
                      <p className="font-medium text-xs">{ev.position}</p>
                      <p className="text-muted-foreground text-xs">{ev.area}</p>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border",
                      ev.result === "aprobado" ? "text-success-600 bg-success-50 border-success-200 dark:bg-success-950/30" :
                      ev.result === "plan_mejoramiento" ? "text-warning-600 bg-warning-50 border-warning-200 dark:bg-warning-950/30" :
                      "text-danger-600 bg-danger-50 border-danger-200 dark:bg-danger-950/30"
                    )}>
                      {getResultLabel(ev.result)}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <span className={cn(
                      "font-bold text-base",
                      ev.score >= 4.0 ? "text-success-600" :
                      ev.score >= 3.1 ? "text-warning-600" : "text-danger-600"
                    )}>
                      {formatScore(ev.score)}
                    </span>
                  </td>
                  <td className="py-3 text-right text-muted-foreground text-xs">
                    {formatDateTime(ev.date)}
                  </td>
                  <td className="py-3 text-center">
                    <Link href={`/evaluaciones/${ev.id}`}>
                      <button className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                        <Eye className="w-4 h-4" />
                      </button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

// ---- Custom Tooltip ----
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-enterprise text-sm">
        <p className="font-semibold mb-2">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>
            {p.name}: <strong>{typeof p.value === "number" ? (p.value > 5 ? p.value : p.value.toFixed(2)) : p.value}</strong>
          </p>
        ))}
      </div>
    );
  }
  return null;
}

// ---- MAIN PAGE ----
export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const { isLoading: showLoading, progress: loadProgress } = useLoadingProgress(!stats);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [selectedResult, setSelectedResult] = useState("");
  const [selectedSeniority, setSelectedSeniority] = useState("requeridos");
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedChart, setExpandedChart] = useState<string | null>(null);
  const [trendViewMode, setTrendViewMode] = useState<"dia" | "mes">("dia");
  const [dbAreas, setDbAreas] = useState<any[]>([]);
  const [dbPositions, setDbPositions] = useState<any[]>([]);

  useEffect(() => {
    async function loadStats() {
      const data = await getDashboardStats();
      setStats(data);
    }
    async function loadConfigData() {
      try {
        const [areasRes, positionsRes] = await Promise.all([
          getAreas(),
          getPositions()
        ]);
        if (areasRes) setDbAreas(areasRes);
        if (positionsRes) setDbPositions(positionsRes);
      } catch (err) {
        console.error("Error loading areas/positions on dashboard mount:", err);
      }
    }
    loadStats();
    loadConfigData();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (expandedChart) setExpandedChart(null);
        else if (isExpanded) setIsExpanded(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, expandedChart]);

  // Filter evaluations based on user selections and seniority filter (6 months rule)
  const filteredEvals = stats?.allEvaluations ? stats.allEvaluations.filter((ev: any) => {
    if ((selectedSeniority === "requeridos" || selectedSeniority === "obligados") && ev.is_eligible === false) return false;
    if (selectedSeniority === "exentos" && ev.is_eligible === true) return false;
    if (startDate && new Date(ev.date) < new Date(startDate)) return false;
    if (endDate) {
      const limitDate = new Date(endDate);
      limitDate.setHours(23, 59, 59, 999);
      if (new Date(ev.date) > limitDate) return false;
    }
    if (selectedAreas.length > 0 && !selectedAreas.includes(ev.area)) return false;
    if (selectedPositions.length > 0 && !selectedPositions.includes(ev.position)) return false;
    if (selectedResult && ev.result !== selectedResult) return false;
    return true;
  }) : [];

  // Recalculate KPI data dynamically from filtered evaluations and collaborator stats
  const totalCollabs = stats?.kpis?.totalCollabs || 0;
  const eligibleCollabs = stats?.kpis?.eligibleCollabs || 0;
  const exemptCollabs = stats?.kpis?.exemptCollabs || 0;

  const displayCollabValue = (selectedSeniority === "requeridos" || selectedSeniority === "obligados")
    ? eligibleCollabs
    : selectedSeniority === "exentos"
    ? exemptCollabs
    : totalCollabs;

  const completedEvals = filteredEvals.filter((e: any) => e.result !== "borrador" && e.result !== "en_proceso").length;
  const aprobados = filteredEvals.filter((e: any) => e.result === "aprobado").length;
  const conPMI = filteredEvals.filter((e: any) => e.result === "plan_mejoramiento").length;
  const reprobados = filteredEvals.filter((e: any) => e.result === "no_aprobado").length;
  const pmisCount = filteredEvals.filter((e: any) => e.result === "plan_mejoramiento").length;
  const scoredEvals = filteredEvals.filter((e: any) => e.score > 0);
  const avgScore = scoredEvals.length > 0 ? scoredEvals.reduce((sum: number, e: any) => sum + e.score, 0) / scoredEvals.length : 0;

  const kpiData = [
    {
      title: (selectedSeniority === "requeridos" || selectedSeniority === "obligados")
        ? "Colaboradores Requeridos"
        : selectedSeniority === "exentos"
        ? "Colaboradores Exentos"
        : "Total Colaboradores",
      value: displayCollabValue,
      icon: Users,
      color: "brand",
      suffix: (selectedSeniority === "requeridos" || selectedSeniority === "obligados") ? ` (${exemptCollabs} exentos)` : ""
    },
    { title: "Evaluaciones Finalizadas", value: completedEvals, icon: ClipboardList, color: "violet", suffix: "" },
    { title: "Evaluaciones Aprobadas", value: aprobados, icon: CheckCircle2, color: "success", suffix: "" },
    { title: "Con Plan de Mejora", value: conPMI, icon: Target, color: "warning", suffix: "" },
    { title: "No Aprobados", value: reprobados, icon: AlertCircle, color: "danger", suffix: "" },
    { title: "Promedio General", value: avgScore, icon: Star, color: "brand", suffix: "/5.0" },
  ];

  const resultDistribution = [
    { name: "Aprobados", value: aprobados, color: "#012169" },
    { name: "Plan Mejora", value: conPMI, color: "#0084d5" },
    { name: "No Aprobados", value: reprobados, color: "#94a3b8" },
  ];

  // Recalculate dynamic position average data
  // Extract unique positions dynamically from database evaluations
  const dynamicPositions = stats?.allEvaluations
    ? (Array.from(new Set(stats.allEvaluations.map((e: any) => e.position).filter((p: any) => p && p !== "N/A"))) as string[]).sort()
    : [];

  const displayPositionsList = dynamicPositions.length > 0 ? dynamicPositions : ["Conductor", "Coordinador de Agencia", "Supervisor"];
  const positionAverageData = displayPositionsList.map(position => {
    const evs = filteredEvals.filter((e: any) => e.position === position && e.score > 0);
    const avg = evs.length > 0 ? evs.reduce((sum: number, e: any) => sum + e.score, 0) / evs.length : 0;
    return {
      position,
      promedio: Number(avg.toFixed(2)),
      evaluados: evs.length
    };
  }).sort((a, b) => b.promedio - a.promedio).slice(0, 10);
  
  // Recalculate dynamic trend data (por Día o por Mes)
  let trendData: Array<{ label: string; evaluaciones: number; promedio: number }> = [];

  if (trendViewMode === "dia") {
    const dailyMap: Record<string, { displayLabel: string; sum: number; count: number }> = {};
    
    filteredEvals.forEach((e: any) => {
      if (!e.date) return;
      const d = new Date(e.date);
      if (isNaN(d.getTime())) return;

      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateKey = `${yyyy}-${mm}-${dd}`;
      const monthsAbbr = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      const displayLabel = `${d.getDate()} ${monthsAbbr[d.getMonth()]}`;

      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { displayLabel, sum: 0, count: 0 };
      }
      dailyMap[dateKey].count += 1;
      if (e.score > 0) {
        dailyMap[dateKey].sum += e.score;
      }
    });

    trendData = Object.keys(dailyMap)
      .sort()
      .map(key => {
        const item = dailyMap[key];
        const avg = item.count > 0 && item.sum > 0 ? item.sum / item.count : 0;
        return {
          label: item.displayLabel,
          evaluaciones: item.count,
          promedio: Number(avg.toFixed(2))
        };
      });
  } else {
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const currentYear = new Date().getFullYear();
    trendData = months.map((mes, idx) => {
      const evs = filteredEvals.filter((e: any) => {
        const d = new Date(e.date);
        return d.getMonth() === idx && d.getFullYear() === currentYear;
      });
      const scoredEvs = evs.filter((e: any) => e.score > 0);
      const avg = scoredEvs.length > 0 ? scoredEvs.reduce((sum: number, e: any) => sum + e.score, 0) / scoredEvs.length : 0;
      return {
        label: mes,
        evaluaciones: evs.length,
        promedio: Number(avg.toFixed(2))
      };
    }).filter(t => t.evaluaciones > 0);
  }

  const displayTrendData = trendData.length > 0 ? trendData : [
    { label: trendViewMode === "dia" ? "Sin Datos" : "Ene", evaluaciones: 0, promedio: 0 }
  ];
  
  // Recalculate dynamic payroll type average EVD score data from evaluated collaborators (score > 0)
  const payrollAverages: Record<string, { sum: number; count: number }> = {};
  filteredEvals.forEach((e: any) => {
    if (e.payroll_type && e.payroll_type !== "N/A" && e.score > 0) {
      const pType = e.payroll_type.trim();
      if (!payrollAverages[pType]) {
        payrollAverages[pType] = { sum: 0, count: 0 };
      }
      payrollAverages[pType].sum += e.score;
      payrollAverages[pType].count += 1;
    }
  });

  const payrollChartData = Object.entries(payrollAverages).map(([payroll, data]) => ({
    payroll,
    promedio: Number((data.sum / data.count).toFixed(2)),
    evaluaciones: data.count
  })).sort((a, b) => b.promedio - a.promedio);

  const displayPayrollData = payrollChartData;

  // Recalculate evaluations count and average by leader
  const leaderCountsMap: Record<string, { name: string; count: number; sumScore: number; scoreCount: number }> = {};
  filteredEvals.forEach((e: any) => {
    const leaderName = e.evaluator_name && e.evaluator_name !== "Sin Asignar" ? e.evaluator_name : null;
    if (!leaderName) return;
    if (!leaderCountsMap[leaderName]) {
      leaderCountsMap[leaderName] = { name: leaderName, count: 0, sumScore: 0, scoreCount: 0 };
    }
    leaderCountsMap[leaderName].count += 1;
    if (e.score > 0) {
      leaderCountsMap[leaderName].sumScore += e.score;
      leaderCountsMap[leaderName].scoreCount += 1;
    }
  });

  const leaderChartData = Object.values(leaderCountsMap).map(l => ({
    name: l.name,
    evaluaciones: l.count,
    promedio: l.scoreCount > 0 ? Number((l.sumScore / l.scoreCount).toFixed(2)) : 0
  })).sort((a, b) => b.evaluaciones - a.evaluaciones);

  const displayLeaderData = leaderChartData.slice(0, 10);

  // Calculate relation of payroll type by Area
  const areaPayrollCounts: Record<string, Record<string, number>> = {};
  const payrollTypesSet = new Set<string>();

  const collabs = stats?.collaborators || [];
  collabs.forEach((c: any) => {
    if ((selectedSeniority === "requeridos" || selectedSeniority === "obligados") && c.is_eligible === false) return;
    if (selectedSeniority === "exentos" && c.is_eligible === true) return;
    if (selectedAreas.length > 0 && !selectedAreas.includes(c.area)) return;

    const areaName = c.area || "Sin Área";
    const payrollName = c.payroll_type || "Sin Especificar";
    if (payrollName && payrollName !== "N/A") {
      payrollTypesSet.add(payrollName);
    }
    if (!areaPayrollCounts[areaName]) {
      areaPayrollCounts[areaName] = {};
    }
    areaPayrollCounts[areaName][payrollName] = (areaPayrollCounts[areaName][payrollName] || 0) + 1;
  });

  // Unique list of payroll types found
  const dynamicPayrollTypes = Array.from(payrollTypesSet).sort();

  // Map to Recharts data array
  const areaPayrollChartData = Object.entries(areaPayrollCounts).map(([area, counts]) => {
    const obj: any = { area };
    Object.entries(counts).forEach(([payroll, count]) => {
      obj[payroll] = count;
    });
    return obj;
  }).sort((a: any, b: any) => {
    // Sort by total count descending
    const sumA = Object.keys(a).filter(k => k !== "area").reduce((acc, k) => acc + (a[k] || 0), 0);
    const sumB = Object.keys(b).filter(k => k !== "area").reduce((acc, k) => acc + (b[k] || 0), 0);
    return sumB - sumA;
  });

  // Paleta de Colores Corporativos (Grupo Libertadores / Sugamuxi)
  const PAYROLL_COLORS = [
    "#012169", // Azul Profundo
    "#0084d5", // Azul Digital
    "#131b2e", // Negro Tech
    "#94a3b8", // Gris UX
    "#1fccea", // Action Cyan
    "#38bdf8", // Sky Blue
    "#64748b", // Slate Gray
    "#0284c7", // Deep Sky Blue
    "#475569", // Dark Slate
    "#cbd5e1"  // Light Gray
  ];

  // 1. Niveles de Desempeño con Colores Corporativos
  const tierExcelente = filteredEvals.filter((e: any) => e.score >= 4.5 && e.score <= 5.0).length;
  const tierSobresaliente = filteredEvals.filter((e: any) => e.score >= 3.5 && e.score < 4.5).length;
  const tierCompetente = filteredEvals.filter((e: any) => e.score >= 2.5 && e.score < 3.5).length;
  const tierRequiereMejora = filteredEvals.filter((e: any) => e.score >= 1.5 && e.score < 2.5).length;
  const tierInsatisfactorio = filteredEvals.filter((e: any) => e.score > 0 && e.score < 1.5).length;
  const totalClassified = tierExcelente + tierSobresaliente + tierCompetente + tierRequiereMejora + tierInsatisfactorio;

  const performanceTiersData = [
    {
      name: "Excelente (4.5 - 5.0)",
      value: tierExcelente,
      percentage: totalClassified > 0 ? ((tierExcelente / totalClassified) * 100).toFixed(1) : "0",
      displayLabel: totalClassified > 0 && tierExcelente > 0 ? `${tierExcelente} (${((tierExcelente / totalClassified) * 100).toFixed(1)}%)` : `${tierExcelente}`,
      color: "#012169"
    },
    {
      name: "Sobresaliente (3.5 - 4.49)",
      value: tierSobresaliente,
      percentage: totalClassified > 0 ? ((tierSobresaliente / totalClassified) * 100).toFixed(1) : "0",
      displayLabel: totalClassified > 0 && tierSobresaliente > 0 ? `${tierSobresaliente} (${((tierSobresaliente / totalClassified) * 100).toFixed(1)}%)` : `${tierSobresaliente}`,
      color: "#0084d5"
    },
    {
      name: "Cumple lo esperado (2.5 - 3.49)",
      value: tierCompetente,
      percentage: totalClassified > 0 ? ((tierCompetente / totalClassified) * 100).toFixed(1) : "0",
      displayLabel: totalClassified > 0 && tierCompetente > 0 ? `${tierCompetente} (${((tierCompetente / totalClassified) * 100).toFixed(1)}%)` : `${tierCompetente}`,
      color: "#38bdf8"
    },
    {
      name: "Requiere Mejora (1.5 - 2.49)",
      value: tierRequiereMejora,
      percentage: totalClassified > 0 ? ((tierRequiereMejora / totalClassified) * 100).toFixed(1) : "0",
      displayLabel: totalClassified > 0 && tierRequiereMejora > 0 ? `${tierRequiereMejora} (${((tierRequiereMejora / totalClassified) * 100).toFixed(1)}%)` : `${tierRequiereMejora}`,
      color: "#94a3b8"
    },
    {
      name: "No cumple (< 1.5)",
      value: tierInsatisfactorio,
      percentage: totalClassified > 0 ? ((tierInsatisfactorio / totalClassified) * 100).toFixed(1) : "0",
      displayLabel: totalClassified > 0 && tierInsatisfactorio > 0 ? `${tierInsatisfactorio} (${((tierInsatisfactorio / totalClassified) * 100).toFixed(1)}%)` : `${tierInsatisfactorio}`,
      color: "#475569"
    },
  ];

  // 2. Rendimiento Promedio por Sede (Ciudad)
  const citiesList = Array.from(new Set(filteredEvals.map((e: any) => e.workplace_city).filter(Boolean))) as string[];
  const displayCitiesList = citiesList.length > 0 ? citiesList : ["Sogamoso", "Duitama", "Tunja", "Bogotá", "Yopal"];

  const performanceByCityData = displayCitiesList.map(city => {
    const evs = filteredEvals.filter((e: any) => e.workplace_city === city && e.score > 0);
    const avg = evs.length > 0 ? evs.reduce((sum: number, e: any) => sum + e.score, 0) / evs.length : 0;
    return {
      city,
      promedio: Number(avg.toFixed(2)),
      evaluaciones: evs.length
    };
  }).sort((a, b) => b.promedio - a.promedio);

  // 3. Distribución del Estado de PMI
  const pmiRequiredEvals = filteredEvals.filter((e: any) => e.pmi_required || e.pmi_status);
  const pmiActivos = pmiRequiredEvals.filter((e: any) => e.pmi_status === "activo" || e.pmi_status === "en_seguimiento").length;
  const pmiCerrados = pmiRequiredEvals.filter((e: any) => e.pmi_status === "cerrado").length;
  const pmiVencidos = pmiRequiredEvals.filter((e: any) => e.pmi_status === "vencido").length;
  const pmiPendientes = pmiRequiredEvals.filter((e: any) => !e.pmi_status || e.pmi_status === "pendiente").length;

  const pmiStatusDistribution = [
    { name: "En Seguimiento", value: pmiActivos, color: "#f59e0b" },
    { name: "Cerrados", value: pmiCerrados, color: "#10b981" },
    { name: "Vencidos", value: pmiVencidos, color: "#ef4444" },
    { name: "Pendientes", value: pmiPendientes, color: "#71717a" },
  ];

  // Filtered recent 5 evaluations
  const recentEvals = filteredEvals.slice(0, 5);


  if (showLoading || !stats) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-4">
        <LoadingProgress icon={BarChart3} title="Cargando métricas ejecutivas..." description="Consolidando indicadores de desempeño, promedios y cumplimiento..." progress={loadProgress} />

      </div>
    );
  }

  return (
    <div className={cn(
      "space-y-6 animate-fade-in bg-background",
      isExpanded && "fixed inset-0 z-[100] overflow-y-auto p-6 md:p-8 w-screen h-screen"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Ejecutivo</h1>
          <p className="text-muted-foreground text-sm">
            Monitoreo y métricas de desempeño de colaboradores
          </p>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-xl border bg-card hover:bg-accent text-xs sm:text-sm font-semibold transition-all shadow-sm"
        >
          {isExpanded ? (
            <>
              <Minimize2 className="w-4 h-4" />
              <span>Salir Pantalla Completa</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-4 h-4" />
              <span>Pantalla Completa</span>
            </>
          )}
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-card border rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 shadow-sm">
        <div className="lg:col-span-2 space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Antigüedad</label>
          <select
            value={selectedSeniority}
            onChange={(e) => setSelectedSeniority(e.target.value)}
            className="w-full text-xs border rounded-xl px-2.5 py-1.5 bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none h-[38px] font-medium"
          >
            <option value="requeridos">Requeridos (≥ 6 meses)</option>
            <option value="todos">Todos los colaboradores</option>
            <option value="exentos">Exentos (&lt; 6 meses)</option>
          </select>
        </div>
        <div className="lg:col-span-2">
          <MultiSelectSearch
            options={dbAreas}
            selectedValues={selectedAreas}
            onChange={setSelectedAreas}
            placeholder="Todas las áreas"
            searchPlaceholder="Buscar área..."
            label="Área"
          />
        </div>
        <div className="lg:col-span-2">
          <MultiSelectSearch
            options={dbPositions}
            selectedValues={selectedPositions}
            onChange={setSelectedPositions}
            placeholder="Todos los cargos"
            searchPlaceholder="Buscar cargo..."
            label="Cargo"
          />
        </div>
        <div className="lg:col-span-3 space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Rango de Fechas</label>
          <div className="flex items-center gap-1.5 w-full min-w-0">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full min-w-0 text-xs border rounded-xl px-2 py-1.5 bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none h-[38px]"
              title="Fecha Inicio"
            />
            <span className="text-muted-foreground text-xs font-semibold px-0.5 shrink-0">a</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full min-w-0 text-xs border rounded-xl px-2 py-1.5 bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none h-[38px]"
              title="Fecha Fin"
            />
          </div>
        </div>
        <div className="lg:col-span-2 space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Resultado</label>
          <select
            value={selectedResult}
            onChange={(e) => setSelectedResult(e.target.value)}
            className="w-full text-xs border rounded-xl px-2.5 py-1.5 bg-background focus:ring-2 focus:ring-primary/20 focus:outline-none h-[38px]"
          >
            <option value="">Todos los resultados</option>
            <option value="aprobado">Aprobados</option>
            <option value="plan_mejoramiento">Con Plan de Mejora</option>
            <option value="no_aprobado">No Aprobados</option>
          </select>
        </div>
        <div className="lg:col-span-1 flex items-end">
          <button
            onClick={() => {
              setStartDate("");
              setEndDate("");
              setSelectedAreas([]);
              setSelectedPositions([]);
              setSelectedResult("");
              setSelectedSeniority("requeridos");
            }}
            className="w-full text-xs border rounded-xl px-2 py-1.5 bg-muted hover:bg-accent transition-colors font-semibold text-muted-foreground hover:text-foreground h-[38px] truncate"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 stagger-children">
        {kpiData.map((item, i) => (
          <KPICard key={item.title} item={item} index={i} />
        ))}
      </div>

      {/* Charts Row 3 — Nuevos Gráficos Gerenciales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Gráfico 1: Niveles de Desempeño */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-xl border bg-card p-5 flex flex-col justify-between h-full"
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-semibold">Niveles de Desempeño</h3>
              <p className="text-xs text-muted-foreground">Distribución por rangos EVD</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setExpandedChart("desempeno")}
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Expandir gráfico"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <Users className="w-5 h-5 text-[#012169] dark:text-[#0084d5]" />
            </div>
          </div>
          <div className="flex-1 w-full min-h-[240px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height={isExpanded ? 320 : 250}>
              <BarChart
                data={performanceTiersData}
                layout="vertical"
                margin={{ top: 10, right: 65, left: 10, bottom: 5 }}
                barSize={18}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} vertical={true} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  width={145}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: any, name: any, item: any) => {
                    const payload = item?.payload;
                    const pct = payload?.percentage || "0";
                    return [`${value} colaboradores (${pct}%)`, "Cantidad"];
                  }}
                />
                <Bar dataKey="value" name="Colaboradores" radius={[0, 4, 4, 0]}>
                  <LabelList
                    dataKey="displayLabel"
                    position="right"
                    dx={6}
                    style={{ fontSize: 10, fill: "hsl(var(--foreground))", fontWeight: "bold" }}
                  />
                  {performanceTiersData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between pt-3 border-t text-xs text-muted-foreground mt-2">
            <span>Evaluaciones clasificadas: <strong className="text-foreground">{completedEvals}</strong></span>
            <span className="text-[#012169] dark:text-[#0084d5] font-bold">
              {completedEvals > 0 ? `${Math.round(((performanceTiersData[0].value + performanceTiersData[1].value) / completedEvals) * 100)}% nivel superior` : "0%"}
            </span>
          </div>
        </motion.div>

        {/* Colaboradores Destacados Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="rounded-xl border bg-card p-5 flex flex-col justify-between h-full space-y-3"
        >
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="font-semibold">Colaboradores Destacados</h3>
              <p className="text-xs text-muted-foreground">Ranking de mejores promedios en EVD</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setExpandedChart("destacados")}
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Expandir gráfico"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <Award className="w-5 h-5 text-[#012169] dark:text-[#0084d5]" />
            </div>
          </div>
          <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1 flex-1">
            {filteredEvals
              .filter((e: any) => e.score > 0)
              .sort((a: any, b: any) => b.score - a.score)
              .map((e: any, idx: number) => {
                const badgeStyle = idx === 0
                  ? "bg-amber-500/20 text-amber-700 border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-300"
                  : idx === 1
                  ? "bg-slate-300/40 text-slate-700 border-slate-400/50 dark:bg-slate-700/40 dark:text-slate-200"
                  : idx === 2
                  ? "bg-amber-700/20 text-amber-800 border-amber-700/40 dark:bg-amber-800/30 dark:text-amber-200"
                  : "bg-[#012169]/10 text-[#012169] border-[#012169]/20 dark:bg-[#0084d5]/20 dark:text-[#38bdf8]";
                
                const badgeLabel = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
                return (
                  <div key={e.id} className="flex items-center justify-between p-2.5 rounded-xl border bg-muted/10">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border shrink-0", badgeStyle)}>
                        {badgeLabel}
                      </span>
                      <div className="overflow-hidden">
                        <p className="font-semibold text-xs truncate text-foreground leading-normal">{e.collaborator}</p>
                        <p className="text-[10px] text-muted-foreground truncate leading-normal">{e.position}</p>
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-[#012169] dark:text-[#0084d5] px-2 py-0.5 bg-[#012169]/10 dark:bg-[#0084d5]/20 rounded-lg shrink-0">
                      {e.score.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            {filteredEvals.filter((e: any) => e.score > 0).length === 0 && (
              <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
                No hay evaluaciones registradas.
              </div>
            )}
          </div>
          <div className="flex items-center justify-between pt-3 border-t text-xs text-muted-foreground mt-auto">
            <span>Colaboradores con nota: <strong className="text-foreground">{filteredEvals.filter((e: any) => e.score > 0).length}</strong></span>
            <span className="text-amber-600 dark:text-amber-400 font-semibold">Top EVD</span>
          </div>
        </motion.div>

        {/* Datos de Interés Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-xl border bg-card p-5 flex flex-col justify-between h-full space-y-3"
        >
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="font-semibold">Datos de Interés</h3>
              <p className="text-xs text-muted-foreground">Métricas ejecutivas de cumplimiento</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setExpandedChart("datos_interes")}
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Expandir gráfico"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <TrendingUp className="w-5 h-5 text-[#0084d5]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-2.5 rounded-xl border bg-[#012169]/5 border-[#012169]/20 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-[#012169] dark:text-[#0084d5] uppercase tracking-wider">Aprobación</span>
              <div className="mt-1.5">
                <p className="text-xl font-black text-[#012169] dark:text-[#0084d5] leading-none">
                  {completedEvals > 0 ? ((aprobados / completedEvals) * 100).toFixed(0) : 0}%
                </p>
                <p className="text-[9px] text-muted-foreground mt-1">Colaboradores aprobados</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border bg-[#0084d5]/5 border-[#0084d5]/20 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-[#0084d5] dark:text-[#38bdf8] uppercase tracking-wider">Planes de Mejora</span>
              <div className="mt-1.5">
                <p className="text-xl font-black text-[#0084d5] dark:text-[#38bdf8] leading-none">
                  {completedEvals > 0 ? ((conPMI / completedEvals) * 100).toFixed(0) : 0}%
                </p>
                <p className="text-[9px] text-muted-foreground mt-1">Requirieron PMI</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border bg-brand-50/5 dark:bg-brand-950/5 border-brand-200/50 dark:border-brand-900/30 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-brand-700 dark:text-brand-400 uppercase tracking-wider">Promedio General</span>
              <div className="mt-1.5">
                <p className="text-xl font-black text-brand-600 dark:text-brand-400 leading-none">
                  {avgScore.toFixed(2)}
                </p>
                <p className="text-[9px] text-muted-foreground mt-1">Calificación promedio</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border bg-slate-500/5 border-slate-300 dark:border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider">Tasa Crítica</span>
              <div className="mt-1.5">
                <p className="text-xl font-black text-slate-700 dark:text-slate-300 leading-none">
                  {completedEvals > 0 ? ((reprobados / completedEvals) * 100).toFixed(0) : 0}%
                </p>
                <p className="text-[9px] text-muted-foreground mt-1">No aprobados</p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl border bg-muted/10 space-y-2 mt-auto">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Datos del Proceso</h4>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Requeridos (≥ 6 meses):</span>
              <span className="font-semibold text-foreground">{eligibleCollabs}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Exentos (&lt; 6 meses):</span>
              <span className="font-semibold text-slate-500">{exemptCollabs}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Evaluaciones realizadas:</span>
              <span className="font-semibold text-foreground">{completedEvals}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Participación (sobre requeridos):</span>
              <span className="font-bold text-[#012169] dark:text-[#0084d5]">
                {eligibleCollabs > 0 ? Math.min(100, Math.round((completedEvals / eligibleCollabs) * 100)) : 0}%
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cargo Averages Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="lg:col-span-2 rounded-xl border bg-card p-5"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold">Promedio por Cargo</h3>
              <p className="text-xs text-muted-foreground">Evaluaciones finalizadas (Top 10)</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setExpandedChart("cargo")}
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Expandir gráfico"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <BarChart3 className="w-5 h-5 text-[#012169] dark:text-[#0084d5]" />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={isExpanded ? 340 : 260}>
            <BarChart data={positionAverageData} barSize={30} margin={{ top: 25, right: 10, left: -10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="position"
                interval={0}
                angle={-25}
                textAnchor="end"
                height={55}
                tick={{ fontSize: 9.5, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis domain={[0, 5]} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="promedio" name="Promedio" radius={[6, 6, 0, 0]}>
                <LabelList dataKey="promedio" position="top" dy={-4} style={{ fontSize: 10, fill: "hsl(var(--foreground))", fontWeight: "bold" }} />
                {positionAverageData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.promedio >= 4.0 ? "#012169" : entry.promedio >= 3.1 ? "#0084d5" : "#94a3b8"}
                  />
                ))}
              </Bar>
              {/* Threshold line at 4.0 */}
              <CartesianGrid y={4.0} strokeDasharray="4 4" stroke="#012169" vertical={false} horizontal={false} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-[#012169] inline-block" /> Aprobado (≥4.0)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-[#0084d5] inline-block" /> Plan Mejora (3.1–3.9)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-[#94a3b8] inline-block" /> No Aprobado (&lt;3.1)</span>
          </div>
        </motion.div>

        {/* Result Distribution Pie */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="rounded-xl border bg-card p-5"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold">Distribución</h3>
              <p className="text-xs text-muted-foreground">{completedEvals} evaluaciones finalizadas</p>
            </div>
            <button
              onClick={() => setExpandedChart("dist")}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Expandir gráfico"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={isExpanded ? 240 : 180}>
            <PieChart margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
              <Pie
                data={resultDistribution}
                cx="50%"
                cy="50%"
                innerRadius={36}
                outerRadius={56}
                paddingAngle={3}
                dataKey="value"
                label={(props: any) => {
                  const { cx = 0, cy = 0, midAngle = 0, outerRadius = 0, value = 0, percent = 0 } = props || {};
                  if (!value || value === 0) return null;
                  const RADIAN = Math.PI / 180;
                  const radius = Number(outerRadius) + 14;
                  const x = Number(cx) + radius * Math.cos(-Number(midAngle) * RADIAN);
                  const y = Number(cy) + radius * Math.sin(-Number(midAngle) * RADIAN);
                  return (
                    <text
                      x={x}
                      y={y}
                      fill="hsl(var(--foreground))"
                      textAnchor={x > Number(cx) ? "start" : "end"}
                      dominantBaseline="central"
                      fontSize={10}
                      fontWeight="bold"
                    >
                      {`${value} (${Math.round(Number(percent) * 100)}%)`}
                    </text>
                  );
                }}
                labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
              >
                {resultDistribution.map((entry, index) => (
                  <Cell key={index} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [`${value} evaluaciones`, name || "Cantidad"]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {resultDistribution.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                  <span className="text-muted-foreground text-xs">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs">{item.value}</span>
                  <span className="text-muted-foreground text-xs">
                    ({completedEvals > 0 ? ((item.value / completedEvals) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Gráfico de Tendencia Temporal (Fila Completa) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="rounded-xl border bg-card p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div>
            <h3 className="font-semibold">Tendencia</h3>
            <p className="text-xs text-muted-foreground">
              {trendViewMode === "dia" ? "Evolución diaria de evaluaciones y promedio" : "Evolución mensual de evaluaciones y promedio"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Filter Buttons: Día / Mes */}
            <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border text-xs">
              <button
                onClick={() => setTrendViewMode("dia")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-semibold transition-all text-xs",
                  trendViewMode === "dia"
                    ? "bg-[#012169] text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Por Día
              </button>
              <button
                onClick={() => setTrendViewMode("mes")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-semibold transition-all text-xs",
                  trendViewMode === "mes"
                    ? "bg-[#012169] text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Por Mes
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setExpandedChart("trend")}
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Expandir gráfico"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <TrendingUp className="w-5 h-5 text-[#012169] dark:text-[#0084d5]" />
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={isExpanded ? 340 : 260}>
          <LineChart data={displayTrendData} margin={{ top: 25, right: 30, left: -10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 5]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line yAxisId="left" type="monotone" dataKey="evaluaciones" stroke="#012169" strokeWidth={2.5} dot={{ r: 4, fill: "#012169" }} name="Evaluaciones" activeDot={{ r: 6 }}>
              <LabelList dataKey="evaluaciones" position="top" dy={-8} style={{ fontSize: 10, fill: "#012169", fontWeight: "bold" }} />
            </Line>
            <Line yAxisId="right" type="monotone" dataKey="promedio" stroke="#0084d5" strokeWidth={2.5} dot={{ r: 4, fill: "#0084d5" }} name="Promedio" activeDot={{ r: 6 }}>
              <LabelList dataKey="promedio" position="bottom" dy={8} style={{ fontSize: 10, fill: "#0084d5", fontWeight: "bold" }} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Relación de Tipo de Nómina por Área */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.68 }}
        className="rounded-xl border bg-card p-5"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold">Relación de Tipo de Nómina por Área</h3>
            <p className="text-xs text-muted-foreground">Distribución estructural de colaboradores activos</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpandedChart("payroll_area")}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Expandir gráfico"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <GitBranch className="w-5 h-5 text-[#012169] dark:text-[#0084d5]" />
          </div>
        </div>
        {dynamicPayrollTypes.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={areaPayrollChartData}
              margin={{ top: 25, right: 15, left: -10, bottom: 5 }}
              barSize={32}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="area" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              {dynamicPayrollTypes.map((pt, idx) => (
                <Bar
                  key={pt}
                  dataKey={pt}
                  name={pt}
                  stackId="a"
                  fill={PAYROLL_COLORS[idx % PAYROLL_COLORS.length]}
                >
                  <LabelList
                    dataKey={pt}
                    position="center"
                    formatter={(val: any) => (val > 0 ? val : "")}
                    style={{ fontSize: 10, fill: "#ffffff", fontWeight: "bold" }}
                  />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[280px] text-xs text-muted-foreground border border-dashed rounded-lg bg-muted/10">
            No hay información registrada.
          </div>
        )}
      </motion.div>

      {/* Gráfico: Evaluaciones por Líder */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="rounded-xl border bg-card p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-[#012169] dark:text-[#0084d5]" />
              Evaluaciones Realizadas por Líder
            </h3>
            <p className="text-xs text-muted-foreground">
              Cantidad de evaluaciones realizadas y promedio otorgado por líder evaluador (Top 10)
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setExpandedChart("lideres")}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Expandir gráfico"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {displayLeaderData.length > 0 ? (
          <ResponsiveContainer width="100%" height={isExpanded ? 340 : 280}>
            <BarChart
              data={displayLeaderData}
              layout="vertical"
              margin={{ top: 10, right: 65, left: 15, bottom: 5 }}
              barSize={20}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} vertical={true} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 10.5, fill: "hsl(var(--muted-foreground))" }}
                width={150}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: any, name: any, item: any) => {
                  const payload = item?.payload;
                  const avg = payload?.promedio ? ` (Promedio: ${payload.promedio})` : "";
                  return [`${value} evaluaciones${avg}`, "Evaluaciones Realizadas"];
                }}
              />
              <Bar dataKey="evaluaciones" name="Evaluaciones" radius={[0, 4, 4, 0]} fill="#012169">
                <LabelList
                  dataKey="evaluaciones"
                  position="right"
                  dx={6}
                  style={{ fontSize: 11, fill: "hsl(var(--foreground))", fontWeight: "bold" }}
                />
                {displayLeaderData.map((_, index) => (
                  <Cell
                    key={index}
                    fill={index === 0 ? "#012169" : index < 3 ? "#0084d5" : "#64748b"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[260px] text-xs text-muted-foreground border border-dashed rounded-lg bg-muted/10">
            No hay evaluaciones registradas con evaluador asignado en los filtros actuales.
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t text-xs text-muted-foreground">
          <span>Líderes con evaluaciones: <strong className="text-foreground">{leaderChartData.length}</strong></span>
          <span className="text-[#012169] dark:text-[#0084d5] font-bold">
            {leaderChartData.reduce((acc, curr) => acc + curr.evaluaciones, 0)} evaluaciones totales
          </span>
        </div>
      </motion.div>

      {/* Modal de Gráfico Expandido */}
      <AnimatePresence>
        {expandedChart && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border rounded-2xl p-5 md:p-6 w-full max-w-4xl shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setExpandedChart(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Cerrar"
              >
                <Minimize2 className="w-5 h-5" />
              </button>

              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {expandedChart === "cargo" && "Promedio por Cargo"}
                  {expandedChart === "dist" && "Distribución de Resultados"}
                  {expandedChart === "trend" && "Tendencia Temporal"}
                  {expandedChart === "payroll" && "Desempeño por Tipo de Nómina"}
                  {expandedChart === "payroll_area" && "Relación de Tipo de Nómina por Área"}
                  {expandedChart === "desempeno" && "Niveles de Desempeño"}
                  {expandedChart === "destacados" && "Ranking de Colaboradores Destacados"}
                  {expandedChart === "datos_interes" && "Datos de Interés y Métricas del Proceso"}
                  {expandedChart === "lideres" && "Evaluaciones Realizadas por Líder"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {expandedChart === "cargo" && "Puntaje promedio obtenido agrupado por cargo de la empresa (Top 10)"}
                  {expandedChart === "dist" && `Distribución porcentual de las ${completedEvals} evaluaciones finalizadas`}
                  {expandedChart === "trend" && "Histórico mensual del volumen de evaluaciones y promedio general"}
                  {expandedChart === "payroll" && "Calificación promedio agrupada por tipo de nómina del colaborador"}
                  {expandedChart === "payroll_area" && "Distribución estructural de colaboradores activos según área y nómina"}
                  {expandedChart === "desempeno" && "Distribución de colaboradores por rango y escala oficial de calificación EVD"}
                  {expandedChart === "destacados" && "Listado completo y detallado de los colaboradores con mejores promedios en la evaluación"}
                  {expandedChart === "datos_interes" && "Métricas ejecutivas de cumplimiento, tasas de aprobación y consolidado de participación"}
                  {expandedChart === "lideres" && "Listado completo de evaluaciones realizadas y calificación promedio otorgada por cada líder evaluador"}
                </p>
              </div>

              <div className="w-full flex items-center justify-center min-h-[300px] md:min-h-[400px]">
                {expandedChart === "cargo" && (
                  <div className="w-full">
                    <ResponsiveContainer width="100%" height={420}>
                      <BarChart data={positionAverageData} barSize={36} margin={{ top: 25, right: 15, left: -10, bottom: 35 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                          dataKey="position"
                          interval={0}
                          angle={-25}
                          textAnchor="end"
                          height={65}
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis domain={[0, 5]} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="promedio" name="Promedio" radius={[6, 6, 0, 0]}>
                          <LabelList dataKey="promedio" position="top" dy={-4} style={{ fontSize: 11, fill: "hsl(var(--foreground))", fontWeight: "bold" }} />
                          {positionAverageData.map((entry, index) => (
                            <Cell
                              key={index}
                              fill={entry.promedio >= 4.0 ? "#012169" : entry.promedio >= 3.1 ? "#0084d5" : "#94a3b8"}
                            />
                          ))}
                        </Bar>
                        <CartesianGrid y={4.0} strokeDasharray="4 4" stroke="#012169" vertical={false} horizontal={false} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-[#012169] inline-block" /> Aprobado (≥4.0)</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-[#0084d5] inline-block" /> Plan Mejora (3.1–3.9)</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-[#94a3b8] inline-block" /> No Aprobado (&lt;3.1)</span>
                    </div>
                  </div>
                )}

                {expandedChart === "dist" && (
                  <div className="w-full flex flex-col md:flex-row items-center justify-center gap-6">
                    <div className="w-full md:w-2/3 h-[280px] md:h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ top: 20, right: 35, left: 35, bottom: 20 }}>
                          <Pie
                            data={resultDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={3}
                            dataKey="value"
                            label={(props: any) => {
                              const { cx = 0, cy = 0, midAngle = 0, outerRadius = 0, value = 0, percent = 0 } = props || {};
                              if (!value || value === 0) return null;
                              const RADIAN = Math.PI / 180;
                              const radius = Number(outerRadius) + 16;
                              const x = Number(cx) + radius * Math.cos(-Number(midAngle) * RADIAN);
                              const y = Number(cy) + radius * Math.sin(-Number(midAngle) * RADIAN);
                              return (
                                <text
                                  x={x}
                                  y={y}
                                  fill="hsl(var(--foreground))"
                                  textAnchor={x > Number(cx) ? "start" : "end"}
                                  dominantBaseline="central"
                                  fontSize={12}
                                  fontWeight="bold"
                                >
                                  {`${value} (${Math.round(Number(percent) * 100)}%)`}
                                </text>
                              );
                            }}
                            labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                          >
                            {resultDistribution.map((entry, index) => (
                              <Cell key={index} fill={entry.color} stroke="transparent" />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value, name) => [`${value} evaluaciones`, name || "Cantidad"]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full md:w-1/3 space-y-2">
                      {resultDistribution.map((item) => (
                        <div key={item.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                            <span className="text-muted-foreground">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 font-semibold">
                            <span>{item.value}</span>
                            <span className="text-muted-foreground text-xs">
                              ({completedEvals > 0 ? ((item.value / completedEvals) * 100).toFixed(0) : 0}%)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {expandedChart === "trend" && (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={displayTrendData} margin={{ top: 25, right: 15, left: -10, bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 5]} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line yAxisId="left" type="monotone" dataKey="evaluaciones" stroke="#012169" strokeWidth={3} dot={{ r: 5, fill: "#012169" }} name="Evaluaciones">
                        <LabelList dataKey="evaluaciones" position="top" dy={-8} style={{ fontSize: 10, fill: "#012169", fontWeight: "bold" }} />
                      </Line>
                      <Line yAxisId="right" type="monotone" dataKey="promedio" stroke="#0084d5" strokeWidth={3} dot={{ r: 5, fill: "#0084d5" }} name="Promedio">
                        <LabelList dataKey="promedio" position="bottom" dy={8} style={{ fontSize: 10, fill: "#0084d5", fontWeight: "bold" }} />
                      </Line>
                    </LineChart>
                  </ResponsiveContainer>
                )}

                {expandedChart === "payroll" && (
                  displayPayrollData.length > 0 ? (
                    <div className="w-full">
                      <ResponsiveContainer width="100%" height={380}>
                        <BarChart data={displayPayrollData} barSize={40} margin={{ top: 25, right: 10, left: -10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis dataKey="payroll" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 5]} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="promedio" name="Promedio" radius={[6, 6, 0, 0]}>
                            <LabelList dataKey="promedio" position="top" dy={-4} style={{ fontSize: 11, fill: "hsl(var(--foreground))", fontWeight: "bold" }} />
                            {displayPayrollData.map((entry, index) => (
                              <Cell
                                key={index}
                                fill={entry.promedio >= 4.0 ? "#012169" : entry.promedio >= 3.1 ? "#0084d5" : "#94a3b8"}
                              />
                            ))}
                          </Bar>
                          <CartesianGrid y={4.0} strokeDasharray="4 4" stroke="#012169" vertical={false} horizontal={false} />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-[#012169] inline-block" /> Aprobado (≥4.0)</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-[#0084d5] inline-block" /> Plan Mejora (3.1–3.9)</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-[#94a3b8] inline-block" /> No Aprobado (&lt;3.1)</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-full h-[300px] text-sm text-muted-foreground border border-dashed rounded-lg bg-muted/10">
                      No hay evaluaciones registradas.
                    </div>
                  )
                )}

                {expandedChart === "payroll_area" && (
                  dynamicPayrollTypes.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart
                        data={areaPayrollChartData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                        barSize={40}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="area" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                        {dynamicPayrollTypes.map((pt, idx) => (
                          <Bar
                            key={pt}
                            dataKey={pt}
                            name={pt}
                            stackId="a"
                            fill={PAYROLL_COLORS[idx % PAYROLL_COLORS.length]}
                          >
                            <LabelList
                              dataKey={pt}
                              position="center"
                              formatter={(val: any) => (val > 0 ? val : "")}
                              style={{ fontSize: 11, fill: "#ffffff", fontWeight: "bold" }}
                            />
                          </Bar>
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center w-full h-[300px] text-sm text-muted-foreground border border-dashed rounded-lg bg-muted/10">
                      No hay información registrada.
                    </div>
                  )
                )}

                {expandedChart === "desempeno" && (
                  <div className="w-full space-y-4">
                    <ResponsiveContainer width="100%" height={380}>
                      <BarChart
                        data={performanceTiersData}
                        layout="vertical"
                        margin={{ top: 15, right: 80, left: 15, bottom: 10 }}
                        barSize={24}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} vertical={true} />
                        <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                          width={180}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(value: any, name: any, item: any) => {
                            const payload = item?.payload;
                            const pct = payload?.percentage || "0";
                            return [`${value} colaboradores (${pct}%)`, "Cantidad"];
                          }}
                        />
                        <Bar dataKey="value" name="Colaboradores" radius={[0, 6, 6, 0]}>
                          <LabelList
                            dataKey="displayLabel"
                            position="right"
                            dx={8}
                            style={{ fontSize: 12, fill: "hsl(var(--foreground))", fontWeight: "bold" }}
                          />
                          {performanceTiersData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t">
                      {performanceTiersData.map((tier) => (
                        <div key={tier.name} className="p-3 rounded-xl border bg-muted/10 text-center">
                          <p className="text-xs text-muted-foreground truncate" title={tier.name}>{tier.name.split(" (")[0]}</p>
                          <p className="text-lg font-bold text-foreground mt-0.5">{tier.value}</p>
                          <p className="text-xs font-semibold text-brand-600 dark:text-brand-400">{tier.percentage}%</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {expandedChart === "destacados" && (
                  <div className="w-full space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
                      {filteredEvals
                        .filter((e: any) => e.score > 0)
                        .sort((a: any, b: any) => b.score - a.score)
                        .map((e: any, idx: number) => {
                          const badgeStyle = idx === 0
                            ? "bg-amber-500/20 text-amber-700 border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-300"
                            : idx === 1
                            ? "bg-slate-300/40 text-slate-700 border-slate-400/50 dark:bg-slate-700/40 dark:text-slate-200"
                            : idx === 2
                            ? "bg-amber-700/20 text-amber-800 border-amber-700/40 dark:bg-amber-800/30 dark:text-amber-200"
                            : "bg-[#012169]/10 text-[#012169] border-[#012169]/20 dark:bg-[#0084d5]/20 dark:text-[#38bdf8]";
                          
                          const badgeLabel = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
                          return (
                            <div key={e.id} className="flex items-center justify-between p-3 rounded-xl border bg-muted/10 hover:bg-muted/20 transition-colors">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border shrink-0", badgeStyle)}>
                                  {badgeLabel}
                                </span>
                                <div className="overflow-hidden">
                                  <p className="font-semibold text-sm truncate text-foreground">{e.collaborator}</p>
                                  <p className="text-xs text-muted-foreground truncate">{e.position} {e.area ? `· ${e.area}` : ""}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs font-extrabold text-[#012169] dark:text-[#0084d5] px-2.5 py-1 bg-[#012169]/10 dark:bg-[#0084d5]/20 rounded-lg">
                                  {e.score.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      {filteredEvals.filter((e: any) => e.score > 0).length === 0 && (
                        <div className="col-span-2 h-48 flex items-center justify-center text-sm text-muted-foreground border border-dashed rounded-lg bg-muted/10">
                          No hay evaluaciones registradas.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {expandedChart === "datos_interes" && (
                  <div className="w-full space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-xl border bg-[#012169]/5 border-[#012169]/20 flex flex-col justify-between">
                        <span className="text-xs font-bold text-[#012169] dark:text-[#0084d5] uppercase tracking-wider">Aprobación</span>
                        <div className="mt-3">
                          <p className="text-3xl font-black text-[#012169] dark:text-[#0084d5] leading-none">
                            {completedEvals > 0 ? ((aprobados / completedEvals) * 100).toFixed(0) : 0}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1.5">{aprobados} de {completedEvals} aprobados</p>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border bg-[#0084d5]/5 border-[#0084d5]/20 flex flex-col justify-between">
                        <span className="text-xs font-bold text-[#0084d5] dark:text-[#38bdf8] uppercase tracking-wider">Planes de Mejora</span>
                        <div className="mt-3">
                          <p className="text-3xl font-black text-[#0084d5] dark:text-[#38bdf8] leading-none">
                            {completedEvals > 0 ? ((conPMI / completedEvals) * 100).toFixed(0) : 0}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1.5">{conPMI} con plan de mejora</p>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border bg-brand-50/5 dark:bg-brand-950/5 border-brand-200/50 dark:border-brand-900/30 flex flex-col justify-between">
                        <span className="text-xs font-bold text-brand-700 dark:text-brand-400 uppercase tracking-wider">Promedio General</span>
                        <div className="mt-3">
                          <p className="text-3xl font-black text-brand-600 dark:text-brand-400 leading-none">
                            {avgScore.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1.5">Escala sobre 5.0</p>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border bg-slate-500/5 border-slate-300 dark:border-slate-800 flex flex-col justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider">Tasa Crítica</span>
                        <div className="mt-3">
                          <p className="text-3xl font-black text-slate-700 dark:text-slate-300 leading-none">
                            {completedEvals > 0 ? ((reprobados / completedEvals) * 100).toFixed(0) : 0}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1.5">{reprobados} no aprobados</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 rounded-xl border bg-muted/10 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Detalle del Proceso de Evaluación</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between p-3 rounded-lg border bg-background">
                          <span className="text-muted-foreground">Requeridos (≥ 6 meses):</span>
                          <span className="font-bold text-foreground">{eligibleCollabs} colaboradores</span>
                        </div>
                        <div className="flex justify-between p-3 rounded-lg border bg-background">
                          <span className="text-muted-foreground">Exentos (&lt; 6 meses):</span>
                          <span className="font-semibold text-slate-500">{exemptCollabs} colaboradores</span>
                        </div>
                        <div className="flex justify-between p-3 rounded-lg border bg-background">
                          <span className="text-muted-foreground">Evaluaciones realizadas:</span>
                          <span className="font-bold text-foreground">{completedEvals} finalizadas</span>
                        </div>
                        <div className="flex justify-between p-3 rounded-lg border bg-background">
                          <span className="text-muted-foreground">Participación (sobre requeridos):</span>
                          <span className="font-extrabold text-[#012169] dark:text-[#0084d5]">
                            {eligibleCollabs > 0 ? Math.min(100, Math.round((completedEvals / eligibleCollabs) * 100)) : 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {expandedChart === "lideres" && (
                  <div className="w-full space-y-4">
                    {leaderChartData.length > 0 ? (
                      <div className="w-full">
                        <ResponsiveContainer width="100%" height={Math.max(400, leaderChartData.length * 36)}>
                          <BarChart
                            data={leaderChartData}
                            layout="vertical"
                            margin={{ top: 15, right: 65, left: 20, bottom: 15 }}
                            barSize={20}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} vertical={true} />
                            <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                            <YAxis
                              type="category"
                              dataKey="name"
                              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                              width={170}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              formatter={(value: any, name: any, item: any) => {
                                const payload = item?.payload;
                                const avg = payload?.promedio ? ` (Promedio: ${payload.promedio})` : "";
                                return [`${value} evaluaciones${avg}`, "Evaluaciones Realizadas"];
                              }}
                            />
                            <Bar dataKey="evaluaciones" name="Evaluaciones" radius={[0, 4, 4, 0]} fill="#012169">
                              <LabelList
                                dataKey="evaluaciones"
                                position="right"
                                dx={6}
                                style={{ fontSize: 11, fill: "hsl(var(--foreground))", fontWeight: "bold" }}
                              />
                              {leaderChartData.map((_, index) => (
                                <Cell
                                  key={index}
                                  fill={index === 0 ? "#012169" : index < 3 ? "#0084d5" : "#64748b"}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="flex items-center justify-between pt-3 border-t text-xs text-muted-foreground mt-4">
                          <span>Total de líderes activos en el proceso: <strong className="text-foreground">{leaderChartData.length}</strong></span>
                          <span className="text-[#012169] dark:text-[#0084d5] font-bold">
                            {leaderChartData.reduce((acc, curr) => acc + curr.evaluaciones, 0)} evaluaciones finalizadas en total
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center w-full h-[300px] text-sm text-muted-foreground border border-dashed rounded-lg bg-muted/10">
                        No hay evaluaciones registradas con evaluador asignado.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
