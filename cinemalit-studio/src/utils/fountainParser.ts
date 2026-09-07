// src/utils/fountainParser.ts
import type { Scene, SceneType, SceneTiming, DialogueLine } from '../types';

export interface ParsedScript {
  title: string;
  author: string;
  draftDate: string;
  scenes: Scene[];
}

const SLUG_REGEX = /^(INT|EXT|INT\/EXT|I\/E|EST)\.?\s+(.+)$/i;

export function parseFountainScript(text: string): ParsedScript {
  const lines = text.split(/\r?\n/);
  let title = 'Untitled Screenplay';
  let author = 'Anonymous';
  let draftDate = 'August 2, 2026';

  const rawScenes: {
    slug: string;
    lines: string[];
    charNames: Set<string>;
    dialogue: DialogueLine[];
  }[] = [];
  let currentSlug: string | null = null;
  let currentLines: string[] = [];
  let currentChars = new Set<string>();
  let currentDialogue: DialogueLine[] = [];

  // Parse title page metadata vs script lines
  let inTitlePage = true;
  let scriptStartIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (inTitlePage) {
      if (line.toLowerCase().startsWith('title:')) {
        title = line.replace(/title:/i, '').trim();
      } else if (line.toLowerCase().startsWith('author:') || line.toLowerCase().startsWith('written by:')) {
        author = line.replace(/author:|written by:/i, '').trim();
      } else if (line.toLowerCase().startsWith('date:')) {
        draftDate = line.replace(/date:/i, '').trim();
      } else if (line === '' && i > 3) {
        inTitlePage = false;
        scriptStartIdx = i;
      }
    }
  }

  // Parse scenes
  for (let i = scriptStartIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(SLUG_REGEX);

    if (match) {
      if (currentSlug) {
        rawScenes.push({
          slug: currentSlug, lines: currentLines,
          charNames: currentChars, dialogue: currentDialogue,
        });
      }
      currentSlug = line;
      currentLines = [];
      currentChars = new Set<string>();
      currentDialogue = [];
    } else if (currentSlug) {
      currentLines.push(line);
      // Character detection: ALL CAPS line without punctuation that precedes a non-empty line
      if (
        line.length > 1 &&
        line.length < 35 &&
        line === line.toUpperCase() &&
        !line.includes('.') &&
        !line.includes('!') &&
        !line.includes('?') &&
        i < lines.length - 1 &&
        lines[i + 1].trim() !== ''
      ) {
        const charName = line.replace(/\(.*\)/, '').trim();
        const TRANSITION_CUES = [
          'CUT TO:', 'FADE IN:', 'FADE OUT:', 'FADE TO:', 'DISSOLVE TO:',
          'SMASH CUT TO:', 'MATCH CUT TO:', 'JUMP CUT TO:', 'CUT TO BLACK:', 'INT', 'EXT',
        ];
        if (charName && !TRANSITION_CUES.includes(charName)) {
          currentChars.add(charName);

          // Everything up to the next blank line is this character's speech —
          // an optional (parenthetical) first, then the dialogue itself. The
          // old parser stopped at the name, which is why exporting a script
          // used to lose every spoken line.
          let parenthetical: string | undefined;
          const spoken: string[] = [];
          for (let j = i + 1; j < lines.length; j++) {
            const next = lines[j].trim();
            if (next === '') break;
            if (next.startsWith('(') && next.endsWith(')') && spoken.length === 0) {
              parenthetical = next.slice(1, -1);
            } else {
              spoken.push(next);
            }
          }
          if (spoken.length > 0) {
            currentDialogue.push({ character: charName, parenthetical, text: spoken.join(' ') });
          }
        }
      }
    }
  }

  if (currentSlug) {
    rawScenes.push({
      slug: currentSlug, lines: currentLines,
      charNames: currentChars, dialogue: currentDialogue,
    });
  }

  // Map to Scene objects
  const scenes: Scene[] = rawScenes.map((rs, idx) => {
    const num = String(idx + 1).padStart(2, '0');
    const slugUpper = rs.slug.toUpperCase();
    const type: SceneType = slugUpper.includes('EXT') ? 'EXT' : 'INT';
    const timing: SceneTiming = slugUpper.includes('NIGHT')
      ? 'NIGHT'
      : slugUpper.includes('DAWN')
      ? 'DAWN'
      : slugUpper.includes('DUSK')
      ? 'DUSK'
      : 'DAY';

    // Location extraction
    const locParts = rs.slug.replace(/^(INT|EXT|INT\/EXT|I\/E|EST)\.?\s+/i, '').split('—');
    const loc = locParts[0].split('-')[0].trim();

    // Page count estimation (54 lines per page)
    const lineCount = rs.lines.length + 2;
    const pages = (lineCount / 54).toFixed(2);

    // Extract props, vfx, ward
    const props: string[] = [];
    const vfx: string[] = [];
    const sfx: string[] = [];

    rs.lines.forEach((l) => {
      const lLower = l.toLowerCase();
      if (lLower.includes('gun') || lLower.includes('terminal') || lLower.includes('case') || lLower.includes('car')) {
        const words = l.split(/\s+/);
        words.forEach((w) => {
          if (['gun', 'terminal', 'case', 'car', 'phone', 'key'].includes(w.toLowerCase().replace(/[^a-z]/g, ''))) {
            if (!props.includes(w)) props.push(w);
          }
        });
      }
      if (lLower.includes('rain') || lLower.includes('neon') || lLower.includes('screen')) {
        if (lLower.includes('rain') && !sfx.includes('Rain Practical')) sfx.push('Rain Practical');
        if (lLower.includes('neon') && !vfx.includes('Neon FX')) vfx.push('Neon FX');
      }
    });

    const isHighRisk = props.some((p) => p.toLowerCase().includes('gun')) || sfx.includes('Rain Practical');

    return {
      id: `sn${idx}`,
      num,
      slug: rs.slug,
      type,
      timing,
      loc: loc || 'LOCATION',
      pages,
      cast: Array.from(rs.charNames),
      shots: Math.max(2, Math.floor(rs.lines.length / 3)),
      risk: isHighRisk ? 'high' : 'low',
      riskNote: isHighRisk ? 'Prop/Stunt element detected' : 'Standard low risk',
      day: idx < 2 ? 1 : 2,
      desc: rs.lines.filter((l) => l !== '').slice(0, 2).join(' '),
      body: rs.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
      dialogue: rs.dialogue,
      props: props.length > 0 ? props : ['Standard Prop'],
      ward: ['Cast Wardrobe'],
      vfx,
      sfx,
      x: 100 + (idx % 3) * 300,
      y: 160 + Math.floor(idx / 3) * 200,
    };
  });

  return { title, author, draftDate, scenes };
}

export function exportToFountain(scenes: Scene[], title: string = 'Neon Echoes', author: string = 'A. Kubrick'): string {
  let text = `Title: ${title}\nCredit: Written by\nAuthor: ${author}\nDraft date: ${new Date().toLocaleDateString()}\n\n`;

  scenes.forEach((sc) => {
    text += `${sc.slug}\n\n`;

    // Prefer the scene's own text — that makes import → edit → export a true
    // round-trip. Only synthesize when a scene was created in the app and has
    // no source prose of its own.
    if (sc.body && sc.body.trim()) {
      text += `${sc.body.trim()}\n\n`;
      return;
    }

    text += `${sc.desc || 'Action description for scene.'}\n\n`;
    (sc.dialogue ?? []).forEach((d) => {
      text += `${d.character.toUpperCase()}\n`;
      if (d.parenthetical) text += `(${d.parenthetical})\n`;
      text += `${d.text}\n\n`;
    });
  });

  return text;
}
