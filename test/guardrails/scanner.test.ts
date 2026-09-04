import { describe, expect, it } from 'vitest';
import { scanSource } from '../../tools/guardrails.js';

const at = (path: string, content: string) => ({ path, content });

describe('Guardrail-Scanner', () => {
  it('SNR-03: findet ein nsec-Eingabefeld', () => {
    const found = scanSource([at('src/ui/login.tsx', '<input name="nsec" />')]);
    expect(found.map((v) => v.rule)).toContain('SNR-03');
  });

  it('SNR-03: findet localStorage — dort darf kein Wallet-Privkey landen', () => {
    const found = scanSource([at('src/nip60/wallet.ts', "localStorage.setItem('privkey', k)")]);
    expect(found.map((v) => v.rule)).toContain('SNR-03');
  });

  it('SNR-03: findet Konsolenausgaben', () => {
    const found = scanSource([at('src/nip60/wallet.ts', 'console.log(privkey)')]);
    expect(found.map((v) => v.rule)).toContain('SNR-03');
  });

  it('SNR-06: findet einen http-Endpunkt', () => {
    const found = scanSource([at('src/config/x.ts', "const m = 'http://mint.example';")]);
    expect(found.map((v) => v.rule)).toContain('SNR-06');
  });

  it('SNR-06: findet einen ws-Endpunkt', () => {
    const found = scanSource([at('src/config/x.ts', 'const r = "ws://relay.example";')]);
    expect(found.map((v) => v.rule)).toContain('SNR-06');
  });

  it('SNR-06: nimmt die Namespace-Datei von der http-Regel aus', () => {
    const found = scanSource([
      at('src/feed/namespaces.ts', "export const NS = 'http://www.itunes.com/dtds/podcast-1.0.dtd';"),
    ]);
    expect(found).toEqual([]);
  });

  it('SNR-01: kind:17375 und kind:7375 sind hier bewusst erlaubt', () => {
    // In cashu-player verbot NR-09 beide Ereignisarten. Kapitel 2 der
    // Spezifikation hebt das auf: Dieser Showcase muss kind:17375 lesen und
    // kind:7375 schreiben, sonst gibt es keine NIP-60-Quelle. Was an ihre
    // Stelle tritt — SNR-01 und SNR-02 — ist nicht mit einem reguleren
    // Ausdruck pruefbar und gehoert in Code-Review und manuelle Pruefung.
    const found = scanSource([
      at('src/nip60/wallet-event.ts', 'export const WALLET_KIND = 17375;'),
      at('src/nip60/wallet-event.ts', 'export const TOKEN_KIND = 7375;'),
    ]);
    expect(found).toEqual([]);
  });

  it('ignoriert Fundstellen in Zeilenkommentaren', () => {
    const found = scanSource([at('src/db/x.ts', '// localStorage ist gesperrt')]);
    expect(found).toEqual([]);
  });

  it('ignoriert Fundstellen in Blockkommentaren', () => {
    const source = ['/**', ' * Der Privkey steht nie in localStorage.', ' */', 'export const x = 1;'].join('\n');
    expect(scanSource([at('src/db/x.ts', source)])).toEqual([]);
  });

  it('findet einen Verstoß vor einem Zeilenkommentar in derselben Zeile', () => {
    const found = scanSource([at('src/db/x.ts', 'console.log(1); // Hinweis')]);
    expect(found.map((v) => v.rule)).toContain('SNR-03');
  });

  it('behandelt // innerhalb eines String-Literals nicht als Kommentar', () => {
    const found = scanSource([at('src/x.ts', "const u = 'https://ok.example'; // Hinweis")]);
    expect(found).toEqual([]);
  });

  it('meldet nichts für unauffälligen Code', () => {
    expect(scanSource([at('src/feed/parse.ts', 'export const x = 1;')])).toEqual([]);
  });

  it('nennt Datei und Zeilennummer jedes Fundes', () => {
    const found = scanSource([at('src/a.ts', 'const ok = 1;\nconsole.log(1);')]);
    expect(found[0]).toMatchObject({ file: 'src/a.ts', line: 2 });
  });
});
