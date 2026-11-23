import React, { useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Compass,
  GraduationCap,
  HardDrive,
  Microscope,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { ThemeMode, WorkspaceTab } from '../types/histology';
import { PWAInstallButton } from './PWAInstallButton';

interface TopWorkspaceBarProps {
  activeTab: WorkspaceTab;
  onChangeTab: (tab: WorkspaceTab) => void;
  globalSearch: string;
  onChangeGlobalSearch: (q: string) => void;
  onSearchDiscover: (q: string) => void;
  onOpenUpload: () => void;
  onOpenOfflineManager?: () => void;
  offlineCount?: number;
  theme: ThemeMode;
  onToggleTheme: () => void;
  totalSlideCount: number;
}

export const TopWorkspaceBar: React.FC<TopWorkspaceBarProps> = ({
  activeTab,
  onChangeTab,
  globalSearch,
  onChangeGlobalSearch,
  onSearchDiscover,
  onOpenUpload,
  onOpenOfflineManager,
  offlineCount = 0,
  theme,
  onToggleTheme,
  totalSlideCount,
}) => {
  const [localQuery, setLocalQuery] = useState(globalSearch);

  const tabs: Array<{ id: WorkspaceTab; label: string; icon: React.ReactNode }> = [
    {
      id: 'viewer',
      label: `Study Viewer (${totalSlideCount})`,
      icon: <Microscope className="h-3.5 w-3.5" aria-hidden="true" />,
    },
    {
      id: 'audit',
      label: 'Slide Audit',
      icon: <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />,
    },
    {
      id: 'practical',
      label: 'Practical 2.0',
      icon: <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />,
    },
    {
      id: 'performance',
      label: 'Performance',
      icon: <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />,
    },
    {
      id: 'catalog',
      label: 'Catalog',
      icon: <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />,
    },
    {
      id: 'discover',
      label: 'Discover Slides',
      icon: <Compass className="h-3.5 w-3.5" aria-hidden="true" />,
    },
  ];

  const handleGlobalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = localQuery.trim();
    if (!q) return;
    onSearchDiscover(q);
  };

  return (
    <header className="z-30 flex h-13 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 sm:px-4 text-slate-900 dark:border-slate-800 dark:bg-[#0D111A] dark:text-slate-100">
      {/* Zone 1: Brand Wordmark */}
      <button
        type="button"
        onClick={() => onChangeTab('viewer')}
        className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-600 rounded-md"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white dark:bg-blue-500">
          <Microscope className="h-4 w-4" aria-hidden="true" />
        </div>
        <span className="font-semibold tracking-tight text-base text-slate-900 dark:text-slate-50">
          HistoAtlas
        </span>
      </button>

      {/* Zone 2: Primary Workspace Tabs (Desktop / Tablet Landscape) */}
      <nav
        aria-label="Workspace Sections"
        className="hidden lg:flex items-center gap-1 overflow-x-auto no-scrollbar"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Global Quick Search + Offline + Install + Theme + Upload */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <form onSubmit={handleGlobalSubmit} className="relative hidden xl:block w-52">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={localQuery}
            onChange={(e) => {
              setLocalQuery(e.target.value);
              onChangeGlobalSearch(e.target.value);
            }}
            placeholder="Search or Enter to discover..."
            aria-label="Global slide search"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#111622] dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </form>

        <PWAInstallButton compact />

        {onOpenOfflineManager && (
          <button
            type="button"
            onClick={onOpenOfflineManager}
            title="Offline Study Storage Manager"
            aria-label={`Offline study storage (${offlineCount} slides cached)`}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shrink-0"
          >
            <HardDrive className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span className="hidden md:inline font-mono tabular-nums">{offlineCount}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shrink-0"
        >
          {theme === 'dark' ? (
            <Sun className="h-3.5 w-3.5 text-amber-400" />
          ) : (
            <Moon className="h-3.5 w-3.5 text-slate-600" />
          )}
        </button>

        <button
          type="button"
          onClick={onOpenUpload}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 sm:px-3 text-xs font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Upload Slide</span>
        </button>
      </div>
    </header>
  );
};
