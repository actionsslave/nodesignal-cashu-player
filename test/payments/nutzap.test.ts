import { describe, expect, it } from 'vitest';
import type { ResolvedPaymentTarget, StoredProof } from '../../src/contracts/index.js';
import { buildNutzap, p2pkLockKey } from '../../src/payments/nutzap.js';
import { EMPFAENGER_HEX, EMPFAENGER_NPUB, P2PK_PUBKEY } from '../helpers/nostr.js';

const TARGET: ResolvedPaymentTarget = {
  status: 'resolved',
  npub: EMPFAENGER_NPUB,
  pubkeyHex: EMPFAENGER_HEX,
  p2pkPubkey: P2PK_PUBKEY,
  mints: ['https://Mint-A.example/'],
  relays: ['wss://r1.example'],
  fetchedAt: 0,
};

const PROOFS: StoredProof[] = [
  { id: '00ad268c4d1f5826', amount: 8, secret: 's1', C: `02${'a'.repeat(64)}` },
  { id: '00ad268c4d1f5826', amount: 2, secret: 's2', C: `02${'b'.repeat(64)}` },
];

const tagsOf = (event: { tags: string[][] }, name: string) =>
  event.tags.filter((tag) => tag[0] === name);

describe('FR-27: Nutzap bauen', () => {
  it('ist ein kind:9321-Event', () => {
    expect(buildNutzap({ target: TARGET, mintUrl: TARGET.mints[0], proofs: PROOFS }).kind).toBe(9321);
  });

  it('trägt je Proof ein proof-Tag mit dem serialisierten Proof', () => {
    const event = buildNutzap({ target: TARGET, mintUrl: TARGET.mints[0], proofs: PROOFS });
    const proofTags = tagsOf(event, 'proof');
    expect(proofTags).toHaveLength(2);
    expect(JSON.parse(proofTags[0][1])).toEqual(PROOFS[0]);
  });

  it('trägt das unit-Tag sat', () => {
    const event = buildNutzap({ target: TARGET, mintUrl: TARGET.mints[0], proofs: PROOFS });
    expect(tagsOf(event, 'unit')[0]).toEqual(['unit', 'sat']);
  });

  it('trägt die Mint-URL exakt so, wie sie im kind:10019 steht', () => {
    const event = buildNutzap({ target: TARGET, mintUrl: TARGET.mints[0], proofs: PROOFS });
    expect(tagsOf(event, 'u')[0]).toEqual(['u', 'https://Mint-A.example/']);
  });

  it('trägt den Empfänger im p-Tag', () => {
    const event = buildNutzap({ target: TARGET, mintUrl: TARGET.mints[0], proofs: PROOFS });
    expect(tagsOf(event, 'p')[0]).toEqual(['p', EMPFAENGER_HEX]);
  });

  it('ist ohne Nachricht inhaltlich leer', () => {
    expect(buildNutzap({ target: TARGET, mintUrl: TARGET.mints[0], proofs: PROOFS }).content).toBe('');
  });

  it('FR-28: übernimmt die Nachricht in den content', () => {
    const event = buildNutzap({
      target: TARGET,
      mintUrl: TARGET.mints[0],
      proofs: PROOFS,
      content: 'Starke Folge 00:14:07',
    });
    expect(event.content).toBe('Starke Folge 00:14:07');
  });

  it('trägt einen Zeitstempel in Sekunden', () => {
    const event = buildNutzap({ target: TARGET, mintUrl: TARGET.mints[0], proofs: PROOFS });
    expect(event.created_at).toBeGreaterThan(1_600_000_000);
    expect(Number.isInteger(event.created_at)).toBe(true);
  });
});

describe('FR-27: P2PK-Schlüssel', () => {
  it('stellt dem x-only-Schlüssel aus kind:10019 ein 02 voran', () => {
    expect(p2pkLockKey(P2PK_PUBKEY)).toBe(`02${P2PK_PUBKEY}`);
  });

  it('lässt einen bereits komprimierten Schlüssel unverändert', () => {
    expect(p2pkLockKey(`02${P2PK_PUBKEY}`)).toBe(`02${P2PK_PUBKEY}`);
    expect(p2pkLockKey(`03${P2PK_PUBKEY}`)).toBe(`03${P2PK_PUBKEY}`);
  });
});

const BASIS = { target: TARGET, mintUrl: TARGET.mints[0], proofs: PROOFS };

describe('OQ-02: Podcast-, Episoden- und Zeitkontext als Tags', () => {
  const KONTEXT = {
    podcastTitle: 'Nodesignal',
    episodeTitle: 'E290 — Juni / Juli',
    podcastGuid: 'a1b2c3',
    episodeGuid: 'e-290',
    positionSeconds: 657,
  };

  it('schreibt Titel und GUIDs von Podcast und Episode', () => {
    const event = buildNutzap({ ...BASIS, context: KONTEXT });

    expect(tagsOf(event, 'podcast')).toEqual([['podcast', 'Nodesignal']]);
    expect(tagsOf(event, 'episode')).toEqual([['episode', 'E290 — Juni / Juli']]);
    expect(tagsOf(event, 'podcast_guid')).toEqual([['podcast_guid', 'a1b2c3']]);
    expect(tagsOf(event, 'episode_guid')).toEqual([['episode_guid', 'e-290']]);
  });

  it('schreibt die Hoerposition in ganzen Sekunden, wie blip-0010 sie fuehrt', () => {
    const event = buildNutzap({ ...BASIS, context: { ...KONTEXT, positionSeconds: 657.8 } });
    expect(tagsOf(event, 'ts')).toEqual([['ts', '657']]);
  });

  it('laesst Tags weg, zu denen es keinen Wert gibt', () => {
    const event = buildNutzap({ ...BASIS, context: { podcastTitle: 'Nodesignal' } });

    expect(tagsOf(event, 'podcast')).toHaveLength(1);
    expect(tagsOf(event, 'episode')).toEqual([]);
    expect(tagsOf(event, 'podcast_guid')).toEqual([]);
    expect(tagsOf(event, 'ts')).toEqual([]);
  });

  it('FR-27: die Pflicht-Tags bleiben unberuehrt', () => {
    const event = buildNutzap({ ...BASIS, context: KONTEXT });

    expect(tagsOf(event, 'unit')).toHaveLength(1);
    expect(tagsOf(event, 'u')).toHaveLength(1);
    expect(tagsOf(event, 'p')).toHaveLength(1);
    expect(event.tags.filter((tag) => tag[0] === 'proof').length).toBeGreaterThan(0);
  });

  it('kommt ohne Kontext aus — Streaming ohne aufgeloeste Episode', () => {
    const event = buildNutzap(BASIS);
    const namen = event.tags.map((tag) => tag[0]);
    expect(namen).not.toContain('podcast');
    expect(namen).not.toContain('ts');
  });
});
