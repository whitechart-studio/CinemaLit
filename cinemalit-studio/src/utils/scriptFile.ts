// src/utils/scriptFile.ts
// Turns whatever the user picked (fountain/txt/fdx/pdf) into fountain-ish text
// the parser can chew on. Shared by the wizard and the screenplay importer so
// both accept the same formats.

export const SCRIPT_ACCEPT = '.fountain,.txt,.md,.fdx,.pdf';

const ALLOWED = ['.fountain', '.txt', '.md', '.fdx', '.pdf'];

export function scriptFileError(file: File): string {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!ALLOWED.includes(ext)) {
    return `Unsupported file type "${ext || file.name}". Use ${ALLOWED.join(', ')}.`;
  }
  if (file.size > 25 * 1024 * 1024) return 'File is larger than 25 MB.';
  return '';
}

/** Final Draft .fdx is XML — pull the paragraphs back out as plain script lines. */
function fdxToText(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('This .fdx file is not valid Final Draft XML.');
  const paras = Array.from(doc.querySelectorAll('Content > Paragraph'));
  if (!paras.length) throw new Error('No screenplay text found in this .fdx file.');
  return paras
    .map((p) => {
      const text = Array.from(p.querySelectorAll('Text')).map((t) => t.textContent || '').join('').trim();
      // Scene headings / action / dialogue all read fine flat; blank line between
      // paragraphs is what the fountain parser uses to split blocks.
      return p.getAttribute('Type') === 'Scene Heading' ? `\n${text}` : text;
    })
    .join('\n\n');
}

async function pdfToText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    // ponytail: group text items into lines by their y position — good enough for
    // slugline/character detection since the parser trims indentation anyway.
    // Swap for a column-aware extractor if dual-dialogue scripts come up.
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      (rows.get(y) ?? rows.set(y, []).get(y)!).push({ x: item.transform[4], s: item.str });
    }
    pages.push(
      [...rows.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, items]) => items.sort((a, b) => a.x - b.x).map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim())
        .join('\n'),
    );
  }
  const text = pages.join('\n\n');
  if (!text.trim()) throw new Error('No selectable text in this PDF — it is probably a scan.');
  return text;
}

export async function readScriptFile(file: File): Promise<string> {
  const bad = scriptFileError(file);
  if (bad) throw new Error(bad);
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (ext === '.pdf') return pdfToText(file);
  const text = await file.text();
  if (ext === '.fdx') return fdxToText(text);
  if (!text.trim()) throw new Error('That file is empty.');
  return text;
}
