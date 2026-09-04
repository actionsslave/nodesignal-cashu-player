/**
 * Das gemeinsame Gerüst aller Dialoge aus 5b.
 *
 * Immer dieselbe Abfolge: Kicker, eine Überschrift, die den Betrag oder den
 * Sachverhalt nennt, eine Erklärung, eine von Haarlinien eingefasste
 * Detailliste, dann die Aktionen. Die Hauptaktion nennt den Betrag
 * („500 Sat entnehmen"), nie „OK" — wer bestätigt, soll lesen können, was er
 * bestätigt.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

export interface DialogDetail {
  label: string;
  value: ComponentChildren;
}

export interface DialogProps {
  kicker: string;
  /** Kicker in Magenta — nur für Fehlschlag und Sperre. */
  kickerFail?: boolean;
  title: string;
  explanation?: ComponentChildren;
  details?: DialogDetail[];
  children?: ComponentChildren;
  actions: ComponentChildren;
  onCancel: () => void;
}

export function Dialog({
  kicker,
  kickerFail,
  title,
  explanation,
  details,
  children,
  actions,
  onCancel,
}: DialogProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  // Leere Abhängigkeiten: Ein Aufrufer, der eine Pfeilfunktion durchreicht,
  // liesse den Fokus sonst bei jedem Render neu springen — dieser Fehler war
  // im Vorgänger schon einmal da.
  useEffect(() => {
    boxRef.current?.querySelector('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div class="dialog-backdrop" onClick={() => onCancel()} role="presentation">
      <div
        class="dialog"
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <span class={kickerFail ? 'kicker kicker-12 fail' : 'kicker kicker-12'}>{kicker}</span>
        <h3 class="dialog-title">{title}</h3>
        {explanation && <p class="dialog-text">{explanation}</p>}
        {details && details.length > 0 && (
          <dl class="dialog-details">
            {details.map((detail) => (
              <div key={detail.label} class="dialog-detail">
                <dt>{detail.label}</dt>
                <dd>{detail.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {children}
        <div class="dialog-actions">{actions}</div>
      </div>
    </div>
  );
}
