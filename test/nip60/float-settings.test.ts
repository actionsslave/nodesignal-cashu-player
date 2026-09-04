/**
 * SFR-18, SFR-28: Float-Betrag und Quellenwahl überleben einen Reload.
 *
 * Beides liegt in IndexedDB, nicht in localStorage (NR-04). Die Quellenwahl
 * ist eine Entscheidung des Nutzers — sie beim Reload zu vergessen hiesse, ihn
 * bei jedem Besuch neu fragen zu müssen.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  confirmFloatAmount,
  getFloatAmount,
  isFloatConfirmed,
  readActiveSource,
  setFloatAmount,
  writeActiveSource,
} from '../../src/nip60/float-settings.js';
import { FLOAT_DEFAULT_SATS } from '../../src/config/build-config.js';
import { resetDatabase } from '../helpers/db.js';

describe('Float-Einstellungen', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('liefert ohne Eintrag die Vorgabe', async () => {
    await expect(getFloatAmount()).resolves.toBe(FLOAT_DEFAULT_SATS);
  });

  it('behält einen gesetzten Betrag', async () => {
    await setFloatAmount(1200);
    await expect(getFloatAmount()).resolves.toBe(1200);
  });

  it('weist Beträge außerhalb der Grenzen ab', async () => {
    await expect(setFloatAmount(50)).rejects.toThrow();
    await expect(setFloatAmount(20_000)).rejects.toThrow();
    await expect(getFloatAmount()).resolves.toBe(FLOAT_DEFAULT_SATS);
  });

  it('SNR-06: gilt erst nach der Bestätigung als bestätigt', async () => {
    await expect(isFloatConfirmed()).resolves.toBe(false);
    await confirmFloatAmount(500);
    await expect(isFloatConfirmed()).resolves.toBe(true);
  });

  it('SFR-28: merkt sich die gewählte Quelle', async () => {
    await expect(readActiveSource()).resolves.toBeUndefined();
    await writeActiveSource('local');
    await expect(readActiveSource()).resolves.toBe('local');
  });
});

describe('kind:7376 (SFR-21)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('ist ohne Zutun aus', async () => {
    const { isHistoryEventsEnabled } = await import('../../src/nip60/float-settings.js');
    await expect(isHistoryEventsEnabled()).resolves.toBe(false);
  });

  it('lässt sich einschalten und wieder aus', async () => {
    const { isHistoryEventsEnabled, setHistoryEventsEnabled } = await import(
      '../../src/nip60/float-settings.js'
    );
    await setHistoryEventsEnabled(true);
    await expect(isHistoryEventsEnabled()).resolves.toBe(true);
    await setHistoryEventsEnabled(false);
    await expect(isHistoryEventsEnabled()).resolves.toBe(false);
  });
});
