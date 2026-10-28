"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Edit, Mail, Phone, MapPin, Building2, Briefcase, Calendar, User } from "lucide-react";
import { toast } from "sonner";
import { getCollaboratorById } from "@/app/actions/collaborators";
import { formatDate, formatDateTime, getStatusLabel, getInitials } from "@/lib/utils";
import { LoadingProgress, useLoadingProgress } from "@/components/ui/loading-progress";

export default function CollaboratorDetailPage() {
  const params = useParams();
  const collaboratorId = params?.id as string;
  const [collaborator, setCollaborator] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoading: showLoading, progress: loadProgress } = useLoadingProgress(isLoading);
  const [isError, setIsError] = useState<string | null>(null);

  useEffect(() => {
    if (!collaboratorId) return;

    async function loadCollaborator() {
      setIsLoading(true);
      const res = await getCollaboratorById(collaboratorId);
      if (res.error) {
        setIsError(res.error);
        toast.error("Error cargando colaborador: " + res.error);
      } else {
        setCollaborator(res.data);
      }
      setIsLoading(false);
    }

    loadCollaborator();
  }, [collaboratorId]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href="/colaboradores" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver a Colaboradores
          </Link>
          <h1 className="text-2xl font-bold mt-4">Detalle del Colaborador</h1>
        </div>
        {collaborator && (
          <Link href={`/colaboradores/${collaborator.id}/editar`} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-accent transition-colors">
            <Edit className="w-4 h-4" /> Editar
          </Link>
        )}
      </div>

      {showLoading ? (
        <LoadingProgress icon={User} title="Cargando ficha del colaborador..." description="Consultando datos personales, cargo y estado laboral..." progress={loadProgress} />
      ) : isError ? (
        <div className="rounded-xl border bg-card p-8 text-center text-danger-600">{isError}</div>
      ) : !collaborator ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Colaborador no encontrado.</div>
      ) : (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="rounded-xl border bg-card p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-full gradient-brand flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
              {getInitials(collaborator.full_name || "--")}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{collaborator.full_name}</h2>
              <p className="text-muted-foreground">
                {collaborator.position?.name || collaborator.positions?.name || (Array.isArray(collaborator.positions) ? collaborator.positions[0]?.name : null) || "Sin cargo asignado"}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  collaborator.status === 'activo' ? 'text-success-600 bg-success-50 border-success-200 dark:bg-success-950/30' :
                  'text-muted-foreground bg-muted border-border'
                }`}>
                  {getStatusLabel(collaborator.status)}
                </span>
              </div>
            </div>
          </div>

          {/* Two Column Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Información Personal */}
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Información Personal
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Tipo de Documento</p>
                  <p className="font-medium">{collaborator.document_type} - {collaborator.document_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Correo Electrónico</p>
                  <p className="font-medium flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" />
                    {collaborator.email || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Teléfono</p>
                  <p className="font-medium flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5" />
                    {collaborator.phone || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Dirección</p>
                  <p className="font-medium flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" />
                    {collaborator.address || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Ciudad</p>
                  <p className="font-medium">{collaborator.city || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Género</p>
                  <p className="font-medium capitalize">{collaborator.gender || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Fecha de Nacimiento</p>
                  <p className="font-medium">{collaborator.birth_date ? formatDate(collaborator.birth_date) : "—"}</p>
                </div>
              </div>
            </div>

            {/* Información Laboral */}
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
                Información Laboral
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Código Interno</p>
                  <p className="font-medium">{collaborator.internal_code || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Cargo</p>
                  <p className="font-medium flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5" />
                    {collaborator.position?.name || collaborator.positions?.name || (Array.isArray(collaborator.positions) ? collaborator.positions[0]?.name : null) || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Área</p>
                  <p className="font-medium flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5" />
                    {collaborator.area?.name || collaborator.areas?.name || (Array.isArray(collaborator.areas) ? collaborator.areas[0]?.name : null) || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Tipo de Contrato</p>
                  <p className="font-medium capitalize">{collaborator.contract_type?.replace('_', ' ') || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Tipo de Nómina</p>
                  <p className="font-medium">{collaborator.payroll_type || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Fecha de Ingreso</p>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    {collaborator.hire_date ? formatDate(collaborator.hire_date) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Sede / Lugar de Trabajo</p>
                  <p className="font-medium">{collaborator.workplace || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Ciudad de Trabajo</p>
                  <p className="font-medium">{collaborator.workplace_city || "—"}</p>
                </div>
              </div>
            </div>
          </div>



          {/* Metadata */}
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="grid gap-3 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Creado:</span>
                <span>{collaborator.created_at ? formatDateTime(collaborator.created_at) : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span>Actualizado:</span>
                <span>{collaborator.updated_at ? formatDateTime(collaborator.updated_at) : "—"}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
