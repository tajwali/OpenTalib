/**
 * JSON parsing with fallback strategies for AI-generated responses.
 * Uses jsonrepair for robust handling of malformed JSON from LLMs.
 */

import { jsonrepair } from 'jsonrepair';
import { createLogger } from '@/lib/logger';
const log = createLogger('Generation');

export function parseJsonResponse<T>(response: string): T | null {
  // Pre-processing: Strip thinking/reasoning blocks (e.g. <think>...</think>)
  // Some models (like DeepSeek R1) output reasoning before the actual response.
  let cleanedResponse = response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // targeted pre-fix for "key:value" patterns that jsonrepair might miss
  // 1. Extra quote inside key: "id:"table_001" -> "id": "table_001"
  cleanedResponse = cleanedResponse.replace(/"(\w+):"([^"]+)"/g, '"$1": "$2"');

  // 2. CSS-style or unquoted keys with colons: "width:880," or "top:130"
  // Handles: "width:880,", "rowspan: 1,", "top:130"
  // Uses negative lookahead to avoid breaking valid keys like "view:Box": ...
  cleanedResponse = cleanedResponse.replace(
    /"(\w+):\s*([^",} ]+)([" ,])?(?!\s*:)/g,
    (match, key, val, end) => {
      const trimmedVal = val.trim();
      const isNum = !isNaN(Number(trimmedVal)) && trimmedVal !== '';
      const finalVal = isNum ? trimmedVal : `"${trimmedVal}"`;
      const finalEnd = end === '"' ? '' : end || '';
      return `"${key}": ${finalVal}${finalEnd}`;
    },
  );

  // 3. Fix colon inside key names (e.g. "view:Box" -> "viewBox")
  cleanedResponse = cleanedResponse.replace(/"view":\s*"Box"":/g, '"viewBox":');
  cleanedResponse = cleanedResponse.replace(/"(\w+):(\w+)"(?=\s*:)/g, '"$1$2"');

  // 4. Fix aspect ratio and similar nested colon patterns: "aspectRatio": "16": 9 -> "aspectRatio": "16:9"
  cleanedResponse = cleanedResponse.replace(/"(\w+)":\s*"?(\d+)"?:\s*"?(\d+)"?/g, '"$1": "$2:$3"');
  // Also handle "aspectRatio": 16:9
  cleanedResponse = cleanedResponse.replace(/"(\w+)":\s*(\d+):(\d+)(?=[,}\n ])/g, '"$1": "$2:$3"');

  // 5. Fix unquoted string values that contain spaces or special chars (limited to common keys)
  // e.g. "title": Welcome to the Alphabet! -> "title": "Welcome to the Alphabet!"
  const commonStringKeys = [
    'title',
    'description',
    'content',
    'prompt',
    'teachingObjective',
    'message',
    'statusMessage',
  ];
  commonStringKeys.forEach((key) => {
    const re = new RegExp(`("${key}":\\s*)([^"{}\\[\\],]+)(?=[,\\n}])`, 'g');
    cleanedResponse = cleanedResponse.replace(re, (match, prefix, val) => {
      const trimmedVal = val.trim();
      if (
        trimmedVal === 'true' ||
        trimmedVal === 'false' ||
        trimmedVal === 'null' ||
        !isNaN(Number(trimmedVal))
      ) {
        return match;
      }
      // Check if it's already properly quoted
      if (trimmedVal.startsWith('"') && trimmedVal.endsWith('"')) return match;
      return `${prefix}"${trimmedVal}"`;
    });
  });

  // 6. Fix CSS-style properties that broke out of strings: "font_size": "20px;" -> font-size: 20px;
  // This happens when the model fails to escape quotes inside an HTML string, making jsonrepair
  // think the property is a new JSON key.
  cleanedResponse = cleanedResponse.replace(
    /"(\w+)[_-](\w+)":\s*"([^"]*)"/g,
    (match, p1, p2, val) => {
      // If it looks like a common CSS property (font, text, background, border, margin, padding)
      const cssPrefixes = [
        'font',
        'text',
        'background',
        'border',
        'margin',
        'padding',
        'line',
        'vertical',
        'white',
      ];
      if (cssPrefixes.includes(p1.toLowerCase())) {
        return `${p1}-${p2}: ${val}`;
      }
      return match;
    },
  );

  // Strategy 0: Primary - Attempt to repair and parse the entire cleaned response
  try {
    log.debug('--- Strategy 0: Global jsonrepair ---');
    log.debug(`Input length: ${cleanedResponse.length}`);
    log.debug('[jsonrepair] Strategy 0: Calling global jsonrepair');
    const repaired = jsonrepair(cleanedResponse);
    log.debug('[jsonrepair] Strategy 0: global jsonrepair success');
    log.debug('jsonrepair success (global)');
    const result = JSON.parse(repaired) as T;
    return result;
  } catch (err) {
    log.debug(
      `jsonrepair failed (global). Error: ${err instanceof Error ? err.message : String(err)}`,
    );
    // If it's a JSON parse error after repair, log a snippet
    if (err instanceof SyntaxError) {
      log.debug(`SyntaxError at position ${err.message}`);
    }
  }

  // Strategy 1: Try to extract JSON from markdown code blocks
  const codeBlockMatches = cleanedResponse.matchAll(/```(?:json)?\s*([\s\S]*?)```/g);
  for (const match of codeBlockMatches) {
    const extracted = match[1].trim();
    if (extracted.startsWith('{') || extracted.startsWith('[')) {
      const result = tryParseJson<T>(extracted);
      if (result !== null) {
        log.debug('Successfully parsed JSON from code block');
        return result;
      }
    }
  }

  // Strategy 2: Try to find JSON structure directly in response
  const jsonStartArray = cleanedResponse.indexOf('[');
  const jsonStartObject = cleanedResponse.indexOf('{');

  if (jsonStartArray !== -1 || jsonStartObject !== -1) {
    const startIndex =
      jsonStartArray === -1
        ? jsonStartObject
        : jsonStartObject === -1
          ? jsonStartArray
          : Math.min(jsonStartArray, jsonStartObject);

    let depth = 0;
    let endIndex = -1;
    let inString = false;
    let escapeNext = false;

    for (let i = startIndex; i < cleanedResponse.length; i++) {
      const char = cleanedResponse[i];
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }
      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '[' || char === '{') depth++;
        else if (char === ']' || char === '}') {
          depth--;
          if (depth === 0) {
            endIndex = i;
            break;
          }
        }
      }
    }

    if (endIndex !== -1) {
      const jsonStr = cleanedResponse.substring(startIndex, endIndex + 1);
      const result = tryParseJson<T>(jsonStr);
      if (result !== null) {
        log.debug('Successfully parsed JSON from response body');
        return result;
      }
    }
  }

  // Strategy 3: Last resort
  const result = tryParseJson<T>(cleanedResponse.trim());
  if (result !== null) return result;

  log.error('Failed to parse JSON from response');
  log.error('Raw response (first 2000 chars):', cleanedResponse.substring(0, 2000));
  return null;
}

export function tryParseJson<T>(jsonStr: string): T | null {
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    /* continue */
  }

  try {
    log.debug('--- Targeted jsonrepair ---');
    log.debug('[jsonrepair] Targeted: Calling jsonrepair for snippet');
    const repaired = jsonrepair(jsonStr);
    log.debug('[jsonrepair] Targeted: jsonrepair snippet success');
    log.debug('jsonrepair success (targeted)');
    return JSON.parse(repaired) as T;
  } catch (err) {
    log.debug(`jsonrepair failed (targeted): ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    let fixed = jsonStr;
    fixed = fixed.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (_match, content) => {
      const fixedContent = content.replace(/\\([a-zA-Z])/g, (_m: string, ch: string) => {
        if ('bfnrtu'.includes(ch)) return `\\${ch}`;
        return `\\\\${ch}`;
      });
      return `"${fixedContent}"`;
    });
    fixed = fixed.replace(/\\([^"\\\/bfnrtu\n\r])/g, (match, char) => {
      if (/[a-zA-Z]/.test(char)) return '\\\\' + char;
      return match;
    });

    const trimmed = fixed.trim();
    if (trimmed.startsWith('[') && !trimmed.endsWith(']')) {
      const lastCompleteObj = fixed.lastIndexOf('}');
      if (lastCompleteObj > 0) fixed = fixed.substring(0, lastCompleteObj + 1) + ']';
    } else if (trimmed.startsWith('{') && !trimmed.endsWith('}')) {
      const openBraces = (fixed.match(/{/g) || []).length;
      const closeBraces = (fixed.match(/}/g) || []).length;
      if (openBraces > closeBraces) fixed += '}'.repeat(openBraces - closeBraces);
    }

    log.debug('[jsonrepair] Fixed-Targeted: Calling jsonrepair');
    const repaired = jsonrepair(fixed);
    log.debug('[jsonrepair] Fixed-Targeted: jsonrepair success');
    return JSON.parse(repaired) as T;
  } catch {
    try {
      const fixed = jsonStr.replace(/[\x00-\x1F\x7F]/g, (char) => {
        switch (char) {
          case '\n':
            return '\\n';
          case '\r':
            return '\\r';
          case '\t':
            return '\\t';
          default:
            return '';
        }
      });
      log.debug('[jsonrepair] Fixed-Targeted: Calling jsonrepair');
      const repaired = jsonrepair(fixed);
      log.debug('[jsonrepair] Fixed-Targeted: jsonrepair success');
      return JSON.parse(repaired) as T;
    } catch {
      return null;
    }
  }
}
