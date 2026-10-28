"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, ClipboardList, Settings, TrendingUp,
  FileBarChart2, Shield, ChevronLeft, ChevronRight,
  Building2, BookOpen, LogOut, ChevronDown, ChevronUp, User,
  Sun, Moon, Plus, List, UserPlus, ClipboardPlus, UsersRound, ClipboardCheck, PenTool, UserCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { logoutAction } from "@/app/actions/auth";

interface NavItem {
  title: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  children?: NavItem[];
}

interface NavGroup {
  groupTitle: string;
  items: NavItem[];
}

// Definición de grupos y elementos de navegación del menú lateral con sus respectivos iconos
const navGroups: NavGroup[] = [
  {
    groupTitle: "Menú Principal",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        title: "Colaboradores",
        icon: Users,
        children: [
          { title: "Nuevo Colaborador", href: "/colaboradores/nuevo", icon: UserPlus },
          { title: "Listado Colaboradores", href: "/colaboradores", icon: UsersRound },
        ],
      },
      {
        title: "Evaluaciones",
        icon: ClipboardList,
        children: [
          { title: "Nueva Evaluación", href: "/evaluaciones/nueva", icon: ClipboardPlus },
          { title: "Resultados Evaluaciones", href: "/evaluaciones", icon: ClipboardCheck },
          { title: "Firmas Pendientes", href: "/evaluaciones/firmas-pendientes", icon: PenTool },
        ],
      },
      {
        title: "Reportes",
        href: "/reportes",
        icon: FileBarChart2,
      },
    ]
  },
  {
    groupTitle: "Administración & Configuración",
    items: [
      {
        title: "Mi Perfil",
        href: "/perfil",
        icon: User,
      },
      {
        title: "Configuración",
        icon: Settings,
        children: [
          { title: "Categorías", href: "/configuracion/categorias", icon: Settings },
          { title: "Preguntas", href: "/configuracion/preguntas", icon: Settings },
          { title: "Versiones", href: "/configuracion/versiones", icon: Settings },
          { title: "Campos Colaborador", href: "/configuracion/campos", icon: Settings },
          { title: "Empresa", href: "/configuracion/empresa", icon: Building2 },
        ],
      },
      {
        title: "Administración",
        icon: Building2,
        children: [
          { title: "Usuarios", href: "/administracion/usuarios", icon: Users },
          { title: "Roles", href: "/administracion/roles", icon: Shield },
          { title: "Asignación Evaluaciones", href: "/administracion/asignaciones", icon: UserCheck },
          { title: "Áreas", href: "/administracion/areas", icon: Building2 },
          { title: "Cargos", href: "/administracion/cargos", icon: BookOpen },
          { title: "Importar Datos", href: "/administracion/importar", icon: FileBarChart2 },
        ],
      },
      {
        title: "Auditoría",
        href: "/auditoria",
        icon: Shield,
      },
    ]
  }
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onItemClick?: () => void;
  userRole?: string;
  userPermissions?: Record<string, {
    can_view: boolean;
    can_create?: boolean;
    can_edit?: boolean;
    can_delete?: boolean;
    can_export?: boolean;
    can_approve?: boolean;
  }>;
}

const ITEM_MODULE_MAP: Record<string, string> = {
  "Dashboard": "dashboard",
  "Colaboradores": "colaboradores",
  "Evaluaciones": "evaluaciones",
  "Reportes": "reportes",
  "Configuración": "configuracion",
  "Administración": "administracion",
  "Auditoría": "auditoria",
};

export function Sidebar({ collapsed, onToggle, onItemClick, userRole, userPermissions }: SidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Evaluaciones: true,
    Colaboradores: true,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleItemClick = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      onItemClick?.();
    }
  };

  // Filtrar dinámicamente navGroups basado en el rol y los permisos de la BD
  const filteredNavGroups = navGroups.map(group => {
    const processedItems = group.items.map(item => {
      if (userRole === "lider" && item.title === "Administración") {
        return {
          ...item,
          children: item.children
            ?.filter(child => child.title === "Usuarios")
            .map(child => ({ ...child, href: "/perfil" }))
        };
      }
      return item;
    });

    const filteredItems = processedItems.filter(item => {
      // Si es 'Mi Perfil', siempre es visible
      if (item.title === "Mi Perfil") return true;

      // El superadministrador ve todo
      if (userRole === "admin") return true;

      const modName = ITEM_MODULE_MAP[item.title];

      // Verificación dinámica mediante la matriz de permisos de la BD
      if (modName && userPermissions && userPermissions[modName]) {
        // Si no tiene permiso de ver (can_view = false), ocultar del menú
        if (userPermissions[modName].can_view === false) {
          return false;
        }
      }

      // Reglas de compatibilidad históricas si aún no hay permisos en BD
      if (userRole === "lider") {
        if (item.title === "Configuración" || item.title === "Auditoría") {
          return false;
        }
      }

      if (userRole === "colaborador") {
        if (
          item.title === "Configuración" ||
          item.title === "Administración" ||
          item.title === "Auditoría" ||
          item.title === "Evaluaciones" ||
          item.title === "Colaboradores"
        ) {
          return false;
        }
      }

      return true;
    }).map(item => {
      // Filtrar sub-elementos según permisos de creación
      if (item.children && userPermissions && userRole !== "admin") {
        const modName = ITEM_MODULE_MAP[item.title];
        const perm = modName ? userPermissions[modName] : null;

        if (perm) {
          let updatedChildren = [...item.children];
          if (perm.can_create === false) {
            updatedChildren = updatedChildren.filter(c => 
              c.title !== "Nuevo Colaborador" && c.title !== "Nueva Evaluación"
            );
          }
          return { ...item, children: updatedChildren };
        }
      }
      return item;
    });

    return { ...group, items: filteredItems };
  }).filter(group => group.items.length > 0);

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
      canvas.width = canvas.parentElement?.clientWidth || 260;
      canvas.height = window.innerHeight;
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      const count = Math.floor((canvas.width * canvas.height) / 8000);
      for (let i = 0; i < Math.min(count, 40); i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height + canvas.height,
          radius: Math.random() * 1.8 + 0.6,
          speed: Math.random() * 0.2 + 0.05,
          opacity: Math.random() * 0.5 + 0.15,
        });
      }
    };

    const initParticlesFull = () => {
      particles = [];
      const count = Math.floor((canvas.width * canvas.height) / 8000);
      for (let i = 0; i < Math.min(count, 40); i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 1.8 + 0.6,
          speed: Math.random() * 0.2 + 0.05,
          opacity: Math.random() * 0.5 + 0.15,
        });
      }
    };

    window.addEventListener("resize", resizeCanvas);
    canvas.width = canvas.parentElement?.clientWidth || 260;
    canvas.height = window.innerHeight;
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

  const toggleGroup = (title: string) => {
    if (collapsed) {
      onToggle();
      setOpenGroups((prev) => ({ ...prev, [title]: true }));
    } else {
      setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }));
    }
  };

  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/evaluaciones") {
      return (
        pathname === "/evaluaciones" ||
        (pathname.startsWith("/evaluaciones/") &&
          pathname !== "/evaluaciones/nueva" &&
          !pathname.startsWith("/evaluaciones/firmas-pendientes"))
      );
    }
    if (href === "/colaboradores") {
      return pathname === "/colaboradores" || (pathname.startsWith("/colaboradores/") && pathname !== "/colaboradores/nuevo");
    }
    return pathname.startsWith(href);
  };

  const isGroupActive = (item: NavItem) => {
    if (item.href) return isActive(item.href);
    return item.children?.some((child) => isActive(child.href)) ?? false;
  };

  return (
    <motion.aside
      initial={false}
      animate={{ 
        width: collapsed ? 72 : 260,
        x: 0
      }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "fixed left-0 top-0 h-screen z-50 flex flex-col overflow-hidden border-r",
        "transition-transform md:translate-x-0 bg-gradient-to-b from-[#012169] via-[#001647] to-[#000a22] border-[#012169]/30",
        collapsed ? "-translate-x-full md:translate-x-0" : "translate-x-0"
      )}
    >
      {/* Particle Background */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none opacity-55" />

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-[#012169]/30 min-h-[72px]">
        {/* Logo Icon */}
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center overflow-hidden border border-slate-100 shadow-md">
            <img src="/logo.png" alt="Logo Flota Sugamuxi" className="w-full h-full object-contain p-0.5" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success-500 border-2 border-[#011133]" />
        </div>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <p className="text-sm font-bold text-white leading-tight">Flota Sugamuxi</p>
              <p className="text-[10px] text-slate-400 font-semibold tracking-wide">EVD · Gestión Humana</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5 sidebar-scrollbar">
        {filteredNavGroups.map((group, groupIdx) => (
          <div key={group.groupTitle} className="space-y-1">
            {/* Divider / Group Title */}
            {collapsed ? (
              groupIdx > 0 && <div className="my-2 border-t border-[#012169]/20" />
            ) : (
              <div className="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider select-none">
                {group.groupTitle}
              </div>
            )}

            <div className="space-y-0.5">
              {group.items.map((item) => {
                if (item.children) {
                  const isOpen = openGroups[item.title] ?? isGroupActive(item);
                  const active = isGroupActive(item);

                  return (
                    <div key={item.title}>
                      <button
                        onClick={() => toggleGroup(item.title)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all w-full cursor-pointer",
                          active && !collapsed
                            ? "text-white bg-[#012169]/40"
                            : "text-slate-200 hover:bg-white/10 hover:text-white"
                        )}
                        title={collapsed ? item.title : undefined}
                      >
                        <item.icon className={cn("w-5 h-5 flex-shrink-0 transition-colors", active ? "text-brand-400" : "text-slate-200")} />
                        <AnimatePresence>
                          {!collapsed && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex items-center justify-between flex-1 overflow-hidden"
                            >
                              <span className="truncate">{item.title}</span>
                              {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </button>

                      <AnimatePresence>
                        {isOpen && !collapsed && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="pl-4 py-0.5 space-y-0.5">
                              {item.children.map((child) => (
                                <Link
                                  key={child.href}
                                  href={child.href!}
                                  onClick={handleItemClick}
                                    className={cn(
                                      "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all w-full pl-9",
                                      isActive(child.href)
                                        ? "text-brand-300 font-bold bg-brand-500/10"
                                        : "text-slate-300 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                  {child.icon ? (
                                    <child.icon className={cn(
                                      "w-3.5 h-3.5 flex-shrink-0 transition-colors",
                                      isActive(child.href) ? "text-brand-400" : "text-slate-400"
                                    )} />
                                  ) : (
                                    <div className={cn(
                                      "w-2 h-2 rounded-full flex-shrink-0 transition-colors",
                                      isActive(child.href) ? "bg-brand-400" : "bg-white/40"
                                    )} />
                                  )}
                                  <span className="truncate">{child.title}</span>
                                </Link>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href!}
                    onClick={handleItemClick}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all w-full relative",
                      isActive(item.href)
                        ? "bg-gradient-to-r from-brand-600 to-brand-400 text-white font-semibold shadow-lg shadow-brand-500/10"
                        : "text-slate-200 hover:bg-white/10 hover:text-white"
                    )}
                    title={collapsed ? item.title : undefined}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />

                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="truncate flex-1"
                        >
                          {item.title}
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {item.badge !== undefined && item.badge > 0 && (
                      <motion.span
                        className={cn(
                          "rounded-full text-[10px] font-bold",
                          collapsed
                            ? "absolute top-1 right-1 w-4 h-4 flex items-center justify-center bg-brand-500 text-white"
                            : "ml-auto min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-brand-500 text-white text-xs"
                        )}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 400 }}
                      >
                        {item.badge}
                      </motion.span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-[#012169]/30 p-4 pb-5 space-y-1.5 z-10">
        {/* Collapse Toggle */}
        <button
          onClick={onToggle}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-slate-200 hover:bg-white/10 hover:text-white w-full transition-all cursor-pointer",
            collapsed ? "justify-center" : "justify-start"
          )}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5 flex-shrink-0" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm truncate">Colapsar</span>
            </>
          )}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-slate-200 hover:bg-white/10 hover:text-white w-full transition-all cursor-pointer",
            collapsed ? "justify-center" : "justify-start"
          )}
          title={collapsed ? "Cambiar tema" : undefined}
        >
          {theme === "dark" ? (
            <Sun className="w-5 h-5 flex-shrink-0" />
          ) : (
            <Moon className="w-5 h-5 flex-shrink-0" />
          )}
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm truncate"
              >
                {theme === "dark" ? "Modo claro" : "Modo oscuro"}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Logout */}
        <button
          onClick={async () => {
            await logoutAction();
          }}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/10 hover:text-red-400 w-full transition-all cursor-pointer",
            collapsed ? "justify-center" : "justify-start"
          )}
          title={collapsed ? "Cerrar sesión" : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm truncate"
              >
                Cerrar sesión
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}
