import React, { useMemo, useState } from 'react';
import { BookOpen, Compass, Microscope, Search } from 'lucide-react';
import { HISTOLOGY_CATALOG, SYSTEM_SECTIONS } from '../data/histologyCatalog';
import { AnatomicalSystem, CatalogTopic, Slide } from '../types/histology';

interface CatalogBrowserProps {
  slides: Slide[];
  onDiscoverTopic: (query: string, system?: AnatomicalSystem) => void;
  onOpenMatchingSlide: (slideId: string) => void;
}

export const CatalogBrowser: React.FC<CatalogBrowserProps> = ({
  slides,
  onDiscoverTopic,
  onOpenMatchingSlide,
}) => {
  const [selectedSystem, setSelectedSystem] = useState<AnatomicalSystem | 'all'>('all');
  const [query, setQuery] = useState('');

  const filteredTopics = useMemo(() => {
    const q = query.trim().toLowerCase();
    return HISTOLOGY_CATALOG.filter((topic) => {
      if (selectedSystem !== 'all' && topic.system !== selectedSystem) return false;
      if (!q) return true;
      const hay = `${topic.name} ${topic.subcategory} ${topic.organ} ${topic.system} ${topic.keyFeatures.join(' ')} ${topic.suggestedStains.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [selectedSystem, query]);

  const groupedBySystem = useMemo(() => {
    const map = new Map<AnatomicalSystem, CatalogTopic[]>();
    for (const topic of filteredTopics) {
      const list = map.get(topic.system) ?? [];
      list.push(topic);
      map.set(topic.system, list);
    }
    return SYSTEM_SECTIONS.filter((sec) => map.has(sec.system)).map((sec) => ({
      ...sec,
      topics: map.get(sec.system) ?? [],
    }));
  }, [filteredTopics]);

  const findMatchingLibrarySlides = (topic: CatalogTopic): Slide[] => {
    const tokens = topic.name
      .toLowerCase()
      .replace(/[()]/g, '')
      .split(/[\s,:/]+/)
      .filter((t) => t.length > 3);
    const organTokens = topic.organ
      .toLowerCase()
      .split(/[\s,:/]+/)
      .filter((t) => t.length > 3);
    const check = [...new Set([...tokens, ...organTokens])];

    return slides.filter((s) => {
      const hay = `${s.title} ${s.organ} ${s.tissueType} ${s.tags.join(' ')}`.toLowerCase();
      return check.some((tok) => hay.includes(tok));
    });
  };

  return (
    <div className="histo-scroll flex-1 overflow-y-auto bg-slate-50 px-6 py-6 text-slate-900 dark:bg-[#090C12] dark:text-slate-100">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Medical-School Histology Curriculum Catalog
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Browse all 10 organ and tissue systems ({HISTOLOGY_CATALOG.length} core topics). Open
              slides from your library or search open-access repositories directly.
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter organs, tissues, stains..."
              aria-label="Filter histology curriculum catalog"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#111622] dark:text-slate-100"
            />
          </div>
        </div>

        {/* System Filter Buttons */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedSystem('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              selectedSystem === 'all'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-[#111622] dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            All Systems (A–J)
          </button>
          {SYSTEM_SECTIONS.map((sec) => {
            const active = selectedSystem === sec.system;
            return (
              <button
                key={sec.code}
                type="button"
                onClick={() => setSelectedSystem(sec.system)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-[#111622] dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {sec.code}. {sec.system.replace(' System', '')}
              </button>
            );
          })}
        </div>

        {/* System Sections */}
        {groupedBySystem.length === 0 ? (
          <div className="mt-10 rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-[#111622]">
            <BookOpen className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              No catalog topics match "{query}"
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSelectedSystem('all');
              }}
              className="mt-3 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Show all systems
            </button>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-8">
            {groupedBySystem.map((section) => (
              <section key={section.code} aria-label={section.system}>
                <div className="flex flex-col gap-1 border-b border-slate-200 pb-2.5 dark:border-slate-800 sm:flex-row sm:items-baseline sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                      {section.code}. {section.system}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{section.summary}</p>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
                    {section.topics.length} topics
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {section.topics.map((topic) => {
                    const matches = findMatchingLibrarySlides(topic);
                    return (
                      <div
                        key={topic.id}
                        className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#111622]"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="truncate font-medium">{topic.subcategory}</span>
                            <span className="font-mono tabular-nums shrink-0">
                              {matches.length > 0 ? `${matches.length} in library` : 'Not in library'}
                            </span>
                          </div>

                          <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
                            {topic.name}
                          </h3>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {topic.organ} · {topic.suggestedStains.join(', ')}
                          </p>

                          <ul className="mt-2.5 flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                            {topic.keyFeatures.map((feat, idx) => (
                              <li key={idx} className="leading-snug">
                                • {feat}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800/80">
                          {matches.length > 0 && (
                            <button
                              type="button"
                              onClick={() => onOpenMatchingSlide(matches[0].id)}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
                            >
                              <Microscope className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Study Slide</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDiscoverTopic(topic.searchQuery, topic.system)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap"
                          >
                            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Discover Online</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
