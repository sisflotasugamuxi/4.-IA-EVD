"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Settings2, Eye, EyeOff, Lock, Unlock, Save,
  AlertCircle, CheckCircle2, RefreshCw, LayoutGrid, HelpCircle
} from "lucide-react";
import { toast } from "sonner";
import { getCollaboratorFieldsConfig, updateCollaboratorFieldConfig } from "@/app/actions/fields";
import { LoadingProgress, useLoadingProgress } from "@/components/ui/loading-progress";

export default function ParametrizacionCamposPage() {
  const [fields, setFields] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoading: showLoading, progress: loadProgress } = useLoadingProgress(isLoading);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [savingFieldId, setSavingFieldId] = useState<string | null>(null);

  // Estados locales para los campos editables
  const [editLabels, setEditLabels] = useState<Record<string, string>>({});
  const [editTypes, setEditTypes] = useState<Record<string, string>>({});

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const res = await getCollaboratorFieldsConfig();
      setFields(res.data || []);
      setIsDbConnected(res.fromDb);

      // Rellenar estados locales de edición
      const labels: Record<string, string> = {};
      const types: Record<string, string> = {};
      res.data?.forEach((field: any) => {
        labels[field.id] = field.label;
        types[field.id] = field.field_type;
      });
      setEditLabels(labels);
      setEditTypes(types);
    } catch (err) {
      toast.error("Error al cargar la configuración.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleToggleRequired = async (field: any) => {
    if (field.is_system) {
      toast.error("Este campo es requerido por el sistema y no puede ser opcional.");
      return;
    }
    const nextVal = !field.is_required;
    const res = await updateCollaboratorFieldConfig(field.id, { is_required: nextVal });
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(`Campo '${field.label}' ${nextVal ? "ahora es obligatorio" : "ahora es opcional"}`);
      loadConfig();
    }
  };

  const handleToggleVisible = async (field: any) => {
    if (field.is_system) {
      toast.error("Este campo es obligatorio por el sistema y no puede ocultarse.");
      return;
    }
    const nextVal = !field.is_visible;
    const res = await updateCollaboratorFieldConfig(field.id, { is_visible: nextVal });
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(`Campo '${field.label}' ${nextVal ? "ahora está visible" : "ahora está oculto"}`);
      loadConfig();
    }
  };

  const handleSaveChanges = async (fieldId: string) => {
    setSavingFieldId(fieldId);
    try {
      const label = editLabels[fieldId];
      const field_type = editTypes[fieldId];
      const res = await updateCollaboratorFieldConfig(fieldId, { label, field_type });
      
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Campo actualizado exitosamente.");
        loadConfig();
      }
    } catch (err) {
      toast.error("Error al guardar cambios.");
    } finally {
      setSavingFieldId(null);
    }
  };

  // Agrupar los campos por número de paso (step_number)
  const steps = [
    { num: 1, title: "Paso 1: Información Personal", desc: "Datos de identificación del colaborador" },
    { num: 2, title: "Paso 2: Información Laboral", desc: "Datos del cargo, sede, contrato e ingreso" },
    { num: 3, title: "Paso 3: Jerarquía / Estructura", desc: "Definición del jefe inmediato en la empresa" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in p-2 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Parametrización de Campos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configura el nombre visible, tipo de dato y validación de los campos en el formulario de Nuevo Colaborador.
          </p>
        </div>
        <button
          onClick={loadConfig}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border bg-card hover:bg-accent hover:text-accent-foreground transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Recargar
        </button>
      </div>

      {/* DB Status alert */}
      {!isDbConnected && !isLoading && (
        <div className="p-4 rounded-2xl border border-warning-200 bg-warning-50 dark:bg-warning-950/20 text-warning-800 dark:text-warning-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Modo de Fallback de Sistema Activo</p>
            <p className="text-xs leading-relaxed max-w-3xl">
              La tabla de base de datos <code className="bg-warning-100/50 dark:bg-warning-900/50 px-1 py-0.5 rounded font-mono">collaborator_fields_config</code> no ha sido creada o está vacía en Supabase.
              Actualmente estás previsualizando la parametrización predeterminada. Para poder guardar cambios de forma persistente, por favor ejecute el script SQL de migración
              <code className="bg-warning-100/50 dark:bg-warning-900/50 px-1 py-0.5 rounded font-mono">007_create_collaborator_fields_config.sql</code> en el editor SQL de Supabase.
            </p>
          </div>
        </div>
      )}

      {isDbConnected && (
        <div className="p-4 rounded-2xl border border-success-200 bg-success-50 dark:bg-success-950/20 text-success-800 dark:text-success-300 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">Persistencia Activa</p>
            <p className="text-xs">Los cambios se guardan directamente en la base de datos de Supabase y afectarán de inmediato el formulario de registro.</p>
          </div>
        </div>
      )}

      {showLoading ? (
        <LoadingProgress
          icon={Settings2}
          title="Cargando configuración de campos..."
          description="Consultando parametrización del formulario de colaboradores..."
          progress={loadProgress}
        />
      ) : (
        <div className="space-y-8">
          {steps.map((step) => {
            const stepFields = fields.filter((f) => f.step_number === step.num);
            return (
              <div key={step.num} className="space-y-3">
                <div className="border-b pb-2">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <LayoutGrid className="w-5 h-5 text-brand-500" />
                    {step.title}
                  </h2>
                  <p className="text-xs text-muted-foreground">{step.desc}</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {stepFields.map((field) => {
                    const isSaving = savingFieldId === field.id;
                    const isFieldSystem = field.is_system;

                    return (
                      <div
                        key={field.id}
                        className={`p-4 rounded-2xl border bg-card shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          !field.is_visible ? "opacity-65 border-dashed bg-muted/10" : ""
                        }`}
                      >
                        {/* Column 1: Config Label & ID */}
                        <div className="space-y-1.5 flex-1 min-w-[200px]">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded-md">
                              {field.id}
                            </span>
                            {isFieldSystem && (
                              <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 dark:bg-brand-950/40 px-1.5 py-0.5 rounded">
                                <Lock className="w-2.5 h-2.5" /> Requerido por Sistema
                              </span>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground">Nombre del Campo (UI)</label>
                            <input
                              type="text"
                              value={editLabels[field.id] || ""}
                              onChange={(e) =>
                                setEditLabels((prev) => ({ ...prev, [field.id]: e.target.value }))
                              }
                              className="w-full h-9 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                        </div>

                        {/* Column 2: Field Type Select */}
                        <div className="space-y-1 w-full md:w-44">
                          <label className="text-xs font-semibold text-muted-foreground">Tipo de Campo</label>
                          <select
                            value={editTypes[field.id] || "text"}
                            onChange={(e) =>
                              setEditTypes((prev) => ({ ...prev, [field.id]: e.target.value }))
                            }
                            className="w-full h-9 rounded-xl border bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            <option value="text">Texto</option>
                            <option value="email">Correo</option>
                            <option value="date">Fecha</option>
                            <option value="select">Selección (Dropdown)</option>
                          </select>
                        </div>

                        {/* Column 3: Toggles & Status */}
                        <div className="flex items-center gap-6 mt-2 md:mt-0">
                          {/* Visibility Toggle */}
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Visibilidad</span>
                            <button
                              onClick={() => handleToggleVisible(field)}
                              disabled={isFieldSystem}
                              className={`p-2 rounded-xl border transition-all ${
                                field.is_visible
                                  ? "bg-brand-50 border-brand-200 text-brand-600 hover:bg-brand-100"
                                  : "bg-muted border-border text-muted-foreground hover:bg-accent"
                              } disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
                              title={field.is_visible ? "Visible en formulario" : "Oculto en formulario"}
                            >
                              {field.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                          </div>

                          {/* Obligatoriness Toggle */}
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Obligatorio</span>
                            <button
                              onClick={() => handleToggleRequired(field)}
                              disabled={isFieldSystem}
                              className={`p-2 rounded-xl border transition-all ${
                                field.is_required
                                  ? "bg-danger-50 border-danger-200 text-danger-600 hover:bg-danger-100"
                                  : "bg-muted border-border text-muted-foreground hover:bg-accent"
                              } disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
                              title={field.is_required ? "Es campo obligatorio" : "Es campo opcional"}
                            >
                              {field.is_required ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Column 4: Actions (Save changes) */}
                        <div className="flex items-end justify-end mt-2 md:mt-0">
                          <button
                            onClick={() => handleSaveChanges(field.id)}
                            disabled={isSaving || !isDbConnected}
                            className="flex items-center justify-center gap-2 h-9 px-4 rounded-xl gradient-brand text-white text-xs font-bold shadow hover:opacity-90 disabled:opacity-50 cursor-pointer w-full md:w-auto"
                          >
                            {isSaving ? (
                              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Save className="w-3.5 h-3.5" />
                            )}
                            Guardar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
