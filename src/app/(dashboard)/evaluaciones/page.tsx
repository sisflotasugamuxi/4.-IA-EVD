"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ClipboardList, Plus, Search, Filter, Eye,
  Edit, FileDown, MoreHorizontal, ChevronLeft, ChevronRight, FileText,
  ArrowUpDown, ChevronUp, ChevronDown, PenTool
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, getResultLabel, getStatusLabel, formatDate, formatDateTime, formatScore, getInitials, compressImageIfNeeded } from "@/lib/utils";
import { toast } from "sonner";

import { getEvaluations, getEvaluationById, getLeaderProfiles } from "@/app/actions/evaluations";
import { getAreas, getPositions } from "@/app/actions/config";
import MultiSelectSearch from "@/components/ui/MultiSelectSearch";
import { PdfPreviewModal } from "@/components/ui/pdf-preview-modal";
import { LoadingProgress, useLoadingProgress } from "@/components/ui/loading-progress";

const STATUS_STYLE: Record<string, string> = {
  borrador: "text-muted-foreground bg-muted border-border",
  en_proceso: "text-brand-600 bg-brand-50 border-brand-200 dark:bg-brand-950/30",
  finalizada: "text-success-600 bg-success-50 border-success-200 dark:bg-success-950/30",
  pendiente_firma: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30",
  reabierta: "text-warning-600 bg-warning-50 border-warning-200 dark:bg-warning-950/30",
  anulada: "text-danger-600 bg-danger-50 border-danger-200 dark:bg-danger-950/30",
};

const RESULT_STYLE: Record<string, string> = {
  aprobado: "text-success-600 bg-success-50 border-success-200 dark:bg-success-950/30",
  plan_mejoramiento: "text-warning-600 bg-warning-50 border-warning-200 dark:bg-warning-950/30",
  no_aprobado: "text-danger-600 bg-danger-50 border-danger-200 dark:bg-danger-950/30",
  pendiente: "text-muted-foreground bg-muted border-border",
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

export default function EvaluacionesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterAreas, setFilterAreas] = useState<string[]>([]);
  const [filterPositions, setFilterPositions] = useState<string[]>([]);
  const [filterEvaluators, setFilterEvaluators] = useState<string[]>([]);
  const [filterResult, setFilterResult] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dbAreas, setDbAreas] = useState<any[]>([]);
  const [dbPositions, setDbPositions] = useState<any[]>([]);
  const [dbLeaders, setDbLeaders] = useState<{ id: string; name: string }[]>([]);
  const [sortField, setSortField] = useState<string>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const evaluatorOptions = useMemo(() => {
    if (dbLeaders.length > 0) return dbLeaders;
    const names = new Set<string>();
    evaluations.forEach((e) => {
      if (e.evaluator && e.evaluator !== "—" && e.evaluator !== "Desconocido") {
        names.add(e.evaluator.trim());
      }
    });
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ id: name, name }));
  }, [dbLeaders, evaluations]);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoading: showLoading, progress: loadProgress } = useLoadingProgress(isLoading);

  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [previewPdfBlob, setPreviewPdfBlob] = useState<Blob | null>(null);
  const [previewPdfFileName, setPreviewPdfFileName] = useState("");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handlePreviewClick = async (id: string, pdfType: 'colaborador' | 'evaluador' = 'evaluador') => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    const toastId = toast.loading("Obteniendo detalles de la evaluación...");
    
    try {
      const res = await getEvaluationById(id);
      if (res.error || !res.data) {
        toast.error("Error al obtener los detalles de la evaluación: " + (res.error || "No se encontraron datos"), { id: toastId });
        setIsGeneratingPdf(false);
        return;
      }
      
      const evalData = res.data;
      toast.loading("Generando previsualización de PDF...", { id: toastId });
      
      const { jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      // Load logo image first
      let logoImg: HTMLImageElement | null = null;
      try {
        const logoSrc = await compressImageIfNeeded("/logo.png", 200, 200);
        logoImg = await new Promise<HTMLImageElement | null>((resolve) => {
          const img = new Image();
          img.src = logoSrc;
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
        });
      } catch (e) {
        console.error("Error loading logo image:", e);
      }
      
      const brandColorBlue = [1, 33, 105]; // #012169
      const brandColorLightBlue = [0, 132, 213]; // #0084D5
      const textColorDark = [30, 41, 59]; // #1e293b
      const textColorMuted = [100, 116, 139]; // #64748b
      
      // Page Margins
      const marginX = 15;
      let posY = 20;
      
      const formatPDFDate = (dateStr: any) => {
        if (!dateStr) return "N/A";
        try {
          const d = new Date(dateStr);
          return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString("es-ES");
        } catch {
          return "N/A";
        }
      };

      const drawHeader = () => {
        doc.setFillColor(brandColorBlue[0], brandColorBlue[1], brandColorBlue[2]);
        doc.rect(0, 0, 210, 4, "F");
        
        // Draw Logo if loaded (on the left side)
        let textStartX = marginX;
        if (logoImg) {
          try {
            doc.addImage(logoImg, "PNG", marginX, 6, 13, 13);
            textStartX = marginX + 16;
          } catch (err) {
            console.error("Error drawing logo to PDF:", err);
          }
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(brandColorBlue[0], brandColorBlue[1], brandColorBlue[2]);
        doc.text("FLOTA SUGAMUXI S.A.", textStartX, 14);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(textColorMuted[0], textColorMuted[1], textColorMuted[2]);
        doc.text("Sistema de Evaluación de Desempeño (EVD)", textStartX, 19);
        
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(marginX, 22, 210 - marginX, 22);
      };
      
      const drawFooter = (pageNumber: number, totalPages: number) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(textColorMuted[0], textColorMuted[1], textColorMuted[2]);
        
        const currentDate = new Date().toLocaleDateString("es-ES");
        doc.text(`Generado el: ${currentDate}`, marginX, 285);
        doc.text(`Página ${pageNumber} de ${totalPages}`, 210 - marginX, 285, { align: "right" });
        
        doc.setDrawColor(226, 232, 240);
        doc.line(marginX, 280, 210 - marginX, 280);
      };
      
      // PAGE 1: COVER
      posY = 32;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(brandColorBlue[0], brandColorBlue[1], brandColorBlue[2]);
      doc.text("REPORTE DE EVALUACIÓN DE DESEMPEÑO", marginX, posY);
      posY += 8;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(textColorDark[0], textColorDark[1], textColorDark[2]);
      const dateText = evalData.finalized_at 
        ? `Fecha de Finalización: ${formatDateTime(evalData.finalized_at)}`
        : `Fecha de Registro: ${formatDateTime(evalData.created_at)}`;
      const evalYear = evalData.evaluation_year || new Date().getFullYear();
      doc.text(`${dateText}  |  Año de Evaluación: ${evalYear}`, marginX, posY);
      posY += 10;
      
      // SECTION: COLLABORATOR INFO (EVALUATED)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(brandColorLightBlue[0], brandColorLightBlue[1], brandColorLightBlue[2]);
      doc.text("1. DATOS DEL COLABORADOR (EVALUADO)", marginX, posY);
      posY += 4;
      
      const collabInfo = [
        ["Nombre Completo:", evalData.collaborator?.full_name || "N/A", "Documento:", `${evalData.collaborator?.document_type || "CC"} ${evalData.collaborator?.document_number || "N/A"}`],
        ["Cargo Actual:", evalData.collaborator?.positions?.name || evalData.collaborator?.position?.name || "N/A", "Área / Departamento:", evalData.collaborator?.areas?.name || evalData.collaborator?.area?.name || "N/A"],
        ["Estado:", evalData.collaborator?.status || "N/A", "", ""]
      ];
      
      autoTable(doc, {
        startY: posY,
        head: [],
        body: collabInfo,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 2, textColor: textColorDark as any, lineColor: [226, 232, 240], lineWidth: 0.2 },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 35, fillColor: [248, 250, 252] as any },
          1: { cellWidth: 55 },
          2: { fontStyle: "bold", cellWidth: 35, fillColor: [248, 250, 252] as any },
          3: { cellWidth: 55 }
        },
        margin: { left: marginX, right: marginX, top: 26, bottom: 24 }
      });
      
      posY = (doc as any).lastAutoTable.finalY + 8;
      
      // SECTION: EVALUATOR INFO
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(brandColorLightBlue[0], brandColorLightBlue[1], brandColorLightBlue[2]);
      doc.text("2. DATOS DEL EVALUADOR", marginX, posY);
      posY += 4;
      
      const evaluatorInfo = [
        ["Nombre del Evaluador:", evalData.evaluator ? `${evalData.evaluator.first_name} ${evalData.evaluator.last_name}` : "N/A", "Cargo Actual:", evalData.evaluator?.cargo || evalData.evaluator?.role?.display_name || evalData.evaluator?.roles?.display_name || "N/A"],
        ["Correo Electrónico:", evalData.evaluator?.email || "N/A", "Versión del Proceso EVD:", evalData.version?.name || "N/A"]
      ];
      
      autoTable(doc, {
        startY: posY,
        head: [],
        body: evaluatorInfo,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 2, textColor: textColorDark as any, lineColor: [226, 232, 240], lineWidth: 0.2 },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 45, fillColor: [248, 250, 252] as any },
          1: { cellWidth: 45 },
          2: { fontStyle: "bold", cellWidth: 45, fillColor: [248, 250, 252] as any },
          3: { cellWidth: 45 }
        },
        margin: { left: marginX, right: marginX, top: 26, bottom: 24 }
      });
      
      posY = (doc as any).lastAutoTable.finalY + 8;
      
      // SECTION: SUMMARY OF RESULTS
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(brandColorLightBlue[0], brandColorLightBlue[1], brandColorLightBlue[2]);
      doc.text("3. RESUMEN DE RESULTADOS", marginX, posY);
      posY += 4;
      
      const resultObj = evalData.result && !Array.isArray(evalData.result) ? evalData.result : evalData.result?.[0] || null;
      const overallScore = resultObj ? resultObj.overall_average : 0;
      const statusLabelText = resultObj ? getResultLabel(resultObj.result) : "Pendiente de finalizar";
      let resultGeneralText = statusLabelText.toUpperCase();
      if (resultObj?.result === "plan_mejoramiento") {
        if (resultObj?.has_critical_fails) {
          resultGeneralText = "PLAN DE MEJORAMIENTO (POR CATEGORÍA)";
        } else {
          resultGeneralText = "PLAN DE MEJORAMIENTO (POR PUNTUACIÓN OBTENIDA (PROMEDIO))";
        }
      }
      
      const summaryInfo = [
        ["PUNTUACIÓN OBTENIDA (PROMEDIO):", `${formatScore(overallScore)} / 5.0`],
        ["RESULTADO GENERAL:", resultGeneralText]
      ];
      
      autoTable(doc, {
        startY: posY,
        head: [],
        body: summaryInfo,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 2, textColor: textColorDark as any },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 60, fillColor: [248, 250, 252] as any },
          1: { cellWidth: 120 }
        },
        margin: { left: marginX, right: marginX, top: 26, bottom: 24 }
      });
      
      posY = (doc as any).lastAutoTable.finalY + 6;
      if (resultObj?.has_critical_fails && resultObj.critical_fails_detail?.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(239, 68, 68); // Red color
        doc.text("CRITERIOS CRÍTICOS INCUMPLIDOS (Causales de Plan de Mejoramiento):", marginX, posY);
        posY += 4;
        
        const failHeaders = [["Criterio Crítico", "Valor Obtenido", "Mínimo Requerido"]];
        const failRows = resultObj.critical_fails_detail.map((fail: any) => {
          return [
            fail.question || "Criterio Crítico",
            `${formatScore(fail.score)} / 5.0`,
            `${formatScore(fail.min_required)} / 5.0`
          ];
        });

        autoTable(doc, {
          startY: posY,
          head: failHeaders,
          body: failRows,
          theme: "striped",
          headStyles: { fillColor: brandColorBlue as any, textColor: [255, 255, 255] as any, fontStyle: "bold" },
          styles: { fontSize: 8, cellPadding: 2, textColor: textColorDark as any },
          columnStyles: {
            0: { fontStyle: "bold", cellWidth: 120 },
            1: { cellWidth: 30, halign: "center" },
            2: { cellWidth: 30, halign: "center" }
          },
          margin: { left: marginX, right: marginX, top: 26, bottom: 24 }
        });
        posY = (doc as any).lastAutoTable.finalY + 8;
      } else {
        posY = (doc as any).lastAutoTable.finalY + 8;
      }

      // SECTION: CATEGORY SCORES
      const categoryScores = resultObj?.category_scores || {};
      if (categoryScores && Object.keys(categoryScores).length > 0) {
        // Prevent signatures from being on a page by themselves for colaborador
        if (pdfType === "colaborador" && posY > 230) {
          doc.addPage();
          posY = 28;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(brandColorLightBlue[0], brandColorLightBlue[1], brandColorLightBlue[2]);
        doc.text("4. CALIFICACIÓN POR CATEGORÍA", marginX, posY);
        posY += 6;
        
        const catHeaders = [["Categoría (Preguntas)", "Promedio"]];
        const catRows = Object.entries(categoryScores).map(([_, cat]: [string, any]) => [
          `${cat.name || "Categoría"} (${cat.count || 0} preguntas)`,
          `${formatScore(cat.average || 0)} / 5.0`
        ]);
        
        autoTable(doc, {
          startY: posY,
          head: catHeaders,
          body: catRows,
          theme: "striped",
          headStyles: { fillColor: brandColorBlue as any, textColor: [255, 255, 255] as any, fontStyle: "bold" },
          styles: { fontSize: 8, cellPadding: 2, textColor: textColorDark as any },
          columnStyles: {
            0: { fontStyle: "bold", cellWidth: 155 },
            1: { cellWidth: 25, halign: "center" }
          },
          margin: { left: marginX, right: marginX, top: 26, bottom: 24 }
        });
        
        posY = (doc as any).lastAutoTable.finalY + 8;
      }
      
      if (pdfType === "evaluador") {
        // Check space for Escala and Rangos section (only page break if it cannot fit without splitting)
        if (posY > 230) {
          doc.addPage();
          posY = 28;
        }

        // SECTION: ESCALA DE CALIFICACIÓN & RANGOS DE RESULTADOS
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(brandColorLightBlue[0], brandColorLightBlue[1], brandColorLightBlue[2]);
        doc.text("5. ESCALA DE CALIFICACIÓN", marginX, posY);
        doc.text("6. RANGOS DE RESULTADOS", marginX + 95, posY);
        posY += 6;

        autoTable(doc, {
          startY: posY,
          margin: { left: marginX, top: 26, bottom: 24 },
          tableWidth: 85,
          head: [["Calificación", "Descripción"]],
          body: [
            ["5", "Excelente"],
            ["4", "Sobresaliente"],
            ["3", "Cumple lo esperado"],
            ["2", "Requiere mejora"],
            ["1", "No cumple"]
          ],
          theme: "grid",
          headStyles: { fillColor: brandColorBlue as any, textColor: [255, 255, 255] as any, fontStyle: "bold", halign: "center" },
          styles: { fontSize: 8, cellPadding: 2, textColor: textColorDark as any },
          columnStyles: {
            0: { halign: "center", fontStyle: "bold", cellWidth: 25 },
            1: { cellWidth: 60 }
          }
        });
        const finalY1 = (doc as any).lastAutoTable.finalY;

        autoTable(doc, {
          startY: posY,
          margin: { left: marginX + 95, top: 26, bottom: 24 },
          tableWidth: 85,
          head: [["Promedio", "Resultado"]],
          body: [
            ["4.0 – 5.0", "Aprobado"],
            ["3.1 – 3.9", "Plan de Mejoramiento"],
            ["1.0 - 3.0", "No Aprobado"]
          ],
          theme: "grid",
          headStyles: { fillColor: brandColorBlue as any, textColor: [255, 255, 255] as any, fontStyle: "bold", halign: "center" },
          styles: { fontSize: 8, cellPadding: 2, textColor: textColorDark as any },
          columnStyles: {
            0: { halign: "center", fontStyle: "bold", cellWidth: 35 },
            1: { cellWidth: 50, halign: "center" }
          }
        });
        const finalY2 = (doc as any).lastAutoTable.finalY;

        posY = Math.max(finalY1, finalY2) + 12;

        // PAGE 1 (continued): DETAILED ANSWERS TABLE
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(brandColorLightBlue[0], brandColorLightBlue[1], brandColorLightBlue[2]);
        doc.text("7. DESGLOSE DETALLADO DE COMPETENCIAS Y PREGUNTAS", marginX, posY);
        posY += 6;
        
        const answersHeaders = [["Categoría", "Pregunta", "Calificación"]];
        const answersRows = (evalData.answers || []).map((ans: any, idx: number) => [
          ans.category?.name || "N/A",
          ans.question?.question || "Pregunta sin descripción",
          `${ans.score} / 5.0`
        ]);
        
        autoTable(doc, {
          startY: posY,
          head: answersHeaders,
          body: answersRows,
          theme: "striped",
          headStyles: { fillColor: brandColorBlue as any, textColor: [255, 255, 255] as any, fontStyle: "bold" },
          styles: { fontSize: 8, cellPadding: 2, textColor: textColorDark as any },
          columnStyles: {
            0: { fontStyle: "bold", cellWidth: 45 },
            1: { cellWidth: 110 },
            2: { cellWidth: 25, halign: "center" }
          },
          margin: { left: marginX, right: marginX, top: 26, bottom: 24 }
        });
        
        posY = (doc as any).lastAutoTable.finalY + 12;
        
        // Prevent signatures from being on a page by themselves for evaluador (lower threshold to group narrative + signatures together)
        if (posY > 200) {
          doc.addPage();
          posY = 28;
        }
        
        // SECTION: NARRATIVE
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(brandColorLightBlue[0], brandColorLightBlue[1], brandColorLightBlue[2]);
        doc.text("8. COMENTARIOS Y NARRATIVA DE DESEMPEÑO", marginX, posY);
        posY += 6;
        
        const narratives = [
          ["Observaciones Generales del Evaluador:", evalData.observations || "Sin observaciones registradas."],
          ["Fortalezas Clave Demostradas:", evalData.strengths || "Sin fortalezas registradas."],
          ["Oportunidades de Mejora Identificadas:", evalData.improvement_opportunities || "Sin oportunidades registradas."],
          ["Necesidades de Formación / Capacitación:", evalData.training_needs || "Sin necesidades registradas."]
        ];
        
        autoTable(doc, {
          startY: posY,
          head: [],
          body: narratives,
          theme: "grid",
          styles: { fontSize: 8.5, cellPadding: 3, textColor: textColorDark as any },
          columnStyles: {
            0: { fontStyle: "bold", cellWidth: 60, fillColor: [248, 250, 252] as any },
            1: { cellWidth: 120 }
          },
          margin: { left: marginX, right: marginX, top: 26, bottom: 24 }
        });
        
        posY = (doc as any).lastAutoTable.finalY + 15;
      }
      
      if (posY > 250) {
        doc.addPage();
        posY = 28;
      }
      
      // SECTION: SIGNATURES
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(brandColorLightBlue[0], brandColorLightBlue[1], brandColorLightBlue[2]);
      doc.text(pdfType === "colaborador" ? "5. CONFORMIDAD Y FIRMAS" : "9. CONFORMIDAD Y FIRMAS", marginX, posY);
      
      const evaluatorSigRaw = evalData.evaluator?.avatar_url;
      const collaboratorSigRaw = (evalData.draft_data as any)?.collaborator_signature;
      
      const evaluatorSig = evaluatorSigRaw ? await compressImageIfNeeded(evaluatorSigRaw) : null;
      const collaboratorSig = collaboratorSigRaw ? await compressImageIfNeeded(collaboratorSigRaw) : null;
      
      let sigHeight = 11;
      let sigWidth = 38;
      
      if (evaluatorSig) {
        try {
          doc.addImage(evaluatorSig, "PNG", marginX + 16, posY + 2, sigWidth, sigHeight);
        } catch (err) {
          console.error("Error adding evaluator signature to PDF:", err);
        }
      }
      
      if (collaboratorSig) {
        try {
          doc.addImage(collaboratorSig, "PNG", 210 - marginX - 54, posY + 2, sigWidth, sigHeight);
        } catch (err) {
          console.error("Error adding collaborator signature to PDF:", err);
        }
      }

      posY += 15;
      
      doc.setDrawColor(100, 116, 139);
      doc.setLineWidth(0.5);
      
      doc.line(marginX, posY, marginX + 70, posY);
      doc.line(210 - marginX - 70, posY, 210 - marginX, posY);
      
      posY += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(textColorDark[0], textColorDark[1], textColorDark[2]);
      doc.text("Firma del Evaluador", marginX, posY);
      doc.text("Firma del Colaborador Evaluado", 210 - marginX, posY, { align: "right" });
      
      posY += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(textColorMuted[0], textColorMuted[1], textColorMuted[2]);
      doc.text(evalData.evaluator ? `${evalData.evaluator.first_name} ${evalData.evaluator.last_name}` : "Nombre del Evaluador", marginX, posY);
      doc.text(evalData.collaborator?.full_name || "Nombre del Colaborador", 210 - marginX, posY, { align: "right" });
      
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawHeader();
        drawFooter(i, totalPages);
      }
      
      const typeLabel = pdfType === 'colaborador' ? 'Colaborador' : 'Evaluador';
      const fileName = `EVD_${typeLabel}_${evalData.collaborator?.full_name?.replace(/\s+/g, "_") || "Colaborador"}_${evalData.evaluation_year || new Date().getFullYear()}.pdf`;
      
      const blob = doc.output("blob");
      setPreviewPdfBlob(blob);
      setPreviewPdfFileName(fileName);
      
      toast.success("PDF generado con éxito", { id: toastId });
      setShowPdfPreview(true);
    } catch (err: any) {
      console.error(err);
      toast.error("Error al generar el PDF: " + (err?.message || err), { id: toastId });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  React.useEffect(() => {
    async function loadEvaluations() {
      const res = await getEvaluations();
      if (!res.error && res.data) {
        const mapped = res.data.map((e: any) => {
          const resObj = e.result && !Array.isArray(e.result) ? e.result : e.result?.[0] || null;
          return {
            id: e.id,
            code: e.code || "—",
            collaborator: e.collaborator?.full_name || "Desconocido",
            collaborator_document: e.collaborator?.document_number || "—",
            area: e.collaborator?.areas?.name || "—",
          position: e.collaborator?.positions?.name || e.collaborator?.position?.name || "—",
            evaluator: e.evaluator ? `${e.evaluator.first_name || ""} ${e.evaluator.last_name || ""}`.replace(/\s+/g, " ").trim() : "—",
            date: e.created_at,
            year: e.evaluation_year,
            status: e.status,
            result: resObj ? resObj.result : "pendiente",
            score: resObj ? resObj.overall_average : 0,
            has_pmi: resObj ? resObj.pmi_required : false,
            hire_date: e.collaborator?.hire_date || null,
          };
        });
        setEvaluations(mapped);
      }
      setIsLoading(false);
    }
    async function loadConfigData() {
      try {
        const [areasRes, positionsRes, leadersRes] = await Promise.all([
          getAreas(),
          getPositions(),
          getLeaderProfiles()
        ]);
        if (areasRes) setDbAreas(areasRes);
        if (positionsRes) setDbPositions(positionsRes);
        if (leadersRes?.data) setDbLeaders(leadersRes.data);
      } catch (err) {
        console.error("Error loading areas/positions/leaders filter data:", err);
      }
    }
    loadEvaluations();
    loadConfigData();
  }, []);

  const filtered = evaluations.filter((e) => {
    const matchSearch =
      !search ||
      e.collaborator.toLowerCase().includes(search.toLowerCase()) ||
      e.collaborator_document.includes(search) ||
      e.evaluator.toLowerCase().includes(search.toLowerCase()) ||
      e.code.toLowerCase().includes(search.toLowerCase());

    const matchArea = filterAreas.length === 0 || filterAreas.includes(e.area);
    const matchPosition = filterPositions.length === 0 || filterPositions.includes(e.position);
    const matchEvaluator = filterEvaluators.length === 0 || filterEvaluators.includes(e.evaluator.trim());

    const matchResult = !filterResult || e.result === filterResult;
    
    let matchDate = true;
    if (startDate || endDate) {
      if (!e.date) {
        matchDate = false;
      } else {
        const evalDate = new Date(e.date);
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (evalDate < start) matchDate = false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (evalDate > end) matchDate = false;
        }
      }
    }
    
    return matchSearch && matchResult && matchDate && matchArea && matchPosition && matchEvaluator;
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sorted = [...filtered].sort((a, b) => {
    let valA: any = a[sortField as keyof typeof a];
    let valB: any = b[sortField as keyof typeof b];

    if (sortField === "collaborator") {
      valA = (a.collaborator || "").toLowerCase();
      valB = (b.collaborator || "").toLowerCase();
    } else if (sortField === "area") {
      valA = (a.area || "").toLowerCase();
      valB = (b.area || "").toLowerCase();
    } else if (sortField === "position") {
      valA = (a.position || "").toLowerCase();
      valB = (b.position || "").toLowerCase();
    } else if (sortField === "status") {
      valA = (a.status || "").toLowerCase();
      valB = (b.status || "").toLowerCase();
    } else if (sortField === "result") {
      valA = (a.result || "").toLowerCase();
      valB = (b.result || "").toLowerCase();
    } else if (sortField === "evaluator") {
      valA = (a.evaluator || "").toLowerCase();
      valB = (b.evaluator || "").toLowerCase();
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

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleExportExcel = async () => {
    if (filtered.length === 0) {
      toast.error("No hay evaluaciones para exportar");
      return;
    }

    const toastId = toast.loading("Generando archivo Excel...");
    try {
      const XLSX = await import("xlsx");
      const currentYear = new Date().getFullYear();
      const excelRows = filtered.map((e) => ({
        "ID Evaluación": e.code || "—",
        "Evaluador": e.evaluator,
        "Colaborador": e.collaborator,
        "Documento Colaborador": e.collaborator_document || "—",
        "Área": e.area,
        "Cargo": e.position,
        "Año": e.year || currentYear,
        "Antigüedad": isEvdRequired(e.hire_date) ? "Requerido" : "No Requerido",
        "EVD 2026": (e.status === "finalizada" || e.status === "completada" || e.status === "aprobada") ? "Realizada" : "Pendiente",
        "Estado": getStatusLabel(e.status),
        "Puntaje (Promedio)": e.score > 0 ? Number(formatScore(e.score)) : 0,
        "Resultado": getResultLabel(e.result),
        "Fecha Registro": formatDateTime(e.date),
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Evaluaciones");

      // Auto-fit column widths
      const maxColWidth = excelRows.reduce((acc, row) => {
        Object.keys(row).forEach((key, i) => {
          const val = String((row as any)[key]);
          acc[i] = Math.max(acc[i] || 10, val.length + 2, key.length + 2);
        });
        return acc;
      }, [] as number[]);
      worksheet["!cols"] = maxColWidth.map(w => ({ wch: w }));

      XLSX.writeFile(workbook, `Evaluaciones_Desempeno_${new Date().getFullYear()}.xlsx`);
      toast.success("Excel descargado exitosamente", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Error al exportar a Excel", { id: toastId });
    }
  };

  // Summary stats
  const total = filtered.length;
  const aprobados = filtered.filter(e => e.result === "aprobado").length;
  const conPMI = filtered.filter(e => e.has_pmi || e.result === "plan_mejoramiento").length;
  const noAprobados = filtered.filter(e => e.result === "no_aprobado").length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Evaluaciones de Desempeño</h1>
          <p className="text-muted-foreground text-sm mt-1">Año 2026 · Flota Sugamuxi S.A.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-foreground text-sm hover:bg-accent transition-colors"
          >
            <FileDown className="w-4 h-4" />
            Exportar
          </button>
          <Link href="/evaluaciones/nueva">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-md">
              <Plus className="w-4 h-4" />
              Nueva Evaluación
            </button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: total, color: "brand" },
          { label: "Aprobados", value: aprobados, color: "success" },
          { label: "Con PMI", value: conPMI, color: "warning" },
          { label: "No Aprobados", value: noAprobados, color: "danger" },
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

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-[minmax(140px,1.2fr)_minmax(130px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(195px,1.3fr)_minmax(130px,1fr)_auto] gap-2 items-center">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por colaborador..."
            className="w-full h-10 pl-9 pr-2.5 rounded-xl border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all truncate"
          />
        </div>
        <div className="w-full">
          <MultiSelectSearch
            options={evaluatorOptions}
            selectedValues={filterEvaluators}
            onChange={(vals) => { setFilterEvaluators(vals); setPage(1); }}
            placeholder="Todos los evaluadores"
            searchPlaceholder="Buscar evaluador..."
          />
        </div>
        <div className="w-full">
          <MultiSelectSearch
            options={dbAreas}
            selectedValues={filterAreas}
            onChange={(vals) => { setFilterAreas(vals); setPage(1); }}
            placeholder="Todas las áreas"
            searchPlaceholder="Buscar área..."
          />
        </div>
        <div className="w-full">
          <MultiSelectSearch
            options={dbPositions}
            selectedValues={filterPositions}
            onChange={(vals) => { setFilterPositions(vals); setPage(1); }}
            placeholder="Todos los cargos"
            searchPlaceholder="Buscar cargo..."
          />
        </div>
        <div className="flex items-center gap-1 w-full min-w-0">
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="w-full min-w-0 h-10 px-2 rounded-xl border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            title="Fecha Inicio"
          />
          <span className="text-muted-foreground text-xs font-semibold px-0.5 shrink-0">a</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="w-full min-w-0 h-10 px-2 rounded-xl border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            title="Fecha Fin"
          />
        </div>
        <div className="w-full">
          <select
            value={filterResult}
            onChange={(e) => { setFilterResult(e.target.value); setPage(1); }}
            className="w-full h-10 px-2.5 rounded-xl border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Todos los resultados</option>
            <option value="aprobado">Aprobado</option>
            <option value="plan_mejoramiento">Plan de Mejoramiento</option>
            <option value="no_aprobado">No Aprobado</option>
          </select>
        </div>
        <div className="w-full xl:w-auto">
          <button
            onClick={() => {
              setSearch("");
              setFilterEvaluators([]);
              setFilterAreas([]);
              setFilterPositions([]);
              setStartDate("");
              setEndDate("");
              setFilterResult("");
              setPage(1);
            }}
            className="w-full xl:w-auto h-10 rounded-xl border bg-muted hover:bg-accent font-semibold text-xs text-muted-foreground hover:text-foreground transition-all truncate px-3 whitespace-nowrap"
          >
            Limpiar
          </button>
        </div>
      </div>

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
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase cursor-pointer select-none" onClick={() => handleSort("evaluator")}>
                  <div className="flex items-center gap-1 hover:text-foreground transition-colors font-semibold">
                    Evaluador
                    {sortField === "evaluator" ? (
                      sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-55" />
                    )}
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase cursor-pointer select-none" onClick={() => handleSort("collaborator")}>
                  <div className="flex items-center gap-1 hover:text-foreground transition-colors font-semibold">
                    Colaborador
                    {sortField === "collaborator" ? (
                      sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-55" />
                    )}
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase hidden md:table-cell cursor-pointer select-none" onClick={() => handleSort("position")}>
                  <div className="flex items-center gap-1 hover:text-foreground transition-colors font-semibold">
                    Área / Cargo
                    {sortField === "position" ? (
                      sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-55" />
                    )}
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase cursor-pointer select-none" onClick={() => handleSort("status")}>
                  <div className="flex items-center gap-1 hover:text-foreground transition-colors font-semibold">
                    Estado
                    {sortField === "status" ? (
                      sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-55" />
                    )}
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase hidden lg:table-cell cursor-pointer select-none" onClick={() => handleSort("result")}>
                  <div className="flex items-center gap-1 hover:text-foreground transition-colors font-semibold">
                    Resultado
                    {sortField === "result" ? (
                      sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-55" />
                    )}
                  </div>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase cursor-pointer select-none" onClick={() => handleSort("score")}>
                  <div className="flex items-center justify-end gap-1 hover:text-foreground transition-colors font-semibold">
                    Promedio
                    {sortField === "score" ? (
                      sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-55" />
                    )}
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase hidden lg:table-cell cursor-pointer select-none" onClick={() => handleSort("date")}>
                  <div className="flex items-center gap-1 hover:text-foreground transition-colors font-semibold">
                    Fecha
                    {sortField === "date" ? (
                      sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-55" />
                    )}
                  </div>
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase select-none">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {showLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <LoadingProgress
                      icon={ClipboardList}
                      title="Cargando evaluaciones realizadas..."
                      description="Sincronizando calificaciones, estados y resultados del ciclo..."
                      progress={loadProgress}
                    />
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No se encontraron evaluaciones.
                  </td>
                </tr>
              ) : (
              paginated.map((ev, i) => (
                <motion.tr
                  key={ev.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="hover:bg-muted/40 transition-colors cursor-pointer"
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest("button") || target.closest("a")) {
                      return;
                    }
                    router.push(`/evaluaciones/${ev.id}`);
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {getInitials(ev.evaluator === "—" ? "Sin Evaluador" : ev.evaluator)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{ev.evaluator}</p>
                        <p className="text-xs text-muted-foreground">Año {ev.year} · {ev.code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full gradient-brand flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {getInitials(ev.collaborator)}
                      </div>
                      <p className="font-semibold text-sm">{ev.collaborator}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-sm font-medium">{ev.position}</p>
                    <p className="text-xs text-muted-foreground">{ev.area}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border", STATUS_STYLE[ev.status])}>
                      {getStatusLabel(ev.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {ev.result !== "pendiente" && (
                      <div className="space-y-1">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border", RESULT_STYLE[ev.result])}>
                          {getResultLabel(ev.result)}
                        </span>
                        {ev.has_pmi && (
                          <div className="text-[10px] text-warning-600 font-semibold">PMI generado</div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {ev.score > 0 ? (
                      <span className={cn(
                        "font-bold text-lg",
                        ev.score >= 4.0 ? "text-success-600" :
                        ev.score >= 3.1 ? "text-warning-600" : "text-danger-600"
                      )}>
                        {formatScore(ev.score)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-sm text-muted-foreground">
                    {formatDateTime(ev.date)}
                  </td>
                  <td className="px-4 py-3 relative">
                    <div className="flex items-center justify-center gap-1">
                      <Link href={`/evaluaciones/${ev.id}`}>
                        <button className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground" title="Ver detalle">
                          <Eye className="w-4 h-4" />
                        </button>
                      </Link>
                      {ev.status === "finalizada" && (
                        <button
                          onClick={() => handlePreviewClick(ev.id, 'colaborador')}
                          className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                          title="Ver PDF Colaborador"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      )}
                      {ev.status === "pendiente_firma" && (
                        <Link href="/evaluaciones/firmas-pendientes">
                          <button className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors text-amber-600 hover:text-amber-700" title="Firmar (Pendiente de firma)">
                            <PenTool className="w-4 h-4" />
                          </button>
                        </Link>
                      )}
                      {(ev.status === "borrador" || ev.status === "en_proceso") && (
                        <Link href={`/evaluaciones/${ev.id}/editar`}>
                          <button className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground" title="Editar">
                            <Edit className="w-4 h-4" />
                          </button>
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(openMenuId === ev.id ? null : ev.id)}
                        className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                    {openMenuId === ev.id && (
                      <div className="absolute right-0 top-full mt-2 w-40 rounded-xl border bg-card shadow-lg z-10">
                        <Link
                          href={`/evaluaciones/${ev.id}`}
                          className="block px-3 py-2 text-sm text-left text-foreground hover:bg-muted"
                        >
                          Ver detalle
                        </Link>
                        {ev.status === "pendiente_firma" && (
                          <Link
                            href="/evaluaciones/firmas-pendientes"
                            className="block px-3 py-2 text-sm text-left text-amber-600 hover:bg-muted font-medium"
                          >
                            Firmar Evaluación
                          </Link>
                        )}
                        {ev.status === "finalizada" && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                handlePreviewClick(ev.id, 'colaborador');
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted"
                            >
                              PDF Colaborador
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                handlePreviewClick(ev.id, 'evaluador');
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted"
                            >
                              PDF Evaluador
                            </button>
                          </>
                        )}
                        {(ev.status === "borrador" || ev.status === "en_proceso") && (
                          <Link
                            href={`/evaluaciones/${ev.id}/editar`}
                            className="block px-3 py-2 text-sm text-left text-foreground hover:bg-muted"
                          >
                            Editar
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(ev.code || ev.id);
                            setOpenMenuId(null);
                            toast.success("Código copiado al portapapeles");
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted"
                        >
                          Copiar Código
                        </button>
                      </div>
                    )}
                  </td>
                </motion.tr>
              )))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
          <p className="text-sm text-muted-foreground">
            {filtered.length} evaluaciones · Página {page} de {totalPages || 1}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setPage(p => Math.max(1, p - 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              disabled={page === 1}
              className="p-2 rounded-lg hover:bg-accent disabled:opacity-40"
              title="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setPage(p => Math.min(totalPages, p + 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              disabled={page >= totalPages}
              className="p-2 rounded-lg hover:bg-accent disabled:opacity-40"
              title="Página siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>

      <PdfPreviewModal
        isOpen={showPdfPreview}
        onClose={() => setShowPdfPreview(false)}
        pdfBlob={previewPdfBlob}
        fileName={previewPdfFileName}
      />
    </div>
  );
}
