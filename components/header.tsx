'use client';

import {
  Settings,
  Sun,
  Moon,
  Monitor,
  ArrowLeft,
  Loader2,
  Download,
  FileDown,
  Package,
  RefreshCw,
} from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useTheme } from '@/lib/hooks/use-theme';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsDialog } from './settings';
import { cn } from '@/lib/utils';
import { useStageStore } from '@/lib/store/stage';
import { useMediaGenerationStore, isMediaPlaceholder } from '@/lib/store/media-generation';
import { useExportPPTX } from '@/lib/export/use-export-pptx';
import { retryRemainingMedia } from '@/lib/media/media-orchestrator';
import type { PPTImageElement } from '@/lib/types/slides';

interface HeaderProps {
  readonly currentSceneTitle: string;
  readonly courseTitle?: string;
}

export function Header({ currentSceneTitle, courseTitle }: HeaderProps) {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [retryingImages, setRetryingImages] = useState(false);

  // Export
  const { exporting: isExporting, exportPPTX, exportResourcePack } = useExportPPTX();
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const scenes = useStageStore((s) => s.scenes);
  const stage = useStageStore((s) => s.stage);
  const _outlines = useStageStore((s) => s.outlines);
  const generatingOutlines = useStageStore((s) => s.generatingOutlines);
  const failedOutlines = useStageStore((s) => s.failedOutlines);
  const mediaTasks = useMediaGenerationStore((s) => s.tasks);

  const failedMediaTasks = useMemo(
    () => Object.values(mediaTasks).filter((task) => task.status === 'failed'),
    [mediaTasks],
  );

  const tasksToRetryInfo = useMemo(() => {
    const info: Array<{ elementId: string; prompt?: string }> = [];
    for (const scene of scenes) {
      if (scene.content.type === 'slide') {
        for (const el of scene.content.canvas.elements) {
          if (el.type === 'image') {
            const img = el as PPTImageElement;
            if (isMediaPlaceholder(img.src) || img.src.startsWith('blob:')) {
              // Check if task exists and is NOT done
              const task = mediaTasks[img.src];
              if (!task || task.status === 'failed' || task.status === 'pending') {
                // If element has prompt, use it directly
                if (img.prompt) {
                  info.push({ elementId: img.src, prompt: img.prompt });
                } else {
                  // Otherwise, add just the ID, we'll look it up in outlines later if needed
                  info.push({ elementId: img.src });
                }
              }
            }
          }
        }
      }
    }
    // Deduplicate by elementId, keeping the one with the prompt if available
    return Array.from(new Map(info.map((item) => [item.elementId, item])).values());
  }, [scenes, mediaTasks]);

  const canExport =
    scenes.length > 0 &&
    generatingOutlines.length === 0 &&
    failedOutlines.length === 0 &&
    Object.values(mediaTasks).every((task) => task.status === 'done' || task.status === 'failed');

  const showRetryImages =
    scenes.length > 0 &&
    generatingOutlines.length === 0 &&
    failedOutlines.length === 0 &&
    (failedMediaTasks.length > 0 || tasksToRetryInfo.length > 0); // Use tasksToRetryInfo length

  const handleRetryImages = async () => {
    if (retryingImages || !stage?.id) return;
    setRetryingImages(true);
    try {
      const currentMediaTasks = useMediaGenerationStore.getState().tasks;
      const currentOutlines = useStageStore.getState().outlines;

      const tasksToEnqueue: Array<{ elementId: string; prompt: string; type: 'image' | 'video' }> =
        [];

      // 1. Process missing images and retrieve their prompts
      for (const info of tasksToRetryInfo) {
        const { elementId, prompt: elementPrompt } = info;

        // If element has a prompt, use it directly
        if (elementPrompt) {
          tasksToEnqueue.push({ elementId, prompt: elementPrompt, type: 'image' });
        } else {
          // Fallback: try to find prompt in outlines if not available on element
          // Note: outlines might be empty if loaded from Supabase without local generation history
          if (currentOutlines) {
            for (const outline of currentOutlines) {
              const mg = outline.mediaGenerations?.find((m) => m.elementId === elementId);
              if (mg?.prompt) {
                tasksToEnqueue.push({ elementId, prompt: mg.prompt, type: mg.type ?? 'image' });
                break; // Found prompt for this elementId
              }
            }
          }
        }
      }

      // Filter out tasks that are already in a non-retryable state or have no prompt
      const finalTasksToEnqueue = tasksToEnqueue.filter((task) => {
        const existingTask = currentMediaTasks[task.elementId];
        // Enqueue if task is missing, pending, or failed AND has a prompt
        return (
          (!existingTask ||
            existingTask.status === 'failed' ||
            existingTask.status === 'pending') &&
          task.prompt
        );
      });

      if (finalTasksToEnqueue.length > 0) {
        useMediaGenerationStore.getState().enqueueTasks(stage.id, finalTasksToEnqueue);
      }

      // 2. Mark any relevant tasks as 'failed' so retryRemainingMedia picks them up
      // This step is crucial for elements that were placeholders but not yet tasks in the store,
      // or were in a non-failed state but still missing.
      // We iterate through tasksToRetryInfo to ensure we cover all elements that *should* be retried.
      for (const info of tasksToRetryInfo) {
        const elementId = info.elementId;
        const task = useMediaGenerationStore.getState().getTask(elementId);
        // If task doesn't exist, is pending (was just enqueued), or failed, ensure it's retried.
        // If task is 'done', we don't need to retry.
        if (!task || task.status === 'pending' || task.status === 'failed') {
          // No direct action needed here, retryRemainingMedia will pick them up.
          // The enqueueTasks above ensures they get a 'pending' status.
        } else if (task.status !== 'done') {
          // If task exists but is not done and not failed/pending, mark as failed for retry.
          // This covers cases where the task was previously successful but the element still looks like a placeholder.
          // e.g. blob URL became invalid.
          useMediaGenerationStore
            .getState()
            .markFailed(elementId, 'Placeholder mismatch or invalid URL');
        }
        // If task.status is 'done', we skip marking as failed as it's already processed.
      }

      // 3. Retry all failed tasks for this stage
      await retryRemainingMedia(stage.id);

      // 4. After retrying, update the classroom in Supabase with the latest scenes (which now have permanent URLs)
      const latestScenes = useStageStore.getState().scenes;
      await fetch(`/api/user/classrooms/${stage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes: latestScenes }),
      });
    } finally {
      setRetryingImages(false);
    }
  };

  const languageRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (languageOpen && languageRef.current && !languageRef.current.contains(e.target as Node)) {
        setLanguageOpen(false);
      }
      if (themeOpen && themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setThemeOpen(false);
      }
      if (exportMenuOpen && exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    },
    [languageOpen, themeOpen, exportMenuOpen],
  );

  useEffect(() => {
    if (languageOpen || themeOpen || exportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [languageOpen, themeOpen, exportMenuOpen, handleClickOutside]);

  return (
    <>
      <header className="h-20 px-8 flex items-center justify-between z-10 bg-transparent gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={() => router.push('/')}
            className="shrink-0 p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            title={t('generation.backToHome')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-500 mb-0.5 truncate max-w-[400px]">
              {courseTitle || t('stage.currentScene')}
            </span>
            <h1
              className="text-xl font-bold text-gray-800 dark:text-gray-200 tracking-tight truncate"
              suppressHydrationWarning
            >
              {currentSceneTitle || t('common.loading')}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/60 dark:bg-gray-800/60 backdrop-blur-md px-2 py-1.5 rounded-full border border-gray-100/50 dark:border-gray-700/50 shadow-sm shrink-0">
          {/* Language Selector */}
          <div className="relative" ref={languageRef}>
            <button
              onClick={() => {
                setLanguageOpen(!languageOpen);
                setThemeOpen(false);
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 hover:shadow-sm transition-all"
            >
              {locale === 'zh-CN' ? 'CN' : 'EN'}
            </button>
            {languageOpen && (
              <div className="absolute top-full mt-2 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-50 min-w-[120px]">
                <button
                  onClick={() => {
                    setLocale('zh-CN');
                    setLanguageOpen(false);
                  }}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
                    locale === 'zh-CN' &&
                      'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
                  )}
                >
                  简体中文
                </button>
                <button
                  onClick={() => {
                    setLocale('en-US');
                    setLanguageOpen(false);
                  }}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
                    locale === 'en-US' &&
                      'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
                  )}
                >
                  English
                </button>
              </div>
            )}
          </div>

          <div className="w-[1px] h-4 bg-gray-200 dark:bg-gray-700" />

          {/* Theme Selector */}
          <div className="relative" ref={themeRef}>
            <button
              onClick={() => {
                setThemeOpen(!themeOpen);
                setLanguageOpen(false);
              }}
              className="p-2 rounded-full text-gray-400 dark:text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 hover:shadow-sm transition-all group"
            >
              {theme === 'light' && <Sun className="w-4 h-4" />}
              {theme === 'dark' && <Moon className="w-4 h-4" />}
              {theme === 'system' && <Monitor className="w-4 h-4" />}
            </button>
            {themeOpen && (
              <div className="absolute top-full mt-2 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-50 min-w-[140px]">
                <button
                  onClick={() => {
                    setTheme('light');
                    setThemeOpen(false);
                  }}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2',
                    theme === 'light' &&
                      'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
                  )}
                >
                  <Sun className="w-4 h-4" />
                  {t('settings.themeOptions.light')}
                </button>
                <button
                  onClick={() => {
                    setTheme('dark');
                    setThemeOpen(false);
                  }}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2',
                    theme === 'dark' &&
                      'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
                  )}
                >
                  <Moon className="w-4 h-4" />
                  {t('settings.themeOptions.dark')}
                </button>
                <button
                  onClick={() => {
                    setTheme('system');
                    setThemeOpen(false);
                  }}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2',
                    theme === 'system' &&
                      'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
                  )}
                >
                  <Monitor className="w-4 h-4" />
                  {t('settings.themeOptions.system')}
                </button>
              </div>
            )}
          </div>

          <div className="w-[1px] h-4 bg-gray-200 dark:bg-gray-700" />

          {/* Settings Button */}
          <div className="relative">
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-full text-gray-400 dark:text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 hover:shadow-sm transition-all group"
            >
              <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
            </button>
          </div>

          {showRetryImages && (
            <>
              <div className="w-[1px] h-4 bg-gray-200 dark:bg-gray-700" />
              <div className="relative">
                <button
                  onClick={handleRetryImages}
                  disabled={retryingImages}
                  title={t('settings.mediaRetry')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all',
                    retryingImages
                      ? 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 cursor-not-allowed'
                      : 'text-amber-600 dark:text-amber-400 hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm',
                  )}
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', retryingImages && 'animate-spin')} />
                  <span>
                    {retryingImages
                      ? `${t('settings.testingConnection')} (${failedMediaTasks.length})`
                      : t('settings.mediaRetry')}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Export Dropdown */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => {
              if (canExport && !isExporting) setExportMenuOpen(!exportMenuOpen);
            }}
            disabled={!canExport || isExporting}
            title={
              canExport
                ? isExporting
                  ? t('export.exporting')
                  : t('export.pptx')
                : t('share.notReady')
            }
            className={cn(
              'shrink-0 p-2 rounded-full transition-all',
              canExport && !isExporting
                ? 'text-gray-400 dark:text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 hover:shadow-sm'
                : 'text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-50',
            )}
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>
          {exportMenuOpen && (
            <div className="absolute top-full mt-2 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-50 min-w-[200px]">
              <button
                onClick={() => {
                  setExportMenuOpen(false);
                  exportPPTX();
                }}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2.5"
              >
                <FileDown className="w-4 h-4 text-gray-400 shrink-0" />
                <span>{t('export.pptx')}</span>
              </button>
              <button
                onClick={() => {
                  setExportMenuOpen(false);
                  exportResourcePack();
                }}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2.5"
              >
                <Package className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <div>{t('export.resourcePack')}</div>
                  <div className="text-[11px] text-gray-400 dark:text-gray-500">
                    {t('export.resourcePackDesc')}
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>
      </header>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
