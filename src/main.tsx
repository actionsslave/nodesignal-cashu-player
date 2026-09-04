/**
 * SFR-05: eine einzige Seite ohne Routing. Aufbau nach Entwurf 5a — Kopf,
 * Aktuelle Folge mit Sticky-Streifen, Folgen, Zahlungsquelle.
 *
 * Verlauf, Einstellungen und die Erklärung stehen weiter unten und werden im
 * nächsten Schritt auf den Entwurf gezogen; die Anker im Index zeigen schon
 * dorthin.
 */
import { render } from 'preact';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import {
  ALLOWED_MINTS,
  DEMO_RELAYS,
  FLOAT_DEFAULT_SATS,
  RECIPIENT_NPUB,
  STREAMING_RATE_DEFAULT_SATS_PER_MINUTE,
  hasPlaceholders,
} from './config/build-config.js';
import snapshotJson from './feed/snapshot.json';
import type { FeedSnapshot } from './feed/snapshot-parse.js';
import { loadEpisodes, type LoadedEpisodes } from './feed/episodes.js';
import { Masthead } from './ui/masthead.js';
import { EpisodeList } from './ui/episode-list.js';
import { Player } from './ui/player.js';
import { SourceSection } from './ui/source-section.js';
import { SettingsView } from './ui/settings-view.js';
import { detectSigner, nip44Decrypt } from './identity/nip07.js';
import { login, restoreSession, shortNpub, type Session } from './identity/session.js';
import { evaluateSources, type SourceId } from './payments/source.js';
import { resolvePaymentTarget } from './payments/resolve-target.js';
import { SimplePoolGateway } from './payments/simple-pool-gateway.js';
import { readNip60Wallet, type Nip60Snapshot } from './nip60/read.js';
import { LocalWallet } from './wallet/local-wallet.js';
import { CashuMintGateway } from './wallet/cashu-mint-gateway.js';
import { mintOverview } from './wallet/mint-overview.js';
import { readStorageMode } from './wallet/persistence.js';
import { TokenImportError } from './wallet/mint-gateway.js';
import { loadPosition } from './player/position-store.js';
import { openDatabase, type EpisodeRecord } from './db/database.js';
import type { PaymentTarget } from './contracts/index.js';
import './ui/app.css';

const snapshot = snapshotJson as FeedSnapshot;

const QUELLEN_NAME: Record<SourceId, string> = {
  nip60: 'nostr-Wallet (NIP-60)',
  local: 'Lokale Wallet',
};

function App() {
  const [session, setSession] = useState<Session | undefined>(undefined);
  const [feed, setFeed] = useState<LoadedEpisodes | undefined>(undefined);
  const [positions, setPositions] = useState<Map<string, number>>(new Map());
  const [nowPlaying, setNowPlaying] = useState<EpisodeRecord | undefined>(undefined);
  const [target, setTarget] = useState<PaymentTarget | undefined>(undefined);
  const [localBalance, setLocalBalance] = useState<Record<string, number>>({});
  const [nip60, setNip60] = useState<Nip60Snapshot | undefined>(undefined);
  const [storageMode, setStorageMode] = useState<string | undefined>(undefined);
  const [activeSource, setActiveSource] = useState<SourceId | undefined>(undefined);
  const [token, setToken] = useState('');
  const [importError, setImportError] = useState<string | undefined>(undefined);
  const [exportToken, setExportToken] = useState<string | undefined>(undefined);
  const [floatAmount] = useState(FLOAT_DEFAULT_SATS);
  const [rate] = useState(STREAMING_RATE_DEFAULT_SATS_PER_MINUTE);

  const signer = useMemo(() => detectSigner(), []);
  const mintGateway = useMemo(() => new CashuMintGateway(), []);
  const nostr = useMemo(() => new SimplePoolGateway(), []);
  const wallet = useMemo(() => new LocalWallet({ gateway: mintGateway }), [mintGateway]);

  const refreshWallet = useCallback(async () => {
    const db = await openDatabase();
    const [proofs, mode] = await Promise.all([db.getAll('proofs'), readStorageMode()]);
    const byMint: Record<string, number> = {};
    for (const row of mintOverview(proofs)) byMint[row.url] = row.balance;
    setLocalBalance(byMint);
    setStorageMode(mode);
  }, []);

  useEffect(() => {
    void restoreSession().then(setSession);
    void refreshWallet();
    // SFR-09: erst der Build-Stand, dann der Versuch eines frischen Abrufs.
    void loadEpisodes(snapshot).then(async (geladen) => {
      setFeed(geladen);
      const gespeichert = await Promise.all(geladen.episodes.map((e) => loadPosition(e.id)));
      const map = new Map<string, number>();
      geladen.episodes.forEach((episode, index) => {
        const wert = gespeichert[index];
        if (wert !== undefined) map.set(episode.id, wert);
      });
      setPositions(map);
    });
  }, [refreshWallet]);

  // Der Empfänger steht fest: genau ein Podcast (SFR-04).
  useEffect(() => {
    if (hasPlaceholders()) return;
    let cancelled = false;
    void resolvePaymentTarget(RECIPIENT_NPUB, { gateway: nostr }).then((resolved) => {
      if (!cancelled) setTarget(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [nostr]);

  // SFR-13, SNR-01: die NIP-60-Wallet wird gelesen, nie angelegt.
  useEffect(() => {
    if (!session || !signer.nip44) return;
    let cancelled = false;
    void readNip60Wallet({
      pubkeyHex: session.pubkeyHex,
      relays: [...DEMO_RELAYS],
      gateway: nostr,
      decrypt: nip44Decrypt,
    })
      .then((gelesen) => {
        if (!cancelled) setNip60(gelesen);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [session, signer.nip44, nostr]);

  const sources = useMemo(
    () =>
      evaluateSources({
        loggedIn: Boolean(session),
        hasNip44: signer.nip44,
        walletEvent: nip60?.wallet,
        nip60BalanceByMint: nip60?.balanceByMint ?? {},
        localBalanceByMint: localBalance,
        allowedMints: ALLOWED_MINTS,
        recipientMints: target?.status === 'resolved' ? target.mints : [],
      }),
    [session, signer.nip44, nip60, localBalance, target],
  );

  useEffect(() => {
    if (!activeSource && sources.preferred) setActiveSource(sources.preferred);
  }, [activeSource, sources.preferred]);

  async function handleImport() {
    setImportError(undefined);
    try {
      await wallet.importToken(token.trim());
      setToken('');
      await refreshWallet();
    } catch (cause) {
      setImportError(
        cause instanceof TokenImportError ? cause.message : 'Der Import ist fehlgeschlagen.',
      );
    }
  }

  const quelleAktiv = activeSource ? QUELLEN_NAME[activeSource] : 'keine gewählt';

  return (
    <div class="page">
      <Masthead
        npubShort={session ? shortNpub(session.npub) : undefined}
        onLogin={() => void login().then(setSession).catch(() => undefined)}
        feedFetchedAt={feed?.fetchedAt ?? snapshot.fetchedAt}
        feedStale={feed?.stale}
        sourceLabel={quelleAktiv}
      />

      {hasPlaceholders() && (
        <section class="block first">
          <p class="fail">
            Konfiguration unvollständig: In <code>src/config/build-config.ts</code> stehen noch
            Platzhalter für Feed, Empfänger oder Mints. Zahlungen bleiben deshalb gesperrt.
          </p>
        </section>
      )}

      <Player
        episode={nowPlaying}
        podcastTitle={feed?.title}
        artworkUrl={nowPlaying ? feed?.imageUrl : undefined}
        onPositionChange={() => undefined}
        sessionSent={0}
        floatRemaining={activeSource === 'nip60' ? 0 : undefined}
        rate={rate}
        sourceNote={activeSource === 'local' ? 'aus der lokalen Wallet' : 'aus dem Float'}
        canBoost={false}
      />

      <EpisodeList
        episodes={feed?.episodes ?? []}
        positions={positions}
        playingId={nowPlaying?.id}
        onPlay={setNowPlaying}
      />

      <SourceSection
        sources={sources}
        active={activeSource}
        onChoose={setActiveSource}
        floatRemaining={0}
        floatAmount={floatAmount}
        onChangeFloat={() => undefined}
        sessionSent={0}
        nip60BalanceByMint={nip60?.balanceByMint ?? {}}
        localBalanceByMint={localBalance}
        storageMode={storageMode}
        token={token}
        onTokenChange={setToken}
        onImport={() => void handleImport()}
        onExport={() => void wallet.exportTokens().then((liste) => setExportToken(liste[0]?.token))}
        onPaste={() =>
          void navigator.clipboard
            ?.readText()
            .then((text) => setToken(text.trim()))
            .catch(() => undefined)
        }
      />

      {importError && (
        <section class="block">
          <p class="fail">{importError}</p>
        </section>
      )}

      {exportToken && (
        <section class="block">
          <span class="kicker">Exportierter Token</span>
          <p style={{ wordBreak: 'break-all', fontSize: '14px' }}>{exportToken}</p>
        </section>
      )}

      <SettingsView
        floatAmount={floatAmount}
        floatConfirmed={false}
        rate={rate}
        rateConfirmed={false}
        onConfirmFloat={async () => undefined}
        onConfirmRate={async () => undefined}
      />
    </div>
  );
}

const root = document.getElementById('app');
if (root) render(<App />, root);
