/**
 * Statischer Scanner für die automatisch prüfbaren negativen Anforderungen
 * (SNR-01 bis SNR-09). Läuft nicht im Bundle, sondern nur in den Tests.
 *
 * Gegenüber `cashu-player` fehlt hier bewusst die Regel gegen kind:17375 und
 * kind:7375: Dieser Showcase muss beide lesen und kind:7375 schreiben, das ist
 * der Kern von SFR-13 bis SFR-17. Kapitel 2 der Spezifikation hebt NR-09 dafür
 * ausdrücklich auf. Was an ihre Stelle tritt, steht in SNR-01 und SNR-02 und
 * ist nicht mit einem regulären Ausdruck prüfbar — sondern nur im Code-Review
 * und in der manuellen Prüfung. Diese Lücke ist benannt, nicht übersehen.
 *
 * Ebenfalls entfallen: die Proxy-Regel (kein Feed-Proxy, SFR-08) und die
 * Cache-Regel (kein Service Worker, PWA ist nicht im Scope).
 */

export interface Violation {
  file: string;
  line: number;
  rule: string;
  text: string;
}

export interface SourceFile {
  path: string;
  content: string;
}

interface Rule {
  id: string;
  pattern: RegExp;
  /** Datei-Pfade, für die diese Regel nicht gilt. */
  allow?: (path: string) => boolean;
}

const RULES: Rule[] = [
  // SNR-03: kein nsec-Eingabefeld. Der nostr-Schlüssel bleibt in der Extension.
  { id: 'SNR-03', pattern: /(?<![A-Za-z0-9_])nsec/i },
  // SNR-03: Der Wallet-Privkey aus kind:17375 steht nie in localStorage oder
  // in einer Konsolenausgabe. Dieselbe Regel deckt Proofs und Token mit ab.
  { id: 'SNR-03', pattern: /\blocalStorage\b/ },
  { id: 'SNR-03', pattern: /\bconsole\s*\.\s*(log|debug|info|warn|error|table|dir)\b/ },
  // SNR-06: keine http- oder ws-Endpunkte; von einer HTTPS-Seite blockiert sie
  // der Browser ohnehin.
  {
    id: 'SNR-06',
    pattern: /["'`]http:\/\//,
    // XML-Namespace-Bezeichner sind keine Endpunkte und werden nie abgerufen.
    allow: (path) => path === 'src/feed/namespaces.ts',
  },
  { id: 'SNR-06', pattern: /["'`]ws:\/\// },
];

/**
 * Ersetzt Kommentare zeilenweise durch Leerraum. Die Regeln zielen auf Code;
 * ein Kommentar, der eine verbotene Konstruktion erklärt, ist kein Verstoß.
 * String-Literale bleiben stehen — dort steckt gerade das, was NR-05 sucht.
 * Zeilennummern bleiben erhalten, weil nur der Inhalt geleert wird.
 */
function stripComments(source: string): string[] {
  type State = 'code' | 'block' | 'single' | 'double' | 'template';
  let state: State = 'code';

  return source.split('\n').map((line) => {
    let out = '';
    let index = 0;

    while (index < line.length) {
      const char = line[index];
      const pair = line.slice(index, index + 2);

      if (state === 'block') {
        if (pair === '*/') {
          state = 'code';
          index += 2;
        } else {
          index += 1;
        }
        continue;
      }

      if (state !== 'code') {
        out += char;
        if (char === '\\') {
          out += line[index + 1] ?? '';
          index += 2;
          continue;
        }
        const closes =
          (state === 'single' && char === "'") ||
          (state === 'double' && char === '"') ||
          (state === 'template' && char === '`');
        if (closes) state = 'code';
        index += 1;
        continue;
      }

      if (pair === '//') return out;
      if (pair === '/*') {
        state = 'block';
        index += 2;
        continue;
      }
      if (char === "'") state = 'single';
      else if (char === '"') state = 'double';
      else if (char === '`') state = 'template';
      out += char;
      index += 1;
    }

    // Einfache Strings enden am Zeilenende; nur Template-Literale laufen weiter.
    if (state === 'single' || state === 'double') state = 'code';
    return out;
  });
}

export function scanSource(files: SourceFile[]): Violation[] {
  const violations: Violation[] = [];
  for (const file of files) {
    const lines = stripComments(file.content);
    for (const rule of RULES) {
      if (rule.allow?.(file.path)) continue;
      lines.forEach((text, index) => {
        if (rule.pattern.test(text)) {
          violations.push({ file: file.path, line: index + 1, rule: rule.id, text: text.trim() });
        }
      });
    }
  }
  return violations;
}
