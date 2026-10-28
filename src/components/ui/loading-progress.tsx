"use client";

import React, { useEffect, useState } from "react";
import { Loader2, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Hook que envuelve un booleano `isLoading` para animar el porcentaje de 0% a 100%
 * y mostrar brevemente el 100% antes de revelar el contenido cargado.
 */
export function useLoadingProgress(isLoading: boolean, finishHoldMs = 180) {
  const [visible, setVisible] = useState(isLoading);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isLoading) {
      setVisible(true);
      setProgress(0);

      const kickTimer = setTimeout(() => {
        setProgress(16);
      }, 25);

      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev < 42) return prev + 16;
          if (prev < 74) return prev + 11;
          if (prev < 90) return prev + 5;
          if (prev < 96) return prev + 1;
          return prev;
        });
      }, 85);

      return () => {
        clearTimeout(kickTimer);
        clearInterval(interval);
      };
    } else {
      setProgress(100);
      const hideTimer = setTimeout(() => {
        setVisible(false);
      }, finishHoldMs);
      return () => clearTimeout(hideTimer);
    }
  }, [isLoading, finishHoldMs]);

  return {
    isLoading: isLoading || visible,
    progress,
  };
}

interface LoadingProgressProps {
  title?: string;
  description?: string;
  stepText?: string;
  progress?: number;
  icon?: LucideIcon;
  compact?: boolean;
  className?: string;
}

export function LoadingProgress({
  title = "Cargando información del módulo...",
  description = "Consultando y sincronizando registros en tiempo real...",
  stepText,
  progress: controlledProgress,
  icon: Icon,
  compact = false,
  className,
}: LoadingProgressProps) {
  const [internalProgress, setInternalProgress] = useState(0);

  useEffect(() => {
    if (controlledProgress !== undefined) return;
    setInternalProgress(0);

    const kick = setTimeout(() => setInternalProgress(18), 20);
    const interval = setInterval(() => {
      setInternalProgress((prev) => {
        if (prev < 45) return prev + 18;
        if (prev < 78) return prev + 12;
        if (prev < 94) return prev + 5;
        if (prev < 100) return prev + 2;
        return 100;
      });
    }, 75);

    return () => {
      clearTimeout(kick);
      clearInterval(interval);
    };
  }, [controlledProgress]);

  const currentProgress = Math.min(
    100,
    Math.max(0, Math.round(controlledProgress !== undefined ? controlledProgress : internalProgress))
  );

  const dynamicStepText =
    stepText ||
    (currentProgress < 35
      ? "Consultando base de datos..."
      : currentProgress < 75
      ? "Procesando registros y métricas..."
      : currentProgress < 100
      ? "Sincronizando visualización..."
      : "¡Información lista!");

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card/90 backdrop-blur-xs text-center shadow-xs mx-auto animate-fade-in",
        compact ? "p-5 space-y-3.5 max-w-sm my-3" : "p-8 sm:p-10 space-y-5 max-w-md my-8",
        className
      )}
    >
      {/* Icono corporativo animado */}
      <div className={cn("relative mx-auto flex items-center justify-center", compact ? "w-12 h-12" : "w-16 h-16")}>
        <div className="absolute inset-0 rounded-full bg-[#012169]/15 dark:bg-[#0084d5]/20 animate-ping opacity-60" />
        <div
          className={cn(
            "rounded-2xl bg-gradient-to-tr from-[#012169] to-[#0084d5] text-white flex items-center justify-center shadow-md shadow-[#012169]/20",
            compact ? "w-10 h-10" : "w-14 h-14"
          )}
        >
          {Icon ? (
            <Icon className={cn("animate-pulse", compact ? "w-5 h-5" : "w-7 h-7")} />
          ) : (
            <Loader2 className={cn("animate-spin", compact ? "w-5 h-5" : "w-7 h-7")} />
          )}
        </div>
      </div>

      {/* Textos descriptivos */}
      <div className="space-y-1">
        <h4 className={cn("font-bold text-[#012169] dark:text-white", compact ? "text-xs sm:text-sm" : "text-sm sm:text-base")}>
          {title}
        </h4>
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* Barra de progreso de 0% a 100% */}
      <div className="space-y-2 pt-0.5 max-w-xs mx-auto">
        <div className="flex justify-between items-center text-xs font-semibold px-0.5 gap-2">
          <span className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1.5 truncate">
            <span className="inline-block w-2 h-2 rounded-full bg-[#0084d5] animate-pulse flex-shrink-0" />
            <span className="truncate">{dynamicStepText}</span>
          </span>
          <span className="font-mono font-extrabold text-[#012169] dark:text-[#38bdf8] text-sm tabular-nums bg-[#012169]/5 dark:bg-[#0084d5]/15 px-2 py-0.5 rounded-md border border-[#012169]/15 dark:border-[#0084d5]/30 flex-shrink-0">
            {currentProgress}%
          </span>
        </div>

        <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
          <div
            className="h-full bg-gradient-to-r from-[#012169] via-[#0084d5] to-[#38bdf8] rounded-full transition-all duration-150 ease-out relative overflow-hidden"
            style={{ width: `${currentProgress}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.5s_infinite]" />
          </div>
        </div>
      </div>
    </div>
  );
}
