'use client';

import { useMemo } from 'react';
import { BotOff } from 'lucide-react';
import type { InteractiveContent } from '@/lib/types/stage';

interface InteractiveRendererProps {
  readonly content: InteractiveContent;
  readonly mode: 'autonomous' | 'playback';
  readonly sceneId: string;
}

export function InteractiveRenderer({ content, mode: _mode, sceneId }: InteractiveRendererProps) {
  const patchedHtml = useMemo(
    () => (content.html ? patchHtmlForIframe(content.html) : undefined),
    [content.html],
  );

  if (!patchedHtml && !content.url) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/5 rounded-xl border-2 border-dashed border-border/50">
        <BotOff className="size-12 mb-4 opacity-20" />
        <p className="text-sm font-medium">Interactive element unavailable for this scene.</p>
        <p className="text-xs opacity-60 mt-1">Try refreshing or check the lesson outlines.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <iframe
        srcDoc={patchedHtml}
        src={patchedHtml ? undefined : content.url}
        className="absolute inset-0 w-full h-full border-0"
        title={`Interactive Scene ${sceneId}`}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}

/**
 * Patch embedded HTML to display correctly inside an iframe.
 *
 * Fixes:
 * - min-h-screen / h-screen → use 100% of iframe viewport
 * - Ensure html/body fill the iframe with no overflow issues
 * - Canvas elements use container sizing instead of viewport
 */
function patchHtmlForIframe(html: string): string {
  const iframeCss = `<style data-iframe-patch>
  html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
    overflow-y: auto;
  }
  /* Fix min-h-screen: in iframes 100vh is the iframe height, which is correct,
     but ensure body actually fills it */
  body { min-height: 100vh; }
</style>`;

  // Insert right after <head> or at the start of the document
  const headIdx = html.indexOf('<head>');
  if (headIdx !== -1) {
    const insertPos = headIdx + 6; // after <head>
    return html.substring(0, insertPos) + '\n' + iframeCss + html.substring(insertPos);
  }

  const headWithAttrs = html.indexOf('<head ');
  if (headWithAttrs !== -1) {
    const closeAngle = html.indexOf('>', headWithAttrs);
    if (closeAngle !== -1) {
      const insertPos = closeAngle + 1;
      return html.substring(0, insertPos) + '\n' + iframeCss + html.substring(insertPos);
    }
  }

  // Fallback: prepend
  return iframeCss + html;
}
