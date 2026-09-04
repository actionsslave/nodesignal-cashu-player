import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanSource, type SourceFile } from '../../tools/guardrails.js';

const ROOT = join(import.meta.dirname, '..', '..');

function collect(dir: string, out: SourceFile[] = []): SourceFile[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collect(full, out);
    } else if (/\.(ts|tsx|js|jsx|html)$/.test(entry)) {
      out.push({ path: relative(ROOT, full), content: readFileSync(full, 'utf8') });
    }
  }
  return out;
}

describe('Negative Anforderungen im Quelltext', () => {
  it('SNR-03, SNR-06: src/ enthält keine verbotenen Muster', () => {
    const violations = scanSource(collect(join(ROOT, 'src')));
    expect(violations).toEqual([]);
  });

  it('SNR-06: index.html enthält keine http- oder ws-Endpunkte', () => {
    const violations = scanSource([
      { path: 'index.html', content: readFileSync(join(ROOT, 'index.html'), 'utf8') },
    ]);
    expect(violations).toEqual([]);
  });

  it('SNR-06: keine Analytics-, Tracking- oder Error-Reporting-Abhängigkeit', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    const deps = Object.keys(pkg.dependencies ?? {});
    expect(deps.sort()).toEqual([
      '@cashu/cashu-ts',
      'idb',
      'nostr-tools',
      'preact',
      'qrcode-generator',
    ]);
  });
});
