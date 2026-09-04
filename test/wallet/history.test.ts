import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase } from '../../src/db/database.js';
import { listHistory, recordPayment, updatePaymentStatus } from '../../src/wallet/history.js';
import { resetDatabase } from '../helpers/db.js';

beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  await closeDatabase();
});

describe('FR-19: Zahlungsverlauf', () => {
  it('hält Richtung, Betrag, Zeitstempel, Podcast, Episode und Status fest', async () => {
    await recordPayment({
      direction: 'out',
      amount: 10,
      kind: 'streaming',
      status: 'gesendet',
      feedTitle: 'Testpodcast',
      episodeTitle: 'Folge 1',
    });

    const [entry] = await listHistory();
    expect(entry).toMatchObject({
      direction: 'out',
      amount: 10,
      kind: 'streaming',
      status: 'gesendet',
      feedTitle: 'Testpodcast',
      episodeTitle: 'Folge 1',
    });
    expect(entry.at).toBeGreaterThan(0);
  });

  it('listet die jüngsten Einträge zuerst', async () => {
    await recordPayment({ direction: 'out', amount: 1, kind: 'streaming', status: 'gesendet', at: 1000 });
    await recordPayment({ direction: 'out', amount: 2, kind: 'boost', status: 'gesendet', at: 3000 });
    await recordPayment({ direction: 'in', amount: 3, kind: 'import', status: 'empfangen', at: 2000 });

    expect((await listHistory()).map((entry) => entry.amount)).toEqual([2, 3, 1]);
  });

  it('begrenzt die Ausgabe auf die angefragte Anzahl', async () => {
    for (let i = 0; i < 5; i++) {
      await recordPayment({ direction: 'out', amount: i, kind: 'boost', status: 'gesendet', at: i });
    }
    expect(await listHistory(2)).toHaveLength(2);
  });

  it('FR-29: ein ausstehender Eintrag lässt sich auf fehlgeschlagen setzen', async () => {
    const id = await recordPayment({
      direction: 'out',
      amount: 1000,
      kind: 'boost',
      status: 'ausstehend',
    });

    await updatePaymentStatus(id, 'fehlgeschlagen', 'Kein Relay hat bestätigt.');

    const [entry] = await listHistory();
    expect(entry.status).toBe('fehlgeschlagen');
    expect(entry.error).toBe('Kein Relay hat bestätigt.');
  });
});
