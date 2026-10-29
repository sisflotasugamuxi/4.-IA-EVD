"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserCheck, Users, Upload, Download, Plus, Search, Filter,
  CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  FileSpreadsheet, Trash2, ArrowRight, RefreshCw, Copy, Check,
  ExternalLink, UserX, Building2, Briefcase, Award, Shield,
  MoreVertical, Edit3, X, HelpCircle, FileText
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { cn, formatScore } from "@/lib/utils";
import {
  getEvaluationAssignments,
  getEvaluationAssignmentsDashboard,
  getAssignmentsSummaryByLeader,
  getAssignmentsStats,
  createOrUpdateAssignment,
  bulkAssignCollaborators,
  deleteAssignment,
  importAssignmentsFromExcelData,
  getAvailableLeaders,
  getCollaboratorsWithAssignmentStatus
} from "@/app/actions/assignments";
import type { EvaluationAssignment, AssignmentLeaderSummary, AssignmentStatus } from "@/types";
import { LoadingProgress } from "@/components/ui/loading-progress";

export default function AsignacionesPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [loading, setLoading] = useState(true);
  const [tableNotCreated, setTableNotCreated] = useState(false);
  const [assignments, setAssignments] = useState<EvaluationAssignment[]>([]);
  const [leaderSummaries, setLeaderSummaries] = useState<AssignmentLeaderSummary[]>([]);
  const [stats, setStats] = useState({
    totalAssignments: 0,
    totalCompleted: 0,
    totalPendingSignature: 0,
    totalInProgress: 0,
    totalPending: 0,
    totalLeaders: 0,
    overallCompletion: 0,
  });

  // Filtros y Paginación
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [leaderFilter, setLeaderFilter] = useState<string>("todos");
  const [viewMode, setViewMode] = useState<"lideres" | "general">("lideres");
  const [expandedLeaders, setExpandedLeaders] = useState<Record<string, boolean>>({});
  const [leaderPages, setLeaderPages] = useState<Record<string, number>>({});
  const [generalPage, setGeneralPage] = useState(1);
  const LEADER_PAGE_SIZE = 10;

  // Modales
  const [showManualModal, setShowManualModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedAssignmentForReassign, setSelectedAssignmentForReassign] = useState<EvaluationAssignment | null>(null);

  // Datos auxiliares para modales
  const [leadersList, setLeadersList] = useState<any[]>([]);
  const [collaboratorsList, setCollaboratorsList] = useState<any[]>([]);
  const [loadingAuxData, setLoadingAuxData] = useState(false);

  // Formulario Manual
  const [manualLeaderId, setManualLeaderId] = useState("");
  const [manualCollabIds, setManualCollabIds] = useState<string[]>([]);
  const [manualNotes, setManualNotes] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  // Filtros y búsquedas para Modal Manual
  const [manualLeaderSearch, setManualLeaderSearch] = useState("");
  const [manualLeaderPositionFilter, setManualLeaderPositionFilter] = useState("todos");
  const [manualCollabSearch, setManualCollabSearch] = useState("");
  const [manualCollabPositionFilter, setManualCollabPositionFilter] = useState("todos");
  const [manualCollabStatusFilter, setManualCollabStatusFilter] = useState<"todos" | "sin_asignar" | "asignados">("todos");
  const [manualCollabAreaFilter, setManualCollabAreaFilter] = useState("todos");

  // Búsqueda para Modal Reasignar
  const [reassignSearch, setReassignSearch] = useState("");
  const [reassignNewLeaderId, setReassignNewLeaderId] = useState("");

  // Estado Importación Excel
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelPreview, setExcelPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStepText, setImportStepText] = useState("");
  const [importResult, setImportResult] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Progreso de carga inicial del módulo y modales
  const [loadProgress, setLoadProgress] = useState(0);
  const [auxLoadProgress, setAuxLoadProgress] = useState(0);
  const [manualSaveProgress, setManualSaveProgress] = useState(0);
  const [manualSaveStep, setManualSaveStep] = useState("");

  // Copiado de SQL
  const [copiedSql, setCopiedSql] = useState(false);

  // Cargar datos principales con progreso animado de 0% a 100%
  const loadData = async () => {
    setLoading(true);
    setLoadProgress(0);
    setTimeout(() => setLoadProgress(15), 25);

    const progressTimer = setInterval(() => {
      setLoadProgress((prev) => {
        if (prev < 40) return prev + 15;
        if (prev < 75) return prev + 10;
        if (prev < 92) return prev + 4;
        return prev;
      });
    }, 110);

    try {
      const res = await getEvaluationAssignmentsDashboard(selectedYear);

      clearInterval(progressTimer);
      setLoadProgress(100);

      if (res.tableNotCreated) {
        setTableNotCreated(true);
        setTimeout(() => setLoading(false), 200);
        return;
      }

      if (res.error) {
        console.error("Dashboard response error:", res.error);
        toast.error("Observación al cargar asignaciones: " + res.error);
      }

      setTableNotCreated(false);
      setAssignments(res.assignments || []);
      setLeaderSummaries(res.summaries || []);
      setStats(res.stats || {
        totalAssignments: 0,
        totalCompleted: 0,
        totalPendingSignature: 0,
        totalInProgress: 0,
        totalPending: 0,
        totalLeaders: 0,
        overallCompletion: 0,
      });

      // Mantener las tarjetas contraídas inicialmente para una vista ejecutiva limpia y alineada
      setExpandedLeaders({});
    } catch (err: any) {
      clearInterval(progressTimer);
      console.error("Error en loadData asignaciones:", err);
      toast.error("Error al cargar asignaciones: " + (err?.message || "Error desconocido"));
    } finally {
      setTimeout(() => setLoading(false), 200);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedYear]);

  useEffect(() => {
    setLeaderPages({});
    setGeneralPage(1);
  }, [searchTerm, statusFilter, leaderFilter, selectedYear]);

  // Cargar líderes y colaboradores cuando se abre un modal con animación de 0% a 100%
  const loadAuxData = async () => {
    setLoadingAuxData(true);
    setAuxLoadProgress(0);
    setTimeout(() => setAuxLoadProgress(18), 25);

    const auxTimer = setInterval(() => {
      setAuxLoadProgress((prev) => {
        if (prev < 45) return prev + 16;
        if (prev < 78) return prev + 10;
        if (prev < 94) return prev + 4;
        return prev;
      });
    }, 90);

    try {
      const [leadersRes, collabsRes] = await Promise.all([
        getAvailableLeaders(),
        getCollaboratorsWithAssignmentStatus(selectedYear)
      ]);
      clearInterval(auxTimer);
      setAuxLoadProgress(100);
      setLeadersList(leadersRes.data || []);
      setCollaboratorsList(collabsRes.data || []);
    } catch (err) {
      clearInterval(auxTimer);
      console.error(err);
    } finally {
      setTimeout(() => setLoadingAuxData(false), 180);
    }
  };

  const handleOpenManualModal = () => {
    setManualLeaderId("");
    setManualCollabIds([]);
    setManualNotes("");
    setManualLeaderSearch("");
    setManualLeaderPositionFilter("todos");
    setManualCollabSearch("");
    setManualCollabPositionFilter("todos");
    setManualCollabStatusFilter("todos");
    setManualCollabAreaFilter("todos");
    loadAuxData();
    setShowManualModal(true);
  };

  const handleOpenImportModal = () => {
    setExcelFile(null);
    setExcelPreview([]);
    setImportResult(null);
    setShowImportModal(true);
  };

  const toggleLeaderExpand = (leaderId: string) => {
    setExpandedLeaders((prev) => ({ ...prev, [leaderId]: !prev[leaderId] }));
  };

  // Filtrado de Resúmenes por Líder
  const filteredLeaderSummaries = useMemo(() => {
    return leaderSummaries.filter((l) => {
      const matchesLeaderFilter = leaderFilter === "todos" || l.leaderId === leaderFilter;
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = !q ||
        l.leaderName.toLowerCase().includes(q) ||
        l.leaderEmail.toLowerCase().includes(q) ||
        l.leaderPosition.toLowerCase().includes(q) ||
        l.assignments.some((a) =>
          (a.collaborator?.full_name || "").toLowerCase().includes(q) ||
          (a.collaborator?.document_number || "").includes(q) ||
          (a.collaborator?.positions?.name || "").toLowerCase().includes(q)
        );

      // Filtro de estado sobre las asignaciones del líder
      const matchesStatus = statusFilter === "todos" || l.assignments.some((a) => a.status === statusFilter);

      return matchesLeaderFilter && matchesSearch && matchesStatus;
    });
  }, [leaderSummaries, searchTerm, statusFilter, leaderFilter]);

  // Filtrado de Asignaciones Generales
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const matchesStatus = statusFilter === "todos" || a.status === statusFilter;
      const matchesLeader = leaderFilter === "todos" || a.evaluator_id === leaderFilter;
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = !q ||
        (a.collaborator?.full_name || "").toLowerCase().includes(q) ||
        (a.collaborator?.document_number || "").includes(q) ||
        (a.collaborator?.positions?.name || "").toLowerCase().includes(q) ||
        `${a.evaluator?.first_name || ""} ${a.evaluator?.last_name || ""}`.toLowerCase().includes(q) ||
        (a.evaluator?.document_number || "").includes(q);

      return matchesStatus && matchesLeader && matchesSearch;
    });
  }, [assignments, searchTerm, statusFilter, leaderFilter]);

  // Opciones únicas de cargos para filtros en modal manual
  const uniqueLeaderPositions = useMemo(() => {
    const positions = new Set<string>();
    leadersList.forEach((l) => {
      if (l.position) positions.add(l.position);
    });
    return Array.from(positions).sort();
  }, [leadersList]);

  const uniqueCollabPositions = useMemo(() => {
    const positions = new Set<string>();
    collaboratorsList.forEach((c) => {
      if (c.position) positions.add(c.position);
    });
    return Array.from(positions).sort();
  }, [collaboratorsList]);

  const uniqueCollabAreas = useMemo(() => {
    const areas = new Set<string>();
    collaboratorsList.forEach((c) => {
      if (c.area) areas.add(c.area);
    });
    return Array.from(areas).sort();
  }, [collaboratorsList]);

  // Líderes filtrados para modal manual
  const filteredLeadersForManual = useMemo(() => {
    const q = manualLeaderSearch.toLowerCase().trim();
    return leadersList.filter((l) => {
      const matchesPosition = manualLeaderPositionFilter === "todos" || l.position === manualLeaderPositionFilter;
      const matchesSearch = !q ||
        (l.name || "").toLowerCase().includes(q) ||
        (l.document_number || "").includes(q) ||
        (l.position || "").toLowerCase().includes(q) ||
        (l.email || "").toLowerCase().includes(q) ||
        (l.role || "").toLowerCase().includes(q);
      return matchesPosition && matchesSearch;
    });
  }, [leadersList, manualLeaderSearch, manualLeaderPositionFilter]);

  // Colaboradores filtrados para modal manual
  const filteredCollabsForManual = useMemo(() => {
    const q = manualCollabSearch.toLowerCase().trim();
    return collaboratorsList.filter((c) => {
      const matchesSearch = !q ||
        (c.full_name || "").toLowerCase().includes(q) ||
        (c.document_number || "").includes(q) ||
        (c.position || "").toLowerCase().includes(q) ||
        (c.area || "").toLowerCase().includes(q);

      const matchesPosition = manualCollabPositionFilter === "todos" || c.position === manualCollabPositionFilter;
      const matchesArea = manualCollabAreaFilter === "todos" || c.area === manualCollabAreaFilter;
      const matchesStatus =
        manualCollabStatusFilter === "todos" ||
        (manualCollabStatusFilter === "sin_asignar" && !c.isAssigned) ||
        (manualCollabStatusFilter === "asignados" && c.isAssigned);

      return matchesSearch && matchesPosition && matchesArea && matchesStatus;
    });
  }, [collaboratorsList, manualCollabSearch, manualCollabPositionFilter, manualCollabAreaFilter, manualCollabStatusFilter]);

  const selectedLeaderObj = useMemo(() => {
    return leadersList.find((l) => l.id === manualLeaderId) || null;
  }, [leadersList, manualLeaderId]);

  // Acciones de selección en lote para colaboradores en modal manual
  const handleSelectAllVisibleCollabs = () => {
    const visibleIds = filteredCollabsForManual.map((c) => c.id);
    setManualCollabIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  const handleDeselectAllVisibleCollabs = () => {
    const visibleSet = new Set(filteredCollabsForManual.map((c) => c.id));
    setManualCollabIds((prev) => prev.filter((id) => !visibleSet.has(id)));
  };

  const handleClearAllSelectedCollabs = () => {
    setManualCollabIds([]);
  };

  // Líderes filtrados para modal de reasignación
  const filteredLeadersForReassign = useMemo(() => {
    const q = reassignSearch.toLowerCase().trim();
    return leadersList.filter((l) => {
      if (selectedAssignmentForReassign && l.id === selectedAssignmentForReassign.evaluator_id) {
        return false;
      }
      return (
        !q ||
        (l.name || "").toLowerCase().includes(q) ||
        (l.document_number || "").includes(q) ||
        (l.position || "").toLowerCase().includes(q) ||
        (l.role || "").toLowerCase().includes(q)
      );
    });
  }, [leadersList, reassignSearch, selectedAssignmentForReassign]);

  // Guardar asignación manual con animación de progreso de 0% a 100%
  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualLeaderId) {
      toast.error("Seleccione un líder evaluador.");
      return;
    }
    if (manualCollabIds.length === 0) {
      toast.error("Seleccione al menos un colaborador.");
      return;
    }

    setSavingManual(true);
    setManualSaveProgress(0);
    setManualSaveStep("Validando líder evaluador y colaboradores seleccionados...");
    setTimeout(() => setManualSaveProgress(22), 20);

    const saveTimer = setInterval(() => {
      setManualSaveProgress((prev) => {
        if (prev < 50) {
          setManualSaveStep(`Sincronizando ${manualCollabIds.length} asignaciones en base de datos...`);
          return prev + 16;
        }
        if (prev < 88) return prev + 10;
        if (prev < 96) return prev + 2;
        return prev;
      });
    }, 95);

    const res = await bulkAssignCollaborators({
      evaluator_id: manualLeaderId,
      collaborator_ids: manualCollabIds,
      evaluation_year: selectedYear,
      notes: manualNotes,
    });

    clearInterval(saveTimer);
    setManualSaveProgress(100);
    setManualSaveStep("¡Asignación completada exitosamente!");

    if (res.error) {
      setSavingManual(false);
      toast.error("Error al asignar colaboradores: " + res.error);
      return;
    }

    setTimeout(() => {
      setSavingManual(false);
      toast.success(`Se asignaron exitosamente ${manualCollabIds.length} colaboradores.`);
      setShowManualModal(false);
      loadData();
    }, 220);
  };

  // Reasignar Líder
  const handleReassign = async (newLeaderId: string) => {
    if (!selectedAssignmentForReassign || !newLeaderId) return;

    const res = await createOrUpdateAssignment({
      evaluator_id: newLeaderId,
      collaborator_id: selectedAssignmentForReassign.collaborator_id,
      evaluation_year: selectedYear,
      notes: `Reasignado desde líder anterior.`,
    });

    if (res.error) {
      toast.error("Error al reasignar: " + res.error);
      return;
    }

    toast.success("Colaborador reasignado con éxito.");
    setShowReassignModal(false);
    setSelectedAssignmentForReassign(null);
    loadData();
  };

  // Eliminar asignación
  const handleDeleteAssignment = async (assignmentId: string, collabName: string) => {
    if (!confirm(`¿Está seguro de eliminar la asignación de evaluación para ${collabName}?`)) {
      return;
    }

    const res = await deleteAssignment(assignmentId);
    if (res.error) {
      toast.error("Error al eliminar asignación: " + res.error);
      return;
    }

    toast.success("Asignación eliminada correctamente.");
    loadData();
  };

  // Procesar archivo Excel
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFile(file);
    setImportResult(null);
    setImportProgress(0);
    setImportStepText("");
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (!data || data.length === 0) {
          toast.error("El archivo Excel está vacío.");
          return;
        }

        setExcelPreview(data.slice(0, 5));
      } catch (err) {
        console.error(err);
        toast.error("Error al procesar el archivo Excel.");
      }
    };
    reader.readAsBinaryString(file);
  };

  // Confirmar importación desde Excel con animación y porcentaje de avance
  const handleConfirmImport = async () => {
    if (!excelFile) {
      toast.error("Seleccione un archivo Excel primero.");
      return;
    }

    setImporting(true);
    setImportProgress(10);
    setImportStepText("Leyendo archivo Excel y analizando hojas de cálculo...");

    const progressTimer = setInterval(() => {
      setImportProgress((prev) => {
        if (prev < 35) return prev + 10;
        if (prev < 68) return prev + 6;
        if (prev < 88) return prev + 2;
        return prev;
      });
    }, 200);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setImportProgress(40);
        setImportStepText("Extrayendo columnas de colaboradores y líderes evaluadores...");

        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        // Normalizar filas buscando columnas de documento, nombre, cargo de colaborador y líder
        const formattedRows = data.map((row) => {
          const docCollab =
            row["Documento Colaborador"] ||
            row["Documento"] ||
            row["Cédula Colaborador"] ||
            row["Cedula Colaborador"] ||
            row["Cédula"] ||
            row["Cedula"] ||
            row["doc_colaborador"] ||
            row["documento_colaborador"] ||
            row["Colaborador Documento"];

          const nameCollab =
            row["Nombre Colaborador (Opcional)"] ||
            row["Nombre Colaborador"] ||
            row["Nombre"] ||
            row["Nombres"] ||
            row["Colaborador"] ||
            row["nombre_colaborador"] ||
            row["Colaborador Nombre"];

          const cargoCollab =
            row["Cargo Colaborador (Opcional)"] ||
            row["Cargo Colaborador"] ||
            row["Cargo"] ||
            row["cargo_colaborador"] ||
            row["Posición"] ||
            row["Posicion"];

          const docLeader =
            row["Documento Líder"] ||
            row["Documento Lider"] ||
            row["Cédula Líder"] ||
            row["Cedula Lider"] ||
            row["doc_lider"] ||
            row["documento_lider"] ||
            row["Líder Documento"] ||
            row["Lider Documento"];

          const nameLeader =
            row["Nombre Líder (Opcional)"] ||
            row["Nombre Líder"] ||
            row["Nombre Lider"] ||
            row["Líder"] ||
            row["Lider"] ||
            row["nombre_lider"] ||
            row["Líder Nombre"];

          const emailLeader =
            row["Correo Líder"] ||
            row["Correo Lider"] ||
            row["Email Líder"] ||
            row["Email Lider"] ||
            row["email_lider"] ||
            row["correo_lider"];

          const notas = row["Notas"] || row["Observaciones"] || "";

          return {
            doc_colaborador: docCollab ? docCollab.toString().trim() : "",
            nombre_colaborador: nameCollab ? nameCollab.toString().trim() : undefined,
            cargo_colaborador: cargoCollab ? cargoCollab.toString().trim() : undefined,
            doc_lider: docLeader ? docLeader.toString().trim() : "",
            nombre_lider: nameLeader ? nameLeader.toString().trim() : undefined,
            email_lider: emailLeader ? emailLeader.toString().trim() : "",
            notas: notas ? notas.toString().trim() : undefined,
          };
        });

        setImportProgress(70);
        setImportStepText(`Validando ${formattedRows.length} asignaciones en la base de datos...`);

        const res = await importAssignmentsFromExcelData(formattedRows, selectedYear);

        clearInterval(progressTimer);
        setImportProgress(100);
        setImportStepText("¡Cargue finalizado! Aplicando asignaciones y reporte...");

        setTimeout(() => {
          setImporting(false);
          setImportResult(res);

          if (res.success) {
            toast.success(`Importación exitosa: ${res.importedCount} asignaciones registradas.`);
            loadData();
          } else {
            toast.error("Hubo observaciones al procesar el archivo. Revisa el reporte en pantalla.");
          }
        }, 400);
      } catch (err: any) {
        clearInterval(progressTimer);
        setImporting(false);
        setImportProgress(0);
        console.error("Error al procesar importación:", err);
        const errorMsg = err?.message || "";
        if (errorMsg.includes("Server Components render") || errorMsg.includes("digest")) {
          toast.error("Ocurrió un error en el servidor al procesar el archivo. Por favor verifica que las columnas del Excel sean válidas.");
        } else {
          toast.error("Error al importar: " + (errorMsg || "Error desconocido"));
        }
      }
    };
    reader.readAsBinaryString(excelFile);
  };

  // Exportar Log de Errores / Filas no coincidentes a Excel
  const handleExportErrorsToExcel = () => {
    if (!importResult?.errors || importResult.errors.length === 0) {
      toast.info("No hay errores o filas no coincidentes para exportar.");
      return;
    }

    const exportRows = importResult.errors.map((err: any) => ({
      "Fila Excel": err.fila,
      "Documento Colaborador": err.documento_colaborador || "—",
      "Nombre Colaborador": err.nombre_colaborador || "—",
      "Cargo Colaborador": err.cargo_colaborador || "—",
      "Documento Líder": err.documento_lider || "—",
      "Nombre Líder": err.nombre_lider || "—",
      "Motivo de la Novedad / Error": err.motivo || "—",
      "Acción Sugerida": err.accion_sugerida || "Registrar colaborador o verificar en el sistema",
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws["!cols"] = [
      { wch: 12 }, // Fila
      { wch: 24 }, // Doc Colab
      { wch: 35 }, // Nombre Colab
      { wch: 30 }, // Cargo Colab
      { wch: 20 }, // Doc Líder
      { wch: 30 }, // Nombre Líder
      { wch: 55 }, // Motivo
      { wch: 45 }, // Acción Sugerida
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Log Errores Importación");
    const fileName = `Log_Errores_Importacion_Asignaciones_${selectedYear}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success("Log de errores descargado en Excel con éxito.");
  };

  // Descargar Plantilla Oficial Excel
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Documento Colaborador": "1052485963",
        "Nombre Colaborador (Opcional)": "Juan Pérez Gómez",
        "Cargo Colaborador (Opcional)": "Conductor",
        "Documento Líder": "74185296",
        "Correo Líder": "carlos.rodriguez@empresa.com",
        "Nombre Líder (Opcional)": "Carlos Rodríguez",
        "Notas": "Asignación ciclo 2026",
      },
      {
        "Documento Colaborador": "1049874512",
        "Nombre Colaborador (Opcional)": "María López Silva",
        "Cargo Colaborador (Opcional)": "Auxiliar de Ventas",
        "Documento Líder": "74185296",
        "Correo Líder": "carlos.rodriguez@empresa.com",
        "Nombre Líder (Opcional)": "Carlos Rodríguez",
        "Notas": "Asignación ciclo 2026",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla Asignaciones");
    XLSX.writeFile(wb, `Plantilla_Asignaciones_Evaluaciones_${selectedYear}.xlsx`);
    toast.success("Plantilla descargada con éxito.");
  };

  // Exportar Asignaciones a Excel
  const handleExportAssignmentsExcel = () => {
    if (assignments.length === 0) {
      toast.warning("No hay asignaciones para exportar.");
      return;
    }

    const exportData = assignments.map((a, idx) => ({
      "#": idx + 1,
      "Año Evaluación": a.evaluation_year,
      "Cédula Líder": a.evaluator?.document_number || "—",
      "Líder Evaluador": `${a.evaluator?.first_name || ""} ${a.evaluator?.last_name || ""}`.trim(),
      "Cargo Líder": Array.isArray(a.evaluator?.positions) ? a.evaluator?.positions[0]?.name : a.evaluator?.positions?.name || "Sin Cargo",
      "Correo Líder": a.evaluator?.email || "—",
      "Cédula Colaborador": a.collaborator?.document_number || "—",
      "Colaborador Evaluado": a.collaborator?.full_name || `${a.collaborator?.first_name || ""} ${a.collaborator?.last_name || ""}`.trim(),
      "Cargo Colaborador": Array.isArray(a.collaborator?.positions) ? a.collaborator?.positions[0]?.name : a.collaborator?.positions?.name || "Sin Cargo",
      "Área Colaborador": Array.isArray(a.collaborator?.areas) ? a.collaborator?.areas[0]?.name : a.collaborator?.areas?.name || "Sin Área",
      "Estado Evaluación":
        a.status === "finalizada"
          ? "Finalizada"
          : a.status === "pendiente_firma"
          ? "Pendiente de Firma"
          : a.status === "en_proceso"
          ? "En Proceso"
          : "Pendiente",
      "Calificación Final": a.evaluation?.result?.overall_average ? `${formatScore(a.evaluation.result.overall_average)} / 5.0` : "Sin Calificar",
      "Resultado": a.evaluation?.result?.result || "Sin Evaluar",
      "Fecha Finalización": a.evaluation?.finalized_at ? new Date(a.evaluation.finalized_at).toLocaleDateString("es-CO") : "—",
      "Notas Asignación": a.notes || "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asignaciones Detalladas");

    // Hoja 2: Resumen por Líder
    const leaderData = leaderSummaries.map((l, idx) => ({
      "#": idx + 1,
      "Líder Evaluador": l.leaderName,
      "Cargo Líder": l.leaderPosition,
      "Correo Líder": l.leaderEmail,
      "Total Asignados": l.totalAssigned,
      "Evaluaciones Finalizadas": l.finalizedCount,
      "Pendientes de Firma": l.pendingSignatureCount,
      "En Proceso": l.inProgressCount,
      "Sin Iniciar": l.pendingCount,
      "% Avance": `${l.completionPercentage}%`,
      "Promedio Calificación": l.averageScore > 0 ? `${formatScore(l.averageScore)} / 5.0` : "—",
    }));

    const wsLeaders = XLSX.utils.json_to_sheet(leaderData);
    XLSX.utils.book_append_sheet(wb, wsLeaders, "Resumen por Líder");

    XLSX.writeFile(wb, `Reporte_Asignaciones_Evaluaciones_${selectedYear}.xlsx`);
    toast.success("Reporte descargado con éxito.");
  };

  const sqlCodeToCopy = `-- Migración SQL para crear la tabla de asignaciones de evaluación
SET search_path TO public, extensions;

CREATE TABLE IF NOT EXISTS public.evaluation_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL DEFAULT '11111111-0000-0000-0000-000000000001',
  evaluation_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  version_id UUID,
  evaluator_id UUID NOT NULL,
  collaborator_id UUID NOT NULL,
  evaluation_id UUID,
  status VARCHAR(50) NOT NULL DEFAULT 'pendiente',
  notes TEXT,
  assigned_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_year_collaborator UNIQUE(evaluation_year, collaborator_id)
);

CREATE INDEX IF NOT EXISTS idx_eval_assignments_year ON public.evaluation_assignments(evaluation_year);
CREATE INDEX IF NOT EXISTS idx_eval_assignments_evaluator ON public.evaluation_assignments(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_eval_assignments_collab ON public.evaluation_assignments(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_eval_assignments_status ON public.evaluation_assignments(status);
CREATE INDEX IF NOT EXISTS idx_eval_assignments_comp ON public.evaluation_assignments(company_id);

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.evaluation_assignments
      ADD CONSTRAINT fk_eval_assignments_evaluator
      FOREIGN KEY (evaluator_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER TABLE public.evaluation_assignments
      ADD CONSTRAINT fk_eval_assignments_collaborator
      FOREIGN KEY (collaborator_id) REFERENCES public.collaborators(id) ON DELETE CASCADE;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER TABLE public.evaluation_assignments
      ADD CONSTRAINT fk_eval_assignments_evaluation
      FOREIGN KEY (evaluation_id) REFERENCES public.evaluations(id) ON DELETE SET NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER TABLE public.evaluation_assignments
      ADD CONSTRAINT fk_eval_assignments_assigned_by
      FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

ALTER TABLE public.evaluation_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acceso completo a service_role" ON public.evaluation_assignments;
CREATE POLICY "Permitir acceso completo a service_role" ON public.evaluation_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin, RRHH y Gerencia pueden gestionar asignaciones" ON public.evaluation_assignments;
CREATE POLICY "Admin, RRHH y Gerencia pueden gestionar asignaciones" ON public.evaluation_assignments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name::text IN ('admin', 'rrhh', 'gerencia')
  )
);

DROP POLICY IF EXISTS "Líderes pueden ver sus evaluaciones asignadas" ON public.evaluation_assignments;
CREATE POLICY "Líderes pueden ver sus evaluaciones asignadas" ON public.evaluation_assignments FOR SELECT USING (evaluator_id = auth.uid());

NOTIFY pgrst, 'reload schema';`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlCodeToCopy);
    setCopiedSql(true);
    toast.success("Script SQL copiado al portapapeles.");
    setTimeout(() => setCopiedSql(false), 3000);
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Encabezado Principal */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-xl bg-[#012169]/10 text-[#012169] dark:bg-[#0084d5]/20 dark:text-[#38bdf8]">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Asignación y Planificación de Evaluaciones
              </h1>
              <p className="text-sm text-muted-foreground">
                Parametriza qué colaboradores deben ser evaluados por cada líder para el ciclo activo.
              </p>
            </div>
          </div>
        </div>

        {/* Acciones Superiores y Selector de Año */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Selector de Ciclo / Año */}
          <div className="flex items-center bg-card border rounded-xl px-3 py-1.5 shadow-xs">
            <span className="text-xs text-muted-foreground font-medium mr-2">Ciclo:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent font-bold text-sm text-foreground focus:outline-none cursor-pointer"
            >
              {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((y) => (
                <option key={y} value={y} className="bg-popover text-foreground">
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border bg-card hover:bg-accent text-xs font-semibold transition-colors"
            title="Descargar plantilla de Excel"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            Plantilla Excel
          </button>

          <button
            onClick={handleOpenImportModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 text-white hover:bg-slate-900 dark:bg-slate-700 text-xs font-semibold transition-colors shadow-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            Importar Excel
          </button>

          <button
            onClick={handleOpenManualModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#012169] text-white hover:bg-[#012169]/90 text-xs font-semibold transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Asignar Manualmente
          </button>

          <button
            onClick={handleExportAssignmentsExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0084d5] text-white hover:bg-[#0084d5]/90 text-xs font-semibold transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Banner si la tabla aún no ha sido creada en Supabase */}
      {tableNotCreated && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 p-5 shadow-xs space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1 flex-1">
              <h3 className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                Tabla de Asignaciones Pendiente de Activación en Base de Datos
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                La tabla <code className="font-mono font-bold bg-amber-200/50 dark:bg-amber-900/50 px-1 py-0.5 rounded">evaluation_assignments</code> no existe aún en el esquema de Supabase. Para habilitarla de inmediato, ejecuta la migración <code className="font-mono font-bold bg-amber-200/50 dark:bg-amber-900/50 px-1 py-0.5 rounded">013_create_evaluation_assignments.sql</code> en el <strong>SQL Editor</strong> de tu panel de Supabase.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copySqlToClipboard}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSql ? "¡Copiado!" : "Copiar Script SQL"}
              </button>
              <button
                onClick={loadData}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-zinc-900 hover:bg-amber-100/50 text-xs font-semibold transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Verificar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tarjetas KPI de Resumen (Paleta Corporativa: Azul Oscuro #012169, Azul Claro #0084d5 y Gris Slate) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-stretch">
        <div className="rounded-2xl border border-l-4 border-l-[#012169] bg-card p-4 shadow-xs flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Planificadas</span>
            <div className="p-2 rounded-xl bg-[#012169]/10 text-[#012169] dark:bg-[#012169]/30 dark:text-[#38bdf8] flex-shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-extrabold text-[#012169] dark:text-white tabular-nums">{stats.totalAssignments}</span>
            <span className="text-xs font-bold text-[#0084d5] tabular-nums">{stats.overallCompletion}% avance</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div className="bg-[#012169] h-full rounded-full transition-all" style={{ width: `${stats.overallCompletion}%` }} />
          </div>
        </div>

        <div className="rounded-2xl border border-l-4 border-l-[#012169] bg-card p-4 shadow-xs flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Finalizadas</span>
            <div className="p-2 rounded-xl bg-[#012169]/10 text-[#012169] dark:bg-[#012169]/30 dark:text-[#38bdf8] flex-shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-extrabold text-[#012169] dark:text-white tabular-nums">{stats.totalCompleted}</span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Completadas</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Con resultado y calificación</p>
        </div>

        <div className="rounded-2xl border border-l-4 border-l-[#0084d5] bg-card p-4 shadow-xs flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pendientes de Firma</span>
            <div className="p-2 rounded-xl bg-[#0084d5]/10 text-[#0084d5] flex-shrink-0">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-extrabold text-[#0084d5] tabular-nums">{stats.totalPendingSignature}</span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Firma Colab.</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Calificadas sin firma aún</p>
        </div>

        <div className="rounded-2xl border border-l-4 border-l-slate-400 bg-card p-4 shadow-xs flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sin Iniciar / En Proc.</span>
            <div className="p-2 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-300 flex-shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-extrabold text-slate-600 dark:text-slate-300 tabular-nums">{stats.totalPending + stats.totalInProgress}</span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Por realizar</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Pendientes del líder</p>
        </div>

        <div className="rounded-2xl border border-l-4 border-l-[#0084d5] bg-card p-4 shadow-xs flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Líderes Asignados</span>
            <div className="p-2 rounded-xl bg-[#0084d5]/10 text-[#0084d5] flex-shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-extrabold text-[#012169] dark:text-white tabular-nums">{stats.totalLeaders}</span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Evaluadores</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {stats.totalLeaders > 0 ? (stats.totalAssignments / stats.totalLeaders).toFixed(1) : 0} colab. prom. por líder
          </p>
        </div>
      </div>

      {/* Cinta de Filtros y Selector de Vistas */}
      <div className="rounded-2xl border bg-card p-3.5 sm:p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Buscador */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por colaborador, líder, documento o cargo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-10 pr-8 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#012169]/30 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtros y Acciones de Vista */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-xl border bg-background px-3 text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="todos">Todos los Estados</option>
              <option value="pendiente">Sin Iniciar (Pendiente)</option>
              <option value="en_proceso">En Proceso</option>
              <option value="pendiente_firma">Pendiente de Firma</option>
              <option value="finalizada">Finalizada</option>
            </select>

            {/* Filtro por Líder */}
            <select
              value={leaderFilter}
              onChange={(e) => setLeaderFilter(e.target.value)}
              className="h-10 rounded-xl border bg-background px-3 text-xs font-medium focus:outline-none cursor-pointer max-w-[220px] truncate"
            >
              <option value="todos">Todos los Líderes ({leaderSummaries.length})</option>
              {leaderSummaries.map((l) => (
                <option key={l.leaderId} value={l.leaderId}>
                  {l.leaderName} ({l.totalAssigned})
                </option>
              ))}
            </select>

            {/* Expandir / Contraer Todos (en vista por líder) */}
            {viewMode === "lideres" && filteredLeaderSummaries.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const allExpanded = filteredLeaderSummaries.every((l) => !!expandedLeaders[l.leaderId]);
                  if (allExpanded) {
                    setExpandedLeaders({});
                  } else {
                    const next: Record<string, boolean> = {};
                    filteredLeaderSummaries.forEach((l) => {
                      if (l.leaderId) next[l.leaderId] = true;
                    });
                    setExpandedLeaders(next);
                  }
                }}
                className="h-10 inline-flex items-center gap-1.5 px-3 rounded-xl border bg-background hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Expandir o contraer todos los líderes"
              >
                {filteredLeaderSummaries.every((l) => !!expandedLeaders[l.leaderId]) ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Contraer</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Expandir</span>
                  </>
                )}
              </button>
            )}

            {/* Selector de Modo de Vista */}
            <div className="h-10 flex items-center bg-muted/60 p-1 rounded-xl border">
              <button
                onClick={() => setViewMode("lideres")}
                className={cn(
                  "h-full px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  viewMode === "lideres"
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Por Líder
              </button>
              <button
                onClick={() => setViewMode("general")}
                className={cn(
                  "h-full px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  viewMode === "general"
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Lista General
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido Principal con animación y porcentaje de avance */}
      {loading ? (
        <div className="rounded-2xl border bg-card/85 backdrop-blur-xs p-10 text-center space-y-5 shadow-sm max-w-md mx-auto my-12 animate-fade-in">
          <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-[#012169]/15 animate-ping opacity-60" />
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#012169] to-[#0084d5] text-white flex items-center justify-center shadow-lg shadow-[#012169]/25">
              <UserCheck className="w-7 h-7 animate-pulse" />
            </div>
          </div>
          
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-foreground">
              Cargando asignaciones del ciclo {selectedYear}
            </h4>
            <p className="text-xs text-muted-foreground">
              Consultando líderes, colaboradores asignados y estadísticas...
            </p>
          </div>

          <div className="space-y-2 pt-1 max-w-xs mx-auto">
            <div className="flex justify-between items-center text-xs font-semibold px-0.5">
              <span className="text-muted-foreground text-[11px] flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                Sincronizando datos...
              </span>
              <span className="font-mono font-bold text-[#012169] dark:text-blue-400 text-sm">
                {loadProgress}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-[#012169] via-[#0084d5] to-[#38bdf8] rounded-full transition-all duration-300 ease-out relative overflow-hidden"
                style={{ width: `${loadProgress}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-[shimmer_1.5s_infinite]" />
              </div>
            </div>
          </div>
        </div>
      ) : assignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#012169]/10 text-[#012169] dark:bg-[#0084d5]/20 dark:text-[#38bdf8] flex items-center justify-center mx-auto">
            <UserCheck className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-foreground">No hay asignaciones para el ciclo {selectedYear}</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Comienza importando el archivo Excel con los colaboradores asignados a cada líder o realiza asignaciones manuales.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={handleOpenImportModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 text-white hover:bg-slate-900 text-xs font-semibold transition-colors shadow-xs"
            >
              <Upload className="w-4 h-4" />
              Importar desde Excel
            </button>
            <button
              onClick={handleOpenManualModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#012169] text-white hover:bg-[#012169]/90 text-xs font-semibold transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Asignar Manualmente
            </button>
          </div>
        </div>
      ) : viewMode === "lideres" ? (
        /* VISTA 1: POR LÍDER (GESTIÓN Y METAS) */
        <div className="space-y-2.5">
          {filteredLeaderSummaries.length === 0 ? (
            <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
              No se encontraron líderes con los filtros aplicados.
            </div>
          ) : (
            <>
              {/* Cabecera de Columnas para Alineación Vertical Estricta en Escritorio */}
              <div className="hidden lg:grid lg:grid-cols-12 items-center gap-4 px-5 py-2.5 rounded-xl border bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground select-none">
                <div className="lg:col-span-5">Líder Evaluador / Cargo</div>
                <div className="lg:col-span-3">Avance de Evaluaciones</div>
                <div className="lg:col-span-2 text-center">Estado (Realizadas / Pend.)</div>
                <div className="lg:col-span-2 flex items-center justify-end gap-3 pr-1">
                  <span className="w-20 text-right">Promedio</span>
                  <span className="w-8" />
                </div>
              </div>

              {filteredLeaderSummaries.map((leader) => {
                const isExpanded = !!expandedLeaders[leader.leaderId];
                const completedCount = leader.finalizedCount;
                const remainingCount = Math.max(0, leader.totalAssigned - leader.finalizedCount);
                const isAllComplete = leader.totalAssigned > 0 && completedCount === leader.totalAssigned;

                return (
                  <div
                    key={leader.leaderId}
                    className={cn(
                      "rounded-2xl border bg-card overflow-hidden shadow-xs transition-all",
                      isExpanded ? "border-[#012169]/30 ring-1 ring-[#012169]/10" : "hover:border-border/90"
                    )}
                  >
                    {/* Encabezado del Líder con Grid de 12 Columnas para Alineación Perfecta */}
                    <div
                      onClick={() => toggleLeaderExpand(leader.leaderId)}
                      className="group p-4 sm:px-5 sm:py-4 grid grid-cols-1 lg:grid-cols-12 items-center gap-4 cursor-pointer hover:bg-muted/25 transition-colors select-none"
                    >
                      {/* Columna 1: Información del Líder (5/12) */}
                      <div className="lg:col-span-5 flex items-center gap-3.5 min-w-0">
                        <div
                          className={cn(
                            "w-11 h-11 rounded-2xl text-white flex items-center justify-center font-extrabold text-sm shadow-xs flex-shrink-0 transition-transform group-hover:scale-[1.02]",
                            isAllComplete
                              ? "bg-[#012169]"
                              : "bg-gradient-to-br from-[#012169] to-[#0084d5]"
                          )}
                        >
                          {leader.leaderName
                            .split(" ")
                            .filter(Boolean)
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm sm:text-base text-[#012169] dark:text-white truncate">
                              {leader.leaderName}
                            </h3>
                            <span className="text-[10px] font-semibold uppercase tracking-wide bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700 truncate max-w-[260px]">
                              {leader.leaderPosition}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
                            <span className="truncate">{leader.leaderEmail}</span>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span className="font-semibold text-[#0084d5] flex-shrink-0">
                              {leader.totalAssigned} {leader.totalAssigned === 1 ? "asignado" : "asignados"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Columna 2: Barra de Avance con Ancho Fijo en Grid (3/12) */}
                      <div className="lg:col-span-3 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-500 dark:text-slate-400">Avance</span>
                          <span
                            className={cn(
                              "font-extrabold tabular-nums",
                              isAllComplete
                                ? "text-[#012169] dark:text-white"
                                : leader.completionPercentage > 0
                                ? "text-[#0084d5]"
                                : "text-slate-500 dark:text-slate-400"
                            )}
                          >
                            {leader.completionPercentage}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-200/60 dark:border-slate-700">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              isAllComplete
                                ? "bg-[#012169]"
                                : "bg-gradient-to-r from-[#012169] to-[#0084d5]"
                            )}
                            style={{ width: `${leader.completionPercentage}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          <span>
                            {leader.pendingSignatureCount > 0
                              ? `${leader.pendingSignatureCount} por firma`
                              : leader.inProgressCount > 0
                              ? `${leader.inProgressCount} en proceso`
                              : "Ciclo activo"}
                          </span>
                          <span className="font-medium">
                            {completedCount} de {leader.totalAssigned} realizadas
                          </span>
                        </div>
                      </div>

                      {/* Columna 3: Badges de Estado con 2 Slots Fijos Simétricos (2/12) */}
                      <div className="lg:col-span-2 grid grid-cols-2 gap-2 items-center">
                        {/* Slot 1: Realizadas (Azul Oscuro Corporativo cuando > 0, Gris Suave cuando 0) */}
                        <div
                          className={cn(
                            "h-7 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 tabular-nums border transition-colors",
                            completedCount > 0
                              ? "bg-[#012169]/10 text-[#012169] dark:bg-[#012169]/30 dark:text-[#38bdf8] border-[#012169]/20"
                              : "bg-slate-100/70 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 border-slate-200/60 dark:border-slate-800"
                          )}
                          title={`${completedCount} evaluaciones finalizadas`}
                        >
                          <span>✓</span>
                          <span>{completedCount} fin.</span>
                        </div>

                        {/* Slot 2: Pendientes / Faltantes (Gris Corporativo cuando > 0, Azul Claro cuando 0) */}
                        <div
                          className={cn(
                            "h-7 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 tabular-nums border transition-colors",
                            remainingCount > 0
                              ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-300/80 dark:border-slate-700"
                              : "bg-[#0084d5]/10 text-[#0084d5] border-[#0084d5]/20"
                          )}
                          title={`${remainingCount} evaluaciones faltantes o pendientes`}
                        >
                          <span>{remainingCount > 0 ? "⏳" : "✓"}</span>
                          <span>{remainingCount} pend.</span>
                        </div>
                      </div>

                      {/* Columna 4: Promedio Fijo + Botón Desplegar (2/12) */}
                      <div className="lg:col-span-2 flex items-center justify-between lg:justify-end gap-3">
                        <div className="w-20 text-left lg:text-right flex-shrink-0">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold tracking-wider">
                            Promedio
                          </span>
                          {leader.averageScore > 0 ? (
                            <span className="text-sm font-extrabold text-[#012169] dark:text-[#38bdf8] tabular-nums">
                              {formatScore(leader.averageScore)}
                            </span>
                          ) : (
                            <span className="text-sm font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                              —
                            </span>
                          )}
                        </div>

                        <div
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center border transition-colors flex-shrink-0",
                            isExpanded
                              ? "bg-[#012169] text-white border-[#012169]"
                              : "border-slate-200 dark:border-slate-700 text-slate-500 group-hover:bg-slate-100 dark:group-hover:bg-slate-800 group-hover:text-[#012169]"
                          )}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Tabla de Colaboradores del Líder con Paginación (> 10 colaboradores) */}
                    <AnimatePresence>
                      {isExpanded && (() => {
                        const q = searchTerm.toLowerCase().trim();
                        const leaderSelfMatches =
                          !q ||
                          leader.leaderName.toLowerCase().includes(q) ||
                          leader.leaderEmail.toLowerCase().includes(q) ||
                          leader.leaderPosition.toLowerCase().includes(q);

                        const visibleAssignments = leader.assignments.filter((a) => {
                          const matchesStatus = statusFilter === "todos" || a.status === statusFilter;
                          const matchesCollabSearch =
                            leaderSelfMatches ||
                            (a.collaborator?.full_name || "").toLowerCase().includes(q) ||
                            (a.collaborator?.document_number || "").includes(q) ||
                            (a.collaborator?.positions?.name || "").toLowerCase().includes(q);
                          return matchesStatus && matchesCollabSearch;
                        });

                        const totalLeaderItems = visibleAssignments.length;
                        const totalLeaderPages = Math.max(1, Math.ceil(totalLeaderItems / LEADER_PAGE_SIZE));
                        const currentLeaderPage = Math.min(leaderPages[leader.leaderId] || 1, totalLeaderPages);
                        const startIdx = (currentLeaderPage - 1) * LEADER_PAGE_SIZE;
                        const paginatedLeaderAssignments = visibleAssignments.slice(
                          startIdx,
                          startIdx + LEADER_PAGE_SIZE
                        );

                        return (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border-t bg-muted/10 overflow-hidden"
                          >
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs text-left table-fixed min-w-[780px]">
                                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b">
                                  <tr>
                                    <th className="py-2.5 px-4 w-[130px]">Documento</th>
                                    <th className="py-2.5 px-4 w-[240px]">Colaborador Evaluado</th>
                                    <th className="py-2.5 px-4 w-[190px]">Cargo</th>
                                    <th className="py-2.5 px-4 w-[160px]">Área</th>
                                    <th className="py-2.5 px-4 w-[140px] text-center">Estado Evaluación</th>
                                    <th className="py-2.5 px-4 w-[100px] text-center">Calificación</th>
                                    <th className="py-2.5 px-4 w-[110px] text-right">Acciones</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                  {paginatedLeaderAssignments.map((assignment) => {
                                    const collab = assignment.collaborator;
                                    const evalRes = assignment.evaluation?.result;
                                    const st = assignment.status;

                                    return (
                                      <tr key={assignment.id} className="hover:bg-muted/20 transition-colors">
                                        <td className="py-2.5 px-4 font-mono font-medium text-foreground truncate">
                                          {collab?.document_number || "—"}
                                        </td>
                                        <td className="py-2.5 px-4 font-semibold text-foreground truncate" title={collab?.full_name || ""}>
                                          {collab?.full_name || `${collab?.first_name || ""} ${collab?.last_name || ""}`.trim()}
                                        </td>
                                        <td className="py-2.5 px-4 text-muted-foreground truncate">
                                          {Array.isArray(collab?.positions) ? collab?.positions[0]?.name : collab?.positions?.name || "Sin Cargo"}
                                        </td>
                                        <td className="py-2.5 px-4 text-muted-foreground truncate">
                                          {Array.isArray(collab?.areas) ? collab?.areas[0]?.name : collab?.areas?.name || "Sin Área"}
                                        </td>
                                        <td className="py-2.5 px-4 text-center">
                                          {st === "finalizada" ? (
                                            <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#012169]/10 text-[#012169] dark:bg-[#012169]/30 dark:text-[#38bdf8] border border-[#012169]/20 min-w-[105px]">
                                              <CheckCircle2 className="w-3 h-3" />
                                              Finalizada
                                            </span>
                                          ) : st === "pendiente_firma" ? (
                                            <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0084d5]/10 text-[#0084d5] border border-[#0084d5]/20 min-w-[105px]">
                                              <Clock className="w-3 h-3" />
                                              Pendiente Firma
                                            </span>
                                          ) : st === "en_proceso" ? (
                                            <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0084d5]/5 text-[#0084d5] border border-[#0084d5]/20 min-w-[105px]">
                                              <Clock className="w-3 h-3" />
                                              En Proceso
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 min-w-[105px]">
                                              Sin Iniciar
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-4 text-center font-bold tabular-nums">
                                          {evalRes?.overall_average != null ? (
                                            <span className="text-[#012169] dark:text-[#38bdf8]">
                                              {formatScore(evalRes.overall_average)}
                                            </span>
                                          ) : (
                                            <span className="text-slate-400 font-normal">—</span>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-4 text-right">
                                          <div className="flex items-center justify-end gap-1.5">
                                            {assignment.evaluation_id ? (
                                              <Link
                                                href={`/evaluaciones/${assignment.evaluation_id}`}
                                                className="p-1.5 rounded-md text-slate-500 hover:text-[#012169] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                title="Ver Evaluación"
                                              >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                              </Link>
                                            ) : (
                                              <Link
                                                href={`/evaluaciones/nueva?collab=${collab?.id}`}
                                                className="p-1.5 rounded-md text-slate-500 hover:text-[#0084d5] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                title="Iniciar Evaluación"
                                              >
                                                <Plus className="w-3.5 h-3.5" />
                                              </Link>
                                            )}

                                            <button
                                              onClick={() => {
                                                setSelectedAssignmentForReassign(assignment);
                                                setReassignSearch("");
                                                setReassignNewLeaderId("");
                                                loadAuxData();
                                                setShowReassignModal(true);
                                              }}
                                              className="p-1.5 rounded-md text-slate-500 hover:text-[#0084d5] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                              title="Reasignar a otro líder"
                                            >
                                              <Edit3 className="w-3.5 h-3.5" />
                                            </button>

                                            <button
                                              onClick={() => handleDeleteAssignment(assignment.id, collab?.full_name || "este colaborador")}
                                              className="p-1.5 rounded-md text-slate-500 hover:text-[#012169] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                              title="Eliminar asignación"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* Barra de Paginación cuando el líder tiene más de 10 colaboradores */}
                            {totalLeaderItems > LEADER_PAGE_SIZE && (
                              <div className="px-4 py-2.5 border-t bg-slate-50/70 dark:bg-slate-900/30 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                                <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                                  Mostrando{" "}
                                  <strong className="text-[#012169] dark:text-white">{startIdx + 1}</strong>–
                                  <strong className="text-[#012169] dark:text-white">
                                    {Math.min(startIdx + LEADER_PAGE_SIZE, totalLeaderItems)}
                                  </strong>{" "}
                                  de <strong className="text-[#012169] dark:text-white">{totalLeaderItems}</strong>{" "}
                                  colaboradores
                                </span>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={currentLeaderPage <= 1}
                                    onClick={() =>
                                      setLeaderPages((prev) => ({
                                        ...prev,
                                        [leader.leaderId]: Math.max(1, currentLeaderPage - 1),
                                      }))
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-card text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition-colors cursor-pointer"
                                  >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                    <span>Anterior</span>
                                  </button>

                                  {Array.from({ length: totalLeaderPages }, (_, idx) => idx + 1)
                                    .filter(
                                      (p) =>
                                        p === 1 ||
                                        p === totalLeaderPages ||
                                        Math.abs(p - currentLeaderPage) <= 1
                                    )
                                    .reduce<(number | string)[]>((acc, p, i, arr) => {
                                      if (i > 0 && p - (arr[i - 1] as number) > 1) {
                                        acc.push("...");
                                      }
                                      acc.push(p);
                                      return acc;
                                    }, [])
                                    .map((item, idx) =>
                                      item === "..." ? (
                                        <span key={`dots-${idx}`} className="px-1.5 text-slate-400">
                                          ...
                                        </span>
                                      ) : (
                                        <button
                                          key={item}
                                          type="button"
                                          onClick={() =>
                                            setLeaderPages((prev) => ({
                                              ...prev,
                                              [leader.leaderId]: Number(item),
                                            }))
                                          }
                                          className={cn(
                                            "w-7 h-7 rounded-lg text-xs font-bold tabular-nums transition-colors cursor-pointer",
                                            currentLeaderPage === item
                                              ? "bg-[#012169] text-white shadow-2xs"
                                              : "border border-slate-200 dark:border-slate-700 bg-card text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                          )}
                                        >
                                          {item}
                                        </button>
                                      )
                                    )}

                                  <button
                                    type="button"
                                    disabled={currentLeaderPage >= totalLeaderPages}
                                    onClick={() =>
                                      setLeaderPages((prev) => ({
                                        ...prev,
                                        [leader.leaderId]: Math.min(totalLeaderPages, currentLeaderPage + 1),
                                      }))
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-card text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition-colors cursor-pointer"
                                  >
                                    <span>Siguiente</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        );
                      })()}
                    </AnimatePresence>
                  </div>
                );
              })}
            </>
          )}
        </div>
      ) : (
        /* VISTA 2: LISTA GENERAL */
        <div className="rounded-2xl border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 text-muted-foreground font-semibold border-b">
                <tr>
                  <th className="py-3 px-4">Documento</th>
                  <th className="py-3 px-4">Colaborador</th>
                  <th className="py-3 px-4">Cargo / Área</th>
                  <th className="py-3 px-4">Líder Asignado</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-center">Calificación</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No hay asignaciones que coincidan con los filtros.
                    </td>
                  </tr>
                ) : (
                  filteredAssignments.map((a) => {
                    const collab = a.collaborator;
                    const leader = a.evaluator;
                    const evalRes = a.evaluation?.result;

                    return (
                      <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium">{collab?.document_number || "—"}</td>
                        <td className="py-3 px-4 font-semibold text-foreground">
                          {collab?.full_name || `${collab?.first_name || ""} ${collab?.last_name || ""}`.trim()}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-foreground">
                            {Array.isArray(collab?.positions) ? collab?.positions[0]?.name : collab?.positions?.name || "Sin Cargo"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {Array.isArray(collab?.areas) ? collab?.areas[0]?.name : collab?.areas?.name || "Sin Área"}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-foreground">
                            {leader ? `${leader.first_name || ""} ${leader.last_name || ""}`.trim() : "—"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {Array.isArray(leader?.positions) ? leader?.positions[0]?.name : leader?.positions?.name || "Líder"}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {a.status === "finalizada" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#012169]/10 text-[#012169] dark:bg-[#012169]/30 dark:text-[#38bdf8] border border-[#012169]/20">
                              Finalizada
                            </span>
                          ) : a.status === "pendiente_firma" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0084d5]/10 text-[#0084d5] border border-[#0084d5]/20">
                              Pendiente Firma
                            </span>
                          ) : a.status === "en_proceso" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0084d5]/5 text-[#0084d5] border border-[#0084d5]/20">
                              En Proceso
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              Sin Iniciar
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-bold">
                          {evalRes?.overall_average != null ? (
                            <span className="text-[#012169] dark:text-[#38bdf8]">
                              {formatScore(evalRes.overall_average)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {a.evaluation_id ? (
                              <Link
                                href={`/evaluaciones/${a.evaluation_id}`}
                                className="p-1 rounded-md text-slate-500 hover:text-[#012169] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Ver Evaluación"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            ) : (
                              <Link
                                href={`/evaluaciones/nueva?collab=${collab?.id}`}
                                className="p-1 rounded-md text-slate-500 hover:text-[#0084d5] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Iniciar Evaluación"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </Link>
                            )}

                            <button
                              onClick={() => {
                                setSelectedAssignmentForReassign(a);
                                setReassignSearch("");
                                setReassignNewLeaderId("");
                                loadAuxData();
                                setShowReassignModal(true);
                              }}
                              className="p-1 rounded-md text-slate-500 hover:text-[#0084d5] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Reasignar líder"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteAssignment(a.id, collab?.full_name || "este colaborador")}
                              className="p-1 rounded-md text-slate-500 hover:text-[#012169] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Eliminar asignación"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ASIGNACIÓN MANUAL */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-card border rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col">
            {/* Cabecera del Modal */}
            <div className="p-4 sm:p-5 border-b flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#012169] text-white flex items-center justify-center shadow-xs flex-shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-foreground">
                    Asignación Manual de Evaluaciones
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Ciclo de Evaluación {selectedYear} · Selecciona el líder evaluador y los colaboradores correspondientes
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingAuxData ? (
              <div className="py-12 px-4 flex-1 flex flex-col items-center justify-center">
                <LoadingProgress
                  icon={UserCheck}
                  title="Cargando líderes y colaboradores del sistema..."
                  description="Consultando estructura organizacional y estado de asignaciones..."
                  progress={auxLoadProgress}
                />
              </div>
            ) : (
              <form onSubmit={handleSaveManual} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
                  {/* Grid de 2 Columnas: Líder Evaluador (izq) y Colaboradores a Asignar (der) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    
                    {/* COLUMNA 1: LÍDER EVALUADOR (5/12) */}
                    <div className="lg:col-span-5 rounded-2xl border bg-background p-4 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-foreground flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#012169] text-white text-[11px] flex items-center justify-center font-extrabold">
                            1
                          </span>
                          Líder Evaluador
                        </label>
                        {selectedLeaderObj && (
                          <span className="text-[11px] font-semibold text-[#0084d5] bg-[#0084d5]/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Check className="w-3 h-3" /> Seleccionado
                          </span>
                        )}
                      </div>

                      {/* Tarjeta de Líder Seleccionado (Zona de Soltado / Dropzone) */}
                      {selectedLeaderObj && (
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "copy";
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const collabId = e.dataTransfer.getData("text/plain");
                            if (collabId) {
                              setManualCollabIds((prev) =>
                                prev.includes(collabId) ? prev : [...prev, collabId]
                              );
                              toast.info("Colaborador agregado a la asignación");
                            }
                          }}
                          className="p-3.5 rounded-xl border-2 border-[#012169]/40 bg-gradient-to-br from-blue-50/70 to-slate-50/70 dark:from-blue-950/20 dark:to-slate-900/20 space-y-3 transition-all"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#012169] to-[#0084d5] text-white flex items-center justify-center font-extrabold text-sm shadow-xs flex-shrink-0">
                                {selectedLeaderObj.name
                                  .split(" ")
                                  .filter(Boolean)
                                  .map((n: string) => n[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-xs sm:text-sm text-foreground truncate">
                                  {selectedLeaderObj.name}
                                </h4>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {selectedLeaderObj.position}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setManualLeaderId("")}
                              className="text-xs font-semibold text-[#0084d5] hover:text-[#012169] dark:hover:text-blue-300 underline cursor-pointer flex-shrink-0"
                            >
                              Cambiar
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50 text-[11px]">
                            <span className="px-2 py-0.5 rounded-md bg-muted text-foreground font-semibold">
                              CC: {selectedLeaderObj.document_number || "Sin Documento"}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-[#012169]/10 text-[#012169] dark:text-blue-300 font-semibold">
                              Rol: {selectedLeaderObj.role}
                            </span>
                          </div>

                          <div className="p-2 rounded-lg bg-blue-100/50 dark:bg-blue-900/30 text-[11px] text-blue-900 dark:text-blue-200 flex items-center justify-between">
                            <span>Colaboradores a asignar:</span>
                            <span className="font-bold text-xs px-2 py-0.5 rounded-full bg-[#012169] text-white">
                              {manualCollabIds.length}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Buscador y Filtro de Líderes */}
                      <div className="space-y-2">
                        {selectedLeaderObj && (
                          <p className="text-[11px] font-semibold text-muted-foreground pt-1">
                            O selecciona otro líder de la lista:
                          </p>
                        )}

                        {/* Buscador por Nombre, CC o Cargo */}
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Buscar líder por nombre, CC o cargo..."
                            value={manualLeaderSearch}
                            onChange={(e) => setManualLeaderSearch(e.target.value)}
                            className="w-full pl-8.5 pr-8 py-2 rounded-xl border bg-card text-xs focus:outline-none focus:ring-2 focus:ring-[#012169]/30"
                          />
                          {manualLeaderSearch && (
                            <button
                              type="button"
                              onClick={() => setManualLeaderSearch("")}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Filtro por Cargo de Líder */}
                        <select
                          value={manualLeaderPositionFilter}
                          onChange={(e) => setManualLeaderPositionFilter(e.target.value)}
                          className="w-full rounded-xl border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[#012169]/30"
                        >
                          <option value="todos">Todos los cargos de líderes ({leadersList.length})</option>
                          {uniqueLeaderPositions.map((pos) => (
                            <option key={pos} value={pos}>
                              {pos}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Lista de Líderes Filtrados con Selección y Drag & Drop Target */}
                      <div className="max-h-[280px] overflow-y-auto rounded-xl border divide-y bg-card">
                        {filteredLeadersForManual.length === 0 ? (
                          <div className="p-6 text-center text-xs text-muted-foreground space-y-1">
                            <Briefcase className="w-5 h-5 mx-auto opacity-40 mb-1" />
                            <p className="font-semibold">No se encontraron líderes</p>
                            <p className="text-[11px]">Intenta ajustar el texto o filtro de cargo.</p>
                          </div>
                        ) : (
                          filteredLeadersForManual.map((leader) => {
                            const isSelected = manualLeaderId === leader.id;
                            return (
                              <div
                                key={leader.id}
                                onClick={() => setManualLeaderId(leader.id)}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = "copy";
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  setManualLeaderId(leader.id);
                                  const collabId = e.dataTransfer.getData("text/plain");
                                  if (collabId) {
                                    setManualCollabIds((prev) =>
                                      prev.includes(collabId) ? prev : [...prev, collabId]
                                    );
                                    toast.info(`Colaborador agregado a ${leader.name}`);
                                  }
                                }}
                                className={cn(
                                  "p-2.5 flex items-center justify-between gap-2.5 cursor-pointer text-xs transition-colors hover:bg-muted/50",
                                  isSelected && "bg-[#012169]/5 dark:bg-[#012169]/20 border-l-4 border-l-[#012169]"
                                )}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#012169] to-[#0084d5] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                                    {leader.name
                                      .split(" ")
                                      .filter(Boolean)
                                      .map((n: string) => n[0])
                                      .join("")
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p
                                      className={cn(
                                        "font-bold truncate text-foreground",
                                        isSelected && "text-[#012169] dark:text-blue-400"
                                      )}
                                    >
                                      {leader.name}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground truncate">
                                      CC: {leader.document_number} · {leader.position}
                                    </p>
                                  </div>
                                </div>
                                {isSelected ? (
                                  <div className="w-5 h-5 rounded-full bg-[#012169] text-white flex items-center justify-center flex-shrink-0">
                                    <Check className="w-3 h-3" />
                                  </div>
                                ) : (
                                  <span className="text-[10px] font-semibold text-muted-foreground px-2 py-0.5 rounded bg-muted/70 flex-shrink-0">
                                    {leader.role}
                                  </span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* COLUMNA 2: COLABORADORES A ASIGNAR (7/12) */}
                    <div className="lg:col-span-7 rounded-2xl border bg-background p-4 space-y-3 shadow-2xs">
                      {/* Cabecera y Contador de Selección */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="text-xs font-bold text-foreground flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#0084d5] text-white text-[11px] flex items-center justify-center font-extrabold">
                            2
                          </span>
                          Colaboradores a Asignar
                        </label>
                        <span
                          className={cn(
                            "text-xs font-bold px-2.5 py-0.5 rounded-full transition-colors",
                            manualCollabIds.length > 0
                              ? "bg-[#012169] text-white"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {manualCollabIds.length} seleccionados
                        </span>
                      </div>

                      {/* Buscador de Colaboradores por Texto (Nombre, CC, Cargo o Área) */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Buscar colaborador por nombre, CC, cargo o área..."
                          value={manualCollabSearch}
                          onChange={(e) => setManualCollabSearch(e.target.value)}
                          className="w-full pl-8.5 pr-8 py-2 rounded-xl border bg-card text-xs focus:outline-none focus:ring-2 focus:ring-[#0084d5]/30"
                        />
                        {manualCollabSearch && (
                          <button
                            type="button"
                            onClick={() => setManualCollabSearch("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Barra de Filtros: Cargo, Estado de Asignación y Área */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* Filtro por Cargo */}
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                            Filtrar Cargo
                          </label>
                          <select
                            value={manualCollabPositionFilter}
                            onChange={(e) => setManualCollabPositionFilter(e.target.value)}
                            className="w-full rounded-xl border bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[#0084d5]/30 truncate"
                          >
                            <option value="todos">Todos los cargos ({collaboratorsList.length})</option>
                            {uniqueCollabPositions.map((pos) => (
                              <option key={pos} value={pos}>
                                {pos}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Filtro por Estado de Asignación */}
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                            Estado Asignación
                          </label>
                          <select
                            value={manualCollabStatusFilter}
                            onChange={(e) => setManualCollabStatusFilter(e.target.value as any)}
                            className="w-full rounded-xl border bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[#0084d5]/30 truncate"
                          >
                            <option value="todos">Todos los estados</option>
                            <option value="sin_asignar">
                              Solo Sin Asignar ({collaboratorsList.filter((c) => !c.isAssigned).length})
                            </option>
                            <option value="asignados">
                              Ya Asignados ({collaboratorsList.filter((c) => c.isAssigned).length})
                            </option>
                          </select>
                        </div>

                        {/* Filtro por Área */}
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                            Filtrar Área
                          </label>
                          <select
                            value={manualCollabAreaFilter}
                            onChange={(e) => setManualCollabAreaFilter(e.target.value)}
                            className="w-full rounded-xl border bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[#0084d5]/30 truncate"
                          >
                            <option value="todos">Todas las áreas</option>
                            {uniqueCollabAreas.map((area) => (
                              <option key={area} value={area}>
                                {area}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Herramientas de Selección en Lote */}
                      <div className="flex items-center justify-between text-xs pt-1 flex-wrap gap-2 border-t border-border/40">
                        <span className="text-[11px] text-muted-foreground">
                          Mostrando <strong className="text-foreground">{filteredCollabsForManual.length}</strong> de{" "}
                          {collaboratorsList.length} colaboradores
                        </span>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={handleSelectAllVisibleCollabs}
                            disabled={filteredCollabsForManual.length === 0}
                            className="px-2.5 py-1 rounded-lg border bg-card text-[11px] font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            Seleccionar visibles ({filteredCollabsForManual.length})
                          </button>
                          <button
                            type="button"
                            onClick={handleDeselectAllVisibleCollabs}
                            disabled={filteredCollabsForManual.length === 0}
                            className="px-2 py-1 rounded-lg border bg-card text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            Deseleccionar visibles
                          </button>
                          {manualCollabIds.length > 0 && (
                            <button
                              type="button"
                              onClick={handleClearAllSelectedCollabs}
                              className="px-2 py-1 rounded-lg text-[11px] font-semibold text-danger-600 hover:bg-danger-500/10 transition-colors cursor-pointer"
                            >
                              Limpiar todo
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Lista de Colaboradores con Checkbox y Soporte para Arrastrar */}
                      <div className="max-h-[300px] overflow-y-auto rounded-xl border divide-y bg-card">
                        {filteredCollabsForManual.length === 0 ? (
                          <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
                            <Users className="w-6 h-6 mx-auto opacity-40 mb-1" />
                            <p className="font-bold text-foreground">No se encontraron colaboradores</p>
                            <p className="text-[11px]">
                              Prueba cambiando el texto de búsqueda o los filtros de cargo/área.
                            </p>
                          </div>
                        ) : (
                          filteredCollabsForManual.map((collab) => {
                            const isChecked = manualCollabIds.includes(collab.id);
                            return (
                              <div
                                key={collab.id}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData("text/plain", collab.id);
                                }}
                                onClick={() => {
                                  if (isChecked) {
                                    setManualCollabIds((prev) => prev.filter((id) => id !== collab.id));
                                  } else {
                                    setManualCollabIds((prev) => [...prev, collab.id]);
                                  }
                                }}
                                className={cn(
                                  "p-2.5 flex items-center justify-between gap-3 cursor-pointer text-xs transition-colors hover:bg-muted/40 select-none",
                                  isChecked && "bg-blue-50/70 dark:bg-blue-950/30"
                                )}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}} // Manejado por onClick del contenedor
                                    className="rounded border-slate-300 text-[#012169] focus:ring-0 cursor-pointer w-4 h-4 flex-shrink-0"
                                  />
                                  <div className="w-7 h-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                                    {collab.full_name
                                      .split(" ")
                                      .filter(Boolean)
                                      .map((n: string) => n[0])
                                      .join("")
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-foreground truncate">{collab.full_name}</p>
                                    <p className="text-[11px] text-muted-foreground truncate">
                                      CC: {collab.document_number} ·{" "}
                                      <span className="font-semibold text-foreground/80">{collab.position}</span> ·{" "}
                                      {collab.area}
                                    </p>
                                  </div>
                                </div>

                                {/* Estado actual de asignación */}
                                <div className="flex-shrink-0">
                                  {collab.isAssigned ? (
                                    <span
                                      className={cn(
                                        "text-[10px] font-semibold px-2 py-0.5 rounded-md block whitespace-nowrap",
                                        collab.assignedLeaderId === manualLeaderId
                                          ? "bg-[#012169]/10 text-[#012169] dark:text-[#38bdf8]"
                                          : "bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                      )}
                                      title={
                                        collab.assignedLeaderId === manualLeaderId
                                          ? "Ya asignado a este líder"
                                          : `Asignado a: ${collab.assignedLeaderName}`
                                      }
                                    >
                                      {collab.assignedLeaderId === manualLeaderId
                                        ? "Asignado a este líder"
                                        : `Asignado a: ${collab.assignedLeaderName?.split(" ")[0]}`}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-semibold bg-[#0084d5]/10 text-[#0084d5] px-2 py-0.5 rounded-md whitespace-nowrap">
                                      Sin asignar
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notas u Observaciones */}
                  <div className="space-y-1.5 pt-2 border-t">
                    <label className="text-xs font-semibold text-foreground">
                      Notas u Observaciones de la Asignación (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Asignación directa según estructura operativa 2026..."
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      className="w-full rounded-xl border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#012169]/30"
                    />
                  </div>

                  {/* Barra de Progreso de Asignación Manual (0% a 100%) */}
                  {savingManual && (
                    <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-900/40 border border-[#012169]/25 dark:border-[#0084d5]/30 space-y-2.5 animate-fade-in">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <div className="flex items-center gap-2 text-[#012169] dark:text-[#38bdf8]">
                          <div className="w-4 h-4 rounded-full border-2 border-[#012169]/30 border-t-[#012169] dark:border-[#38bdf8]/30 dark:border-t-[#38bdf8] animate-spin flex-shrink-0" />
                          <span>{manualSaveStep || "Guardando asignaciones manuales..."}</span>
                        </div>
                        <span className="font-mono font-extrabold text-[#012169] dark:text-[#38bdf8] text-sm tabular-nums bg-[#012169]/10 dark:bg-[#0084d5]/20 px-2 py-0.5 rounded-md">
                          {manualSaveProgress}%
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-slate-700">
                        <div
                          className="h-full bg-gradient-to-r from-[#012169] via-[#0084d5] to-[#38bdf8] rounded-full transition-all duration-150 ease-out"
                          style={{ width: `${manualSaveProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Modal con Resumen de Asignación */}
                <div className="p-4 sm:p-5 border-t bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground w-full sm:w-auto text-left">
                    {selectedLeaderObj ? (
                      <p>
                        Líder evaluador: <strong className="text-foreground">{selectedLeaderObj.name}</strong> ·{" "}
                        <strong className="text-[#012169] dark:text-blue-400">{manualCollabIds.length}</strong> colaboradores seleccionados
                      </p>
                    ) : (
                      <p className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4" /> Selecciona un líder evaluador en el panel izquierdo
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2.5 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setShowManualModal(false)}
                      className="px-4 py-2 rounded-xl border text-xs font-semibold hover:bg-accent transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingManual || manualCollabIds.length === 0 || !manualLeaderId}
                      className="px-5 py-2.5 rounded-xl bg-[#012169] text-white text-xs font-semibold hover:bg-[#012169]/90 disabled:opacity-50 transition-colors shadow-xs cursor-pointer flex items-center gap-2"
                    >
                      {savingManual ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span className="tabular-nums">Guardando... {manualSaveProgress}%</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-4 h-4" />
                          <span>
                            {manualCollabIds.length === 0
                              ? "Selecciona colaboradores"
                              : `Asignar ${manualCollabIds.length} Colaborador${manualCollabIds.length > 1 ? "es" : ""}`}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: IMPORTAR DESDE EXCEL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-card border rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-foreground">Importar Asignaciones desde Excel</h3>
                <p className="text-xs text-muted-foreground">Carga masiva para el ciclo {selectedYear}</p>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Instrucciones Rápidas */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold">
                  <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Estructura Requerida del Excel
                </div>
                <p className="text-[11px] leading-relaxed">
                  El archivo debe contener al menos dos columnas clave:
                </p>
                <ul className="list-disc list-inside text-[11px] space-y-0.5 pl-1">
                  <li><strong>Documento Colaborador</strong>: Número de cédula del evaluado.</li>
                  <li><strong>Documento Líder</strong> o <strong>Correo Líder</strong>: Cédula o correo del líder evaluador.</li>
                </ul>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 underline mt-1 hover:opacity-80"
                >
                  <Download className="w-3 h-3" /> Descargar Plantilla Oficial (.xlsx)
                </button>
              </div>

              {/* Zona de Drop / Carga */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all hover:bg-muted/30",
                  excelFile ? "border-success-500 bg-success-500/5" : "border-border"
                )}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls"
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-[#012169]/10 text-[#012169] dark:bg-[#0084d5]/20 dark:text-[#38bdf8] flex items-center justify-center mx-auto mb-2">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                {excelFile ? (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-foreground">{excelFile.name}</p>
                    <p className="text-[11px] text-muted-foreground">{(excelFile.size / 1024).toFixed(1)} KB · Haz clic para cambiar archivo</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-foreground">Haz clic para seleccionar el archivo Excel (.xlsx)</p>
                    <p className="text-[11px] text-muted-foreground">O arrastra el archivo directamente aquí</p>
                  </div>
                )}
              </div>

              {/* Barra y Porcentaje de Avance durante el Cargue */}
              {importing && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/80 via-white to-blue-50/40 dark:from-blue-950/30 dark:via-card dark:to-blue-900/10 border-2 border-blue-200 dark:border-blue-800 shadow-md space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2.5 text-[#012169] dark:text-blue-300">
                      <div className="w-5 h-5 rounded-full border-2 border-[#012169]/30 border-t-[#012169] dark:border-blue-400/30 dark:border-t-blue-400 animate-spin flex-shrink-0" />
                      <div>
                        <p className="font-bold text-xs">{importStepText || "Procesando cargue de asignaciones..."}</p>
                        <p className="text-[10px] text-muted-foreground font-normal">Por favor espera mientras se valida y sincroniza la información</p>
                      </div>
                    </div>
                    <span className="font-mono text-base font-black text-[#012169] dark:text-blue-400 px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800">
                      {importProgress}%
                    </span>
                  </div>

                  {/* Barra animada con gradiente y efecto shimmer */}
                  <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden p-0.5 border">
                    <div
                      className="h-full bg-gradient-to-r from-[#012169] via-[#0084d5] to-[#38bdf8] rounded-full transition-all duration-300 ease-out relative overflow-hidden"
                      style={{ width: `${importProgress}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-[shimmer_1.5s_infinite]" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium px-1">
                    <span className={importProgress >= 20 ? "text-blue-700 dark:text-blue-300 font-bold" : ""}>
                      ✓ 1. Lectura
                    </span>
                    <span className={importProgress >= 50 ? "text-blue-700 dark:text-blue-300 font-bold" : ""}>
                      ✓ 2. Normalización
                    </span>
                    <span className={importProgress >= 70 ? "text-blue-700 dark:text-blue-300 font-bold" : ""}>
                      ✓ 3. Validación BD
                    </span>
                    <span className={importProgress === 100 ? "text-success-600 font-bold" : ""}>
                      ✓ 4. Finalizado
                    </span>
                  </div>
                </div>
              )}

              {/* Vista Previa de Filas */}
              {excelPreview.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-foreground">Vista previa de las primeras filas detectadas:</p>
                  <div className="overflow-x-auto border rounded-xl max-h-36">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-muted text-muted-foreground font-semibold">
                        <tr>
                          {Object.keys(excelPreview[0]).map((key) => (
                            <th key={key} className="py-1.5 px-3 whitespace-nowrap">{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {excelPreview.map((row, idx) => (
                          <tr key={idx}>
                            {Object.values(row).map((val: any, vi) => (
                              <td key={vi} className="py-1.5 px-3 whitespace-nowrap">{val?.toString() || "—"}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Reporte de Resultados de Importación */}
              {importResult && (
                <div
                  className={cn(
                    "p-4 rounded-xl border text-xs space-y-3",
                    importResult.success
                      ? "bg-success-500/10 border-success-500/30 text-success-900 dark:text-success-200"
                      : "bg-danger-500/10 border-danger-500/30 text-danger-900 dark:text-danger-200"
                  )}
                >
                  <div className="flex items-center justify-between font-bold text-xs sm:text-sm">
                    <span className="flex items-center gap-1.5">
                      {importResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-success-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-danger-600" />
                      )}
                      Resultado de la Carga:
                    </span>
                    <span>
                      {importResult.importedCount} de {importResult.totalRows} filas válidas
                    </span>
                  </div>

                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="space-y-2.5 pt-2 border-t border-danger-500/20">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <p className="font-bold text-danger-700 dark:text-danger-300 text-xs flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-danger-600 flex-shrink-0" />
                          Observaciones / No coincidentes ({importResult.errors.length}):
                        </p>

                        {/* Botón para Descargar Log de Errores en Excel */}
                        <button
                          type="button"
                          onClick={handleExportErrorsToExcel}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger-600 hover:bg-danger-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Descargar Log en Excel (.xlsx)
                        </button>
                      </div>

                      <div className="max-h-40 overflow-y-auto space-y-1.5 text-[11px] pr-1">
                        {importResult.errors.slice(0, 20).map((err: any, ei: number) => (
                          <div
                            key={ei}
                            className="p-2.5 rounded-lg bg-background/80 border border-danger-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                          >
                            <div className="min-w-0">
                              <p className="text-foreground">
                                <span className="font-bold text-[#012169] dark:text-blue-300">Fila {err.fila}</span> · Doc:{" "}
                                <strong className="font-mono text-danger-700 dark:text-danger-400">
                                  {err.documento_colaborador}
                                </strong>
                                {err.nombre_colaborador && err.nombre_colaborador !== "—" && (
                                  <span className="font-semibold text-foreground"> · {err.nombre_colaborador}</span>
                                )}
                                {err.cargo_colaborador && err.cargo_colaborador !== "—" && (
                                  <span className="text-muted-foreground"> ({err.cargo_colaborador})</span>
                                )}
                              </p>
                              <p className="text-[10px] text-danger-800 dark:text-danger-300 mt-0.5">
                                {err.motivo}
                              </p>
                            </div>

                            {err.accion_sugerida && (
                              <span className="text-[10px] bg-amber-500/10 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-md font-medium whitespace-nowrap self-start sm:self-center flex-shrink-0">
                                {err.accion_sugerida}
                              </span>
                            )}
                          </div>
                        ))}
                        {importResult.errors.length > 20 && (
                          <p className="text-[10px] text-muted-foreground text-center py-1 font-medium">
                            ... y {importResult.errors.length - 20} observaciones más. Descarga el archivo Excel para ver el listado completo.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 sm:p-5 border-t flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-muted/20">
              <div>
                {importResult?.errors && importResult.errors.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportErrorsToExcel}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-danger-300 dark:border-danger-800 bg-card text-danger-700 dark:text-danger-300 hover:bg-danger-50 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-danger-600" />
                    Descargar Log de Errores ({importResult.errors.length})
                  </button>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-xl border text-xs font-semibold hover:bg-accent transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={!excelFile || importing}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 disabled:opacity-50 transition-colors shadow-xs cursor-pointer flex items-center gap-2"
                >
                  {importing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Procesando... {importProgress}%</span>
                    </>
                  ) : (
                    <span>Procesar e Importar Asignaciones</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REASIGNAR LÍDER */}
      {showReassignModal && selectedAssignmentForReassign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-card border rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-foreground">Reasignar Líder Evaluador</h3>
              <button
                onClick={() => setShowReassignModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-muted/30 border text-xs space-y-1">
              <p className="font-bold text-foreground">
                {selectedAssignmentForReassign.collaborator?.full_name}
              </p>
              <p className="text-muted-foreground">
                Documento: {selectedAssignmentForReassign.collaborator?.document_number} · Cargo: {Array.isArray(selectedAssignmentForReassign.collaborator?.positions) ? selectedAssignmentForReassign.collaborator?.positions[0]?.name : selectedAssignmentForReassign.collaborator?.positions?.name}
              </p>
              <p className="text-muted-foreground">
                Líder actual: {selectedAssignmentForReassign.evaluator?.first_name} {selectedAssignmentForReassign.evaluator?.last_name}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Seleccione el Nuevo Líder Evaluador</label>
              
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar líder por nombre, CC o cargo..."
                  value={reassignSearch}
                  onChange={(e) => setReassignSearch(e.target.value)}
                  className="w-full pl-8.5 pr-8 py-2 rounded-xl border bg-card text-xs focus:outline-none focus:ring-2 focus:ring-[#012169]/30"
                />
                {reassignSearch && (
                  <button
                    type="button"
                    onClick={() => setReassignSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="max-h-52 overflow-y-auto rounded-xl border divide-y bg-background">
                {filteredLeadersForReassign.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No se encontraron líderes con los filtros actuales.
                  </div>
                ) : (
                  filteredLeadersForReassign.map((leader) => {
                    const isSelected = reassignNewLeaderId === leader.id;
                    return (
                      <div
                        key={leader.id}
                        onClick={() => setReassignNewLeaderId(leader.id)}
                        className={cn(
                          "p-2.5 flex items-center justify-between gap-2.5 cursor-pointer text-xs transition-colors hover:bg-muted/50",
                          isSelected && "bg-[#012169]/5 dark:bg-[#012169]/20 border-l-4 border-l-[#012169]"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#012169] to-[#0084d5] text-white flex items-center justify-center font-bold text-[11px] flex-shrink-0">
                            {leader.name.split(" ").filter(Boolean).map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className={cn("font-bold truncate text-foreground", isSelected && "text-[#012169] dark:text-blue-400")}>
                              {leader.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              CC: {leader.document_number} · {leader.position}
                            </p>
                          </div>
                        </div>
                        {isSelected ? (
                          <div className="w-4 h-4 rounded-full bg-[#012169] text-white flex items-center justify-center flex-shrink-0">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        ) : (
                          <span className="text-[10px] font-semibold text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                            {leader.role}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t">
              <button
                type="button"
                onClick={() => setShowReassignModal(false)}
                className="px-3 py-1.5 rounded-xl border text-xs font-semibold hover:bg-accent cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!reassignNewLeaderId}
                onClick={() => {
                  if (!reassignNewLeaderId) {
                    toast.error("Seleccione el nuevo líder evaluador.");
                    return;
                  }
                  handleReassign(reassignNewLeaderId);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-[#012169] text-white text-xs font-semibold hover:bg-[#012169]/90 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                Confirmar Reasignación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
