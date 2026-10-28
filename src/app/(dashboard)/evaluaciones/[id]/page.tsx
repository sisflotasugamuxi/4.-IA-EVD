"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Edit, CalendarCheck, CheckCircle2, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { getEvaluationById } from "@/app/actions/evaluations";
import { formatDate, formatDateTime, formatScore, getResultLabel, getStatusLabel, getInitials, compressImageIfNeeded } from "@/lib/utils";
import { PdfPreviewModal } from "@/components/ui/pdf-preview-modal";
import { LoadingProgress, useLoadingProgress } from "@/components/ui/loading-progress";

const SCORE_BADGES: Record<number, string> = {
  5: "bg-success-50 dark:bg-success-950/20 text-success-700 dark:text-success-400 border-success-200 dark:border-success-800/40",
  4: "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/40",
  3: "bg-zinc-50 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700",
  2: "bg-warning-50 dark:bg-warning-950/20 text-warning-700 dark:text-warning-400 border-warning-200 dark:border-warning-800/40",
  1: "bg-danger-50 dark:bg-danger-950/20 text-danger-700 dark:text-danger-400 border-danger-200 dark:border-danger-800/40"
};

const SCORE_LABELS: Record<number, string> = {
  5: "Excelente",
  4: "Sobresaliente",
  3: "Cumple lo esperado",
  2: "Requiere mejora",
  1: "No cumple"
};

export default function EvaluationDetailPage() {
  const params = useParams();
  const evaluationId = params?.id as string;
  const [evaluation, setEvaluation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoading: showLoading, progress: loadProgress } = useLoadingProgress(isLoading);
  const [isError, setIsError] = useState<string | null>(null);
  
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [previewPdfBlob, setPreviewPdfBlob] = useState<Blob | null>(null);
  const [previewPdfFileName, setPreviewPdfFileName] = useState("");

  useEffect(() => {
    if (!evaluationId) return;

    async function loadEvaluation() {
      setIsLoading(true);
      const res = await getEvaluationById(evaluationId);
      if (res.error) {
        setIsError(res.error);
        toast.error("Error cargando la evaluación: " + res.error);
      } else {
        setEvaluation(res.data);
      }
      setIsLoading(false);
    }

    loadEvaluation();
  }, [evaluationId]);

  const result = evaluation?.result && !Array.isArray(evaluation.result) ? evaluation.result : evaluation?.result?.[0] || null;

  const generatePDF = async (download: boolean = true, pdfType: 'colaborador' | 'evaluador' = 'evaluador') => {
    if (!evaluation) return null;
    
    const toastId = download ? toast.loading("Generando PDF corporativo...") : undefined;
    
    try {
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
      
      // Helper: Draw header on each page
      const drawHeader = () => {
        // Decorative top bar
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
        
        // Brand Title
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(brandColorBlue[0], brandColorBlue[1], brandColorBlue[2]);
        doc.text("FLOTA SUGAMUXI S.A.", textStartX, 14);
        
        // Document Subtitle
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(textColorMuted[0], textColorMuted[1], textColorMuted[2]);
        doc.text("Sistema de Evaluación de Desempeño (EVD)", textStartX, 19);
        
        // Horizontal separator line
        doc.setDrawColor(226, 232, 240); // border color
        doc.setLineWidth(0.5);
        doc.line(marginX, 22, 210 - marginX, 22);
      };
      
      // Helper: Draw footer on each page
      const drawFooter = (pageNumber: number, totalPages: number) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(textColorMuted[0], textColorMuted[1], textColorMuted[2]);
        
        // Date and Page count
        const currentDate = new Date().toLocaleDateString("es-ES");
        doc.text(`Generado el: ${currentDate}`, marginX, 285);
        doc.text(`Página ${pageNumber} de ${totalPages}`, 210 - marginX, 285, { align: "right" });
        
        // Bottom border
        doc.setDrawColor(226, 232, 240);
        doc.line(marginX, 280, 210 - marginX, 280);
      };

      // PAGE 1: COVER / INFO BLOCK
      posY = 32;
      
      // Document Main Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(brandColorBlue[0], brandColorBlue[1], brandColorBlue[2]);
      doc.text("REPORTE DE EVALUACIÓN DE DESEMPEÑO", marginX, posY);
      posY += 8;
      
      // Date and metadata
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(textColorDark[0], textColorDark[1], textColorDark[2]);
      const dateText = evaluation.finalized_at 
        ? `Fecha de Finalización: ${formatDateTime(evaluation.finalized_at)}`
        : `Fecha de Registro: ${formatDateTime(evaluation.created_at)}`;
      const evalYear = evaluation.evaluation_year || new Date().getFullYear();
      doc.text(`${dateText}  |  Año de Evaluación: ${evalYear}`, marginX, posY);
      posY += 10;
      
      // SECTION: COLLABORATOR INFO (EVALUATED)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(brandColorLightBlue[0], brandColorLightBlue[1], brandColorLightBlue[2]);
      doc.text("1. DATOS DEL COLABORADOR (EVALUADO)", marginX, posY);
      posY += 4;
      
      // Draw Collaborator Table / Grid
      const collabInfo = [
        ["Nombre Completo:", evaluation.collaborator?.full_name || "N/A", "Documento:", `${evaluation.collaborator?.document_type || "CC"} ${evaluation.collaborator?.document_number || "N/A"}`],
        ["Cargo Actual:", evaluation.collaborator?.positions?.name || evaluation.collaborator?.position?.name || "N/A", "Área / Departamento:", evaluation.collaborator?.areas?.name || evaluation.collaborator?.area?.name || "N/A"],
        ["Estado:", evaluation.collaborator?.status || "N/A", "", ""]
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
        ["Nombre del Evaluador:", evaluation.evaluator ? `${evaluation.evaluator.first_name} ${evaluation.evaluator.last_name}` : "N/A", "Cargo Actual:", evaluation.evaluator?.cargo || evaluation.evaluator?.role?.display_name || evaluation.evaluator?.roles?.display_name || "N/A"],
        ["Correo Electrónico:", evaluation.evaluator?.email || "N/A", "Versión del Proceso EVD:", evaluation.version?.name || "N/A"]
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
      
      const overallScore = result ? result.overall_average : 0;
      const statusLabel = result ? getResultLabel(result.result) : "Pendiente de finalizar";
      let resultGeneralText = statusLabel.toUpperCase();
      if (result?.result === "plan_mejoramiento") {
        if (result?.has_critical_fails) {
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
      if (result?.has_critical_fails && result.critical_fails_detail?.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(239, 68, 68); // Red color
        doc.text("CRITERIOS CRÍTICOS INCUMPLIDOS (Causales de Plan de Mejoramiento):", marginX, posY);
        posY += 4;
        
        const failHeaders = [["Criterio Crítico", "Valor Obtenido", "Mínimo Requerido"]];
        const failRows = result.critical_fails_detail.map((fail: any) => {
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
      const categoryScores = result?.category_scores || {};
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
        const answersRows = (evaluation.answers || []).map((ans: any, idx: number) => [
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
          ["Observaciones Generales del Evaluador:", evaluation.observations || "Sin observaciones registradas."],
          ["Fortalezas Clave Demostradas:", evaluation.strengths || "Sin fortalezas registradas."],
          ["Oportunidades de Mejora Identificadas:", evaluation.improvement_opportunities || "Sin oportunidades registradas."],
          ["Necesidades de Formación / Capacitación:", evaluation.training_needs || "Sin necesidades registradas."]
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

      // Check if signature section fits, if not, add a page
      if (posY > 250) {
        doc.addPage();
        posY = 28;
      }
      
      // SECTION: SIGNATURES
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(brandColorLightBlue[0], brandColorLightBlue[1], brandColorLightBlue[2]);
      doc.text(pdfType === "colaborador" ? "5. CONFORMIDAD Y FIRMAS" : "9. CONFORMIDAD Y FIRMAS", marginX, posY);
      
      const evaluatorSigRaw = evaluation.evaluator?.avatar_url;
      const collaboratorSigRaw = (evaluation.draft_data as any)?.collaborator_signature;
      
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
      
      // Signature lines
      doc.setDrawColor(100, 116, 139);
      doc.setLineWidth(0.5);
      
      // Line for Evaluator
      doc.line(marginX, posY, marginX + 70, posY);
      // Line for Evaluated
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
      doc.text(evaluation.evaluator ? `${evaluation.evaluator.first_name} ${evaluation.evaluator.last_name}` : "Nombre del Evaluador", marginX, posY);
      doc.text(evaluation.collaborator?.full_name || "Nombre del Colaborador", 210 - marginX, posY, { align: "right" });
      
      // Draw Page numbers
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawHeader();
        drawFooter(i, totalPages);
      }
      
      // Save PDF
      if (download) {
        const fileName = `EVD_${evaluation.collaborator?.full_name?.replace(/\s+/g, "_") || "Colaborador"}_${evaluation.evaluation_year || new Date().getFullYear()}.pdf`;
        doc.save(fileName);
        if (toastId) toast.success("PDF generado exitosamente", { id: toastId });
      }
      
      return doc;
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      if (toastId) toast.error("Error al generar el PDF corporativo", { id: toastId });
      return null;
    }
  };

  const handlePreviewPDF = async (pdfType: 'colaborador' | 'evaluador' = 'evaluador') => {
    const docObj = await generatePDF(false, pdfType);
    if (docObj) {
      const blob = docObj.output("blob");
      setPreviewPdfBlob(blob);
      const typeLabel = pdfType === 'colaborador' ? 'Colaborador' : 'Evaluador';
      const fileName = `EVD_${typeLabel}_${evaluation?.collaborator?.full_name?.replace(/\s+/g, "_") || "Colaborador"}_${evaluation?.evaluation_year || new Date().getFullYear()}.pdf`;
      setPreviewPdfFileName(fileName);
      setShowPdfPreview(true);
    }
  };

  // Group answers by category
  const answersByCategory = (evaluation?.answers || []).reduce((acc: Record<string, any[]>, answer: any) => {
    const categoryName = answer.category?.name || "Sin Categoría";
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(answer);
    return acc;
  }, {});

  return (
    <div className="w-full min-h-screen px-3 sm:px-4 py-4 sm:py-6">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <Link href="/evaluaciones" className="inline-flex items-center gap-2 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 
            <span className="hidden sm:inline">Volver a Evaluaciones</span>
            <span className="sm:hidden">Atrás</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold mt-2 sm:mt-4">
            Evaluación {evaluation?.code || ""}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {evaluation && (
            <>
              <button
                onClick={() => handlePreviewPDF('colaborador')}
                className="inline-flex items-center justify-center gap-2 rounded-lg sm:rounded-xl bg-brand-500 hover:bg-brand-600 text-white px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-colors flex-shrink-0 shadow-md"
              >
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 
                <span>PDF Colaborador</span>
              </button>
              <button
                onClick={() => handlePreviewPDF('evaluador')}
                className="inline-flex items-center justify-center gap-2 rounded-lg sm:rounded-xl bg-brand-500 hover:bg-brand-600 text-white px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-colors flex-shrink-0 shadow-md"
              >
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 
                <span>PDF Evaluador</span>
              </button>
            </>
          )}
          {evaluation && (evaluation.status === "borrador" || evaluation.status === "en_proceso") && (
            <Link href={`/evaluaciones/${evaluation.id}/editar`} className="inline-flex items-center justify-center gap-2 rounded-lg sm:rounded-xl border border-border text-foreground px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold hover:bg-accent transition-colors flex-shrink-0">
              <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 
              <span className="hidden sm:inline">Editar</span>
              <span className="sm:hidden">Editar</span>
            </Link>
          )}
        </div>
      </div>

      {showLoading ? (
        <LoadingProgress icon={FileText} title="Cargando detalle de evaluación..." description="Consultando respuestas, calificaciones por categoría y firmas..." progress={loadProgress} />
      ) : isError ? (
        <div className="rounded-lg sm:rounded-xl border bg-card p-6 sm:p-8 text-center text-xs sm:text-sm text-danger-600">{isError}</div>
      ) : !evaluation ? (
        <div className="rounded-lg sm:rounded-xl border bg-card p-6 sm:p-8 text-center text-xs sm:text-sm text-muted-foreground">Evaluación no encontrada.</div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
            <div className="rounded-lg sm:rounded-xl border bg-card p-4 sm:p-6 space-y-2 sm:space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Colaborador</p>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full gradient-brand flex items-center justify-center text-white text-sm sm:text-lg font-bold flex-shrink-0">
                  {getInitials(evaluation.collaborator?.full_name || "--")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{evaluation.collaborator?.full_name || "Desconocido"}</p>
                  <p className="text-xs text-muted-foreground truncate">Cargo: {evaluation.collaborator?.positions?.name || evaluation.collaborator?.position?.name || "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">Documento: {evaluation.collaborator?.document_number || "—"}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg sm:rounded-xl border bg-card p-4 sm:p-6 space-y-2 sm:space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Evaluador</p>
              <p className="font-semibold text-sm">{evaluation.evaluator ? `${evaluation.evaluator.first_name} ${evaluation.evaluator.last_name}` : "—"}</p>
              <p className="text-xs text-muted-foreground">Cargo/Rol: {evaluation.evaluator?.role?.display_name || "—"}</p>
              <p className="text-xs text-muted-foreground">Versión: {evaluation.version?.name || "—"}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
            <div className="rounded-lg sm:rounded-xl border bg-card p-4 sm:p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Estado</p>
              <span className="mt-2 inline-flex items-center rounded-full border px-2 sm:px-3 py-1 text-xs font-semibold">{getStatusLabel(evaluation.status)}</span>
            </div>
            <div className="rounded-lg sm:rounded-xl border bg-card p-4 sm:p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Resultado</p>
              <span className="mt-2 inline-flex items-center rounded-full border px-2 sm:px-3 py-1 text-xs font-semibold">{result ? getResultLabel(result.result) : "Pendiente"}</span>
            </div>
            <div className="rounded-lg sm:rounded-xl border bg-card p-4 sm:p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Promedio</p>
              <p className={`mt-2 text-xl sm:text-2xl font-bold ${result ? "text-foreground" : "text-muted-foreground"}`}>
                {result ? formatScore(result.overall_average) : "—"}
              </p>
            </div>
          </div>

          {result?.pmi_required && (
            <div className="rounded-lg sm:rounded-xl border border-warning-200 bg-warning-50 dark:border-warning-900/50 dark:bg-warning-950/20 p-4 sm:p-5 text-warning-800 dark:text-warning-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-warning-600 dark:text-warning-400" />
                <span>Plan de Mejoramiento Individual (PMI) Requerido</span>
              </div>
              <p className="text-xs sm:text-sm">
                Esta evaluación requiere la generación de un Plan de Mejoramiento debido a: <strong className="text-foreground">{result.pmi_reason}</strong>.
              </p>
              {result.has_critical_fails && result.critical_fails_detail?.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-warning-200 dark:border-warning-900/40 pt-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-warning-700 dark:text-warning-400">Detalle de Criterios Críticos Incumplidos:</p>
                  <ul className="list-disc pl-5 space-y-1 text-xs">
                    {result.critical_fails_detail.map((fail: any, idx: number) => {
                      return (
                        <li key={idx}>
                          La categoría <strong className="text-foreground">"{fail.question}"</strong> obtuvo un promedio de <strong className="text-danger-600 font-bold">{formatScore(fail.score)}</strong> (el mínimo requerido era <strong className="text-foreground">{formatScore(fail.min_required)}</strong>).
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Category Scores */}
          {result?.category_scores && Object.keys(result.category_scores).length > 0 && (
            <div className="rounded-lg sm:rounded-xl border bg-card p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-semibold mb-4">Calificación por Categoría</h2>
              <div className="space-y-3">
                {Object.entries(result.category_scores).map(([catId, cat]: [string, any]) => {
                  const avg = typeof cat.average === "number" ? cat.average : 0;
                  const pct = Math.round((avg / 5) * 100);
                  const color = avg >= 4.0 ? "bg-success-500" : avg >= 3.1 ? "bg-warning-500" : "bg-danger-500";
                  const textColor = avg >= 4.0 ? "text-success-600" : avg >= 3.1 ? "text-warning-600" : "text-danger-600";
                  return (
                    <div key={catId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="font-medium text-foreground truncate pr-3">{cat.name}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`font-bold ${textColor}`}>{formatScore(avg)}</span>
                          <span className="text-muted-foreground text-xs">/ 5.0</span>
                          <span className="text-muted-foreground text-xs">({cat.count} preg.)</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${color}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
            <div className="rounded-lg sm:rounded-xl border bg-card p-4 sm:p-6 space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <FileText className="w-4 sm:w-5 h-4 sm:h-5 text-primary flex-shrink-0" />
                <h2 className="text-base sm:text-lg font-semibold">Narrativa</h2>
              </div>
              <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-muted-foreground">
                <div>
                  <p className="font-semibold text-foreground mb-0.5">Observaciones</p>
                  <p className="line-clamp-3">{evaluation.observations || "—"}</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-0.5">Fortalezas</p>
                  <p className="line-clamp-3">{evaluation.strengths || "—"}</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-0.5">Oportunidades de mejora</p>
                  <p className="line-clamp-3">{evaluation.improvement_opportunities || "—"}</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-0.5">Necesidades de formación</p>
                  <p className="line-clamp-3">{evaluation.training_needs || "—"}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg sm:rounded-xl border bg-card p-4 sm:p-6 space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <CalendarCheck className="w-4 sm:w-5 h-4 sm:h-5 text-primary flex-shrink-0" />
                <h2 className="text-base sm:text-lg font-semibold">Fechas</h2>
              </div>
              <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-muted-foreground">
                <div>
                  <p className="font-semibold text-foreground mb-0.5">Creado</p>
                  <p>{formatDateTime(evaluation.created_at)}</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-0.5">Finalizado</p>
                  <p>{evaluation.finalized_at ? formatDateTime(evaluation.finalized_at) : "—"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg sm:rounded-xl border bg-card p-4 sm:p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base sm:text-lg font-bold text-foreground">Respuestas por Categoría</h2>
              <span className="text-xs font-medium bg-muted px-2.5 py-0.5 rounded-full text-muted-foreground">
                {evaluation.answers?.length || 0} Preguntas Evaluadas
              </span>
            </div>
            
            {evaluation.answers?.length ? (
              <div className="space-y-6 sm:space-y-8">
                {Object.entries(answersByCategory).map(([categoryName, catAnswers]: [string, any]) => (
                  <div key={categoryName} className="space-y-3">
                    <div className="flex items-center gap-2 border-l-4 border-primary pl-2 sm:pl-3 py-0.5">
                      <h3 className="font-bold text-sm sm:text-base text-foreground">{categoryName}</h3>
                      <span className="text-[10px] sm:text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {catAnswers.length} {catAnswers.length === 1 ? "pregunta" : "preguntas"}
                      </span>
                    </div>
                    <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                      {catAnswers.map((answer: any) => {
                        const score = answer.score || 0;
                        const badgeClass = SCORE_BADGES[score] || "bg-muted text-muted-foreground border-border";
                        const labelText = SCORE_LABELS[score] || "Sin calificar";
                        return (
                          <div key={answer.question_id} className="rounded-xl border border-border/60 bg-muted/5 p-3 sm:p-4 flex flex-col justify-between gap-3 shadow-sm hover:shadow-md transition-shadow duration-200">
                            <div className="space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded border">
                                  {answer.question?.code || "PREG"}
                                </span>
                                {answer.question?.is_critical && (
                                  <span className="text-[9px] font-extrabold text-danger-700 bg-danger-50 dark:bg-danger-950/30 border border-danger-200 px-1.5 py-0.5 rounded-full animate-pulse uppercase">
                                    Crítico
                                  </span>
                                )}
                              </div>
                              <p className="font-medium text-xs sm:text-sm text-foreground leading-snug">
                                {answer.question?.question || answer.question_id}
                              </p>
                            </div>
                            <div className="flex items-center justify-between border-t border-border/40 pt-2.5 mt-auto">
                              <span className="text-xs text-muted-foreground">Calificación:</span>
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-bold ${badgeClass}`}>
                                  <span className="text-sm font-extrabold">{score}</span>
                                  <span className="opacity-70">|</span>
                                  <span>{labelText}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-muted-foreground text-center py-6">
                No se encontraron respuestas asociadas a esta evaluación.
              </p>
            )}
          </div>
        </div>
      )}
      </div>
      
      <PdfPreviewModal
        isOpen={showPdfPreview}
        onClose={() => setShowPdfPreview(false)}
        pdfBlob={previewPdfBlob}
        fileName={previewPdfFileName}
      />
    </div>
  );
}
