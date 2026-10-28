"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  FileBarChart2,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  TrendingUp,
  Search,
  Loader2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Users,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Mail,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";
import { toast } from "sonner";
import { getAreas, getPositions } from "@/app/actions/config";
import { getEvaluations, getLeadersReportData, LeaderReportItem } from "@/app/actions/evaluations";
import { getPMIs } from "@/app/actions/pmi";
import MultiSelectSearch from "@/components/ui/MultiSelectSearch";
import { LoadingProgress, useLoadingProgress } from "@/components/ui/loading-progress";
import { formatScore, getResultLabel, getResultColor, compressImageIfNeeded, cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";

interface AreaData {
  id: string;
  name: string;
}

interface EvaluationItem {
  id: string;
  code?: string;
  collaborator: {
    full_name: string;
    document_number: string;
    hire_date?: string;
    position?: { name: string };
    positions?: { name: string };
    areas?: { name: string };
    area?: { name: string };
  };
  evaluator?: {
    first_name: string;
    last_name: string;
  };
  finalized_at?: string;
  created_at: string;
  result?: any;
}

function isEvdRequired(hireDateStr?: string | null): boolean {
  if (!hireDateStr) return true;
  const hireDate = new Date(hireDateStr);
  if (isNaN(hireDate.getTime())) return true;
  const now = new Date();
  let months = (now.getFullYear() - hireDate.getFullYear()) * 12 + (now.getMonth() - hireDate.getMonth());
  if (now.getDate() < hireDate.getDate()) months--;
  return months >= 6;
}

export default function ReportesPage() {
  // Navigation: active module (inicia en "lideres" por defecto)
  const [activeReport, setActiveReport] = useState<"lideres" | "consolidado" | "pmi" | "ejecutivo">("lideres");

  // General shared data
  const [areas, setAreas] = useState<AreaData[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationItem[]>([]);
  const [pmiList, setPmiList] = useState<any[]>([]);
  const [leadersData, setLeadersData] = useState<LeaderReportItem[]>([]);
  const [leadersSummary, setLeadersSummary] = useState({
    totalLeaders: 0,
    leadersWithEvaluations: 0,
    leadersWithoutEvaluations: 0,
    totalEvaluations: 0,
    completionPercentage: 0,
    totalAssigned: 0,
    totalCompletedAssigned: 0,
    totalMissingAssigned: 0,
    overallAssignmentCompliance: 0,
    leadersWithMissingEvaluations: 0,
  });
  const [expandedLeaderId, setExpandedLeaderId] = useState<string | null>(null);
  const [detailFilterTab, setDetailFilterTab] = useState<"all" | "missing" | "completed">("all");

  const [isLoading, setIsLoading] = useState(true);
  const { isLoading: showLoading, progress: loadProgress } = useLoadingProgress(isLoading);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // =========================================================================
  // MÓDULO 1: FILTROS Y ESTADOS DE CONSOLIDADO GENERAL
  // =========================================================================
  const [searchGeneral, setSearchGeneral] = useState("");
  const [selectedAreasGeneral, setSelectedAreasGeneral] = useState<string[]>([]);
  const [selectedPositionsGeneral, setSelectedPositionsGeneral] = useState<string[]>([]);
  const [selectedEvaluatorsGeneral, setSelectedEvaluatorsGeneral] = useState<string[]>([]);
  const [selectedResultGeneral, setSelectedResultGeneral] = useState("");
  const [startDateGeneral, setStartDateGeneral] = useState("");
  const [endDateGeneral, setEndDateGeneral] = useState("");
  const [pageGeneral, setPageGeneral] = useState(1);
  const pageSizeGeneral = 10;
  const [sortFieldGeneral, setSortFieldGeneral] = useState<string>("collaborator");
  const [sortOrderGeneral, setSortOrderGeneral] = useState<"asc" | "desc">("asc");

  // Evaluator options derived from evaluations
  const evaluatorOptions = useMemo(() => {
    const names = new Set<string>();
    evaluations.forEach((e) => {
      if (e.evaluator?.first_name || e.evaluator?.last_name) {
        names.add(`${e.evaluator.first_name || ""} ${e.evaluator.last_name || ""}`.replace(/\s+/g, " ").trim());
      }
    });
    return Array.from(names).sort().map((name) => ({ id: name, name }));
  }, [evaluations]);

  const filteredGeneral = useMemo(() => {
    return evaluations.filter((item) => {
      const collabName = item.collaborator?.full_name || "";
      const docNum = item.collaborator?.document_number || "";
      const evalName = item.evaluator ? `${item.evaluator.first_name || ""} ${item.evaluator.last_name || ""}`.trim() : "";
      const code = item.code || "";

      // Text search
      if (searchGeneral) {
        const query = searchGeneral.toLowerCase();
        const matches =
          collabName.toLowerCase().includes(query) ||
          docNum.includes(query) ||
          evalName.toLowerCase().includes(query) ||
          code.toLowerCase().includes(query);
        if (!matches) return false;
      }

      // Area
      if (selectedAreasGeneral.length > 0) {
        const aName = item.collaborator?.areas?.name || item.collaborator?.area?.name || "";
        if (!selectedAreasGeneral.includes(aName)) return false;
      }

      // Position
      if (selectedPositionsGeneral.length > 0) {
        const pName = item.collaborator?.positions?.name || item.collaborator?.position?.name || "";
        if (!selectedPositionsGeneral.includes(pName)) return false;
      }

      // Evaluator
      if (selectedEvaluatorsGeneral.length > 0) {
        if (!selectedEvaluatorsGeneral.includes(evalName)) return false;
      }

      // Result
      if (selectedResultGeneral) {
        const resObj = item.result && !Array.isArray(item.result) ? item.result : item.result?.[0] || null;
        if (resObj?.result !== selectedResultGeneral) return false;
      }

      // Dates
      if (startDateGeneral || endDateGeneral) {
        const itemDateStr = item.finalized_at || item.created_at;
        if (!itemDateStr) return false;
        const itemDate = new Date(itemDateStr);
        if (startDateGeneral) {
          const s = new Date(startDateGeneral);
          s.setHours(0, 0, 0, 0);
          if (itemDate < s) return false;
        }
        if (endDateGeneral) {
          const e = new Date(endDateGeneral);
          e.setHours(23, 59, 59, 999);
          if (itemDate > e) return false;
        }
      }

      return true;
    });
  }, [
    evaluations,
    searchGeneral,
    selectedAreasGeneral,
    selectedPositionsGeneral,
    selectedEvaluatorsGeneral,
    selectedResultGeneral,
    startDateGeneral,
    endDateGeneral,
  ]);

  const sortedGeneral = useMemo(() => {
    return [...filteredGeneral].sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortFieldGeneral === "collaborator") {
        valA = (a.collaborator?.full_name || "").toLowerCase();
        valB = (b.collaborator?.full_name || "").toLowerCase();
      } else if (sortFieldGeneral === "position") {
        valA = (a.collaborator?.positions?.name || a.collaborator?.position?.name || "").toLowerCase();
        valB = (b.collaborator?.positions?.name || b.collaborator?.position?.name || "").toLowerCase();
      } else if (sortFieldGeneral === "area") {
        valA = (a.collaborator?.areas?.name || a.collaborator?.area?.name || "").toLowerCase();
        valB = (b.collaborator?.areas?.name || b.collaborator?.area?.name || "").toLowerCase();
      } else if (sortFieldGeneral === "score") {
        const resA = a.result && !Array.isArray(a.result) ? a.result : a.result?.[0] || null;
        const resB = b.result && !Array.isArray(b.result) ? b.result : b.result?.[0] || null;
        valA = resA ? Number(resA.overall_average) || 0 : 0;
        valB = resB ? Number(resB.overall_average) || 0 : 0;
      } else if (sortFieldGeneral === "result") {
        const resA = a.result && !Array.isArray(a.result) ? a.result : a.result?.[0] || null;
        const resB = b.result && !Array.isArray(b.result) ? b.result : b.result?.[0] || null;
        valA = resA ? (resA.result || "").toLowerCase() : "";
        valB = resB ? (resB.result || "").toLowerCase() : "";
      } else if (sortFieldGeneral === "evaluator") {
        valA = a.evaluator ? `${a.evaluator.first_name} ${a.evaluator.last_name}`.toLowerCase() : "";
        valB = b.evaluator ? `${b.evaluator.first_name} ${b.evaluator.last_name}`.toLowerCase() : "";
      } else if (sortFieldGeneral === "date") {
        valA = a.finalized_at ? new Date(a.finalized_at).getTime() : a.created_at ? new Date(a.created_at).getTime() : 0;
        valB = b.finalized_at ? new Date(b.finalized_at).getTime() : b.created_at ? new Date(b.created_at).getTime() : 0;
      }

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      if (valA < valB) return sortOrderGeneral === "asc" ? -1 : 1;
      if (valA > valB) return sortOrderGeneral === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredGeneral, sortFieldGeneral, sortOrderGeneral]);

  const pagedGeneral = useMemo(() => {
    const start = (pageGeneral - 1) * pageSizeGeneral;
    return sortedGeneral.slice(start, start + pageSizeGeneral);
  }, [sortedGeneral, pageGeneral]);

  const totalPagesGeneral = Math.ceil(sortedGeneral.length / pageSizeGeneral) || 1;

  const handleSortGeneral = (field: string) => {
    if (sortFieldGeneral === field) {
      setSortOrderGeneral(sortOrderGeneral === "asc" ? "desc" : "asc");
    } else {
      setSortFieldGeneral(field);
      setSortOrderGeneral("asc");
    }
  };

  // =========================================================================
  // MÓDULO 2: FILTROS Y ESTADOS DE SEGUIMIENTO PMI
  // =========================================================================
  const [searchPmi, setSearchPmi] = useState("");
  const [selectedAreasPmi, setSelectedAreasPmi] = useState<string[]>([]);
  const [pmiResultFilter, setPmiResultFilter] = useState("");
  const [pagePmi, setPagePmi] = useState(1);
  const pageSizePmi = 10;

  const filteredPmi = useMemo(() => {
    return pmiList.filter((item) => {
      const collab = item.evaluation?.collaborator;
      const collabName = collab?.full_name || "";
      const cargoName = collab?.positions?.name || "";
      const areaName = collab?.areas?.name || "";

      if (searchPmi) {
        const query = searchPmi.toLowerCase();
        if (!collabName.toLowerCase().includes(query) && !cargoName.toLowerCase().includes(query)) {
          return false;
        }
      }

      if (selectedAreasPmi.length > 0 && !selectedAreasPmi.includes(areaName)) {
        return false;
      }

      if (pmiResultFilter) {
        if (pmiResultFilter === "plan_mejoramiento" && item.result !== "plan_mejoramiento") return false;
        if (pmiResultFilter === "no_aprobado" && item.result !== "no_aprobado") return false;
      }

      return true;
    });
  }, [pmiList, searchPmi, selectedAreasPmi, pmiResultFilter]);

  const pagedPmi = useMemo(() => {
    const start = (pagePmi - 1) * pageSizePmi;
    return filteredPmi.slice(start, start + pageSizePmi);
  }, [filteredPmi, pagePmi]);

  const totalPagesPmi = Math.ceil(filteredPmi.length / pageSizePmi) || 1;

  // =========================================================================
  // MÓDULO 3: FILTROS Y ESTADOS DE GESTIÓN POR LÍDER (ASIGNADAS, REALIZADAS Y FALTANTES)
  // =========================================================================
  const [searchLeader, setSearchLeader] = useState("");
  const [selectedPositionsLeader, setSelectedPositionsLeader] = useState<string[]>([]);
  const [leaderStatusFilter, setLeaderStatusFilter] = useState<
    "all" | "missing_evals" | "completed_all" | "with_evals" | "without_evals"
  >("all");
  const [leaderSortOrder, setLeaderSortOrder] = useState<
    "missing_desc" | "assigned_desc" | "compliance_desc" | "evals_desc" | "evals_asc" | "name_asc" | "name_desc" | "score_desc"
  >("missing_desc");
  const [pageLeaders, setPageLeaders] = useState(1);
  const pageSizeLeaders = 10;

  // Unique leader positions options for filter
  const leaderPositionsOptions = useMemo(() => {
    const set = new Set<string>();
    leadersData.forEach((l) => {
      if (l.position && l.position !== "Sin Cargo Asignado") {
        set.add(l.position);
      }
    });
    return Array.from(set).sort().map((p) => ({ id: p, name: p }));
  }, [leadersData]);

  const filteredLeaders = useMemo(() => {
    const result = leadersData.filter((item) => {
      // Text search: Name, Document, Email, Position, or Assigned Collaborator Name/Doc
      if (searchLeader) {
        const q = searchLeader.toLowerCase();
        const matchesLeader =
          item.name.toLowerCase().includes(q) ||
          (item.documentNumber || "").toLowerCase().includes(q) ||
          item.email.toLowerCase().includes(q) ||
          (item.position || "").toLowerCase().includes(q);
        const matchesAssignedCollab = (item.assignedCollaborators || []).some(
          (ac) =>
            ac.collaboratorName.toLowerCase().includes(q) ||
            (ac.documentNumber || "").toLowerCase().includes(q)
        );
        if (!matchesLeader && !matchesAssignedCollab) return false;
      }

      // Position filter
      if (selectedPositionsLeader.length > 0) {
        if (!selectedPositionsLeader.includes(item.position)) return false;
      }

      // Status filter
      if (leaderStatusFilter === "missing_evals" && item.missingCount === 0) return false;
      if (leaderStatusFilter === "completed_all" && !(item.assignedCount > 0 && item.missingCount === 0)) return false;
      if (leaderStatusFilter === "with_evals" && !item.hasEvaluations) return false;
      if (leaderStatusFilter === "without_evals" && item.hasEvaluations) return false;

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (leaderSortOrder === "missing_desc")
        return b.missingCount - a.missingCount || b.assignedCount - a.assignedCount || a.name.localeCompare(b.name);
      if (leaderSortOrder === "assigned_desc")
        return b.assignedCount - a.assignedCount || b.missingCount - a.missingCount || a.name.localeCompare(b.name);
      if (leaderSortOrder === "compliance_desc")
        return b.compliancePercentage - a.compliancePercentage || b.totalEvaluations - a.totalEvaluations;
      if (leaderSortOrder === "evals_desc")
        return b.totalEvaluations - a.totalEvaluations || a.name.localeCompare(b.name);
      if (leaderSortOrder === "evals_asc")
        return a.totalEvaluations - b.totalEvaluations || a.name.localeCompare(b.name);
      if (leaderSortOrder === "name_asc") return a.name.localeCompare(b.name);
      if (leaderSortOrder === "name_desc") return b.name.localeCompare(a.name);
      if (leaderSortOrder === "score_desc")
        return b.averageScore - a.averageScore || b.totalEvaluations - a.totalEvaluations;
      return 0;
    });

    return result;
  }, [leadersData, searchLeader, selectedPositionsLeader, leaderStatusFilter, leaderSortOrder]);

  const pagedLeaders = useMemo(() => {
    const start = (pageLeaders - 1) * pageSizeLeaders;
    return filteredLeaders.slice(start, start + pageSizeLeaders);
  }, [filteredLeaders, pageLeaders]);

  const totalPagesLeaders = Math.ceil(filteredLeaders.length / pageSizeLeaders) || 1;

  // =========================================================================
  // MÓDULO 4: FILTROS Y ESTADOS DE RESUMEN EJECUTIVO
  // =========================================================================
  const [selectedExecutiveArea, setSelectedExecutiveArea] = useState<string>("");

  const executiveData = useMemo(() => {
    let dataset = evaluations;
    if (selectedExecutiveArea) {
      dataset = dataset.filter((e) => {
        const a = e.collaborator?.areas?.name || e.collaborator?.area?.name || "";
        return a === selectedExecutiveArea;
      });
    }

    const total = dataset.length;
    let scoreSum = 0;
    let approved = 0;
    let pmi = 0;
    let notApproved = 0;

    const areaStats: Record<string, { total: number; sum: number; approved: number }> = {};
    const catStats: Record<string, { sum: number; count: number }> = {};

    dataset.forEach((item) => {
      const resObj = item.result && !Array.isArray(item.result) ? item.result : item.result?.[0] || null;
      if (resObj) {
        const score = Number(resObj.overall_average) || 0;
        scoreSum += score;
        if (resObj.result === "aprobado") approved++;
        else if (resObj.result === "plan_mejoramiento") pmi++;
        else if (resObj.result === "no_aprobado") notApproved++;

        const aName = item.collaborator?.areas?.name || item.collaborator?.area?.name || "Sin Área";
        if (!areaStats[aName]) areaStats[aName] = { total: 0, sum: 0, approved: 0 };
        areaStats[aName].total++;
        areaStats[aName].sum += score;
        if (resObj.result === "aprobado") areaStats[aName].approved++;

        if (resObj.category_scores) {
          const cats = Array.isArray(resObj.category_scores)
            ? resObj.category_scores
            : Object.values(resObj.category_scores);
          cats.forEach((cat: any) => {
            if (cat?.name && (cat.average !== undefined || cat.score !== undefined)) {
              const val = cat.average !== undefined ? cat.average : cat.score;
              if (!catStats[cat.name]) catStats[cat.name] = { sum: 0, count: 0 };
              catStats[cat.name].sum += Number(val) || 0;
              catStats[cat.name].count++;
            }
          });
        }
      }
    });

    const average = total > 0 ? Number((scoreSum / total).toFixed(2)) : 0;
    const approvalRate = total > 0 ? Number(((approved / total) * 100).toFixed(1)) : 0;

    return {
      total,
      average,
      approved,
      pmi,
      notApproved,
      approvalRate,
      areaStats,
      catStats,
    };
  }, [evaluations, selectedExecutiveArea]);

  // =========================================================================
  // CARGA INICIAL DE DATOS
  // =========================================================================
  useEffect(() => {
    async function loadAllData() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        let roleName = "";
        let uid = "";

        if (user) {
          uid = user.id;
          setCurrentUserId(user.id);
          const { data: profile } = await supabase
            .from("profiles")
            .select("roles(name)")
            .eq("id", user.id)
            .single();
          if (profile) {
            roleName = (profile.roles as any)?.name || "";
            setCurrentUserRole(roleName);
          }
        }

        const [areasData, positionsData, evalsRes, leadersRes, pmiRes] = await Promise.all([
          getAreas(),
          getPositions(),
          getEvaluations(),
          getLeadersReportData(),
          getPMIs(),
        ]);

        setAreas(areasData || []);
        setPositions(positionsData || []);

        if (evalsRes.data) {
          let loadedEvals = evalsRes.data as any[];
          if (roleName === "lider") {
            loadedEvals = loadedEvals.filter((item) => item.evaluator_id === uid);
          }
          setEvaluations(loadedEvals);
        }

        if (leadersRes.data) {
          setLeadersData(leadersRes.data);
          setLeadersSummary(leadersRes.summary);
        }

        if (pmiRes.data) {
          setPmiList(pmiRes.data);
        }
      } catch (error) {
        console.error("Error loading reports data:", error);
        toast.error("Error al cargar la información de reportes");
      } finally {
        setIsLoading(false);
      }
    }
    loadAllData();
  }, []);

  // =========================================================================
  // EXPORTACIONES A EXCEL Y PDF
  // =========================================================================

  // Export Excel: Consolidado General Completo
  const handleExportConsolidado = async () => {
    if (evaluations.length === 0) {
      toast.error("No hay evaluaciones disponibles para exportar");
      return;
    }

    const toastId = toast.loading("Generando Excel consolidado...");
    try {
      const uniqueCategories = new Set<string>();
      evaluations.forEach((item) => {
        const resObj = item.result && !Array.isArray(item.result) ? item.result : item.result?.[0] || null;
        if (resObj && resObj.category_scores) {
          const cats = Array.isArray(resObj.category_scores)
            ? resObj.category_scores
            : Object.values(resObj.category_scores);
          cats.forEach((cat: any) => {
            if (cat?.name) uniqueCategories.add(cat.name);
          });
        }
      });
      const categoriesList = Array.from(uniqueCategories).sort();

      const collaboratorRows = evaluations.map((item) => {
        const resObj = item.result && !Array.isArray(item.result) ? item.result : item.result?.[0] || null;
        const row: Record<string, any> = {
          "ID Evaluación": item.code || "—",
          "Colaborador": item.collaborator?.full_name || "N/A",
          "Documento": item.collaborator?.document_number || "N/A",
          "Área": item.collaborator?.areas?.name || item.collaborator?.area?.name || "N/A",
          "Cargo": item.collaborator?.positions?.name || item.collaborator?.position?.name || "N/A",
          "Evaluador": item.evaluator ? `${item.evaluator.first_name} ${item.evaluator.last_name}` : "N/A",
          "Antigüedad": isEvdRequired(item.collaborator?.hire_date) ? "Requerido" : "No Requerido",
          "EVD 2026": item.finalized_at || (item as any).status === "finalizada" ? "Realizada" : "Pendiente",
          "Fecha Finalización": item.finalized_at ? new Date(item.finalized_at).toLocaleDateString("es-ES") : "Pendiente",
        };

        const cats = resObj?.category_scores
          ? (Array.isArray(resObj.category_scores) ? resObj.category_scores : Object.values(resObj.category_scores))
          : [];

        categoriesList.forEach((catName) => {
          let scoreVal: any = "—";
          if (resObj && cats.length > 0) {
            const catMatch = cats.find((c: any) => c.name === catName) as any;
            if (catMatch && catMatch.average !== undefined) scoreVal = Number(formatScore(catMatch.average));
            else if (catMatch && catMatch.score !== undefined) scoreVal = Number(formatScore(catMatch.score));
          }
          row[`Promedio: ${catName}`] = scoreVal;
        });

        row["Promedio General"] = resObj ? Number(formatScore(resObj.overall_average)) : "Pendiente";
        row["Resultado EVD"] = resObj ? getResultLabel(resObj.result) : "Pendiente";
        return row;
      });

      const workbook = XLSX.utils.book_new();
      const wsCollab = XLSX.utils.json_to_sheet(collaboratorRows);
      XLSX.utils.book_append_sheet(workbook, wsCollab, "Resultados Colaboradores");

      XLSX.writeFile(workbook, `Reporte_Consolidado_EVD_${new Date().getFullYear()}.xlsx`);
      toast.success("Excel Consolidado descargado exitosamente", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Error al exportar a Excel", { id: toastId });
    }
  };

  // Export Excel: Consolidado Filtrado
  const handleExportFilteredGeneralExcel = () => {
    if (filteredGeneral.length === 0) {
      toast.error("No hay resultados de búsqueda para exportar");
      return;
    }
    const toastId = toast.loading("Exportando resultados filtrados...");
    try {
      const rows = filteredGeneral.map((item) => {
        const resObj = item.result && !Array.isArray(item.result) ? item.result : item.result?.[0] || null;
        return {
          "Código": item.code || "—",
          "Colaborador": item.collaborator?.full_name || "N/A",
          "Documento": item.collaborator?.document_number || "N/A",
          "Área": item.collaborator?.areas?.name || item.collaborator?.area?.name || "N/A",
          "Cargo": item.collaborator?.positions?.name || item.collaborator?.position?.name || "N/A",
          "Evaluador": item.evaluator ? `${item.evaluator.first_name} ${item.evaluator.last_name}` : "N/A",
          "Puntaje": resObj ? Number(formatScore(resObj.overall_average)) : "—",
          "Resultado": resObj ? getResultLabel(resObj.result) : "Pendiente",
          "Fecha": item.finalized_at
            ? new Date(item.finalized_at).toLocaleDateString("es-ES")
            : new Date(item.created_at).toLocaleDateString("es-ES"),
        };
      });

      const workbook = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, ws, "Evaluaciones Filtradas");
      XLSX.writeFile(workbook, `Reporte_EVD_Filtrado_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Excel exportado exitosamente", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("Error al exportar", { id: toastId });
    }
  };

  // Export Excel: Seguimiento PMI
  const handleExportPMI = async () => {
    if (pmiList.length === 0) {
      toast.error("No hay planes de mejoramiento (PMI) registrados");
      return;
    }
    const toastId = toast.loading("Generando reporte de PMI...");
    try {
      const rows = pmiList.map((item) => {
        const collab = item.evaluation?.collaborator;
        return {
          "ID Evaluación": item.evaluation?.id || "—",
          "Colaborador": collab?.full_name || "N/A",
          "Área": collab?.areas?.name || "N/A",
          "Cargo": collab?.positions?.name || "N/A",
          "Calificación Obtenida": item.overall_average ? Number(formatScore(item.overall_average)) : "—",
          "Resultado": getResultLabel(item.result),
          "Requiere PMI": item.pmi_required ? "Sí" : "No",
          "Fecha Evaluación": item.created_at ? new Date(item.created_at).toLocaleDateString("es-ES") : "—",
        };
      });

      const workbook = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, ws, "Seguimiento PMI");
      XLSX.writeFile(workbook, `Reporte_PMI_${new Date().getFullYear()}.xlsx`);
      toast.success("Excel de PMI generado exitosamente", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("Error al exportar PMI", { id: toastId });
    }
  };

  // Export Excel: Informe de Gestión por Líder (Evaluaciones Realizadas y Faltantes según Asignación)
  const handleExportLeadersExcel = (dataToExport = leadersData, isFiltered = false) => {
    const toastId = toast.loading("Generando Excel de evaluaciones realizadas y faltantes por líder...");
    try {
      // Hoja 1: Resumen General por Líder (Asignadas, Realizadas y Faltantes)
      const summaryRows = dataToExport.map((item, idx) => ({
        "N°": idx + 1,
        "Documento Líder": item.documentNumber || "—",
        "Líder / Evaluador": item.name,
        "Correo Electrónico": item.email,
        "Cargo": item.position || "Sin Cargo Asignado",
        "Evaluaciones Asignadas": item.assignedCount,
        "Evaluaciones Realizadas (Asignadas)": item.completedAssignedCount,
        "Evaluaciones Faltantes (Pendientes)": item.missingCount,
        "% Avance Asignación": `${item.compliancePercentage}%`,
        "Total Evaluaciones Gestionadas": item.totalEvaluations,
        "Finalizadas": item.finalizedCount,
        "Pendientes de Firma": item.pendingSignatureCount,
        "En Proceso": item.inProgressCount,
        "Borradores": item.draftCount,
        "Calificación Promedio Otorgada": item.averageScore > 0 ? item.averageScore : "N/A",
        "Estado de Cumplimiento":
          item.assignedCount > 0 && item.missingCount === 0
            ? "Cumplimiento 100% (Al día)"
            : item.missingCount > 0
            ? `Con Faltantes (${item.missingCount} pendientes)`
            : item.totalEvaluations > 0
            ? "Con Evaluaciones Realizadas"
            : "Sin Evaluaciones Asignadas/Realizadas",
        "Última Evaluación": item.lastEvaluationDate ? new Date(item.lastEvaluationDate).toLocaleDateString("es-ES") : "Ninguna",
      }));

      // Hoja 2: Detalle Nominal de Evaluaciones FALTANTES (según Asignación de Evaluaciones)
      const missingDetailRows: any[] = [];
      let missingIdx = 1;
      dataToExport.forEach((leader) => {
        (leader.assignedCollaborators || [])
          .filter((ac) => !ac.isCompleted)
          .forEach((ac) => {
            missingDetailRows.push({
              "N°": missingIdx++,
              "Documento Líder": leader.documentNumber || "—",
              "Líder Evaluador Asignado": leader.name,
              "Cargo Líder": leader.position || "Sin Cargo",
              "Correo Líder": leader.email,
              "Documento Colaborador": ac.documentNumber,
              "Colaborador Pendiente por Evaluar": ac.collaboratorName,
              "Cargo Colaborador": ac.position,
              "Área Colaborador": ac.area,
              "Estado Evaluación":
                ac.evaluationStatus === "en_proceso"
                  ? "En Proceso (Sin Finalizar)"
                  : ac.evaluationStatus === "borrador"
                  ? "Borrador"
                  : "Faltante / Pendiente por Iniciar",
            });
          });
      });

      // Hoja 3: Detalle Nominal de Evaluaciones REALIZADAS (según Asignación de Evaluaciones)
      const completedDetailRows: any[] = [];
      let completedIdx = 1;
      dataToExport.forEach((leader) => {
        (leader.assignedCollaborators || [])
          .filter((ac) => ac.isCompleted)
          .forEach((ac) => {
            completedDetailRows.push({
              "N°": completedIdx++,
              "Documento Líder": leader.documentNumber || "—",
              "Líder Evaluador": leader.name,
              "Cargo Líder": leader.position || "Sin Cargo",
              "Documento Colaborador": ac.documentNumber,
              "Colaborador Evaluado": ac.collaboratorName,
              "Cargo Colaborador": ac.position,
              "Área Colaborador": ac.area,
              "Estado Evaluación": ac.evaluationStatus === "pendiente_firma" ? "Realizada (Pendiente Firma)" : "Finalizada",
              "Puntaje Obtenido": ac.score != null ? ac.score : "—",
              "Fecha Evaluación": ac.evaluationDate ? new Date(ac.evaluationDate).toLocaleDateString("es-ES") : "—",
            });
          });
      });

      const workbook = XLSX.utils.book_new();

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(workbook, wsSummary, "Resumen por Líder");

      if (missingDetailRows.length > 0) {
        const wsMissing = XLSX.utils.json_to_sheet(missingDetailRows);
        XLSX.utils.book_append_sheet(workbook, wsMissing, "Evaluaciones Faltantes");
      }

      if (completedDetailRows.length > 0) {
        const wsCompleted = XLSX.utils.json_to_sheet(completedDetailRows);
        XLSX.utils.book_append_sheet(workbook, wsCompleted, "Evaluaciones Realizadas");
      }

      const fileName = isFiltered
        ? `Reporte_Lideres_Asignaciones_Filtrado_${new Date().toISOString().slice(0, 10)}.xlsx`
        : `Informe_Evaluaciones_Realizadas_y_Faltantes_Lideres_${new Date().getFullYear()}.xlsx`;

      XLSX.writeFile(workbook, fileName);
      toast.success("Informe de evaluaciones realizadas y faltantes descargado exitosamente", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("Error al exportar reporte de líderes", { id: toastId });
    }
  };

  // Export PDF: Resumen Ejecutivo
  const handleExportExecutivePDF = async () => {
    const toastId = toast.loading("Generando Resumen Ejecutivo PDF...");
    try {
      const { jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const brandColorBlue = [1, 33, 105]; // #012169
      const brandColorLightBlue = [0, 132, 213]; // #0084D5
      const textColorDark = [30, 41, 59];
      const textColorMuted = [100, 116, 139];
      const marginX = 15;

      let logoImg: HTMLImageElement | null = null;
      try {
        const logoSrc = await compressImageIfNeeded("/logo.png", 200, 200);
        logoImg = await new Promise<HTMLImageElement | null>((resolve) => {
          const img = new Image();
          img.src = logoSrc;
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
        });
      } catch {}

      let textStartX = marginX;
      if (logoImg) {
        doc.addImage(logoImg, "PNG", marginX, 6, 13, 13);
        textStartX = marginX + 16;
      }

      // Title bar
      doc.setFillColor(brandColorBlue[0], brandColorBlue[1], brandColorBlue[2]);
      doc.rect(0, 0, 210, 4, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(brandColorBlue[0], brandColorBlue[1], brandColorBlue[2]);
      doc.text("FLOTA SUGAMUXI S.A.", textStartX, 14);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(textColorMuted[0], textColorMuted[1], textColorMuted[2]);
      doc.text("Sistema de Evaluación de Desempeño (EVD)", textStartX, 19);

      doc.setDrawColor(226, 232, 240);
      doc.line(marginX, 22, 210 - marginX, 22);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(brandColorBlue[0], brandColorBlue[1], brandColorBlue[2]);
      doc.text("RESUMEN EJECUTIVO DE DESEMPEÑO EVD", marginX, 32);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(textColorDark[0], textColorDark[1], textColorDark[2]);
      doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString("es-ES")}`, marginX, 38);

      let currentY = 46;

      // Executive Summary KPI Box
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(marginX, currentY, 180, 32, 2, 2, "F");
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(marginX, currentY, 180, 32, 2, 2, "D");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(brandColorBlue[0], brandColorBlue[1], brandColorBlue[2]);
      doc.text("MÉTRICAS CLAVE CONSOLIDADAS", marginX + 5, currentY + 7);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(textColorDark[0], textColorDark[1], textColorDark[2]);

      doc.text(`Total Evaluaciones Realizadas: ${executiveData.total}`, marginX + 5, currentY + 15);
      doc.text(`Promedio General Obtenido: ${executiveData.average} / 5.0`, marginX + 5, currentY + 22);
      doc.text(`Tasa Global de Aprobación: ${executiveData.approvalRate}%`, marginX + 5, currentY + 28);

      doc.text(`Evaluaciones Aprobadas: ${executiveData.approved}`, marginX + 95, currentY + 15);
      doc.text(`Con Plan de Mejoramiento (PMI): ${executiveData.pmi}`, marginX + 95, currentY + 22);
      doc.text(`No Aprobados: ${executiveData.notApproved}`, marginX + 95, currentY + 28);

      currentY += 40;

      // Area breakdown table
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.5);
      doc.setTextColor(brandColorLightBlue[0], brandColorLightBlue[1], brandColorLightBlue[2]);
      doc.text("2. DESEMPEÑO PROMEDIO POR ÁREA", marginX, currentY);
      currentY += 4;

      const areaHeaders = [["Área de la Empresa", "Total Evaluaciones", "Promedio General", "% Aprobación"]];
      const areaRows = Object.entries(executiveData.areaStats).map(([name, stat]) => [
        name,
        stat.total.toString(),
        `${(stat.sum / stat.total).toFixed(2)} / 5.0`,
        `${((stat.approved / stat.total) * 100).toFixed(0)}%`,
      ]);

      autoTable(doc, {
        startY: currentY,
        head: areaHeaders,
        body: areaRows,
        theme: "striped",
        headStyles: { fillColor: brandColorBlue as any, textColor: [255, 255, 255] as any, fontStyle: "bold" },
        styles: { fontSize: 8, cellPadding: 2, textColor: textColorDark as any },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 80 },
          1: { cellWidth: 35, halign: "center" },
          2: { cellWidth: 35, halign: "center" },
          3: { cellWidth: 30, halign: "center" },
        },
        margin: { left: marginX, right: marginX, top: 26, bottom: 24 },
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
      if (currentY > 210) {
        doc.addPage();
        currentY = 28;
      }

      // Category breakdown table
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.5);
      doc.setTextColor(brandColorLightBlue[0], brandColorLightBlue[1], brandColorLightBlue[2]);
      doc.text("3. CALIFICACIÓN PROMEDIO POR CATEGORÍA", marginX, currentY);
      currentY += 4;

      const catHeaders = [["Categoría de Competencia", "Calificación Promedio"]];
      const catRows = Object.entries(executiveData.catStats).map(([name, stat]) => [
        name,
        `${(stat.sum / stat.count).toFixed(2)} / 5.0`,
      ]);

      autoTable(doc, {
        startY: currentY,
        head: catHeaders,
        body: catRows,
        theme: "striped",
        headStyles: { fillColor: brandColorBlue as any, textColor: [255, 255, 255] as any, fontStyle: "bold" },
        styles: { fontSize: 8, cellPadding: 2, textColor: textColorDark as any },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 120 },
          1: { cellWidth: 60, halign: "center" },
        },
        margin: { left: marginX, right: marginX, top: 26, bottom: 24 },
      });

      // Headers & Footers on all pages
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFillColor(brandColorBlue[0], brandColorBlue[1], brandColorBlue[2]);
        doc.rect(0, 0, 210, 4, "F");

        if (logoImg) doc.addImage(logoImg, "PNG", marginX, 6, 13, 13);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(brandColorBlue[0], brandColorBlue[1], brandColorBlue[2]);
        doc.text("FLOTA SUGAMUXI S.A.", textStartX, 14);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(textColorMuted[0], textColorMuted[1], textColorMuted[2]);
        doc.text("Sistema de Evaluación de Desempeño (EVD)", textStartX, 19);

        doc.setDrawColor(226, 232, 240);
        doc.line(marginX, 22, 210 - marginX, 22);

        doc.text(`Generado el: ${new Date().toLocaleDateString("es-ES")}`, marginX, 285);
        doc.text(`Página ${i} de ${totalPages}`, 210 - marginX, 285, { align: "right" });
        doc.line(marginX, 280, 210 - marginX, 280);
      }

      doc.save(`Resumen_Ejecutivo_EVD_${new Date().getFullYear()}.pdf`);
      toast.success("PDF generado exitosamente", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("Error al generar el PDF", { id: toastId });
    }
  };

  if (showLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] p-4">
        <LoadingProgress
          icon={FileBarChart2}
          title="Cargando módulos de reportes y estadísticas..."
          description="Consolidando cumplimiento por líder, evaluaciones realizadas y planes de mejora..."
          progress={loadProgress}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileBarChart2 className="w-6 h-6 text-[#012169] dark:text-[#0084d5]" />
            Reportes y Estadísticas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visualiza, filtra y genera informes consolidados de desempeño en Excel o PDF
          </p>
        </div>
      </div>

      {/* Cards Selector Panel (Módulos Integrados sin Duplicidad) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 (Inicial): Evaluaciones por Líder (Realizadas y Faltantes según Asignación) */}
        <div
          onClick={() => setActiveReport("lideres")}
          className={cn(
            "p-5 rounded-2xl transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between group",
            activeReport === "lideres"
              ? "border-2 border-[#012169] dark:border-[#0084d5] bg-gradient-to-b from-[#012169]/5 to-transparent dark:from-[#0084d5]/10 shadow-md ring-2 ring-[#012169]/10"
              : "border border-border bg-card hover:border-[#012169]/40 hover:bg-muted/20 hover:shadow-xs"
          )}
        >
          {activeReport === "lideres" && (
            <div className="absolute bottom-0 inset-x-0 h-1 bg-[#012169] dark:bg-[#0084d5]" />
          )}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#012169]/10 text-[#012169] dark:bg-[#0084d5]/20 dark:text-[#0084d5] flex items-center justify-center shadow-xs">
                <Users className="w-5 h-5" />
              </div>
              {activeReport === "lideres" ? (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#012169] text-white">
                  Módulo Activo
                </span>
              ) : leadersSummary.totalMissingAssigned > 0 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-danger-100 text-danger-700 dark:bg-danger-950/40 dark:text-danger-300">
                  {leadersSummary.totalMissingAssigned} faltantes
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {leadersData.length} líderes
                </span>
              )}
            </div>
            <h3 className="font-bold text-base text-foreground mb-1">Evaluaciones por Líder</h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
              Informe de evaluaciones asignadas, realizadas y faltantes por cada líder evaluador.
            </p>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs">
            {activeReport === "lideres" ? (
              <span className="flex items-center gap-1.5 font-bold text-[#012169] dark:text-[#0084d5]">
                <span className="w-2 h-2 rounded-full bg-[#012169] dark:bg-[#0084d5] animate-pulse" />
                Mostrando datos
              </span>
            ) : (
              <span className="font-medium text-muted-foreground group-hover:text-foreground">
                Ver y filtrar →
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleExportLeadersExcel();
              }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              title="Descargar Excel Líderes (Realizadas y Faltantes)"
            >
              <Download className="w-3.5 h-3.5 text-[#0084d5]" /> Excel
            </button>
          </div>
        </div>

        {/* Card 2: Consolidado General */}
        <div
          onClick={() => setActiveReport("consolidado")}
          className={cn(
            "p-5 rounded-2xl transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between group",
            activeReport === "consolidado"
              ? "border-2 border-[#012169] dark:border-[#0084d5] bg-gradient-to-b from-[#012169]/5 to-transparent dark:from-[#0084d5]/10 shadow-md ring-2 ring-[#012169]/10"
              : "border border-border bg-card hover:border-[#012169]/40 hover:bg-muted/20 hover:shadow-xs"
          )}
        >
          {activeReport === "consolidado" && (
            <div className="absolute bottom-0 inset-x-0 h-1 bg-[#012169] dark:bg-[#0084d5]" />
          )}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#012169]/10 text-[#012169] dark:bg-[#0084d5]/20 dark:text-[#0084d5] flex items-center justify-center shadow-xs">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              {activeReport === "consolidado" ? (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#012169] text-white">
                  Módulo Activo
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {evaluations.length} evd
                </span>
              )}
            </div>
            <h3 className="font-bold text-base text-foreground mb-1">Consolidado General</h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
              Informe completo de evaluaciones por colaborador, cargo y área con desgloses de competencias.
            </p>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs">
            {activeReport === "consolidado" ? (
              <span className="flex items-center gap-1.5 font-bold text-[#012169] dark:text-[#0084d5]">
                <span className="w-2 h-2 rounded-full bg-[#012169] dark:bg-[#0084d5] animate-pulse" />
                Mostrando datos
              </span>
            ) : (
              <span className="font-medium text-muted-foreground group-hover:text-foreground">
                Ver y filtrar →
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleExportConsolidado();
              }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              title="Descargar Excel completo"
            >
              <Download className="w-3.5 h-3.5 text-[#0084d5]" /> Excel
            </button>
          </div>
        </div>

        {/* Card 3: Seguimiento PMI */}
        <div
          onClick={() => setActiveReport("pmi")}
          className={cn(
            "p-5 rounded-2xl transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between group",
            activeReport === "pmi"
              ? "border-2 border-[#0084d5] bg-gradient-to-b from-[#0084d5]/5 to-transparent shadow-md ring-2 ring-[#0084d5]/10"
              : "border border-border bg-card hover:border-[#0084d5]/40 hover:bg-muted/20 hover:shadow-xs"
          )}
        >
          {activeReport === "pmi" && (
            <div className="absolute bottom-0 inset-x-0 h-1 bg-[#0084d5]" />
          )}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#0084d5]/10 text-[#0084d5] dark:bg-[#0084d5]/20 dark:text-[#38bdf8] flex items-center justify-center shadow-xs">
                <TrendingUp className="w-5 h-5" />
              </div>
              {activeReport === "pmi" ? (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#0084d5] text-white">
                  Módulo Activo
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0084d5]/10 text-[#0084d5] dark:text-[#38bdf8]">
                  {pmiList.length} casos
                </span>
              )}
            </div>
            <h3 className="font-bold text-base text-foreground mb-1">Seguimiento PMI</h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
              Planes de mejoramiento (PMI), compromisos pactados y fechas límite a 30/60/90 días.
            </p>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs">
            {activeReport === "pmi" ? (
              <span className="flex items-center gap-1.5 font-bold text-[#0084d5] dark:text-[#38bdf8]">
                <span className="w-2 h-2 rounded-full bg-[#0084d5] animate-pulse" />
                Mostrando datos
              </span>
            ) : (
              <span className="font-medium text-muted-foreground group-hover:text-foreground">
                Ver y filtrar →
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleExportPMI();
              }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              title="Descargar Excel PMI"
            >
              <Download className="w-3.5 h-3.5 text-[#0084d5]" /> Excel
            </button>
          </div>
        </div>

        {/* Card 4: Resumen Ejecutivo */}
        <div
          onClick={() => setActiveReport("ejecutivo")}
          className={cn(
            "p-5 rounded-2xl transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between group",
            activeReport === "ejecutivo"
              ? "border-2 border-[#64748b] bg-gradient-to-b from-slate-500/5 to-transparent shadow-md ring-2 ring-slate-500/10"
              : "border border-border bg-card hover:border-[#64748b]/40 hover:bg-muted/20 hover:shadow-xs"
          )}
        >
          {activeReport === "ejecutivo" && (
            <div className="absolute bottom-0 inset-x-0 h-1 bg-[#64748b]" />
          )}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#64748b]/10 text-[#475569] dark:bg-[#94a3b8]/20 dark:text-[#94a3b8] flex items-center justify-center shadow-xs">
                <FileText className="w-5 h-5" />
              </div>
              {activeReport === "ejecutivo" ? (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#475569] text-white">
                  Módulo Activo
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  PDF Oficial
                </span>
              )}
            </div>
            <h3 className="font-bold text-base text-foreground mb-1">Resumen Ejecutivo</h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
              Informe gerencial consolidado con promedios por área y desgloses de competencias.
            </p>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs">
            {activeReport === "ejecutivo" ? (
              <span className="flex items-center gap-1.5 font-bold text-[#475569] dark:text-[#94a3b8]">
                <span className="w-2 h-2 rounded-full bg-[#64748b] animate-pulse" />
                Mostrando datos
              </span>
            ) : (
              <span className="font-medium text-muted-foreground group-hover:text-foreground">
                Ver y exportar →
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleExportExecutivePDF();
              }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              title="Descargar PDF Resumen Ejecutivo"
            >
              <Download className="w-3.5 h-3.5 text-[#0084d5]" /> PDF
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MÓDULO 1: VISTA CONSOLIDADO GENERAL                                        */}
      {/* ========================================================================= */}
      {activeReport === "consolidado" && (
        <div className="rounded-2xl border bg-card p-5 sm:p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Filter className="w-5 h-5 text-success-600" />
                Filtros: Consolidado General de Evaluaciones
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Filtra por colaborador, área, cargo, evaluador o rango de fechas
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportFilteredGeneralExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-success-200 bg-success-50 text-success-700 hover:bg-success-100 dark:bg-success-950/30 dark:border-success-800 dark:text-success-300 text-xs font-semibold transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Exportar Filtrados (Excel)
              </button>
              <button
                onClick={handleExportConsolidado}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg gradient-brand text-white text-xs font-semibold shadow hover:opacity-90 transition-opacity"
              >
                <Download className="w-3.5 h-3.5" />
                Consolidado Completo
              </button>
            </div>
          </div>

          {/* Filters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="relative">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Buscar</label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchGeneral}
                  onChange={(e) => {
                    setSearchGeneral(e.target.value);
                    setPageGeneral(1);
                  }}
                  placeholder="Colaborador o doc..."
                  className="w-full h-[38px] pl-8 pr-2.5 rounded-xl border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div>
              <MultiSelectSearch
                options={areas}
                selectedValues={selectedAreasGeneral}
                onChange={(vals) => {
                  setSelectedAreasGeneral(vals);
                  setPageGeneral(1);
                }}
                placeholder="Todas las áreas"
                searchPlaceholder="Buscar área..."
                label="Área"
              />
            </div>

            <div>
              <MultiSelectSearch
                options={positions}
                selectedValues={selectedPositionsGeneral}
                onChange={(vals) => {
                  setSelectedPositionsGeneral(vals);
                  setPageGeneral(1);
                }}
                placeholder="Todos los cargos"
                searchPlaceholder="Buscar cargo..."
                label="Cargo"
              />
            </div>

            <div>
              <MultiSelectSearch
                options={evaluatorOptions}
                selectedValues={selectedEvaluatorsGeneral}
                onChange={(vals) => {
                  setSelectedEvaluatorsGeneral(vals);
                  setPageGeneral(1);
                }}
                placeholder="Todos los evaluadores"
                searchPlaceholder="Buscar evaluador..."
                label="Evaluador"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Resultado</label>
              <select
                value={selectedResultGeneral}
                onChange={(e) => {
                  setSelectedResultGeneral(e.target.value);
                  setPageGeneral(1);
                }}
                className="w-full h-[38px] mt-1 px-2.5 rounded-xl border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Todos los resultados</option>
                <option value="aprobado">Aprobado</option>
                <option value="plan_mejoramiento">Plan de Mejoramiento</option>
                <option value="no_aprobado">No Aprobado</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Fecha Inicio</label>
              <input
                type="date"
                value={startDateGeneral}
                onChange={(e) => {
                  setStartDateGeneral(e.target.value);
                  setPageGeneral(1);
                }}
                className="w-full h-[38px] mt-1 px-2.5 rounded-xl border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Results Summary Bar */}
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-4">
            <span>
              Mostrando <strong className="text-foreground">{sortedGeneral.length}</strong> de{" "}
              {evaluations.length} evaluaciones registradas
            </span>
            {(searchGeneral || selectedAreasGeneral.length > 0 || selectedPositionsGeneral.length > 0 || selectedEvaluatorsGeneral.length > 0 || selectedResultGeneral || startDateGeneral) && (
              <button
                onClick={() => {
                  setSearchGeneral("");
                  setSelectedAreasGeneral([]);
                  setSelectedPositionsGeneral([]);
                  setSelectedEvaluatorsGeneral([]);
                  setSelectedResultGeneral("");
                  setStartDateGeneral("");
                  setPageGeneral(1);
                }}
                className="text-xs text-brand-600 hover:underline flex items-center gap-1 font-medium"
              >
                <X className="w-3.5 h-3.5" /> Limpiar filtros
              </button>
            )}
          </div>

          {/* Table */}
          {sortedGeneral.length > 0 ? (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/40 border-b text-muted-foreground uppercase font-semibold">
                      <th className="p-3 cursor-pointer select-none" onClick={() => handleSortGeneral("collaborator")}>
                        <div className="flex items-center gap-1 hover:text-foreground">
                          Colaborador
                          {sortFieldGeneral === "collaborator" ? (
                            sortOrderGeneral === "asc" ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                          ) : <ArrowUpDown className="w-2.5 h-2.5 opacity-50" />}
                        </div>
                      </th>
                      <th className="p-3 cursor-pointer select-none" onClick={() => handleSortGeneral("position")}>
                        <div className="flex items-center gap-1 hover:text-foreground">
                          Cargo
                          {sortFieldGeneral === "position" ? (
                            sortOrderGeneral === "asc" ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                          ) : <ArrowUpDown className="w-2.5 h-2.5 opacity-50" />}
                        </div>
                      </th>
                      <th className="p-3 cursor-pointer select-none" onClick={() => handleSortGeneral("area")}>
                        <div className="flex items-center gap-1 hover:text-foreground">
                          Área
                          {sortFieldGeneral === "area" ? (
                            sortOrderGeneral === "asc" ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                          ) : <ArrowUpDown className="w-2.5 h-2.5 opacity-50" />}
                        </div>
                      </th>
                      <th className="p-3 cursor-pointer select-none" onClick={() => handleSortGeneral("evaluator")}>
                        <div className="flex items-center gap-1 hover:text-foreground">
                          Evaluador
                          {sortFieldGeneral === "evaluator" ? (
                            sortOrderGeneral === "asc" ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                          ) : <ArrowUpDown className="w-2.5 h-2.5 opacity-50" />}
                        </div>
                      </th>
                      <th className="p-3 text-center cursor-pointer select-none" onClick={() => handleSortGeneral("score")}>
                        <div className="flex items-center justify-center gap-1 hover:text-foreground">
                          Calificación
                          {sortFieldGeneral === "score" ? (
                            sortOrderGeneral === "asc" ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                          ) : <ArrowUpDown className="w-2.5 h-2.5 opacity-50" />}
                        </div>
                      </th>
                      <th className="p-3 text-center cursor-pointer select-none" onClick={() => handleSortGeneral("result")}>
                        <div className="flex items-center justify-center gap-1 hover:text-foreground">
                          Resultado
                          {sortFieldGeneral === "result" ? (
                            sortOrderGeneral === "asc" ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                          ) : <ArrowUpDown className="w-2.5 h-2.5 opacity-50" />}
                        </div>
                      </th>
                      <th className="p-3 cursor-pointer select-none" onClick={() => handleSortGeneral("date")}>
                        <div className="flex items-center gap-1 hover:text-foreground">
                          Fecha
                          {sortFieldGeneral === "date" ? (
                            sortOrderGeneral === "asc" ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                          ) : <ArrowUpDown className="w-2.5 h-2.5 opacity-50" />}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-foreground">
                    {pagedGeneral.map((item) => {
                      const resObj = item.result && !Array.isArray(item.result) ? item.result : item.result?.[0] || null;
                      return (
                        <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3">
                            <div className="font-semibold text-foreground">{item.collaborator?.full_name || "Desconocido"}</div>
                            <div className="text-[11px] text-muted-foreground">{item.collaborator?.document_number || "—"}</div>
                          </td>
                          <td className="p-3 text-muted-foreground">{item.collaborator?.positions?.name || item.collaborator?.position?.name || "—"}</td>
                          <td className="p-3 text-muted-foreground">{item.collaborator?.areas?.name || item.collaborator?.area?.name || "—"}</td>
                          <td className="p-3 text-muted-foreground">
                            {item.evaluator ? `${item.evaluator.first_name} ${item.evaluator.last_name}` : "—"}
                          </td>
                          <td className="p-3 text-center font-bold text-sm">
                            {resObj ? formatScore(resObj.overall_average) : "—"}
                          </td>
                          <td className="p-3 text-center">
                            {resObj ? (
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${getResultColor(resObj.result)}`}>
                                {getResultLabel(resObj.result)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border bg-muted text-muted-foreground">
                                Pendiente
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {item.finalized_at
                              ? new Date(item.finalized_at).toLocaleDateString("es-ES")
                              : new Date(item.created_at).toLocaleDateString("es-ES")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                <span>
                  Página {pageGeneral} de {totalPagesGeneral}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={pageGeneral === 1}
                    onClick={() => setPageGeneral((p) => Math.max(p - 1, 1))}
                    className="p-1.5 rounded-lg border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={pageGeneral >= totalPagesGeneral}
                    onClick={() => setPageGeneral((p) => Math.min(p + 1, totalPagesGeneral))}
                    className="p-1.5 rounded-lg border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground border rounded-xl bg-muted/10">
              No se encontraron evaluaciones con los filtros seleccionados.
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MÓDULO 2: VISTA SEGUIMIENTO PMI                                            */}
      {/* ========================================================================= */}
      {activeReport === "pmi" && (
        <div className="rounded-2xl border bg-card p-5 sm:p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#0084d5]" />
                Filtros: Seguimiento a Planes de Mejoramiento (PMI)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Supervisa los colaboradores con calificaciones menores a 3.1 o con condición de PMI requerido
              </p>
            </div>
            <button
              onClick={handleExportPMI}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0084d5]/30 bg-[#0084d5]/10 text-[#0084d5] hover:bg-[#0084d5]/20 text-xs font-semibold transition-colors self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar PMI (Excel)
            </button>
          </div>

          {/* PMI Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Buscar Colaborador / Cargo</label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchPmi}
                  onChange={(e) => {
                    setSearchPmi(e.target.value);
                    setPagePmi(1);
                  }}
                  placeholder="Nombre o cargo..."
                  className="w-full h-[38px] pl-8 pr-2.5 rounded-xl border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div>
              <MultiSelectSearch
                options={areas}
                selectedValues={selectedAreasPmi}
                onChange={(vals) => {
                  setSelectedAreasPmi(vals);
                  setPagePmi(1);
                }}
                placeholder="Todas las áreas"
                searchPlaceholder="Buscar área..."
                label="Área"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Condición de PMI</label>
              <select
                value={pmiResultFilter}
                onChange={(e) => {
                  setPmiResultFilter(e.target.value);
                  setPagePmi(1);
                }}
                className="w-full h-[38px] mt-1 px-2.5 rounded-xl border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Todos los casos PMI</option>
                <option value="plan_mejoramiento">Plan de Mejoramiento (3.1 a 3.4)</option>
                <option value="no_aprobado">No Aprobado (Menor a 3.1)</option>
              </select>
            </div>
          </div>

          {/* PMI Results Table */}
          {filteredPmi.length > 0 ? (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/40 border-b text-muted-foreground uppercase font-semibold">
                      <th className="p-3">Colaborador</th>
                      <th className="p-3">Cargo</th>
                      <th className="p-3">Área</th>
                      <th className="p-3 text-center">Puntaje</th>
                      <th className="p-3 text-center">Condición</th>
                      <th className="p-3">Fecha Evaluación</th>
                      <th className="p-3 text-center">Estado Seguimiento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-foreground">
                    {pagedPmi.map((item) => {
                      const collab = item.evaluation?.collaborator;
                      return (
                        <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3 font-semibold text-foreground">{collab?.full_name || "Desconocido"}</td>
                          <td className="p-3 text-muted-foreground">{collab?.positions?.name || "—"}</td>
                          <td className="p-3 text-muted-foreground">{collab?.areas?.name || "—"}</td>
                          <td className="p-3 text-center font-bold text-sm">
                            {item.overall_average ? formatScore(item.overall_average) : "—"}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${getResultColor(item.result)}`}>
                              {getResultLabel(item.result)}
                            </span>
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {item.created_at ? new Date(item.created_at).toLocaleDateString("es-ES") : "—"}
                          </td>
                          <td className="p-3 text-center">
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-warning-50 text-warning-700 border border-warning-200">
                              <AlertTriangle className="w-3 h-3" />
                              Compromiso Activo
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                <span>
                  Página {pagePmi} de {totalPagesPmi} ({filteredPmi.length} casos encontrados)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={pagePmi === 1}
                    onClick={() => setPagePmi((p) => Math.max(p - 1, 1))}
                    className="p-1.5 rounded-lg border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={pagePmi >= totalPagesPmi}
                    onClick={() => setPagePmi((p) => Math.min(p + 1, totalPagesPmi))}
                    className="p-1.5 rounded-lg border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground border rounded-xl bg-muted/10">
              No se encontraron registros de planes de mejoramiento con los criterios actuales.
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MÓDULO 3: VISTA EVALUACIONES POR LÍDER (REALIZADAS Y FALTANTES)            */}
      {/* ========================================================================= */}
      {activeReport === "lideres" && (
        <div className="rounded-2xl border bg-card p-5 sm:p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-[#012169] dark:text-[#0084d5]" />
                Informe de Evaluaciones Realizadas y Faltantes por Líder
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Valida las evaluaciones asignadas a cada líder en el módulo de Asignación de Evaluaciones, cuántas ha realizado y cuáles le faltan por evaluar
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportLeadersExcel(filteredLeaders, true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0084d5]/30 bg-[#0084d5]/10 text-[#0084d5] hover:bg-[#0084d5]/20 text-xs font-semibold transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Exportar Vista Actual (Excel)
              </button>
              <button
                onClick={() => handleExportLeadersExcel(leadersData, false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#012169] text-white text-xs font-semibold shadow hover:bg-[#012169]/90 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar Informe (Realizadas y Faltantes)
              </button>
            </div>
          </div>

          {/* Quick Stats Banner (Basado en Asignación de Evaluaciones) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border bg-background/60 shadow-xs">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                <Users className="w-4 h-4 text-[#012169] dark:text-[#0084d5]" />
                Líderes Evaluadores
              </div>
              <div className="text-2xl font-bold text-foreground">{leadersSummary.totalLeaders}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {leadersSummary.leadersWithEvaluations} con evaluaciones iniciadas
              </div>
            </div>

            <div className="p-3.5 rounded-xl border bg-background/60 shadow-xs">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                <FileSpreadsheet className="w-4 h-4 text-[#012169] dark:text-[#0084d5]" />
                Evaluaciones Asignadas
              </div>
              <div className="text-2xl font-bold text-foreground">{leadersSummary.totalAssigned}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Programadas en Asignación Evaluaciones
              </div>
            </div>

            <div className="p-3.5 rounded-xl border bg-[#012169]/5 border-[#012169]/20 shadow-xs">
              <div className="flex items-center gap-2 text-[#012169] dark:text-[#0084d5] text-xs font-semibold mb-1">
                <CheckCircle className="w-4 h-4 text-[#0084d5]" />
                Evaluaciones Realizadas
              </div>
              <div className="text-2xl font-bold text-[#012169] dark:text-[#0084d5]">
                {leadersSummary.totalCompletedAssigned}
                <span className="text-xs font-medium text-muted-foreground ml-1.5">
                  / {leadersSummary.totalAssigned}
                </span>
              </div>
              <div className="text-[11px] text-[#012169]/80 dark:text-[#0084d5]/80 mt-0.5">
                {leadersSummary.overallAssignmentCompliance}% de avance sobre asignadas ({leadersSummary.totalEvaluations} totales)
              </div>
            </div>

            <div className="p-3.5 rounded-xl border bg-danger-50/40 dark:bg-danger-950/20 border-danger-200 dark:border-danger-900/50 shadow-xs">
              <div className="flex items-center gap-2 text-danger-700 dark:text-danger-300 text-xs font-semibold mb-1">
                <AlertCircle className="w-4 h-4 text-danger-600" />
                Evaluaciones Faltantes
              </div>
              <div className="text-2xl font-bold text-danger-600 dark:text-danger-400">
                {leadersSummary.totalMissingAssigned}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                En {leadersSummary.leadersWithMissingEvaluations} líderes con pendientes
              </div>
            </div>
          </div>

          {/* Leaders Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Buscar Líder o Colaborador Asignado</label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchLeader}
                  onChange={(e) => {
                    setSearchLeader(e.target.value);
                    setPageLeaders(1);
                  }}
                  placeholder="Líder, documento, cargo o colaborador..."
                  className="w-full h-[38px] pl-8 pr-2.5 rounded-xl border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div>
              <MultiSelectSearch
                options={leaderPositionsOptions}
                selectedValues={selectedPositionsLeader}
                onChange={(vals) => {
                  setSelectedPositionsLeader(vals);
                  setPageLeaders(1);
                }}
                placeholder="Todos los cargos"
                searchPlaceholder="Buscar cargo..."
                label="Cargo del Líder"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Estado de Evaluaciones</label>
              <select
                value={leaderStatusFilter}
                onChange={(e) => {
                  setLeaderStatusFilter(e.target.value as any);
                  setPageLeaders(1);
                }}
                className="w-full h-[38px] mt-1 px-2.5 rounded-xl border bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">Todos los Líderes ({leadersData.length})</option>
                <option value="missing_evals">
                  Con Evaluaciones Faltantes ({leadersSummary.leadersWithMissingEvaluations})
                </option>
                <option value="completed_all">
                  Cumplimiento 100% Asignadas ({leadersData.filter((l) => l.assignedCount > 0 && l.missingCount === 0).length})
                </option>
                <option value="with_evals">Con Evaluaciones Realizadas ({leadersSummary.leadersWithEvaluations})</option>
                <option value="without_evals">Sin Evaluaciones Realizadas ({leadersSummary.leadersWithoutEvaluations})</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Ordenar Por</label>
              <select
                value={leaderSortOrder}
                onChange={(e) => {
                  setLeaderSortOrder(e.target.value as any);
                  setPageLeaders(1);
                }}
                className="w-full h-[38px] mt-1 px-2.5 rounded-xl border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="missing_desc">Mayor cantidad de evaluaciones faltantes</option>
                <option value="assigned_desc">Mayor cantidad de evaluaciones asignadas</option>
                <option value="compliance_desc">Mayor % de cumplimiento</option>
                <option value="evals_desc">Mayor cantidad de evaluaciones realizadas</option>
                <option value="evals_asc">Menor cantidad de evaluaciones realizadas</option>
                <option value="name_asc">Nombre Alfabético (A - Z)</option>
                <option value="name_desc">Nombre Alfabético (Z - A)</option>
                <option value="score_desc">Calificación promedio otorgada</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {filteredLeaders.length > 0 ? (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/40 border-b text-muted-foreground uppercase font-semibold">
                      <th className="p-3">Líder / Jefe Evaluador</th>
                      <th className="p-3">Cargo</th>
                      <th className="p-3 text-center">Asignadas</th>
                      <th className="p-3 text-center">Realizadas</th>
                      <th className="p-3 text-center">Faltantes</th>
                      <th className="p-3 text-center">Avance Asignación</th>
                      <th className="p-3 text-center">Finalizadas / Pend. Firma</th>
                      <th className="p-3 text-center">Promedio</th>
                      <th className="p-3 text-center">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-foreground">
                    {pagedLeaders.map((leader) => {
                      const isExpanded = expandedLeaderId === leader.id;
                      const assignedList = leader.assignedCollaborators || [];
                      const filteredAssignedList = assignedList.filter((ac) => {
                        if (detailFilterTab === "missing") return !ac.isCompleted;
                        if (detailFilterTab === "completed") return ac.isCompleted;
                        return true;
                      });

                      return (
                        <React.Fragment key={leader.id}>
                          <tr
                            className={cn(
                              "hover:bg-muted/20 transition-colors",
                              leader.missingCount > 0 && "bg-amber-50/10 dark:bg-amber-950/5",
                              leader.totalEvaluations === 0 && leader.assignedCount > 0 && "bg-danger-50/15"
                            )}
                          >
                            <td className="p-3">
                              <div className="font-semibold text-foreground flex items-center gap-1.5">
                                {leader.name}
                              </div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                {leader.documentNumber && leader.documentNumber !== "—" && (
                                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-muted">
                                    CC {leader.documentNumber}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-muted-foreground/70" />
                                  {leader.email}
                                </span>
                              </div>
                            </td>

                            <td className="p-3">
                              <span className="font-medium text-foreground text-xs">
                                {leader.position || "—"}
                              </span>
                            </td>

                            <td className="p-3 text-center">
                              <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md bg-muted font-bold text-foreground text-xs">
                                {leader.assignedCount}
                              </span>
                            </td>

                            <td className="p-3 text-center">
                              <span
                                className={cn(
                                  "inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md font-bold text-xs",
                                  leader.completedAssignedCount > 0 || leader.totalEvaluations > 0
                                    ? "bg-success-50 text-success-700 border border-success-200 dark:bg-success-950/30 dark:text-success-300"
                                    : "bg-muted text-muted-foreground"
                                )}
                              >
                                {leader.assignedCount > 0 ? leader.completedAssignedCount : leader.totalEvaluations}
                              </span>
                            </td>

                            <td className="p-3 text-center">
                              {leader.missingCount > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-danger-50 text-danger-700 border border-danger-200 dark:bg-danger-950/40 dark:border-danger-800 dark:text-danger-300">
                                  <AlertTriangle className="w-3 h-3" />
                                  {leader.missingCount} faltante{leader.missingCount === 1 ? "" : "s"}
                                </span>
                              ) : leader.assignedCount > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-success-50 text-success-700 border border-success-200 dark:bg-success-950/30 dark:border-success-800 dark:text-success-300">
                                  <CheckCircle className="w-3 h-3" />
                                  0 (Al día)
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-[11px]">Sin asignaciones</span>
                              )}
                            </td>

                            <td className="p-3 text-center min-w-[130px]">
                              {leader.assignedCount > 0 ? (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-bold text-foreground">{leader.compliancePercentage}%</span>
                                    <span className="text-muted-foreground">
                                      {leader.completedAssignedCount}/{leader.assignedCount}
                                    </span>
                                  </div>
                                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all",
                                        leader.compliancePercentage >= 100
                                          ? "bg-success-600"
                                          : leader.compliancePercentage >= 50
                                          ? "bg-[#0084d5]"
                                          : leader.compliancePercentage > 0
                                          ? "bg-amber-500"
                                          : "bg-danger-500"
                                      )}
                                      style={{ width: `${Math.min(100, leader.compliancePercentage)}%` }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {leader.totalEvaluations > 0 ? `${leader.totalEvaluations} eval.` : "—"}
                                </span>
                              )}
                            </td>

                            <td className="p-3 text-center text-muted-foreground">
                              <span className="font-semibold text-success-600">{leader.finalizedCount}</span>
                              {" / "}
                              <span className="font-semibold text-amber-600">{leader.pendingSignatureCount}</span>
                            </td>

                            <td className="p-3 text-center font-semibold">
                              {leader.averageScore > 0 ? (
                                <span className="text-foreground">{leader.averageScore.toFixed(2)}</span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>

                            <td className="p-3 text-center">
                              {assignedList.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isExpanded) {
                                      setExpandedLeaderId(null);
                                    } else {
                                      setExpandedLeaderId(leader.id);
                                      setDetailFilterTab("all");
                                    }
                                  }}
                                  className={cn(
                                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors",
                                    isExpanded
                                      ? "bg-[#012169] text-white border-[#012169]"
                                      : "bg-background hover:bg-muted text-foreground border-border"
                                  )}
                                >
                                  {isExpanded ? (
                                    <>
                                      Ocultar <ChevronUp className="w-3.5 h-3.5" />
                                    </>
                                  ) : (
                                    <>
                                      Ver ({assignedList.length}) <ChevronDown className="w-3.5 h-3.5" />
                                    </>
                                  )}
                                </button>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>

                          {/* Fila Expandible con el Detalle de Evaluaciones Realizadas y Faltantes del Líder */}
                          {isExpanded && assignedList.length > 0 && (
                            <tr className="bg-muted/20">
                              <td colSpan={9} className="p-4">
                                <div className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3">
                                    <div>
                                      <h4 className="font-bold text-xs uppercase tracking-wide text-[#012169] dark:text-[#0084d5]">
                                        Colaboradores Asignados a {leader.name}
                                      </h4>
                                      <p className="text-[11px] text-muted-foreground">
                                        {leader.completedAssignedCount} realizadas y {leader.missingCount} faltantes de {leader.assignedCount} asignadas
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setDetailFilterTab("all")}
                                        className={cn(
                                          "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors",
                                          detailFilterTab === "all"
                                            ? "bg-[#012169] text-white"
                                            : "bg-muted text-muted-foreground hover:text-foreground"
                                        )}
                                      >
                                        Todas ({assignedList.length})
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDetailFilterTab("missing")}
                                        className={cn(
                                          "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors",
                                          detailFilterTab === "missing"
                                            ? "bg-danger-600 text-white"
                                            : "bg-danger-50 text-danger-700 hover:bg-danger-100 dark:bg-danger-950/40 dark:text-danger-300"
                                        )}
                                      >
                                        Faltantes ({leader.missingCount})
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDetailFilterTab("completed")}
                                        className={cn(
                                          "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors",
                                          detailFilterTab === "completed"
                                            ? "bg-success-600 text-white"
                                            : "bg-success-50 text-success-700 hover:bg-success-100 dark:bg-success-950/40 dark:text-success-300"
                                        )}
                                      >
                                        Realizadas ({leader.completedAssignedCount})
                                      </button>
                                    </div>
                                  </div>

                                  {filteredAssignedList.length > 0 ? (
                                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto rounded-lg border">
                                      <table className="w-full text-left text-[11px] border-collapse">
                                        <thead className="bg-muted/50 sticky top-0">
                                          <tr className="border-b text-muted-foreground uppercase font-semibold">
                                            <th className="p-2.5">Colaborador Asignado</th>
                                            <th className="p-2.5">Documento</th>
                                            <th className="p-2.5">Cargo</th>
                                            <th className="p-2.5">Área</th>
                                            <th className="p-2.5 text-center">Estado Evaluación</th>
                                            <th className="p-2.5 text-center">Puntaje</th>
                                            <th className="p-2.5">Fecha</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                          {filteredAssignedList.map((ac) => (
                                            <tr key={ac.assignmentId} className="hover:bg-muted/20">
                                              <td className="p-2.5 font-semibold text-foreground">{ac.collaboratorName}</td>
                                              <td className="p-2.5 font-mono text-muted-foreground">{ac.documentNumber}</td>
                                              <td className="p-2.5 text-muted-foreground">{ac.position}</td>
                                              <td className="p-2.5 text-muted-foreground">{ac.area}</td>
                                              <td className="p-2.5 text-center">
                                                {ac.isCompleted ? (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-success-50 text-success-700 border border-success-200 dark:bg-success-950/30 dark:text-success-300">
                                                    <CheckCircle className="w-3 h-3" />
                                                    {ac.evaluationStatus === "pendiente_firma" ? "Realizada (Pend. Firma)" : "Realizada"}
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-danger-50 text-danger-700 border border-danger-200 dark:bg-danger-950/40 dark:text-danger-300">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    Faltante por Evaluar
                                                  </span>
                                                )}
                                              </td>
                                              <td className="p-2.5 text-center font-bold">
                                                {ac.score != null ? ac.score.toFixed(2) : "—"}
                                              </td>
                                              <td className="p-2.5 text-muted-foreground">
                                                {ac.evaluationDate ? new Date(ac.evaluationDate).toLocaleDateString("es-ES") : "Pendiente"}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <div className="p-4 text-center text-xs text-muted-foreground">
                                      No hay colaboradores en esta pestaña.
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                <span>
                  Mostrando {filteredLeaders.length > 0 ? (pageLeaders - 1) * pageSizeLeaders + 1 : 0} a{" "}
                  {Math.min(pageLeaders * pageSizeLeaders, filteredLeaders.length)} de {filteredLeaders.length} líderes
                  {leaderStatusFilter === "without_evals" && " (filtrados sin evaluaciones)"}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={pageLeaders === 1}
                    onClick={() => setPageLeaders((p) => Math.max(p - 1, 1))}
                    className="p-1.5 rounded-lg border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={pageLeaders >= totalPagesLeaders}
                    onClick={() => setPageLeaders((p) => Math.min(p + 1, totalPagesLeaders))}
                    className="p-1.5 rounded-lg border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground border rounded-xl bg-muted/10">
              No se encontraron líderes con los filtros aplicados.
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MÓDULO 4: VISTA RESUMEN EJECUTIVO                                          */}
      {/* ========================================================================= */}
      {activeReport === "ejecutivo" && (
        <div className="rounded-2xl border bg-card p-5 sm:p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#012169] dark:text-[#0084d5]" />
                Módulo: Resumen Ejecutivo Gerencial
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Consolidado de desempeño general y desgloses de competencias por área corporativa
              </p>
            </div>
            <button
              onClick={handleExportExecutivePDF}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl gradient-brand text-white text-xs font-semibold shadow hover:opacity-90 transition-opacity"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar PDF Oficial
            </button>
          </div>

          {/* Filters for executive view */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Filtrar por Área Específica</label>
              <select
                value={selectedExecutiveArea}
                onChange={(e) => setSelectedExecutiveArea(e.target.value)}
                className="w-full h-[38px] mt-1 px-2.5 rounded-xl border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Todas las Áreas de la Empresa</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Periodo de Evaluación</label>
              <input
                type="text"
                disabled
                value="Vigencia 2026 · Flota Sugamuxi S.A."
                className="w-full h-[38px] mt-1 px-2.5 rounded-xl border bg-muted text-xs text-muted-foreground font-medium"
              />
            </div>
          </div>

          {/* Executive KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <div className="p-4 rounded-xl border bg-background shadow-xs">
              <span className="text-xs text-muted-foreground font-medium">Total Evaluaciones</span>
              <div className="text-2xl font-bold mt-1 text-foreground">{executiveData.total}</div>
              <span className="text-[11px] text-muted-foreground">En el corte actual</span>
            </div>

            <div className="p-4 rounded-xl border bg-background shadow-xs">
              <span className="text-xs text-muted-foreground font-medium">Promedio General</span>
              <div className="text-2xl font-bold mt-1 text-brand-600">{executiveData.average} / 5.0</div>
              <span className="text-[11px] text-muted-foreground">Calificación promedio</span>
            </div>

            <div className="p-4 rounded-xl border bg-background shadow-xs">
              <span className="text-xs text-muted-foreground font-medium">Tasa de Aprobación</span>
              <div className="text-2xl font-bold mt-1 text-success-600">{executiveData.approvalRate}%</div>
              <span className="text-[11px] text-muted-foreground">{executiveData.approved} colaboradores</span>
            </div>

            <div className="p-4 rounded-xl border bg-background shadow-xs">
              <span className="text-xs text-muted-foreground font-medium">Requieren PMI</span>
              <div className="text-2xl font-bold mt-1 text-warning-600">{executiveData.pmi + executiveData.notApproved}</div>
              <span className="text-[11px] text-muted-foreground">{executiveData.pmi} en plan + {executiveData.notApproved} no aprobados</span>
            </div>
          </div>

          {/* Area & Category summaries */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            {/* Area Table */}
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-foreground">Desempeño Promedio por Área</h4>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b text-muted-foreground font-semibold uppercase">
                    <tr>
                      <th className="p-2.5">Área</th>
                      <th className="p-2.5 text-center">Evaluaciones</th>
                      <th className="p-2.5 text-center">Promedio</th>
                      <th className="p-2.5 text-center">% Aprobación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-foreground">
                    {Object.entries(executiveData.areaStats).map(([name, stat]) => (
                      <tr key={name} className="hover:bg-muted/20">
                        <td className="p-2.5 font-medium">{name}</td>
                        <td className="p-2.5 text-center text-muted-foreground">{stat.total}</td>
                        <td className="p-2.5 text-center font-bold">{(stat.sum / stat.total).toFixed(2)}</td>
                        <td className="p-2.5 text-center font-semibold text-success-600">
                          {((stat.approved / stat.total) * 100).toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Category Table */}
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-foreground">Calificación por Categoría de Competencias</h4>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b text-muted-foreground font-semibold uppercase">
                    <tr>
                      <th className="p-2.5">Categoría</th>
                      <th className="p-2.5 text-center">Evaluaciones</th>
                      <th className="p-2.5 text-center">Promedio Obtenido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-foreground">
                    {Object.entries(executiveData.catStats).map(([name, stat]) => (
                      <tr key={name} className="hover:bg-muted/20">
                        <td className="p-2.5 font-medium">{name}</td>
                        <td className="p-2.5 text-center text-muted-foreground">{stat.count}</td>
                        <td className="p-2.5 text-center font-bold text-brand-600">{(stat.sum / stat.count).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
