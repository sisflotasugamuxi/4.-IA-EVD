import { LoadingProgress } from "@/components/ui/loading-progress";

export default function DashboardLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <LoadingProgress
        title="Cargando módulo del sistema..."
        description="Preparando la interfaz y sincronizando información..."
      />
    </div>
  );
}
