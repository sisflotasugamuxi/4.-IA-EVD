"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Search, Menu, LogOut, User, Settings, ChevronDown, Building2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { logoutAction } from "@/app/actions/auth";

interface TopbarProps {
  collapsed: boolean;
  onMenuToggle: () => void;
  title?: string;
}

const defaultUser = {
  name: "Admin Sistema",
  role: "Administrador",
  email: "admin@flotasugamuxi.com.co",
  initials: "AS",
};

export function Topbar({ collapsed, onMenuToggle, title }: TopbarProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    role: string;
    roleName: string;
    email: string;
    initials: string;
  } | null>(null);

  const pathname = usePathname();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getPageTitle = (path: string) => {
    if (title) return title;

    if (path === "/dashboard") return "Dashboard Ejecutivo";
    if (path === "/colaboradores/nuevo") return "Nuevo Colaborador";
    if (path === "/colaboradores") return "Listado de Colaboradores";
    if (path.startsWith("/colaboradores/") && path.endsWith("/editar")) return "Editar Colaborador";
    if (path.startsWith("/colaboradores/")) return "Detalle de Colaborador";
    
    if (path === "/evaluaciones/nueva") return "Nueva Evaluación";
    if (path === "/evaluaciones/firmas-pendientes") return "Firmas Pendientes";
    if (path === "/evaluaciones") return "Listado de Evaluaciones";
    if (path.startsWith("/evaluaciones/") && path.endsWith("/editar")) return "Editar Evaluación";
    if (path.startsWith("/evaluaciones/")) return "Detalle de Evaluación";

    if (path === "/reportes") return "Reportes y Estadísticas";
    if (path === "/perfil") return "Mi Perfil de Usuario";
    
    if (path === "/configuracion/categorias") return "Configuración de Categorías";
    if (path === "/configuracion/preguntas") return "Configuración de Preguntas";
    if (path === "/configuracion/versiones") return "Versiones de Evaluaciones";
    if (path === "/configuracion/campos") return "Campos de Colaborador";
    if (path === "/configuracion/empresa") return "Configuración de Empresa";
    
    if (path === "/administracion/usuarios") return "Administración de Usuarios";
    if (path === "/administracion/roles") return "Administración de Roles";
    if (path === "/administracion/asignaciones") return "Asignación y Planificación de Evaluaciones";
    if (path === "/administracion/areas") return "Administración de Áreas";
    if (path === "/administracion/cargos") return "Administración de Cargos";
    if (path === "/administracion/importar") return "Importar Datos del Sistema";
    if (path === "/auditoria") return "Registro de Auditoría";

    return "Sistema EVD";
  };

  const displayTitle = getPageTitle(pathname);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Array<{
      x: number;
      y: number;
      radius: number;
      speed: number;
      opacity: number;
    }> = [];

    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = 56;
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      const count = Math.floor((canvas.width * canvas.height) / 8000);
      for (let i = 0; i < Math.min(count, 30); i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height + canvas.height,
          radius: Math.random() * 1.5 + 0.6,
          speed: Math.random() * 0.1 + 0.02,
          opacity: Math.random() * 0.4 + 0.15,
        });
      }
    };

    const initParticlesFull = () => {
      particles = [];
      const count = Math.floor((canvas.width * canvas.height) / 8000);
      for (let i = 0; i < Math.min(count, 30); i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 1.5 + 0.6,
          speed: Math.random() * 0.1 + 0.02,
          opacity: Math.random() * 0.4 + 0.15,
        });
      }
    };

    window.addEventListener("resize", resizeCanvas);
    canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
    canvas.height = 56;
    initParticlesFull();

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        ctx.fill();

        p.y -= p.speed;

        if (p.y < 0) {
          p.y = canvas.height;
          p.x = Math.random() * canvas.width;
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [collapsed]);

  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name, email, role_id, roles(display_name, name)")
            .eq("id", authUser.id)
            .single();

          if (profile) {
            const ROLE_MAP: Record<string, { name: string; display_name: string }> = {
              "22222222-0000-0000-0000-000000000001": { name: "admin", display_name: "Administrador" },
              "22222222-0000-0000-0000-000000000002": { name: "rrhh", display_name: "Gestión Humana" },
              "22222222-0000-0000-0000-000000000003": { name: "gerencia", display_name: "Gerencia" },
              "22222222-0000-0000-0000-000000000004": { name: "lider", display_name: "Líder / Jefe" },
              "22222222-0000-0000-0000-000000000005": { name: "colaborador", display_name: "Colaborador" }
            };

            const roleInfo = profile.role_id ? ROLE_MAP[profile.role_id] : null;
            const roleDisplayName = roleInfo?.display_name || (profile.roles as any)?.display_name || (profile.roles as any)?.name || "Colaborador";
            const roleName = roleInfo?.name || (profile.roles as any)?.name || "colaborador";
            const name = profile.first_name && profile.last_name 
              ? `${profile.first_name} ${profile.last_name}`
              : profile.first_name || profile.last_name || authUser.email?.split("@")[0] || "Usuario";
            const initials = name
              .split(" ")
              .filter(Boolean)
              .map((n: string) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            setCurrentUser({
              name,
              role: roleDisplayName,
              roleName,
              email: profile.email || authUser.email || "",
              initials: initials || "US",
            });
          } else {
            const name = authUser.email?.split("@")[0] || "Usuario";
            setCurrentUser({
              name,
              role: "Usuario",
              roleName: "colaborador",
              email: authUser.email || "",
              initials: name.slice(0, 2).toUpperCase() || "US",
            });
          }
        }
      } catch (err) {
        console.error("Error loading user in topbar:", err);
      }
    }
    loadUser();
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 right-0 left-0 z-40 h-14 px-4 md:pr-6 flex items-center gap-4 border-b bg-gradient-to-r from-[#012169] to-[#000a22] transition-all duration-300 ease-in-out text-white border-[#012169]/30",
        collapsed ? "md:pl-[96px]" : "md:pl-[284px]"
      )}
    >
      {/* Particle Background - contained to avoid clipping absolute child components */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <canvas ref={canvasRef} className="w-full h-full opacity-45" />
      </div>
      
      {/* Menu Toggle */}
      <button
        onClick={onMenuToggle}
        className={cn(
          "p-2 rounded-lg hover:bg-slate-800/40 transition-colors cursor-pointer text-slate-200 hover:text-white z-10",
          collapsed ? "flex" : "md:hidden flex"
        )}
        title={collapsed ? "Expandir menú" : "Colapsar menú"}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Page Title & Subtitle */}
      <div className="hidden md:flex flex-col justify-center leading-tight z-10">
        <h1 className="text-sm md:text-base font-bold text-white">{displayTitle}</h1>
        <p className="text-[9px] text-slate-300 font-semibold uppercase tracking-wider mt-0.5">
          EVD — Sistema de Evaluación de Desempeño
        </p>
      </div>

      <div className="ml-auto flex items-center gap-2 z-10">
        {/* Search Icon Button */}
        <button className="p-2 rounded-xl hover:bg-slate-800/40 transition-colors cursor-pointer text-slate-200 hover:text-white">
          <Search className="w-5 h-5" />
        </button>

        {/* Notifications */}
        <button className="relative p-2 rounded-xl hover:bg-slate-800/40 transition-colors cursor-pointer text-slate-200 hover:text-white">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500" />
        </button>

        {/* User Dropdown */}
        <div className="relative pl-2 border-l border-[#012169]/30 flex items-center">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity focus:outline-none cursor-pointer"
          >
            <div className="hidden md:block text-right select-none leading-tight">
              <p className="text-xs font-bold text-white">
                {currentUser?.name || defaultUser.name}
              </p>
              <p className="text-[10px] text-slate-300 font-semibold tracking-wide">
                {currentUser?.role || defaultUser.role}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-brand-600 to-brand-400 flex items-center justify-center text-white text-xs font-bold shadow-md">
              {currentUser?.initials || defaultUser.initials}
            </div>
            <ChevronDown className="w-4 h-4 text-slate-200 hidden md:block" />
          </button>

          {/* Click outside overlay */}
          {showDropdown && (
            <div
              className="fixed inset-0 z-45 cursor-default"
              onClick={() => setShowDropdown(false)}
            />
          )}

          {/* Dropdown Menu */}
          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute right-0 top-full mt-2 w-56 rounded-xl border bg-[#011133] border-[#012169]/40 text-white shadow-xl z-50 overflow-hidden"
              >
                {/* Header */}
                <div className="p-3 border-b border-[#012169]/20 select-none">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Sesión iniciada como</p>
                  <p className="text-xs font-bold text-white truncate mt-0.5">
                    {currentUser?.name || defaultUser.name}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {currentUser?.email || defaultUser.email}
                  </p>
                </div>

                {/* Items */}
                <div className="p-1.5 space-y-0.5">
                  <Link
                    href="/perfil"
                    onClick={() => setShowDropdown(false)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800/40 hover:text-white transition-colors"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    <span>Mi Perfil</span>
                  </Link>
                  {currentUser?.roleName !== "lider" && currentUser?.roleName !== "colaborador" && (
                    <>
                      <Link
                        href="/configuracion/empresa"
                        onClick={() => setShowDropdown(false)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800/40 hover:text-white transition-colors"
                      >
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span>Empresa</span>
                      </Link>
                      <Link
                        href="/configuracion/preguntas"
                        onClick={() => setShowDropdown(false)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800/40 hover:text-white transition-colors"
                      >
                        <Settings className="w-4 h-4 text-slate-400" />
                        <span>Configuración</span>
                      </Link>
                    </>
                  )}
                </div>

                {/* Logout Button */}
                <div className="p-1.5 border-t border-[#012169]/20 bg-slate-950/20">
                  <button
                    onClick={async () => {
                      setShowDropdown(false);
                      await logoutAction();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-950/20 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
