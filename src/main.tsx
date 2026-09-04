/**
 * SFR-05: eine einzige Seite ohne Routing mit vier Bereichen — Episodenliste,
 * Player, Wallet, Einstellungen.
 *
 * Die Gestaltung ist schmucklos: Das Design-Handoff stand beim Bauen nicht zur
 * Verfügung. Struktur und Verhalten folgen der Spezifikation; wenn das Handoff
 * kommt, wird umgestylt, nicht neu gebaut.
 */
import { render } from 'preact';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import {
  ALLOWED_MINTS,
  FLOAT_DEFAULT_SATS,
  RECIPIENT_NPUB,
  STREAMING_RATE_DEFAULT_SATS_PER_MINUTE,
  hasPlaceholders,
} from './config/build-config.js';
import snapshotJson from './feed/snapshot.json';
import type { FeedSnapshot } from './feed/snapshot-parse.js';
import { loadEpisodes, type LoadedEpisodes } from './feed/episodes.js';
import { EpisodeList } from './ui/episode-list.js';
import { Player } from './ui/player.js';
import { WalletView } from './ui/wallet-view.js';
import { SettingsView } from './ui/settings-view.js';
import { detectSigner } from './identity/nip07.js';
import { login, restoreSession, shortNpub, type Session } from './identity/session.js';
import { evaluateSources, type SourceId } from './payments/source.js';
import { resolvePaymentTarget } from './payments/resolve-target.js';
import { SimplePoolGateway } from './payments/simple-pool-gateway.js';
import { LocalWallet } from './wallet/local-wallet.js';
import { CashuMintGateway } from './wallet/cashu-mint-gateway.js';
import { mintOverview } from './wallet/mint-overview.js';
import { listHistory } from './wallet/history.js';
import { readStorageMode } from './wallet/persistence.js';
import { TokenImportError } from './wallet/mint-gateway.js';
import { loadPosition } from './player/position-store.js';
import { openDatabase, type EpisodeRecord, type HistoryRecord } from './db/database.js';
import type { PaymentTarget } from './contracts/index.js';
import './ui/app.css';

const snapshot = snapshotJson as FeedSnapshot;

function App() {
  const [session, setSession] = useState<Session | undefined>(undefined);
  const [feed, setFeed] = useState<LoadedEpisodes | undefined>(undefined);
  const [positions, setPositions] = useState<Map<string, number>>(new Map());
  const [nowPlaying, setNowPlaying] = useState<EpisodeRecord | undefined>(undefined);
  const [target, setTarget] = useState<PaymentTarget | undefined>(undefined);
  const [localBalance, setLocalBalance] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<HistoryRecord[]>([]);
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
    const [proofs, entries, mode] = await Promise.all([
      db.getAll('proofs'),
      listHistory(),
      readStorageMode(),
    ]);
    const byMint: Record<string, number> = {};
    for (const row of mintOverview(proofs)) byMint[row.url] = row.balance;
    setLocalBalance(byMint);
    setHistory(entries);
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

  const sources = useMemo(
    () =>
      evaluateSources({
        loggedIn: Boolean(session),
        hasNip44: signer.nip44,
        // SFR-13: das kind:17375 wird noch nicht gelesen — bis dahin gilt die
        // NIP-60-Quelle als „keine Wallet gefunden", nicht als verfügbar.
        walletEvent: undefined,
        nip60BalanceByMint: {},
        localBalanceByMint: localBalance,
        allowedMints: ALLOWED_MINTS,
        recipientMints: target?.status === 'resolved' ? target.mints : [],
      }),
    [session, signer.nip44, localBalance, target],
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

  return (
    <main>
      <h1>Nodesignal — Cashu-Player</h1>

      {hasPlaceholders() && (
        <p class="notice">
          Konfiguration unvollständig: In <code>src/config/build-config.ts</code> stehen noch
          Platzhalter für Feed, Empfänger oder Mints. Zahlungen bleiben deshalb gesperrt.
        </p>
      )}

      <section>
        {session ? (
          <p>Angemeldet als {shortNpub(session.npub)}</p>
        ) : (
          <button type="button" onClick={() => void login().then(setSession).catch(() => undefined)}>
            Mit nostr anmelden
          </button>
        )}
        {!signer.available && (
          <p class="notice">
            Keine NIP-07-Extension gefunden. Episodenliste und Wiedergabe funktionieren trotzdem;
            Zahlungen brauchen eine Extension.
          </p>
        )}
      </section>

      <section>
        <h2>Episoden</h2>
        {/* SFR-09: scheitert der Laufzeit-Abruf, bleibt der Build-Stand mit Datum. */}
        {feed?.stale && (
          <p class="stale">
            Feed nicht erreichbar — angezeigt wird der Stand vom{' '}
            {new Date(feed.fetchedAt).toLocaleString('de-DE')}.
          </p>
        )}
        <EpisodeList
          episodes={feed?.episodes ?? []}
          positions={positions}
          playingId={nowPlaying?.id}
          onPlay={setNowPlaying}
        />
      </section>

      <section>
        <h2>Player</h2>
        <Player
          episode={nowPlaying}
          podcastTitle={feed?.title}
          artworkUrl={feed?.imageUrl}
          onPositionChange={() => undefined}
        />
      </section>

      <WalletView
        sources={sources}
        active={activeSource}
        onChooseSource={setActiveSource}
        floatRemaining={0}
        sessionSent={0}
        history={history}
        token={token}
        onTokenChange={setToken}
        onImport={() => void handleImport()}
        onExport={() =>
          void wallet.exportTokens().then((liste) => setExportToken(liste[0]?.token))
        }
        importError={importError}
        exportToken={exportToken}
        storageMode={storageMode}
      />

      <SettingsView
        floatAmount={floatAmount}
        floatConfirmed={false}
        rate={rate}
        rateConfirmed={false}
        onConfirmFloat={async () => undefined}
        onConfirmRate={async () => undefined}
      />
    </main>
  );
}

const root = document.getElementById('app');
if (root) render(<App />, root);
