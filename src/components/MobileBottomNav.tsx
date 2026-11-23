import React from 'react';
import {
  BarChart3,
  BookOpen,
  Compass,
  GraduationCap,
  HardDrive,
  Home,
  Library,
  Menu,
  Moon,
  Plus,
  ShieldCheck,
  Star,
  Sun,
  X,
} from 'lucide-react';
import { ThemeMode, WorkspaceTab } from '../types/histology';
import { PWAInstallButton } from './PWAInstallButton';

export type MobileNavTab = 'home' | 'library' | 'practical' | 'favorites';

interface MobileBottomNavProps {
  activeNav: MobileNavTab;
  isMoreOpen: boolean;
  onSelectNav: (nav: MobileNavTab) => void;
  onToggleMore: (open: boolean) => void;
  onNavigateWorkspace: (tab: WorkspaceTab) => void;
  onOpenOfflineManager: () => void;
  onOpenUpload: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  offlineCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeNav,
  isMoreOpen,
  onSelectNav,
  onToggleMore,
  onNavigateWorkspace,
  onOpenOfflineManager,
  onOpenUpload,
  theme,
  onToggleTheme,
  offlineCount,
}) => {
  const navItems: Array<{ id: MobileNavTab; label: string; icon: React.ReactNode }> = [
    { id: 'home', label: 'Home', icon: <Home className="h-5 w-5" aria-hidden="true" /> },
    { id: 'library', label: 'Library', icon: <Library className="h-5 w-5" aria-hidden="true" /> },
    {
      id: 'practical',
      label: 'Practical',
      icon: <GraduationCap className="h-5 w-5" aria-hidden="true" />,
    },
    { id: 'favorites', label: 'Favorites', icon: <Star className="h-5 w-5" aria-hidden="true" /> },
  ];

  return (
    <>
      {/* Slide-Up More Drawer */}
      {isMoreOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/55"
            onClick={() => onToggleMore(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More study tools"
            className="relative z-10 rounded-t-2xl border-t border-slate-200 bg-white px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl dark:border-slate-800 dark:bg-[#111622]"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                HistoAtlas Tools & Modules
              </span>
              <button
                type="button"
                onClick={() => onToggleMore(false)}
                aria-label="Close more menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onToggleMore(false);
                  onNavigateWorkspace('catalog');
                }}
                className="flex min-h-[48px] items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-xs font-semibold text-slate-800 dark:border-slate-800 dark:bg-[#0B0F17] dark:text-slate-100"
              >
                <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>Catalog</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onToggleMore(false);
                  onNavigateWorkspace('discover');
                }}
                className="flex min-h-[48px] items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-xs font-semibold text-slate-800 dark:border-slate-800 dark:bg-[#0B0F17] dark:text-slate-100"
              >
                <Compass className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>Discover Slides</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onToggleMore(false);
                  onNavigateWorkspace('audit');
                }}
                className="flex min-h-[48px] items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-xs font-semibold text-slate-800 dark:border-slate-800 dark:bg-[#0B0F17] dark:text-slate-100"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Slide Audit</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onToggleMore(false);
                  onNavigateWorkspace('performance');
                }}
                className="flex min-h-[48px] items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-xs font-semibold text-slate-800 dark:border-slate-800 dark:bg-[#0B0F17] dark:text-slate-100"
              >
                <BarChart3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span>Performance</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onToggleMore(false);
                  onOpenOfflineManager();
                }}
                className="flex min-h-[48px] items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-xs font-semibold text-slate-800 dark:border-slate-800 dark:bg-[#0B0F17] dark:text-slate-100"
              >
                <HardDrive className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>Offline ({offlineCount})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onToggleMore(false);
                  onOpenUpload();
                }}
                className="flex min-h-[48px] items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-xs font-semibold text-slate-800 dark:border-slate-800 dark:bg-[#0B0F17] dark:text-slate-100"
              >
                <Plus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>Upload Slide</span>
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={onToggleTheme}
                className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 dark:border-slate-800 dark:bg-[#0B0F17] dark:text-slate-100"
              >
                <span className="flex items-center gap-2.5">
                  {theme === 'dark' ? (
                    <Sun className="h-4 w-4 text-amber-400" />
                  ) : (
                    <Moon className="h-4 w-4 text-slate-600" />
                  )}
                  <span>{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
                </span>
              </button>

              <PWAInstallButton fullWidth />
            </div>
          </div>
        </div>
      )}

      {/* Fixed Touch Bottom Nav Bar */}
      <nav
        aria-label="Mobile navigation"
        className="z-30 shrink-0 border-t border-slate-200 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-[#0D111A]/95 lg:hidden"
      >
        <div className="grid grid-cols-5">
          {navItems.map((item) => {
            const active = activeNav === item.id && !isMoreOpen;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onToggleMore(false);
                  onSelectNav(item.id);
                }}
                className={`flex min-h-[54px] flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => onToggleMore(!isMoreOpen)}
            aria-expanded={isMoreOpen}
            className={`flex min-h-[54px] flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
              isMoreOpen
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  );
};
