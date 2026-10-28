"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, Search, Filter, Download, Upload,
  ChevronLeft, ChevronRight, Eye, Edit, MoreHorizontal,
  UserCheck, UserX, ArrowUpDown, Building2, ChevronUp, ChevronDown,
  CheckCircle2, Clock, ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cn, getStatusLabel, getInitials, formatDate, getContractTypeLabel } from "@/lib/utils";
import type { Collaborator } from "@/types";

import { getCollaborators } from "@/app/actions/collaborators";

const STATUS_COLORS: Record<string, string> = {
  activo: "text-success-600 bg-success-50 border-success-200 dark:bg-success-950/30",
  inactivo: "text-muted-foreground bg-muted border-border",
  retirado: "text-danger-600 bg-danger-50 border-danger-200 dark:bg-danger-950/30",
  vacaciones: "text-brand-600 bg-brand-50 border-brand-200 dark:bg-brand-950/30",
  incapacidad: "text-warning-600 bg-warning-50 border-warning-200 dark:bg-warning-950/30",
};

function isEvdRequired(hireDateStr?: string | null): boolean {
  if (!hireDateStr) return true;
  const hireDate = new Date(hireDateStr);
  if (isNaN(hireDate.getTime())) return true;
  const now = new Date();
  let months = (now.getFullYear() - hireDate.getFullYear()) * 12 + (now.getMonth() - hireDate.getMonth());
  if (now.getDate() < hireDate.getDate()) months--;
  return months >= 6;
}

export default function ColaboradoresPage() {
  const currentYear = new Date().getFullYear();
  const [search, setSearch] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedEvdRequirement, setSelectedEvdRequirement] = useState("");
  const [selectedEvaluationStatus, setSelectedEvaluationStatus] = useState("");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const pageSize = 10;

  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);

  React.useEffect(() => {
    async function fetchCollabs() {
      try {
        const res = await getCollaborators();
        if (res.error) {
          toast.error("Error al cargar colaboradores: " + res.error);
        } else if (res.data) {
          // Formatear los nested joins
          const formatted = res.data.map((item: any) => ({
            ...item,
            area: item.areas ? { name: item.areas.name } : null,
            position: item.positions ? { name: item.positions.name } : null
          }));
          setCollaborators(formatted);
          // Extraer áreas únicas desde los datos reales
          const areas = Array.from(
            new Set(
              formatted
                .map((c: any) => c.area?.name)
                .filter(Boolean)
            )
          ).sort() as string[];
          setAvailableAreas(areas);
        }
      } catch (err: any) {
        console.error("Error en fetchCollabs:", err);
        toast.error("Error al cargar colaboradores: " + (err?.message || "Error desconocido"));
      } finally {
        setIsLoading(false);
      }
    }
    fetchCollabs();
  }, []);

  const filtered = collaborators.filter((c: any) => {
    const matchesSearch = !search ||
      c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.document_number?.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase());
    const matchesArea = !selectedArea || c.area?.name === selectedArea;
    const matchesStatus = !selectedStatus || c.status === selectedStatus;
    const isReq = isEvdRequired(c.hire_date);
    const matchesEvd = !selectedEvdRequirement ||
      (selectedEvdRequirement === "requerido" && isReq) ||
      (selectedEvdRequirement === "no_requerido" && !isReq);
    const matchesEvalStatus = !selectedEvaluationStatus ||
      (selectedEvaluationStatus === "realizada" && c.has_evaluated_current_year) ||
      (selectedEvaluationStatus === "pendiente" && !c.has_evaluated_current_year);
    return matchesSearch && matchesArea && matchesStatus && matchesEvd && matchesEvalStatus;
  });

  // Reset page when filters change
  React.useEffect(() => { setPage(1); }, [search, selectedArea, selectedStatus, selectedEvdRequirement, selectedEvaluationStatus]);

  const [sortField, setSortField] = useState<string>("full_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sorted = [...filtered].sort((a: any, b: any) => {
    let valA: any = a[sortField as keyof typeof a];
    let valB: any = b[sortField as keyof typeof b];

    if (sortField === "full_name") {
      valA = (a.full_name || "").toLowerCase();
      valB = (b.full_name || "").toLowerCase();
    } else if (sortField === "area") {
      valA = (a.area?.name || "").toLowerCase();
      valB = (b.area?.name || "").toLowerCase();
    } else if (sortField === "position") {
      valA = (a.position?.name || "").toLowerCase();
      valB = (b.position?.name || "").toLowerCase();
    } else if (sortField === "hire_date") {
      valA = a.hire_date ? new Date(a.hire_date).getTime() : 0;
      valB = b.hire_date ? new Date(b.hire_date).getTime() : 0;
    } else if (sortField === "evd_required") {
      valA = isEvdRequired(a.hire_date) ? 1 : 0;
      valB = isEvdRequired(b.hire_date) ? 1 : 0;
    } else if (sortField === "eval_status") {
      valA = a.has_evaluated_current_year ? 1 : 0;
      valB = b.has_evaluated_current_year ? 1 : 0;
    } else if (sortField === "status") {
      valA = (a.status || "").toLowerCase();
      valB = (b.status || "").toLowerCase();
    }

    if (valA === undefined || valA === null) return 1;
    if (valB === undefined || valB === null) return -1;

    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  const stats = {
    total: filtered.length,
    activos: filtered.filter((c: any) => c.status === "activo").length,
    requeridos: filtered.filter((c: any) => c.status === "activo" && isEvdRequired(c.hire_date)).length,
    noRequeridos: filtered.filter((c: any) => c.status === "activo" && !isEvdRequired(c.hire_date)).length,
    inactivos: filtered.filter((c: any) => c.status !== "activo").length,
  };

  const handleExportExcel = async () => {
    if (filtered.length === 0) {
      toast.error("No hay colaboradores para exportar");
      return;
    }

    const toastId = toast.loading("Generando archivo Excel...");
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const excelRows = filtered.map((c: any) => ({
        "Documento": c.document_number || "—",
        "Tipo Doc.": c.document_type || "CC",
        "Colaborador": c.full_name,
        "Correo": c.email || "—",
        "Teléfono": c.phone || "—",
        "Cargo": c.position?.name || "—",
        "Área": c.area?.name || "—",
        "Fecha Ingreso": c.hire_date ? formatDate(c.hire_date) : "—",
        "Antigüedad": isEvdRequired(c.hire_date) ? "Requerido" : "No Requerido",
        "EVD 2026": c.has_evaluated_current_year ? "Realizada" : "Pendiente",
        "Estado": getStatusLabel(c.status || ""),
        "Tipo de Nómina": c.payroll_type || "—",
        "Tipo de Contrato": getContractTypeLabel(c.contract_type || ""),
        "Ciudad": c.workplace_city || "—",
        "Sede": c.workplace || "—",
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Colaboradores");

      // Auto-fit column widths
      const maxCols = Object.keys(excelRows[0] || {}).map((key) => ({
        wch: Math.max(key.length, 14),
      }));
      worksheet["!cols"] = maxCols;

      XLSX.writeFile(workbook, `Colaboradores_Flota_Sugamuxi_${currentYear}.xlsx`);
      toast.success("Excel de colaboradores descargado correctamente", { id: toastId });
    } catch (err: any) {
      console.error("Error exporting to Excel:", err);
      toast.error("Error al exportar a Excel: " + (err?.message || err), { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="w-full min-h-screen px-3 sm:px-4 py-4 sm:py-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Colaboradores</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            Gestión del personal de Flota Sugamuxi S.A.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          <Link href="/administracion/importar">
            <button className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border text-xs sm:text-sm font-medium hover:bg-accent transition-colors">
              <Upload className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
              <span className="hidden sm:inline">Importar</span>
            </button>
          </Link>
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border text-xs sm:text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
            title="Exportar a Excel"
          >
            <Download className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
          <Link href="/colaboradores/nuevo">
            <button className="flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl gradient-brand text-white text-xs sm:text-sm font-semibold hover:opacity-90 transition-opacity shadow-md">
              <Plus className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
              <span className="hidden sm:inline">Nuevo Colaborador</span>
              <span className="sm:hidden">Nuevo</span>
            </button>
          </Link>
        </div>
      </div>

      {/* Stats mini-cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {[
          { label: "Total", value: stats.total, icon: Users, color: "brand" },
          { label: "Activos", value: stats.activos, icon: UserCheck, color: "success" },
          { label: "Requeridos (≥ 6m)", value: stats.requeridos, icon: ShieldCheck, color: "institutional" },
          { label: "No Requeridos (< 6m)", value: stats.noRequeridos, icon: Clock, color: "muted" },
          { label: "Inactivos / Retirados", value: stats.inactivos, icon: UserX, color: "warning" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl border bg-card"
          >
            <div className={cn(
              "p-2 sm:p-2.5 rounded-lg flex-shrink-0",
              stat.color === "institutional" ? "bg-[#012169]/10 text-[#012169] dark:bg-[#0084d5]/20 dark:text-[#38bdf8]" :
              stat.color === "brand" ? "bg-[#012169]/10 text-[#012169] dark:bg-[#012169]/30 dark:text-[#0084d5]" :
              stat.color === "success" ? "bg-[#0084d5]/10 text-[#0084d5] dark:bg-[#0084d5]/30 dark:text-[#38bdf8]" :
              stat.color === "muted" ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" :
              "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            )}>
              <stat.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold leading-none">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1 truncate">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, documento o correo..."
            className="w-full h-10 pl-10 pr-4 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors",
            showFilters || selectedArea || selectedStatus || selectedEvdRequirement || selectedEvaluationStatus ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
          )}
        >
          <Filter className="w-4 h-4" />
          Filtros
          {(selectedArea || selectedStatus || selectedEvdRequirement || selectedEvaluationStatus) && (
            <span className="bg-primary-foreground/20 text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {[selectedArea, selectedStatus, selectedEvdRequirement, selectedEvaluationStatus].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4 rounded-xl border bg-muted/30">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Área</label>
                <select
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className="w-full h-9 rounded-lg border bg-background text-sm px-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Todas las áreas</option>
                  {availableAreas.map((area) => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Estado</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full h-9 rounded-lg border bg-background text-sm px-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Todos los estados</option>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="retirado">Retirado</option>
                  <option value="vacaciones">Vacaciones</option>
                  <option value="incapacidad">Incapacidad</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Evaluación EVD</label>
                <select
                  value={selectedEvdRequirement}
                  onChange={(e) => setSelectedEvdRequirement(e.target.value)}
                  className="w-full h-9 rounded-lg border bg-background text-sm px-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Todos</option>
                  <option value="requerido">Requerido (≥ 6 meses)</option>
                  <option value="no_requerido">No Requerido (&lt; 6 meses)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">EVD {currentYear}</label>
                <select
                  value={selectedEvaluationStatus}
                  onChange={(e) => setSelectedEvaluationStatus(e.target.value)}
                  className="w-full h-9 rounded-lg border bg-background text-sm px-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Todas</option>
                  <option value="realizada">Realizada</option>
                  <option value="pendiente">Pendiente</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => { setSelectedArea(""); setSelectedStatus(""); setSelectedEvdRequirement(""); setSelectedEvaluationStatus(""); }}
                  className="w-full h-9 rounded-lg border text-sm hover:bg-accent transition-colors"
                >
                  Limpiar filtros
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-xl border bg-card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm data-table">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none" onClick={() => handleSort("full_name")}>
                  <div className="flex items-center gap-1 hover:text-foreground transition-colors font-semibold">
                    Colaborador
                    {sortField === "full_name" ? (
                      sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-55" />
                    )}
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell cursor-pointer select-none" onClick={() => handleSort("position")}>
                  <div className="flex items-center gap-1 hover:text-foreground transition-colors font-semibold">
                    Cargo
                    {sortField === "position" ? (
                      sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-55" />
                    )}
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell cursor-pointer select-none" onClick={() => handleSort("area")}>
                  <div className="flex items-center gap-1 hover:text-foreground transition-colors font-semibold">
                    Área
                    {sortField === "area" ? (
                      sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-55" />
                    )}
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell cursor-pointer select-none" onClick={() => handleSort("hire_date")}>
                  <div className="flex items-center gap-1 hover:text-foreground transition-colors font-semibold">
                    Ingreso
                    {sortField === "hire_date" ? (
                      sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-55" />
                    )}
                  </div>
                </th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell cursor-pointer select-none" onClick={() => handleSort("evd_required")}>
                  <div className="flex items-center gap-1 hover:text-foreground transition-colors font-semibold">
                    Antigüedad
                    {sortField === "evd_required" ? (
                      sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-55" />
                    )}
                  </div>
                </th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell cursor-pointer select-none" onClick={() => handleSort("eval_status")}>
                  <div className="flex items-center gap-1 hover:text-foreground transition-colors font-semibold">
                    EVD {currentYear}
                    {sortField === "eval_status" ? (
                      sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-55" />
                    )}
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none" onClick={() => handleSort("status")}>
                  <div className="flex items-center gap-1 hover:text-foreground transition-colors font-semibold">
                    Estado
                    {sortField === "status" ? (
                      sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-55" />
                    )}
                  </div>
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide select-none">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex justify-center items-center gap-3">
                      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      <p className="font-medium text-muted-foreground">Cargando colaboradores...</p>
                    </div>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <Users className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">No se encontraron colaboradores</p>
                        <p className="text-sm text-muted-foreground">Ajusta los filtros o crea un nuevo colaborador</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((collab, i) => (
                  <motion.tr
                    key={collab.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {/* Collaborator */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full gradient-brand flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {getInitials(collab.full_name || "")}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{collab.full_name}</p>
                          <p className="text-xs text-muted-foreground">{collab.document_number}</p>
                        </div>
                      </div>
                    </td>
                    {/* Position */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-sm">{collab.position?.name}</p>
                      <p className="text-xs text-muted-foreground">{collab.email}</p>
                    </td>
                    {/* Area */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm">{collab.area?.name}</span>
                      </div>
                    </td>
                    {/* Hire Date */}
                    <td className="px-4 py-3 hidden lg:table-cell text-sm text-muted-foreground">
                      {collab.hire_date ? formatDate(collab.hire_date) : "—"}
                    </td>
                    {/* EVD Requirement */}
                    <td className="px-3 py-3 hidden sm:table-cell">
                      {isEvdRequired(collab.hire_date) ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-[#012169]/20 bg-[#012169]/10 text-[#012169] dark:bg-[#0084d5]/20 dark:text-[#38bdf8] dark:border-[#0084d5]/30">
                          Requerido
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-slate-300 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" title="Menos de 6 meses de antigüedad">
                          No Requerido
                        </span>
                      )}
                    </td>
                    {/* EVD Current Year Status */}
                    <td className="px-3 py-3 hidden sm:table-cell">
                      {collab.has_evaluated_current_year ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 dark:border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          Realizada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:border-amber-500/30">
                          <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          Pendiente
                        </span>
                      )}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border",
                        STATUS_COLORS[collab.status ?? ""] ?? "text-muted-foreground bg-muted"
                      )}>
                        {getStatusLabel(collab.status ?? "")}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Link href={`/colaboradores/${collab.id}`}>
                          <button className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground" title="Ver detalle">
                            <Eye className="w-4 h-4" />
                          </button>
                        </Link>
                        <Link href={`/colaboradores/${collab.id}/editar`}>
                          <button className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground" title="Editar">
                            <Edit className="w-4 h-4" />
                          </button>
                        </Link>
                        <button className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground" title="Más opciones">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
          <p className="text-sm text-muted-foreground">
            Mostrando {Math.min((page - 1) * pageSize + 1, filtered.length)}–{Math.min(page * pageSize, filtered.length)} de {filtered.length} colaboradores
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => handlePageChange(p)}
                className={cn(
                  "w-8 h-8 rounded-lg text-sm font-medium transition-colors",
                  page === p ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                )}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages || totalPages === 0}
              className="p-2 rounded-lg hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Página siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
      </div>
    </div>
  );
}
