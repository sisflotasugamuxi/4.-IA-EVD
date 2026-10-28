"use client";

import React, { useState, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList, ChevronLeft, ChevronRight, Save,
  CheckCircle2, AlertCircle, Star, Info, Send, FileText, X, ShieldAlert
} from "lucide-react";
import {
  cn, getScoreLabel, formatScore, getResultLabel,
  compressImageIfNeeded, formatDateTime, isMandatorySafetyPosition,
  getCollaboratorCargoName, isRoadSafetyQuestion
} from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { getEvaluationConfig, saveEvaluation, getEvaluationById, sendEvaluationEmail } from "@/app/actions/evaluations";
import { getCollaborators } from "@/app/actions/collaborators";
import { getCurrentUserProfile } from "@/app/actions/admin";
import type { Collaborator } from "@/types";
import { PdfPreviewModal } from "@/components/ui/pdf-preview-modal";
import { SignatureInput } from "@/components/ui/signature-input";
import { LoadingProgress, useLoadingProgress } from "@/components/ui/loading-progress";

// ---- Types ----
interface Question {
  id: string;
  code: string;
  question: string;
  description?: string;
  is_critical: boolean;
  min_score_required: number;
  weight: number;
  is_required: boolean;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  questions: Question[];
  weight: number;
  is_critical?: boolean;
  min_score_required?: number;
}



const SCORES = [
  { value: 5, label: "Excelente", color: "5" },
  { value: 4, label: "Sobresaliente", color: "4" },
  { value: 3, label: "Cumple lo esperado", color: "3" },
  { value: 2, label: "Requiere mejora", color: "2" },
  { value: 1, label: "No cumple", color: "1" },
];

// ---- Score Button ----
function ScoreButton({ score, selected, onSelect }: { score: typeof SCORES[0]; selected: boolean; onSelect: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "score-btn flex-shrink-0 min-w-fit",
        selected && `selected-${score.value}`
      )}
      title={score.label}
    >
      <span>{score.value}</span>
      <span>{score.label.split(' ')[0]}</span>
    </motion.button>
  );
}

function NuevaEvaluacionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEvaluateeId = searchParams?.get("collab");

  const [categories, setCategories] = useState<Category[]>([]);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string | null>(initialEvaluateeId);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [evaluationYear, setEvaluationYear] = useState<string>(new Date().getFullYear().toString());

  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { category_id: string, score: number; comment?: string }>>({});
  const [narrativa, setNarrativa] = useState({
    observations: "",
    strengths: "",
    improvement_opportunities: "",
    training_needs: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");

  const [savedEvaluationId, setSavedEvaluationId] = useState<string | null>(null);
  const [savedEvaluation, setSavedEvaluation] = useState<any | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [collaboratorSignature, setCollaboratorSignature] = useState<string | null>(null);
  const [acceptedCollaboratorDataPolicy, setAcceptedCollaboratorDataPolicy] = useState(false);
  const [pendienteFirmaMode, setPendienteFirmaMode] = useState(false);
  
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [previewPdfBlob, setPreviewPdfBlob] = useState<Blob | null>(null);
  const [previewPdfFileName, setPreviewPdfFileName] = useState("");

  const evalResult = savedEvaluation?.result && !Array.isArray(savedEvaluation.result) 
    ? savedEvaluation.result 
    : savedEvaluation?.result?.[0] || null;
  const overallScore = evalResult && typeof evalResult.overall_average === "number" ? evalResult.overall_average : 0;
  const statusLabel = evalResult?.result ? getResultLabel(evalResult.result) : "Pendiente";
  const [emailInput, setEmailInput] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<any | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const { isLoading: showFormLoading, progress: formLoadProgress } = useLoadingProgress(isLoadingConfig || isLoadingUser);

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const res = await getCurrentUserProfile();
        if (res?.data) {
          setCurrentUserProfile(res.data);
        }
      } catch (err) {
        console.error("Error loading current user profile:", err);
      } finally {
        setIsLoadingUser(false);
      }
    }
    loadCurrentUser();
  }, []);

  useEffect(() => {
    async function loadConfig() {
      try {
        const { categories: cats, questions, version } = await getEvaluationConfig();
        
        if (!cats || !questions) {
          toast.error("No se encontró configuración de evaluación");
          return;
        }
        
        if (version) {
          setVersionId(version.id);
        }
        
        // Group questions into categories
        const structured = cats.map((c: any) => ({
          ...c,
          questions: questions.filter((q: any) => q.category_id === c.id && q.is_active)
        }));
        
        setCategories(structured);
      } catch (err) {
        console.error(err);
        toast.error("Error al cargar configuración de evaluación");
      } finally {
        setIsLoadingConfig(false);
      }
    }
    loadConfig();
  }, []);

  useEffect(() => {
    async function loadCollaborators() {
      try {
        const res = await getCollaborators();
        if (res.error) {
          toast.error("Error al cargar colaboradores");
          return;
        }
        setCollaborators(res.data || []);
      } catch (err) {
        console.error(err);
        toast.error("Error al cargar colaboradores");
      }
    }
    loadCollaborators();
  }, []);

  const category = categories[currentCategoryIndex];
  const totalCategories = categories.length;
  const isLastCategory = currentCategoryIndex === totalCategories - 1;
  const selectedCollaborator = collaborators.find((c) => c.id === selectedCollaboratorId) ?? null;
  const collabCargo = getCollaboratorCargoName(selectedCollaborator);
  const isCollabSafetyMandatory = isMandatorySafetyPosition(collabCargo);

  // Determina si una pregunta es obligatoria para el colaborador evaluado
  const isQuestionMandatoryForCollab = (q: Question, cat?: Category) => {
    if (!q.is_required) return false;
    if (isRoadSafetyQuestion(q, cat)) {
      if (!selectedCollaborator) return true;
      return isCollabSafetyMandatory;
    }
    return true;
  };
  
  // Filter collaborators based on search term
  const filteredCollaborators = collaborators.filter((c) => {
    const fullName = (c.full_name || `${c.first_name || ""} ${c.last_name || ""}`.trim()).toLowerCase();
    const docNumber = (c.document_number || "").toLowerCase();
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || docNumber.includes(search);
  });

  // Calculate progress and required counts
  const totalQuestions = categories.reduce((sum, c) => sum + c.questions.length, 0);
  const answeredQuestions = Object.keys(answers).length;

  const totalRequiredQuestions = categories.reduce(
    (sum, c) => sum + c.questions.filter((q) => isQuestionMandatoryForCollab(q, c)).length,
    0
  );
  const answeredRequiredQuestions = categories.reduce(
    (sum, c) => sum + c.questions.filter((q) => isQuestionMandatoryForCollab(q, c) && answers[q.id]?.score).length,
    0
  );

  const categoryComplete = (cat: Category | undefined) => {
    if (!cat) return false;
    const reqQuestions = cat.questions.filter((q) => isQuestionMandatoryForCollab(q, cat));
    if (reqQuestions.length === 0) return true;
    return reqQuestions.every((q) => answers[q.id]?.score);
  };

  const allRequiredComplete = categories.length > 0 && categories.every(categoryComplete);

  const progress = totalRequiredQuestions > 0
    ? Math.min(100, Math.round((answeredRequiredQuestions / totalRequiredQuestions) * 100))
    : (totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0);

  // Auto-save
  useEffect(() => {
    if (answeredQuestions === 0) return;
    setAutoSaveStatus("unsaved");
    const timer = setTimeout(async () => {
      setAutoSaveStatus("saving");
      await new Promise((r) => setTimeout(r, 500));
      setAutoSaveStatus("saved");
    }, 2000);
    return () => clearTimeout(timer);
  }, [answers, answeredQuestions]);
  
  // Auto-scroll to top when category changes
  useEffect(() => {
    const timer = setTimeout(() => {
      const container = document.getElementById("evaluation-questions-container");
      if (container) {
        const yOffset = -80; // Align below the 64px fixed topbar with 16px margin
        const y = container.getBoundingClientRect().top + (window.scrollY ?? window.pageYOffset) + yOffset;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [currentCategoryIndex]);

  const setAnswer = (questionId: string, categoryId: string, score: number) => {
    setAnswers((prev) => {
      if (prev[questionId]?.score === score) {
        const next = { ...prev };
        delete next[questionId];
        return next;
      }
      return { ...prev, [questionId]: { ...prev[questionId], category_id: categoryId, score } };
    });
  };

  const setComment = (questionId: string, categoryId: string, comment: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], category_id: categoryId, comment } }));
  };

  // Calculate current category average
  const getCategoryAverage = (cat: Category | undefined) => {
    if (!cat) return null;
    const catAnswers = cat.questions.filter((q) => answers[q.id]?.score);
    if (catAnswers.length === 0) return null;
    const totalWeight = catAnswers.reduce((sum, q) => sum + q.weight, 0);
    const weightedSum = catAnswers.reduce((sum, q) => sum + (answers[q.id]?.score || 0) * q.weight, 0);
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  };

  // Calculate overall average
  const getOverallAverage = () => {
    let totalWeight = 0;
    let weightedSum = 0;
    categories.forEach((cat) => {
      cat.questions.forEach((q) => {
        if (answers[q.id]?.score) {
          totalWeight += q.weight;
          weightedSum += answers[q.id].score * q.weight;
        }
      });
    });
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  };

  // Check if any critical category has an average score < min_score_required
  const hasCriticalFails = () => {
    let failed = false;
    categories.forEach((cat) => {
      if (cat.is_critical) {
        // Si es Seguridad Vial y no es obligatorio para el cargo, no genera falla crítica
        if (isRoadSafetyQuestion({ question: "" }, cat) && !isCollabSafetyMandatory) {
          return;
        }
        const avg = getCategoryAverage(cat);
        const minRequired = cat.min_score_required ?? 4.0;
        if (avg !== null && avg < minRequired) {
          failed = true;
        }
      }
    });
    return failed;
  };

  const canProceed = category ? categoryComplete(category) : false;

  const handleFinalize = async () => {
    // Check all required
    const allRequired = categories.every(categoryComplete);
    if (!allRequired) {
      toast.error("Hay preguntas obligatorias sin responder");
      return;
    }
    
    if (!selectedCollaboratorId) {
      toast.error("Selecciona el colaborador a evaluar.");
      return;
    }

    // Show choice modal: signature now or save for later
    setShowChoiceModal(true);
  };

  // Option A: Collaborator present → open signature modal (existing flow)
  const handleChoiceWithSignature = () => {
    setShowChoiceModal(false);
    setCollaboratorSignature(null);
    setAcceptedCollaboratorDataPolicy(false);
    setPendienteFirmaMode(false);
    setShowSignatureModal(true);
  };

  // Option B: Collaborator absent → save with pendiente_firma
  const handleSavePendienteFirma = async () => {
    setShowChoiceModal(false);
    setIsSubmitting(true);
    setPendienteFirmaMode(true);

    const formattedAnswers = Object.entries(answers).map(([question_id, data]) => ({
      question_id,
      category_id: data.category_id,
      score: data.score,
      comment: data.comment,
    }));

    const payload = {
      version_id: versionId,
      evaluatee_id: selectedCollaboratorId,
      evaluation_year: parseInt(evaluationYear) || new Date().getFullYear(),
      answers: formattedAnswers,
      mode: 'pendiente_firma',
      ...narrativa
    };

    const res = await saveEvaluation(payload);

    if (res.error) {
      toast.error("Error al guardar la evaluación: " + res.error);
      setIsSubmitting(false);
      return;
    }

    toast.success("Evaluación guardada. Pendiente de firma del colaborador.");

    try {
      const evalDetails = await getEvaluationById(res.evaluation_id);
      if (evalDetails.data) {
        setSavedEvaluation(evalDetails.data);
        setSavedEvaluationId(res.evaluation_id);
        setShowSuccessModal(true);
      } else {
        router.push("/evaluaciones/firmas-pendientes");
      }
    } catch (err) {
      console.error(err);
      router.push("/evaluaciones/firmas-pendientes");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalizeConfirm = async (signature: string | null) => {
    if (!signature) {
      toast.error("La firma del colaborador es obligatoria para finalizar");
      return;
    }

    setShowSignatureModal(false);
    setIsSubmitting(true);
    setPendienteFirmaMode(false);
    
    const formattedAnswers = Object.entries(answers).map(([question_id, data]) => ({
      question_id,
      category_id: data.category_id,
      score: data.score,
      comment: data.comment,
    }));

    const payload = {
      version_id: versionId,
      evaluatee_id: selectedCollaboratorId,
      evaluation_year: parseInt(evaluationYear) || new Date().getFullYear(),
      answers: formattedAnswers,
      signature: signature, // Pass the base64 signature
      mode: 'finalizar',
      ...narrativa
    };

    const res = await saveEvaluation(payload);
    
    if (res.error) {
      toast.error("Error al guardar la evaluación: " + res.error);
      setIsSubmitting(false);
      return;
    }

    toast.success("Evaluación finalizada exitosamente.");
    
    try {
      const evalDetails = await getEvaluationById(res.evaluation_id);
      if (evalDetails.data) {
        setSavedEvaluation(evalDetails.data);
        setSavedEvaluationId(res.evaluation_id);
        setEmailInput(evalDetails.data.collaborator?.email || "");
        setShowSuccessModal(true);
      } else {
        router.push("/evaluaciones");
      }
    } catch (err) {
      console.error(err);
      router.push("/evaluaciones");
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatePDF = async (download: boolean = true, pdfType: 'colaborador' | 'evaluador' = 'evaluador') => {
    if (!savedEvaluation) return null;
    
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

      // PAGE 1: COVER / INFO BLOCK
      posY = 32;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(brandColorBlue[0], brandColorBlue[1], brandColorBlue[2]);
      doc.text("REPORTE DE EVALUACIÓN DE DESEMPEÑO", marginX, posY);
      posY += 8;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(textColorDark[0], textColorDark[1], textColorDark[2]);
      const dateText = savedEvaluation.finalized_at 
        ? `Fecha de Finalización: ${formatDateTime(savedEvaluation.finalized_at)}`
        : `Fecha de Registro: ${formatDateTime(savedEvaluation.created_at)}`;
      const evalYear = savedEvaluation.evaluation_year || new Date().getFullYear();
      doc.text(`${dateText}  |  Año de Evaluación: ${evalYear}`, marginX, posY);
      posY += 10;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(brandColorLightBlue[0], brandColorLightBlue[1], brandColorLightBlue[2]);
      doc.text("1. DATOS DEL COLABORADOR (EVALUADO)", marginX, posY);
      posY += 4;
      
      const collabInfo = [
        ["Nombre Completo:", savedEvaluation.collaborator?.full_name || "N/A", "Documento:", `${savedEvaluation.collaborator?.document_type || "CC"} ${savedEvaluation.collaborator?.document_number || "N/A"}`],
        ["Cargo Actual:", savedEvaluation.collaborator?.positions?.name || savedEvaluation.collaborator?.position?.name || "N/A", "Área / Departamento:", savedEvaluation.collaborator?.areas?.name || savedEvaluation.collaborator?.area?.name || "N/A"],
        ["Estado:", savedEvaluation.collaborator?.status || "N/A", "", ""]
      ];
      
      const collabTable = autoTable(doc, {
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
        ["Nombre del Evaluador:", savedEvaluation.evaluator ? `${savedEvaluation.evaluator.first_name} ${savedEvaluation.evaluator.last_name}` : "N/A", "Cargo Actual:", savedEvaluation.evaluator?.cargo || savedEvaluation.evaluator?.role?.display_name || savedEvaluation.evaluator?.roles?.display_name || "N/A"],
        ["Correo Electrónico:", savedEvaluation.evaluator?.email || "N/A", "Versión del Proceso EVD:", savedEvaluation.version?.name || "N/A"]
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
      
      const evalResultLocal = savedEvaluation.result && !Array.isArray(savedEvaluation.result) ? savedEvaluation.result : savedEvaluation.result?.[0] || null;
      const overallScoreLocal = evalResultLocal && typeof evalResultLocal.overall_average === "number" ? evalResultLocal.overall_average : 0;
      const statusLabelLocal = evalResultLocal?.result ? getResultLabel(evalResultLocal.result) : "Pendiente";
      let resultGeneralText = (statusLabelLocal || "Pendiente").toUpperCase();
      if (evalResultLocal?.result === "plan_mejoramiento") {
        if (evalResultLocal?.has_critical_fails) {
          resultGeneralText = "PLAN DE MEJORAMIENTO (POR CATEGORÍA)";
        } else {
          resultGeneralText = "PLAN DE MEJORAMIENTO (POR PUNTUACIÓN OBTENIDA (PROMEDIO))";
        }
      }
      
      const summaryInfo = [
        ["PUNTUACIÓN OBTENIDA (PROMEDIO):", `${formatScore(overallScoreLocal)} / 5.0`],
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
      if (evalResultLocal?.has_critical_fails && evalResultLocal.critical_fails_detail?.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(239, 68, 68); // Red color
        doc.text("CRITERIOS CRÍTICOS INCUMPLIDOS (Causales de Plan de Mejoramiento):", marginX, posY);
        posY += 4;
        
        const failHeaders = [["Criterio Crítico", "Valor Obtenido", "Mínimo Requerido"]];
        const failRows = evalResultLocal.critical_fails_detail.map((fail: any) => {
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
      const categoryScores = evalResultLocal?.category_scores || {};
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
        const answersRows = (savedEvaluation.answers || []).map((ans: any, idx: number) => [
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
          ["Observaciones Generales del Evaluador:", savedEvaluation.observations || "Sin observaciones registradas."],
          ["Fortalezas Clave Demostradas:", savedEvaluation.strengths || "Sin fortalezas registradas."],
          ["Oportunidades de Mejora Identificadas:", savedEvaluation.improvement_opportunities || "Sin oportunidades registradas."],
          ["Necesidades de Formación / Capacitación:", savedEvaluation.training_needs || "Sin necesidades registradas."]
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
      
      const evaluatorSigRaw = savedEvaluation.evaluator?.avatar_url;
      const collaboratorSigRaw = (savedEvaluation.draft_data as any)?.collaborator_signature;
      
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
      doc.text(savedEvaluation.evaluator ? `${savedEvaluation.evaluator.first_name} ${savedEvaluation.evaluator.last_name}` : "Nombre del Evaluador", marginX, posY);
      doc.text(savedEvaluation.collaborator?.full_name || "Nombre del Colaborador", 210 - marginX, posY, { align: "right" });
      
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawHeader();
        drawFooter(i, totalPages);
      }
      
      if (download) {
        const fileName = `EVD_${savedEvaluation.collaborator?.full_name?.replace(/\s+/g, "_") || "Colaborador"}_${savedEvaluation.evaluation_year || new Date().getFullYear()}.pdf`;
        doc.save(fileName);
        if (toastId) toast.success("PDF generado exitosamente", { id: toastId });
      }
      
      return doc;
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      if (toastId) toast.error(`Error al generar el PDF corporativo: ${error?.message || error}`, { id: toastId });
      return null;
    }
  };

  const handlePreviewPDF = async (pdfType: 'colaborador' | 'evaluador' = 'evaluador') => {
    const docObj = await generatePDF(false, pdfType);
    if (docObj) {
      const blob = docObj.output("blob");
      setPreviewPdfBlob(blob);
      const typeLabel = pdfType === 'colaborador' ? 'Colaborador' : 'Evaluador';
      const fileName = `EVD_${typeLabel}_${savedEvaluation?.collaborator?.full_name?.replace(/\s+/g, "_") || "Colaborador"}_${savedEvaluation?.evaluation_year || new Date().getFullYear()}.pdf`;
      setPreviewPdfFileName(fileName);
      setShowPdfPreview(true);
    }
  };

  const overall = getOverallAverage();
  const criticalFailed = hasCriticalFails();
  const resultLabel = criticalFailed ? "PLAN DE MEJORAMIENTO" : (overall >= 4.0 ? "APROBADO" : overall >= 3.1 ? "PLAN DE MEJORAMIENTO" : overall > 0 ? "NO APROBADO" : null);
  const resultColor = (resultLabel === "APROBADO") ? "text-success-600" : (resultLabel === "PLAN DE MEJORAMIENTO") ? "text-warning-600" : "text-danger-600";

  return (
    <div className="w-full min-h-screen space-y-4 sm:space-y-6 animate-fade-in px-3 sm:px-4 py-4 sm:py-6">
      <div className="max-w-7xl mx-auto w-full space-y-4 sm:space-y-6">
      {/* Back */}
      <Link href="/evaluaciones" className="inline-flex items-center gap-2 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span className="hidden sm:inline">Volver a Evaluaciones</span>
        <span className="sm:hidden">Atrás</span>
      </Link>

      {showFormLoading ? (
        <LoadingProgress
          icon={ClipboardList}
          title="Cargando configuración de la evaluación..."
          description="Preparando categorías, preguntas, ponderaciones y colaboradores..."
          progress={formLoadProgress}
        />
      ) : currentUserProfile?.roles?.name === 'colaborador' ? (
        <div className="py-16 flex flex-col items-center justify-center gap-6 rounded-2xl border border-danger-200 bg-danger-50/50 dark:border-danger-900/30 dark:bg-danger-950/10">
          <div className="w-16 h-16 rounded-full bg-danger-100 dark:bg-danger-900/20 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-danger-600 dark:text-danger-400" />
          </div>
          <div className="text-center space-y-2 max-w-md">
            <h2 className="text-xl font-bold text-danger-700 dark:text-danger-300">Acceso Denegado</h2>
            <p className="text-sm text-danger-600/80 dark:text-danger-400/80 leading-relaxed">
              Tu rol de <strong>Colaborador</strong> no tiene permisos para realizar evaluaciones de desempeño.
              Solo los roles de <strong>Líder / Jefe</strong>, <strong>Administrador</strong>,
              <strong> Gestión Humana</strong> y <strong>Gerencia</strong> pueden iniciar evaluaciones.
            </p>
          </div>
          <Link
            href="/evaluaciones"
            className="inline-flex items-center gap-2 rounded-xl bg-danger-600 hover:bg-danger-700 text-white px-5 py-2.5 text-sm font-semibold transition-colors shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Volver a Evaluaciones
          </Link>
        </div>
      ) : categories.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No hay configuración de evaluación activa.
        </div>
      ) : (
      <>
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold">Nueva Evaluación de Desempeño</h1>
          {selectedCollaborator && (
            <p className="text-muted-foreground text-xs sm:text-sm mt-1 truncate">
              {selectedCollaborator.full_name} · {selectedCollaborator.positions?.name || selectedCollaborator.position?.name} · {selectedCollaborator.areas?.name || selectedCollaborator.area?.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
          {autoSaveStatus === "saved" && <span className="text-success-500 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Guardado</span>}
          {autoSaveStatus === "saving" && <span className="flex items-center gap-1"><div className="w-3 h-3 border border-muted-foreground/40 border-t-muted-foreground rounded-full animate-spin" /> Guardando...</span>}
          {autoSaveStatus === "unsaved" && <span className="flex items-center gap-1">Sin guardar</span>}
        </div>
      </div>

      {/* Filtros y Selección de Colaborador */}
      <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm border-border/70">
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_180px_140px] lg:items-end">
          <div className="space-y-1.5 relative">
            <label className="block text-xs sm:text-sm font-semibold text-foreground">Colaborador a evaluar</label>
            <div className="relative">
              <input
                type="text"
                value={selectedCollaborator ? `${selectedCollaborator.full_name} (${selectedCollaborator.document_number})` : searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (selectedCollaboratorId) {
                    setSelectedCollaboratorId(null);
                  }
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Buscar por nombre o documento..."
                className="w-full rounded-lg sm:rounded-xl border bg-background pl-3 pr-10 py-2 sm:pl-4 sm:pr-12 sm:py-2.5 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {selectedCollaborator && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCollaboratorId(null);
                    setSearchTerm("");
                    setShowDropdown(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {showDropdown && filteredCollaborators.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-lg sm:rounded-xl border border-border bg-popover text-popover-foreground shadow-xl z-50 max-h-40 sm:max-h-56 overflow-y-auto">
                  {filteredCollaborators.map((collab) => (
                    <button
                      key={collab.id}
                      type="button"
                      onClick={() => {
                        setSelectedCollaboratorId(collab.id);
                        setSearchTerm("");
                        setShowDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 sm:px-4 sm:py-2.5 hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border/50 last:border-b-0 text-xs sm:text-sm"
                    >
                      <p className="font-medium truncate">{collab.full_name}</p>
                      <p className="text-xs text-muted-foreground/85 truncate">{collab.document_number}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-semibold text-foreground">Año de evaluación</label>
            <input
              type="number"
              value={evaluationYear}
              onChange={(e) => setEvaluationYear(e.target.value)}
              min={2020}
              max={new Date().getFullYear()}
              className="w-full rounded-lg sm:rounded-xl border bg-background px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {selectedCollaborator ? (
            <div className="flex items-center justify-center gap-1.5 h-10 rounded-lg sm:rounded-xl border border-success-200 bg-success-50 dark:bg-success-950/20 text-xs sm:text-sm text-success-700 dark:text-success-400 font-bold px-4 shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-success-500" />
              <span>Listo</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 h-10 rounded-lg sm:rounded-xl border border-warning-200 bg-warning-50 dark:bg-warning-950/20 text-xs sm:text-sm text-warning-700 dark:text-warning-400 font-bold px-4 shadow-sm animate-pulse">
              <Info className="w-4 h-4 text-warning-500" />
              <span>Seleccionar</span>
            </div>
          )}
        </div>
      </div>

      {/* Self-evaluation warning banner */}
      {selectedCollaborator && currentUserProfile && (() => {
        const isSameDoc = currentUserProfile.document_type && currentUserProfile.document_number &&
          selectedCollaborator.document_type === currentUserProfile.document_type &&
          selectedCollaborator.document_number === currentUserProfile.document_number;
        const isSameEmail = selectedCollaborator.email && currentUserProfile.email &&
          selectedCollaborator.email.toLowerCase() === currentUserProfile.email.toLowerCase();
        return (isSameDoc || isSameEmail) ? (
          <div className="flex items-start gap-3 text-sm bg-danger-50 dark:bg-danger-950/20 border border-danger-200 dark:border-danger-900/40 rounded-xl p-4 shadow-sm">
            <AlertCircle className="w-5 h-5 mt-0.5 text-danger-600 dark:text-danger-400 flex-shrink-0" />
            <div className="space-y-1">
              <p className="font-bold text-danger-800 dark:text-danger-200 text-sm">Autoevaluación no permitida</p>
              <p className="text-danger-700 dark:text-danger-300 text-xs leading-relaxed">
                No puedes realizar tu propia evaluación de desempeño. Por favor selecciona un colaborador diferente.
                Las evaluaciones deben ser realizadas por un <strong>Líder / Jefe</strong>, <strong>Administrador</strong>,
                <strong> Gestión Humana</strong> o <strong>Gerencia</strong>.
              </p>
            </div>
          </div>
        ) : null;
      })()}

      {/* Método de Calificación Guía */}
      <div className="rounded-xl border border-brand-100 dark:border-brand-900/50 bg-brand-50/20 dark:bg-brand-950/10 p-5 shadow-sm space-y-4">
        {/* Title and Intro */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-bold text-foreground text-sm sm:text-base">
            <Info className="w-4.5 h-4.5 text-brand-500" />
            <span>Escala de Calificación y Criterios Críticos</span>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Evalúe las competencias del colaborador seleccionando un puntaje de <strong className="text-foreground font-semibold">1 a 5</strong> según el nivel de desempeño demostrado:
          </p>
        </div>

        {/* Scale Badges Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="flex flex-col justify-center items-center p-2.5 rounded-lg border border-success-200 bg-success-50/50 dark:border-success-900/40 dark:bg-success-950/10 text-center shadow-sm">
            <span className="text-success-700 dark:text-success-400 font-extrabold text-sm sm:text-base">5</span>
            <span className="text-success-600 dark:text-success-400 text-[10px] sm:text-xs font-medium mt-0.5">Excelente</span>
          </div>
          <div className="flex flex-col justify-center items-center p-2.5 rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/10 text-center shadow-sm">
            <span className="text-blue-700 dark:text-blue-400 font-extrabold text-sm sm:text-base">4</span>
            <span className="text-blue-600 dark:text-blue-400 text-[10px] sm:text-xs font-medium mt-0.5">Sobresaliente</span>
          </div>
          <div className="flex flex-col justify-center items-center p-2.5 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50 text-center shadow-sm">
            <span className="text-zinc-700 dark:text-zinc-300 font-extrabold text-sm sm:text-base">3</span>
            <span className="text-zinc-600 dark:text-zinc-400 text-[10px] sm:text-xs font-medium mt-0.5">Cumple lo esperado</span>
          </div>
          <div className="flex flex-col justify-center items-center p-2.5 rounded-lg border border-warning-200 bg-warning-50/50 dark:border-warning-900/40 dark:bg-warning-950/10 text-center shadow-sm">
            <span className="text-warning-700 dark:text-warning-400 font-extrabold text-sm sm:text-base">2</span>
            <span className="text-warning-600 dark:text-warning-400 text-[10px] sm:text-xs font-medium mt-0.5">Requiere mejora</span>
          </div>
          <div className="flex flex-col justify-center items-center p-2.5 rounded-lg border border-danger-200 bg-danger-50/50 dark:border-danger-900/40 dark:bg-danger-950/10 text-center shadow-sm">
            <span className="text-danger-700 dark:text-danger-400 font-extrabold text-sm sm:text-base">1</span>
            <span className="text-danger-600 dark:text-danger-400 text-[10px] sm:text-xs font-medium mt-0.5">No cumple</span>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="flex items-start gap-3 text-xs sm:text-sm text-warning-800 dark:text-warning-300 bg-warning-50/50 dark:bg-warning-950/10 p-3.5 rounded-xl border border-warning-200/60 dark:border-warning-900/30 shadow-xs">
          <AlertCircle className="w-5 h-5 mt-0.5 text-warning-600 dark:text-warning-500 flex-shrink-0" />
          <div className="space-y-1">
            <span className="block font-bold text-warning-900 dark:text-warning-200 text-xs sm:text-sm">
              Plan de Mejoramiento por Categoría (Criterios Críticos)
            </span>
            <span className="block text-warning-800 dark:text-warning-300 text-xs leading-relaxed">
              Las categorías configuradas como <strong>Criterios Críticos</strong> requieren obtener una calificación promedio mínima de <strong>4.0</strong> (o la establecida en la parametrización). Si el promedio de la categoría es inferior al mínimo requerido, el colaborador ingresará de forma obligatoria al <strong>Plan de Mejoramiento Individual (PMI)</strong>, sin importar su promedio global de evaluación.
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar Widget */}
      <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <span className="font-bold text-foreground flex items-center gap-1.5">
            <Star className="w-4 h-4 text-brand-500" />
            <span>Progreso de la Evaluación</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-semibold bg-muted px-2.5 py-0.5 rounded-full text-xs">
              {answeredQuestions} de {totalQuestions} preguntas respondidas
              {totalRequiredQuestions < totalQuestions && (
                <span className="ml-1 text-brand-600 dark:text-brand-400 font-bold">
                  ({answeredRequiredQuestions}/{totalRequiredQuestions} obligatorias)
                </span>
              )}
            </span>
            <span className="font-extrabold text-brand-600 dark:text-brand-400 text-base">
              {progress}%
            </span>
          </div>
        </div>
        <div className="h-3 bg-muted/60 dark:bg-muted/30 rounded-full overflow-hidden p-0.5 border border-border/30">
          <motion.div
            className="h-full bg-gradient-to-r from-brand-500 to-indigo-600 rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Questions grid — hidden if self-evaluation detected */}
      {selectedCollaborator && currentUserProfile && (() => {
        const isSameDoc = currentUserProfile.document_type && currentUserProfile.document_number &&
          selectedCollaborator.document_type === currentUserProfile.document_type &&
          selectedCollaborator.document_number === currentUserProfile.document_number;
        const isSameEmail = selectedCollaborator.email && currentUserProfile.email &&
          selectedCollaborator.email.toLowerCase() === currentUserProfile.email.toLowerCase();
        return (isSameDoc || isSameEmail);
      })() ? null : (
      <div id="evaluation-questions-container" className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Category Nav */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-20 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Categorías</p>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 lg:gap-3">
              {categories.map((cat, i) => {
                const catAvg = getCategoryAverage(cat);
                const catComplete = categoryComplete(cat);
                const isCatRoadSafety = isRoadSafetyQuestion({ question: "" }, cat);
                const isCatOptional = isCatRoadSafety && !isCollabSafetyMandatory;

                return (
                  <button
                    key={cat.id}
                    onClick={() => setCurrentCategoryIndex(i)}
                    className={cn(
                      "text-left p-2 lg:p-3 rounded-xl border transition-all",
                      i === currentCategoryIndex
                        ? "border-primary bg-primary/8 shadow-sm"
                        : "hover:bg-accent border-transparent"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 flex-shrink-0",
                        catComplete ? "bg-success-500 text-white" : i === currentCategoryIndex ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                      )}>
                        {catComplete ? "✓" : i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs lg:text-xs font-medium leading-tight line-clamp-2">{cat.name}</p>
                        {isCatOptional && (
                          <span className="inline-block text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded mt-0.5 border border-slate-200 dark:border-slate-700">
                            Opcional
                          </span>
                        )}
                        {catAvg !== null && (
                          <p className={cn(
                            "text-xs font-bold mt-0.5",
                            catAvg >= 4.0 ? "text-success-600" : catAvg >= 3.1 ? "text-warning-600" : "text-danger-600"
                          )}>
                            Prom: {formatScore(catAvg)}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Live result */}
            {overall > 0 && (
              <div className="p-3 rounded-xl border bg-card">
                <p className="text-xs text-muted-foreground mb-1">Promedio actual</p>
                <p className={cn("text-2xl font-bold", resultColor)}>{formatScore(overall)}</p>
                <p className={cn("text-xs font-semibold mt-0.5", resultColor)}>{resultLabel}</p>
              </div>
            )}
          </div>
        </div>

        {/* Questions Panel */}
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={category.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="rounded-xl border bg-card overflow-hidden"
            >
              {/* Category Header */}
              <div className="p-3 sm:p-5 border-b bg-muted/20">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">
                        Categoría {currentCategoryIndex + 1} de {totalCategories}
                      </span>
                      <span className="text-xs bg-brand-100 dark:bg-brand-950/30 text-brand-600 px-2 py-0.5 rounded-full flex-shrink-0">
                        Peso: {category.weight}%
                      </span>
                      {category.is_critical && (
                        isRoadSafetyQuestion({ question: "" }, category) && !isCollabSafetyMandatory ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                            Opcional para este cargo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-danger-100 dark:bg-danger-950/30 text-danger-600 border border-danger-200 whitespace-nowrap">
                            <AlertCircle className="w-3 h-3" />
                            Criterio Crítico (Mínimo {category.min_score_required ?? 4.0})
                          </span>
                        )
                      )}
                    </div>
                    <h2 className="font-semibold text-base sm:text-lg">{category.name}</h2>
                    {category.description && (
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">{category.description}</p>
                    )}

                    {/* Notice for Road Safety Category */}
                    {isRoadSafetyQuestion({ question: "" }, category) && selectedCollaborator && (
                      <div className={cn(
                        "flex items-start gap-2.5 p-3 rounded-xl text-xs border transition-colors mt-3",
                        isCollabSafetyMandatory
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-200"
                          : "bg-blue-500/10 border-blue-500/20 text-blue-800 dark:text-blue-200"
                      )}>
                        {isCollabSafetyMandatory ? (
                          <>
                            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold">Módulo obligatorio para el cargo actual</p>
                              <p className="text-[11px] mt-0.5 opacity-90 leading-relaxed">
                                Las 5 preguntas de Seguridad Vial son obligatorias para el cargo <strong>{collabCargo}</strong>.
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold">Módulo opcional para el cargo actual</p>
                              <p className="text-[11px] mt-0.5 opacity-90 leading-relaxed">
                                Las preguntas de Seguridad Vial <strong>no son obligatorias</strong> para el cargo <strong>{collabCargo || "Sin Cargo"}</strong>. Puede responderlas si aplican a sus funciones o dejarlas sin responder para continuar.
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Questions */}
              <div className="divide-y divide-border">
                {category.questions.map((question, qi) => (
                  <div key={question.id} className="p-3 sm:p-5 space-y-3 sm:space-y-4">
                    {/* Question Header */}
                    <div className="flex items-start gap-2 sm:gap-3">
                      <span className="flex-shrink-0 text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded flex items-center justify-center min-w-[2rem] h-5">
                        {question.code || `${currentCategoryIndex + 1}.${qi + 1}`}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                          <p className="text-xs sm:text-sm font-medium leading-relaxed">
                            {question.question}
                            {isQuestionMandatoryForCollab(question, category) ? (
                              <span className="text-danger-500 ml-1 font-bold" title="Pregunta obligatoria">*</span>
                            ) : (
                              <span className="inline-flex items-center text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded ml-2 border border-slate-200 dark:border-slate-700">
                                Opcional
                              </span>
                            )}
                          </p>
                        </div>
                        {question.description && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                            <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            {question.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Score Buttons */}
                    <div className="flex gap-1 sm:gap-2 overflow-x-auto pb-1">
                      {SCORES.map((score) => (
                        <ScoreButton
                          key={score.value}
                          score={score}
                          selected={answers[question.id]?.score === score.value}
                          onSelect={() => setAnswer(question.id, category.id, score.value)}
                        />
                      ))}
                    </div>


                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Narrative (last category) */}
          {isLastCategory && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 sm:mt-6 rounded-xl border bg-card p-3 sm:p-5 space-y-4"
            >
              <h3 className="font-semibold text-sm sm:text-base flex items-center gap-2">
                <Star className="w-4 sm:w-5 h-4 sm:h-5 text-brand-500 flex-shrink-0" />
                Narrativa de la Evaluación
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-medium">Fortalezas identificadas</label>
                  <textarea
                    value={narrativa.strengths}
                    onChange={(e) => setNarrativa((p) => ({ ...p, strengths: e.target.value }))}
                    rows={3}
                    placeholder="Describe las principales fortalezas del colaborador..."
                    className="w-full rounded-lg border bg-background px-2 sm:px-3 py-2 text-xs sm:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-medium">Oportunidades de mejora</label>
                  <textarea
                    value={narrativa.improvement_opportunities}
                    onChange={(e) => setNarrativa((p) => ({ ...p, improvement_opportunities: e.target.value }))}
                    rows={3}
                    placeholder="Describe las áreas de mejora identificadas..."
                    className="w-full rounded-lg border bg-background px-2 sm:px-3 py-2 text-xs sm:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-medium">Necesidades de capacitación</label>
                  <textarea
                    value={narrativa.training_needs}
                    onChange={(e) => setNarrativa((p) => ({ ...p, training_needs: e.target.value }))}
                    rows={3}
                    placeholder="Temas de capacitación requeridos..."
                    className="w-full rounded-lg border bg-background px-2 sm:px-3 py-2 text-xs sm:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-medium">Observaciones generales</label>
                  <textarea
                    value={narrativa.observations}
                    onChange={(e) => setNarrativa((p) => ({ ...p, observations: e.target.value }))}
                    rows={3}
                    placeholder="Observaciones adicionales del evaluador..."
                    className="w-full rounded-lg border bg-background px-2 sm:px-3 py-2 text-xs sm:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Navigation */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 mt-4">
            <button
              onClick={() => setCurrentCategoryIndex((i) => i - 1)}
              disabled={currentCategoryIndex === 0}
              className="flex items-center justify-center sm:justify-start gap-2 px-4 py-2 rounded-xl border border-border text-foreground text-xs sm:text-sm font-medium hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Anterior</span>
              <span className="sm:hidden">Ant.</span>
            </button>

            <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
              {isLastCategory ? (
                <button
                  onClick={handleFinalize}
                  disabled={isSubmitting || !allRequiredComplete}
                  className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 rounded-xl gradient-brand text-white text-xs sm:text-sm font-semibold hover:opacity-90 transition-opacity shadow-md disabled:opacity-60 flex-1 sm:flex-none justify-center"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 sm:w-4 h-3.5 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span className="hidden sm:inline">Finalizando...</span>
                      <span className="sm:hidden">Finalizar</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                      <span className="hidden sm:inline">Finalizar Evaluación</span>
                      <span className="sm:hidden">Finalizar</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => setCurrentCategoryIndex((i) => i + 1)}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 rounded-xl gradient-brand text-white text-xs sm:text-sm font-semibold hover:opacity-90 transition-opacity shadow-md flex-1 sm:flex-none"
                >
                  <span className="hidden sm:inline">Siguiente</span>
                  <span className="sm:hidden">Sig.</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Collaborator & Progress Sticky Panel */}
        <div className="lg:col-span-3 hidden lg:block">
          <div className="sticky top-20 space-y-4">
            {/* Collaborator Card */}
            {selectedCollaborator && (
              <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Evaluando a</p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="w-10 h-10 rounded-full gradient-brand flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0">
                      {(selectedCollaborator.full_name || "US").split(" ").filter(Boolean).map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm leading-tight text-foreground truncate">{selectedCollaborator.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {selectedCollaborator.position?.name || selectedCollaborator.positions?.name || (Array.isArray(selectedCollaborator.positions) ? selectedCollaborator.positions[0]?.name : null) || "Sin Cargo"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/60 pt-2.5 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Área:</span>
                    <span className="font-semibold text-foreground truncate pl-2">
                      {selectedCollaborator.area?.name || selectedCollaborator.areas?.name || (Array.isArray(selectedCollaborator.areas) ? selectedCollaborator.areas[0]?.name : null) || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Documento:</span>
                    <span className="font-semibold text-foreground">{selectedCollaborator.document_number || "—"}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Progress Card */}
            <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Avance</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">
                    {answeredQuestions} de {totalQuestions} preguntas
                    {totalRequiredQuestions < totalQuestions && (
                      <span className="block text-[10px] text-brand-600 dark:text-brand-400 font-semibold mt-0.5">
                        ({answeredRequiredQuestions}/{totalRequiredQuestions} obligatorias)
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-bold text-primary">{progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden mt-1.5">
                  <motion.div
                    className="h-full gradient-brand rounded-full"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
              </div>

              <div className="border-t border-border/60 pt-2.5 space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Categorías Completadas</p>
                <div className="space-y-1.5">
                  {categories.map((cat, idx) => {
                    const isComplete = categoryComplete(cat);
                    const isCatRoadSafety = isRoadSafetyQuestion({ question: "" }, cat);
                    const isCatOptional = isCatRoadSafety && !isCollabSafetyMandatory;

                    return (
                      <div key={cat.id} className="flex items-center justify-between text-xs">
                        <span className={cn(
                          "truncate pr-2",
                          isComplete ? "text-foreground font-medium" : "text-muted-foreground"
                        )} title={cat.name}>
                          {idx + 1}. {cat.name}
                          {isCatOptional && (
                            <span className="text-[10px] text-muted-foreground font-normal ml-1">(Opcional)</span>
                          )}
                        </span>
                        {isComplete ? (
                          <span className="text-success-600 font-bold flex-shrink-0">✓</span>
                        ) : (
                          <span className="text-muted-foreground/35 flex-shrink-0 font-medium">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      </>
      )}
      </div>


      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && savedEvaluation && (
          <div 
            onClick={() => {
              setShowSuccessModal(false);
              router.push(pendienteFirmaMode ? "/evaluaciones/firmas-pendientes" : "/evaluaciones");
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 cursor-pointer"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl space-y-6 text-foreground cursor-default relative"
            >
              <button
                type="button"
                onClick={() => {
                  setShowSuccessModal(false);
                  router.push(pendienteFirmaMode ? "/evaluaciones/firmas-pendientes" : "/evaluaciones");
                }}
                className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-center space-y-2">
                {pendienteFirmaMode ? (
                  <>
                    <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                      <AlertCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold">Evaluación Guardada</h3>
                    <p className="text-sm text-muted-foreground">
                      La evaluación de <strong>{savedEvaluation.collaborator?.full_name}</strong> ha sido guardada exitosamente. <span className="text-amber-600 font-semibold">Queda pendiente la firma del colaborador.</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Podrás recoger la firma desde la sección <strong>&quot;Firmas Pendientes&quot;</strong> cuando el colaborador esté presente.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mx-auto w-12 h-12 rounded-full bg-success-100 dark:bg-success-950/30 flex items-center justify-center text-success-600 dark:text-success-400">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold">¡Evaluación Finalizada!</h3>
                    <p className="text-sm text-muted-foreground">
                      La evaluación de <strong>{savedEvaluation.collaborator?.full_name}</strong> se ha guardado correctamente.
                    </p>
                  </>
                )}
              </div>

              {/* Results Summary */}
              <div className="rounded-xl bg-muted/30 border p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Promedio obtenido:</span>
                  <span className="font-bold text-foreground">
                    {formatScore(overallScore)} / 5.0
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resultado general:</span>
                  <span className={cn(
                    "font-bold uppercase text-xs px-2 py-0.5 rounded border",
                    (evalResult?.result === "aprobado") ? "text-success-600 bg-success-50 border-success-200" :
                    (evalResult?.result === "plan_mejoramiento") ? "text-warning-600 bg-warning-50 border-warning-200" : "text-danger-600 bg-danger-50 border-danger-200"
                  )}>
                    {getResultLabel(evalResult?.result || "pendiente")}
                  </span>
                </div>
                {pendienteFirmaMode && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estado:</span>
                    <span className="font-bold text-xs px-2 py-0.5 rounded border text-amber-600 bg-amber-50 border-amber-200">
                      Pendiente de Firma
                    </span>
                  </div>
                )}
              </div>

              {/* Email Form - only for finalized evaluations */}
              {!pendienteFirmaMode && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-muted-foreground uppercase">
                  Enviar reporte por correo
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    onClick={async () => {
                      if (!emailInput) {
                        toast.error("Por favor ingresa un correo electrónico.");
                        return;
                      }
                      setIsSendingEmail(true);
                      const toastId = toast.loading("Generando PDF y preparando envío...");
                      try {
                        const docObj = await generatePDF(false, 'colaborador');
                        if (!docObj) {
                          toast.error("Error al generar PDF.", { id: toastId });
                          setIsSendingEmail(false);
                          return;
                        }
                        const pdfBase64 = docObj.output("datauristring").split(",")[1];
                        const fileName = `EVD_${savedEvaluation.collaborator?.full_name?.replace(/\s+/g, "_") || "Colaborador"}_${savedEvaluation.evaluation_year || new Date().getFullYear()}.pdf`;

                        const emailResult = await sendEvaluationEmail({
                          evaluationId: savedEvaluation.id,
                          pdfBase64,
                          fileName,
                          recipientEmail: emailInput,
                          recipientName: savedEvaluation.collaborator?.full_name || "Colaborador",
                          evaluationYear: savedEvaluation.evaluation_year || new Date().getFullYear(),
                          score: overallScore,
                          result: evalResult?.result || "pendiente"
                        });

                        if (emailResult.error) {
                          toast.error("Error al enviar: " + emailResult.error, { id: toastId });
                        } else {
                          toast.success("Correo enviado exitosamente.", { id: toastId });
                        }
                      } catch (err: any) {
                        console.error(err);
                        toast.error("Ocurrió un error inesperado al enviar el correo: " + (err?.message || err), { id: toastId });
                      } finally {
                        setIsSendingEmail(false);
                      }
                    }}
                    disabled={isSendingEmail}
                    className="px-4 py-2 rounded-lg gradient-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center min-w-[100px]"
                  >
                    {isSendingEmail ? (
                      <div className="w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      "Enviar"
                    )}
                  </button>
                </div>
              </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 border-t pt-4">
                {!pendienteFirmaMode && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => handlePreviewPDF('colaborador')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-accent transition-colors text-sm font-semibold"
                  >
                    <FileText className="w-4 h-4" />
                    PDF Colaborador
                  </button>
                  <button
                    onClick={() => handlePreviewPDF('evaluador')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-accent transition-colors text-sm font-semibold"
                  >
                    <FileText className="w-4 h-4" />
                    PDF Evaluador
                  </button>
                </div>
                )}
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    router.push(pendienteFirmaMode ? "/evaluaciones/firmas-pendientes" : "/evaluaciones");
                  }}
                  className="w-full px-4 py-2.5 rounded-xl gradient-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity text-center"
                >
                  {pendienteFirmaMode ? "Ir a Firmas Pendientes" : "Volver a Evaluaciones"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Choice Modal — Select finalization mode */}
      <AnimatePresence>
        {showChoiceModal && selectedCollaborator && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl space-y-5 text-foreground"
            >
              <div className="flex justify-between items-center border-b pb-3 bg-muted/20 -mx-6 -mt-6 px-6 py-4 rounded-t-2xl">
                <h3 className="text-lg font-bold">¿Cómo desea finalizar?</h3>
                <button
                  type="button"
                  onClick={() => setShowChoiceModal(false)}
                  className="p-1 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-muted-foreground">
                Seleccione cómo desea guardar la evaluación de <strong>{selectedCollaborator.full_name}</strong>:
              </p>

              <div className="space-y-3">
                {/* Option A: With collaborator signature */}
                <button
                  type="button"
                  onClick={handleChoiceWithSignature}
                  className="w-full text-left rounded-xl border-2 border-success-200 bg-success-50/50 dark:bg-success-950/20 hover:border-success-400 hover:bg-success-50 dark:hover:bg-success-950/40 p-4 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-8 h-8 rounded-full bg-success-100 dark:bg-success-900/50 flex items-center justify-center text-success-600 flex-shrink-0">
                      <CheckCircle2 className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">Finalizar con Firma del Colaborador</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        El colaborador está presente y firmará ahora. La evaluación quedará completa.
                      </p>
                    </div>
                  </div>
                </button>

                {/* Option B: Save for later signature */}
                <button
                  type="button"
                  onClick={handleSavePendienteFirma}
                  disabled={isSubmitting}
                  className="w-full text-left rounded-xl border-2 border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 p-4 transition-all group disabled:opacity-60"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 flex-shrink-0">
                      <AlertCircle className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">Guardar para Firma Posterior</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        El colaborador no está presente. Se guardará la evaluación con su firma de evaluador y el colaborador firmará después desde &quot;Firmas Pendientes&quot;.
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowChoiceModal(false)}
                  className="w-full px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors text-muted-foreground"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Signature Modal */}
      <AnimatePresence>
        {showSignatureModal && selectedCollaborator && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl space-y-4 text-foreground"
            >
              <div className="flex justify-between items-center border-b pb-3 bg-muted/20 -mx-6 -mt-6 px-6 py-4 rounded-t-2xl">
                <h3 className="text-lg font-bold">Firma de Conformidad</h3>
                <button
                  type="button"
                  onClick={() => setShowSignatureModal(false)}
                  className="p-1 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Para finalizar el registro de la evaluación, el colaborador <strong>{selectedCollaborator.full_name}</strong> debe registrar su firma de conformidad.
                </p>
                
                <SignatureInput
                  value={collaboratorSignature}
                  onChange={(val) => setCollaboratorSignature(val)}
                  placeholder="Dibuje su firma aquí o suba una imagen de su firma"
                />
                
                {collaboratorSignature && (
                  <div className="flex items-start gap-2.5 pt-2">
                    <input
                      type="checkbox"
                      id="collab-data-treatment-policy"
                      checked={acceptedCollaboratorDataPolicy}
                      onChange={(e) => setAcceptedCollaboratorDataPolicy(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                    <label htmlFor="collab-data-treatment-policy" className="text-xs text-muted-foreground leading-normal select-none cursor-pointer">
                      Acepto la{" "}
                      <a
                        href="https://flotasugamuxisa.com.co/privacidad/#habeas-data"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:text-brand-700 font-semibold underline"
                      >
                        política de tratamiento de datos personales (Habeas Data)
                      </a>{" "}
                      para el registro, almacenamiento y uso de mi firma digital en esta evaluación de desempeño. <span className="text-danger-500">*</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowSignatureModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleFinalizeConfirm(collaboratorSignature)}
                  disabled={!collaboratorSignature || !acceptedCollaboratorDataPolicy}
                  className="flex-1 px-4 py-2 rounded-xl gradient-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  Confirmar y Guardar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PdfPreviewModal
        isOpen={showPdfPreview}
        onClose={() => setShowPdfPreview(false)}
        pdfBlob={previewPdfBlob}
        fileName={previewPdfFileName}
      />
    </div>
  );
}

export default function NuevaEvaluacionPage() {
  return (
    <Suspense fallback={
      <div className="py-12 flex flex-col items-center justify-center">
        <LoadingProgress
          icon={ClipboardList}
          title="Cargando formulario de evaluación..."
          description="Preparando versión activa y listado de colaboradores..."
        />
      </div>
    }>
      <NuevaEvaluacionContent />
    </Suspense>
  );
}
