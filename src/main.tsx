/**
 * SFR-05: eine einzige Seite ohne Routing. Aufbau nach Entwurf 5a, die
 * Zustände und Dialoge nach 5b.
 *
 * Hier steht die Zusammensetzung und der Ablauf einer Sitzung: wann der Float
 * entnommen wird, wann er zurückgeht, welche Quelle zahlt. Die Regeln selbst
 * stehen in den Modulen darunter — diese Datei entscheidet nichts über Geld,
 * sie ruft nur in der richtigen Reihenfolge auf.
 */
import { render } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  ALLOWED_MINTS,
  DEMO_RELAYS,
  RECIPIENT_NPUB,
  hasPlaceholders,
} from './config/build-config.js';
import snapshotJson from './feed/snapshot.json';
import type { FeedSnapshot } from './feed/snapshot-parse.js';
import { loadEpisodes, type LoadedEpisodes } from './feed/episodes.js';
import { Masthead } from './ui/masthead.js';
import { EpisodeList } from './ui/episode-list.js';
import { Player, episodeNumber, formatClock } from './ui/player.js';
import { SourceSection } from './ui/source-section.js';
import { BlockedSources } from './ui/blocked-sources.js';
import { BoostDialog } from './ui/boost-dialog.js';
import { ExportDialog } from './ui/export-dialog.js';
import { Explainer, EmbeddedNotice } from './ui/explainer.js';
import { HistoryView } from './ui/history-view.js';
import {
  ConflictDialog,
  FirstTakeDialog,
  LeftoverFloat,
  SwitchSourceDialog,
} from './ui/float-dialogs.js';
import { SettingsView } from './ui/settings-view.js';
import { detectSigner, nip44Decrypt, nip44Encrypt, signEvent } from './identity/nip07.js';
import { isEmbedded } from './identity/embedding.js';
import { login, logout, restoreSession, shortNpub, type Session } from './identity/session.js';
import { evaluateSources, type SourceId } from './payments/source.js';
import { resolvePaymentTarget } from './payments/resolve-target.js';
import { SimplePoolGateway } from './payments/simple-pool-gateway.js';
import { sendNutzap } from './payments/pay.js';
import { useStreamingController } from './ui/use-streaming.js';
import {
  confirmStreamingRate,
  getStreamingRate,
  isStreamingRateConfirmed,
} from './payments/streaming-settings.js';
import { readNip60Wallet, type Nip60Snapshot } from './nip60/read.js';
import { resolveWalletRelays } from './nip60/relays.js';
import { foreignWalletEventsSince } from './nip60/watch.js';
import { FloatService } from './nip60/float-service.js';
import {
  confirmFloatAmount,
  getFloatAmount,
  isFloatConfirmed,
  isHistoryEventsEnabled,
  readActiveSource,
  setHistoryEventsEnabled,
  writeActiveSource,
} from './nip60/float-settings.js';
import { LocalWallet, type ExportOffer } from './wallet/local-wallet.js';
import { CashuMintGateway } from './wallet/cashu-mint-gateway.js';
import { listHistory, recordPayment } from './wallet/history.js';
import { mintOverview } from './wallet/mint-overview.js';
import { readStorageMode } from './wallet/persistence.js';
import { TokenImportError } from './wallet/mint-gateway.js';
import { speicherText, untergrenzeText } from './wallet/messages.js';
import { loadPosition } from './player/position-store.js';
import {
  openDatabase,
  type EpisodeRecord,
  type FloatStateRecord,
  type HistoryRecord,
} from './db/database.js';
import type { PaymentTarget } from './contracts/index.js';
import './ui/app.css';

const snapshot = snapshotJson as FeedSnapshot;

const QUELLEN_NAME: Record<SourceId, string> = {
  nip60: 'nostr-Wallet (NIP-60)',
  local: 'Lokale Wallet',
};

/** Welcher Dialog offen ist. Immer höchstens einer. */
type OpenDialog =
  | { art: 'erste-entnahme'; danach: 'boost' | 'streaming' }
  | { art: 'boost'; timecode: string }
  | { art: 'wechsel'; ziel: SourceId }
  | { art: 'konflikt'; events: number }
  | { art: 'export'; offer: ExportOffer }
  | undefined;

function App() {
  const [session, setSession] = useState<Session | undefined>(undefined);
  const [feed, setFeed] = useState<LoadedEpisodes | undefined>(undefined);
  const [positions, setPositions] = useState<Map<string, number>>(new Map());
  const [nowPlaying, setNowPlaying] = useState<EpisodeRecord | undefined>(undefined);
  const [position, setPosition] = useState(0);
  const [target, setTarget] = useState<PaymentTarget | undefined>(undefined);
  const [localBalance, setLocalBalance] = useState<Record<string, number>>({});
  const [floatByMint, setFloatByMint] = useState<Record<string, number>>({});
  const [nip60, setNip60] = useState<Nip60Snapshot | undefined>(undefined);
  const [storageMode, setStorageMode] = useState<string | undefined>(undefined);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [activeSource, setActiveSource] = useState<SourceId | undefined>(undefined);
  const [token, setToken] = useState('');
  const [importError, setImportError] = useState<string | undefined>(undefined);
  const [dialog, setDialog] = useState<OpenDialog>(undefined);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const [floatAmount, setFloatAmount] = useState(0);
  const [floatConfirmed, setFloatConfirmed] = useState(false);
  /** SOQ-03: Rest einer abgebrochenen Sitzung, beim Laden angeboten. */
  const [leftover, setLeftover] = useState<FloatStateRecord | undefined>(undefined);
  const [floatState, setFloatState] = useState<FloatStateRecord | undefined>(undefined);
  /** SOQ-03: fremde kind:7375 seit der Entnahme. undefined heisst: nicht gefragt. */
  const [foreignEvents, setForeignEvents] = useState<number | undefined>(undefined);
  const [rate, setRate] = useState(0);
  const [rateConfirmed, setRateConfirmed] = useState(false);
  const [historyEvents, setHistoryEvents] = useState(false);
  /**
   * NIP-65: Die Wallet-Events liegen auf den Relays des Nutzers. Bis die Liste
   * da ist, wird nicht gelesen und erst recht nicht geschrieben — sonst ginge
   * die Rueckgabe an Relays, die sein eigener Client nicht liest.
   */
  const [walletRelays, setWalletRelays] = useState<string[] | undefined>(undefined);
  const [walletBusy, setWalletBusy] = useState(false);

  /** SFR-20, SFR-31: quellenübergreifend, überlebt einen Quellenwechsel. */
  const [sessionSent, setSessionSent] = useState(0);
  const [streamingNote, setStreamingNote] = useState<string | undefined>(undefined);

  const signer = useMemo(() => detectSigner(), []);
  const embedded = useMemo(() => isEmbedded(), []);
  const mintGateway = useMemo(() => new CashuMintGateway(), []);
  const nostr = useMemo(() => new SimplePoolGateway(), []);
  const localWallet = useMemo(() => new LocalWallet({ gateway: mintGateway }), [mintGateway]);
  const floatWallet = useMemo(
    () => new LocalWallet({ gateway: mintGateway, source: 'nip60' }),
    [mintGateway],
  );

  const floatService = useMemo(() => {
    // Ohne die Relayliste des Nutzers kein Float: Eine Entnahme, deren
    // Rueckgabe auf fremden Relays landet, ist kein akzeptables Risiko.
    if (!session || !walletRelays) return undefined;
    return new FloatService({
      pubkeyHex: session.pubkeyHex,
      relays: walletRelays,
      nostr,
      mint: mintGateway,
      encrypt: nip44Encrypt,
      signEvent,
    });
  }, [session, walletRelays, nostr, mintGateway]);

  const refreshWallet = useCallback(async () => {
    const db = await openDatabase();
    const [proofs, mode, eintraege, offen] = await Promise.all([
      db.getAll('proofs'),
      readStorageMode(),
      listHistory(),
      db.get('floatState', 'current'),
    ]);
    const lokal: Record<string, number> = {};
    for (const row of mintOverview(proofs, 'local')) lokal[row.url] = row.balance;
    const float: Record<string, number> = {};
    for (const row of mintOverview(proofs, 'nip60')) float[row.url] = row.balance;
    setLocalBalance(lokal);
    setFloatByMint(float);
    setStorageMode(mode);
    setHistory(eintraege);
    setFloatState(offen);
  }, []);

  const floatRemaining = useMemo(
    () => Object.values(floatByMint).reduce((total, wert) => total + wert, 0),
    [floatByMint],
  );

  useEffect(() => {
    void restoreSession().then(setSession);
    // NUT-07 zuerst: Was der Mint als ausgegeben kennt, darf gar nicht erst
    // als Guthaben erscheinen.
    void localWallet
      .pruneSpentProofs()
      .catch(() => 0)
      .then(() => refreshWallet());
    void getFloatAmount().then(setFloatAmount);
    void isFloatConfirmed().then(setFloatConfirmed);
    void getStreamingRate().then(setRate);
    void isStreamingRateConfirmed().then(setRateConfirmed);
    void isHistoryEventsEnabled().then(setHistoryEvents);
    void readActiveSource().then((gespeichert) => {
      if (gespeichert) setActiveSource(gespeichert);
    });

    // SOQ-03: Liegt beim Laden noch ein Float, wird er angeboten — nicht
    // ausgeführt. Was mit dem Geld geschieht, entscheidet der Nutzer.
    void openDatabase()
      .then((db) => db.get('floatState', 'current'))
      .then(setLeftover);

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
  }, [refreshWallet, localWallet]);

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

  useEffect(() => {
    if (!session) {
      setWalletRelays(undefined);
      return;
    }
    let cancelled = false;
    void resolveWalletRelays({
      pubkeyHex: session.pubkeyHex,
      gateway: nostr,
      fallback: DEMO_RELAYS,
    }).then((relays) => {
      if (!cancelled) setWalletRelays(relays);
    });
    return () => {
      cancelled = true;
    };
  }, [session, nostr]);

  /**
   * SFR-13, SNR-01: Die NIP-60-Wallet wird gelesen, nie angelegt.
   *
   * Als Funktion, nicht nur als Effekt: Wer die Wallet gerade erst in einem
   * anderen Client eingerichtet hat, soll sie hier sehen, ohne sich neu
   * anmelden zu müssen.
   */
  const readWallet = useCallback(async () => {
    if (!session || !signer.nip44 || !walletRelays) return;
    setWalletBusy(true);
    try {
      setNip60(
        await readNip60Wallet({
          pubkeyHex: session.pubkeyHex,
          relays: walletRelays,
          gateway: nostr,
          decrypt: nip44Decrypt,
        }),
      );
    } catch {
      // Nicht erreichbar heisst nicht „keine Wallet" — der letzte Stand bleibt.
    } finally {
      setWalletBusy(false);
    }
  }, [session, signer.nip44, walletRelays, nostr]);

  useEffect(() => {
    void readWallet();
  }, [readWallet]);

  const sources = useMemo(
    () =>
      evaluateSources({
        // SNR-05: Im iframe ist der Wallet-Betrieb aus — beide Quellen gesperrt.
        loggedIn: Boolean(session) && !embedded,
        hasNip44: signer.nip44,
        walletEvent: nip60?.wallet,
        walletUnreadable: nip60?.walletStatus === 'unlesbar',
        nip60BalanceByMint: nip60?.balanceByMint ?? {},
        localBalanceByMint: localBalance,
        allowedMints: ALLOWED_MINTS,
        recipientMints: target?.status === 'resolved' ? target.mints : [],
      }),
    [session, embedded, signer.nip44, nip60, localBalance, target],
  );

  useEffect(() => {
    if (!activeSource && sources.preferred) setActiveSource(sources.preferred);
  }, [activeSource, sources.preferred]);

  const zahlbarerMint = useMemo(() => {
    const state = activeSource === 'local' ? sources.local : sources.nip60;
    return state.mints[0];
  }, [activeSource, sources]);

  /** Was die aktive Quelle für eine Zahlung hergibt. */
  const verfuegbar = activeSource === 'nip60' ? floatRemaining : sources.local.balance;

  // ── Float ───────────────────────────────────────────────────────────────

  /**
   * SFR-16, SNR-06: Die Entnahme geschieht bei der ersten Zahlungsabsicht,
   * nie beim Laden der Seite, und erst nach der Bestätigung. Liefert false,
   * wenn stattdessen der Dialog aufgeht.
   */
  const ensureFloat = useCallback(
    async (danach: 'boost' | 'streaming'): Promise<boolean> => {
      if (activeSource !== 'nip60') return true;
      if (floatRemaining > 0) return true;
      if (!floatConfirmed) {
        setDialog({ art: 'erste-entnahme', danach });
        return false;
      }
      await takeFloat();
      return true;
    },
    [activeSource, floatRemaining, floatConfirmed],
  );

  async function takeFloat(): Promise<void> {
    if (!floatService || !nip60 || !zahlbarerMint) return;
    setBusy(true);
    try {
      await floatService.take({
        amount: floatAmount,
        mintUrl: zahlbarerMint,
        events: nip60.tokenEvents,
      });
      await refreshWallet();
    } catch (cause) {
      // SFR-19: „bereits ausgegeben" heisst, ein anderer Client war schneller.
      if (String(cause).includes('ausgegeben') || String(cause).includes('spent')) {
        setDialog({ art: 'konflikt', events: nip60.tokenEvents.length });
      } else {
        setStreamingNote(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      setBusy(false);
    }
  }

  /**
   * SFR-17: Idempotent. Der Auslöser kommt von mehreren Stellen — Tabwechsel,
   * Seitenende, Ende der Wiedergabe, Knopf —, geschrieben wird höchstens einmal.
   */
  const giveBackFloat = useCallback(async (): Promise<void> => {
    if (!floatService) return;
    try {
      await floatService.giveBack();
    } finally {
      await refreshWallet();
    }
  }, [floatService, refreshWallet]);

  useEffect(() => {
    if (!floatService) return;
    const zurueck = () => void giveBackFloat();
    const beiSichtwechsel = () => {
      if (document.visibilityState === 'hidden') zurueck();
    };
    document.addEventListener('visibilitychange', beiSichtwechsel);
    window.addEventListener('pagehide', zurueck);
    return () => {
      document.removeEventListener('visibilitychange', beiSichtwechsel);
      window.removeEventListener('pagehide', zurueck);
    };
  }, [floatService, giveBackFloat]);

  /**
   * SOQ-03: Solange ein Float offen ist, wird gefragt, ob ein anderer Client
   * an derselben Wallet geschrieben hat. Nicht im Takt — das waere Geplapper
   * gegen die Relays —, sondern nach der Entnahme und immer dann, wenn der Tab
   * wieder in den Vordergrund kommt.
   */
  const floatRef = useRef(floatState);
  floatRef.current = floatState;
  const openedAt = floatState?.openedAt;

  const checkForeignEvents = useCallback(async () => {
    const offen = floatRef.current;
    if (!session || !offen) {
      setForeignEvents(undefined);
      return;
    }
    try {
      const fremde = await foreignWalletEventsSince({
        pubkeyHex: session.pubkeyHex,
        relays: walletRelays ?? [...DEMO_RELAYS],
        gateway: nostr,
        sinceMs: offen.openedAt,
        ownEventIds: offen.ownEventIds ?? [],
      });
      setForeignEvents(fremde.length);
    } catch {
      // Nicht erreichbar heisst nicht „nichts passiert" — dann lieber schweigen.
      setForeignEvents(undefined);
    }
    // Der Float selbst haengt an einer Ref: Ohne das liefe die Abfrage bei
    // jedem Streaming-Tick erneut, weil refreshWallet den Datensatz neu setzt.
  }, [session, openedAt, walletRelays, nostr]);

  useEffect(() => {
    void checkForeignEvents();
    const beiSicht = () => {
      if (document.visibilityState === 'visible') void checkForeignEvents();
    };
    document.addEventListener('visibilitychange', beiSicht);
    return () => document.removeEventListener('visibilitychange', beiSicht);
  }, [checkForeignEvents]);

  // ── Zahlungen ───────────────────────────────────────────────────────────

  const walletFuerQuelle = activeSource === 'nip60' ? floatWallet : localWallet;

  /**
   * SFR-12, SNR-05: Die Erlaubnis wird unmittelbar vor jeder Geldbewegung
   * geprüft, nicht nur beim Zeichnen der Oberfläche.
   *
   * Die Quellenwahl überlebt den Reload (SFR-28). Ohne diese Prüfung könnte
   * eine gespeicherte Wahl den Weg zum Mint öffnen, während niemand angemeldet
   * ist oder die Seite in einem fremden Rahmen läuft — die Anzeige sagte
   * „gesperrt", der Swap liefe trotzdem. Und der Swap kommt vor der Signatur:
   * Bis die Extension fragt, ist das Geld schon gelockt.
   */
  const darfZahlen = useCallback((): boolean => {
    if (embedded || !session || !activeSource) return false;
    const quelle = activeSource === 'nip60' ? sources.nip60 : sources.local;
    return quelle.available;
  }, [embedded, session, activeSource, sources]);

  const zahle = useCallback(
    async (amount: number, kind: 'streaming' | 'boost', content?: string) => {
      if (!darfZahlen()) return 'fehlgeschlagen';
      if (!target || target.status !== 'resolved' || !nowPlaying) return 'fehlgeschlagen';
      const ergebnis = await sendNutzap(
        {
          target,
          amount,
          kind,
          content,
          // SFR-32: Der Verlauf soll die Quelle nennen, nicht raten lassen.
          source: activeSource,
          feedTitle: feed?.title,
          episodeTitle: nowPlaying.title,
          context: {
            podcastTitle: feed?.title,
            episodeTitle: nowPlaying.title,
            episodeGuid: nowPlaying.guid,
            positionSeconds: Math.floor(position),
          },
        },
        {
          wallet: walletFuerQuelle,
          mintGateway,
          nostr,
          signEvent,
        },
      );
      setSessionSent((bisher) => bisher + amount);
      await refreshWallet();
      return ergebnis.status;
    },
    [
      target,
      nowPlaying,
      feed,
      position,
      activeSource,
      darfZahlen,
      walletFuerQuelle,
      mintGateway,
      nostr,
      refreshWallet,
    ],
  );

  // SFR-23: Abrechnung je 60 Sekunden gehörter Zeit. Der Controller bleibt
  // stehen; nur seine Callbacks sind bei jedem Render frisch.
  const streaming = useStreamingController({
    rate,
    confirmed: rateConfirmed,
    source: activeSource,
    send: async (amount) => {
      if (!(await ensureFloat('streaming'))) return 'ausstehend';
      const status = await zahle(amount, 'streaming');
      return status === 'gesendet' ? 'gesendet' : 'ausstehend';
    },
    /*
     * Was diese Quelle finanzieren kann — nicht, was gerade lokal liegt.
     *
     * Der Controller haelt unterhalb der Untergrenze an, bevor er send()
     * aufruft. Meldete NIP-60 hier den offenen Float, waere der zu
     * Sitzungsbeginn null: Das Streaming stuende still, ehe ensureFloat()
     * ueberhaupt zur Entnahme kaeme, obwohl die Wallet voll ist.
     */
    balance: async () =>
      activeSource === 'nip60'
        ? floatRemaining > 0
          ? floatRemaining
          : sources.nip60.balance
        : localWallet.balance(),
    onStopped: (stopped) => setStreamingNote(stopped ? untergrenzeText() : undefined),
  });


  async function handleImport() {
    setImportError(undefined);
    try {
      await localWallet.importToken(token.trim());
      setToken('');
      await refreshWallet();
      streaming.resume();
    } catch (cause) {
      setImportError(
        cause instanceof TokenImportError ? cause.message : 'Der Import ist fehlgeschlagen.',
      );
    }
  }

  async function handleExport() {
    const angebot = await localWallet.beginExport();
    if (!angebot) return;
    setCopied(false);
    // Das Guthaben ist ab jetzt reserviert und zaehlt nicht mehr mit. Endgueltig
    // weg ist es erst, wenn der Nutzer den Token kopiert oder gespeichert hat.
    await refreshWallet();
    setDialog({ art: 'export', offer: angebot });
  }

  /** SFR-25: Der Nutzer hat den Token — jetzt ist er hier nichts mehr wert. */
  async function finishExport(offer: ExportOffer, behalten: boolean) {
    setDialog(undefined);
    if (behalten) {
      await localWallet.completeExport(offer);
      await recordPayment({
        direction: 'out',
        amount: offer.amount,
        kind: 'export',
        status: 'gesendet',
        source: 'local',
      });
    } else {
      await localWallet.cancelExport(offer);
    }
    await refreshWallet();
  }

  /** SFR-31: Ein offener Float geht zurück, bevor die neue Quelle aktiv wird. */
  function chooseSource(ziel: SourceId) {
    if (ziel === activeSource) return;
    if (activeSource === 'nip60' && floatRemaining > 0) {
      setDialog({ art: 'wechsel', ziel });
      return;
    }
    setActiveSource(ziel);
    void writeActiveSource(ziel);
  }

  /**
   * FR-06: Abmelden loescht Pubkey und Session. Die Proofs bleiben liegen —
   * sie gehoeren dem Geraet, nicht der Anmeldung, und ein Abmelden darf kein
   * Guthaben vernichten. Ein offener Float geht vorher zurueck (SFR-17).
   */
  async function handleLogout() {
    if (floatRemaining > 0) await giveBackFloat();
    await logout();
    setSession(undefined);
    setNip60(undefined);
    setActiveSource(undefined);
    setForeignEvents(undefined);
  }

  const quelleAktiv = activeSource ? QUELLEN_NAME[activeSource] : 'keine gewählt';
  const beideGesperrt = !sources.nip60.available && !sources.local.available;
  const canBoost =
    !beideGesperrt && Boolean(activeSource) && target?.status === 'resolved' && Boolean(nowPlaying);

  return (
    <div class="page">
      <Masthead
        npubShort={session ? shortNpub(session.npub) : undefined}
        onLogin={() => void login().then(setSession).catch(() => undefined)}
        feedFetchedAt={feed?.fetchedAt ?? snapshot.fetchedAt}
        feedStale={feed?.stale}
        sourceLabel={quelleAktiv}
        loggedIn={Boolean(session)}
        onLogout={() => void handleLogout()}
        onReloadWallet={signer.nip44 ? () => void readWallet() : undefined}
        walletBusy={walletBusy}
      />

      {hasPlaceholders() && (
        <section class="block first">
          <p class="fail">
            Konfiguration unvollständig: In <code>src/config/build-config.ts</code> stehen noch
            Platzhalter für Feed, Empfänger oder Mints. Zahlungen bleiben deshalb gesperrt.
          </p>
        </section>
      )}

      {embedded && <EmbeddedNotice />}

      <Player
        episode={nowPlaying}
        podcastTitle={feed?.title}
        artworkUrl={nowPlaying ? feed?.imageUrl : undefined}
        onTick={streaming.onTick}
        onPositionChange={setPosition}
        sessionSent={sessionSent}
        floatRemaining={activeSource === 'nip60' ? floatRemaining : undefined}
        rate={rate}
        sourceNote={activeSource === 'local' ? 'aus der lokalen Wallet' : 'aus dem Float'}
        floatNote={
          // SOQ-03: nur sagen, was wirklich abgefragt wurde.
          floatState === undefined || foreignEvents === undefined
            ? undefined
            : foreignEvents === 0
              ? 'Keine Wallet-Events seit der Entnahme'
              : `${foreignEvents} fremde Wallet-Events seit der Entnahme`
        }
        onWriteBackFloat={
          floatRemaining > 0 && activeSource === 'nip60' ? () => void giveBackFloat() : undefined
        }
        onBoost={() => setDialog({ art: 'boost', timecode: formatClock(position) })}
        canBoost={canBoost}
      />

      {/* SOQ-03: nur, wenn tatsaechlich noch etwas liegt. */}
      {leftover && floatRemaining > 0 && (
        <LeftoverFloat
          amount={floatRemaining}
          mintUrl={leftover.mintUrl}
          openedAt={leftover.openedAt}
          busy={busy}
          onReturn={() => {
            setLeftover(undefined);
            void giveBackFloat();
          }}
          onKeep={() => setLeftover(undefined)}
        />
      )}

      {streamingNote && (
        <section class="block">
          <p class="fail">{streamingNote}</p>
        </section>
      )}

      <EpisodeList
        episodes={feed?.episodes ?? []}
        positions={positions}
        playingId={nowPlaying?.id}
        onPlay={setNowPlaying}
      />

      {beideGesperrt ? (
        <BlockedSources
          sources={sources}
          token={token}
          onTokenChange={setToken}
          onImport={() => void handleImport()}
        />
      ) : (
        <SourceSection
          sources={sources}
          active={activeSource}
          onChoose={chooseSource}
          floatRemaining={floatRemaining}
          floatAmount={floatAmount}
          onChangeFloat={() => document.getElementById('float')?.focus()}
          sessionSent={sessionSent}
          walletRelays={walletRelays}
          onReloadWallet={signer.nip44 && session ? () => void readWallet() : undefined}
          walletBusy={walletBusy}
          nip60BalanceByMint={nip60?.balanceByMint ?? {}}
          localBalanceByMint={localBalance}
          storageMode={storageMode}
          token={token}
          onTokenChange={setToken}
          onImport={() => void handleImport()}
          onExport={() => void handleExport()}
          onPaste={() =>
            void navigator.clipboard
              ?.readText()
              .then((text) => setToken(text.trim()))
              .catch(() => undefined)
          }
        />
      )}

      {importError && (
        <section class="block">
          <p class="fail">{importError}</p>
        </section>
      )}

      {/* SFR-26: nur zeigen, wenn der Browser dauerhaften Speicher verweigert. */}
      {storageMode && storageMode !== 'dauerhaft' && (
        <section class="block">
          <span class="kicker">Speicher</span>
          <p class="dialog-text">{speicherText(storageMode as 'best effort')}</p>
        </section>
      )}

      <SettingsView
        floatAmount={floatAmount}
        floatConfirmed={floatConfirmed}
        rate={rate}
        rateConfirmed={rateConfirmed}
        historyEvents={historyEvents}
        onToggleHistoryEvents={(enabled) => {
          setHistoryEvents(enabled);
          void setHistoryEventsEnabled(enabled);
        }}
        onConfirmFloat={async (betrag) => {
          await confirmFloatAmount(betrag);
          setFloatAmount(betrag);
          setFloatConfirmed(true);
        }}
        onConfirmRate={async (satz) => {
          await confirmStreamingRate(satz);
          setRate(satz);
          setRateConfirmed(true);
        }}
      />

      <HistoryView entries={history} />

      <Explainer />

      {dialog?.art === 'erste-entnahme' && zahlbarerMint && (
        <FirstTakeDialog
          amount={floatAmount}
          mintUrl={zahlbarerMint}
          rate={rate}
          showRiskNotice={!floatConfirmed}
          busy={busy}
          onConfirm={() => {
            setDialog(undefined);
            void confirmFloatAmount(floatAmount)
              .then(() => setFloatConfirmed(true))
              .then(takeFloat);
          }}
          onCancel={() => setDialog(undefined)}
          onChangeAmount={() => {
            setDialog(undefined);
            document.getElementById('float')?.focus();
          }}
        />
      )}

      {dialog?.art === 'boost' && zahlbarerMint && (
        <BoostDialog
          episodeTitle={nowPlaying?.title ?? ''}
          episodeNumber={nowPlaying ? episodeNumber(nowPlaying.title) : undefined}
          podcastTitle={feed?.title ?? 'Nodesignal'}
          timecode={dialog.timecode}
          sourceLabel={activeSource === 'nip60' ? 'nostr-Wallet · Float' : 'Lokale Wallet'}
          mintUrl={zahlbarerMint}
          available={verfuegbar}
          floatRemaining={activeSource === 'nip60' ? floatRemaining : undefined}
          busy={busy}
          onTopUpFloat={
            activeSource === 'nip60'
              ? () => {
                  setDialog(undefined);
                  void takeFloat();
                }
              : undefined
          }
          onSend={(amount, comment) => {
            setDialog(undefined);
            setBusy(true);
            void ensureFloat('boost')
              .then((bereit) => (bereit ? zahle(amount, 'boost', comment) : undefined))
              .finally(() => setBusy(false));
          }}
          onCancel={() => setDialog(undefined)}
        />
      )}

      {dialog?.art === 'wechsel' && (
        <SwitchSourceDialog
          floatRemaining={floatRemaining}
          targetName={QUELLEN_NAME[dialog.ziel]}
          targetBalance={dialog.ziel === 'local' ? sources.local.balance : sources.nip60.balance}
          sessionSent={sessionSent}
          busy={busy}
          onConfirm={() => {
            const ziel = dialog.ziel;
            setDialog(undefined);
            setBusy(true);
            void giveBackFloat()
              .then(() => {
                setActiveSource(ziel);
                return writeActiveSource(ziel);
              })
              .finally(() => setBusy(false));
          }}
          onCancel={() => setDialog(undefined)}
        />
      )}

      {dialog?.art === 'konflikt' && (
        <ConflictDialog
          affectedEvents={dialog.events}
          newBalance={sources.nip60.balance}
          floatRemaining={floatRemaining}
          onRetry={() => {
            setDialog(undefined);
            void takeFloat();
          }}
          onSwitchToLocal={() => {
            setDialog(undefined);
            setActiveSource('local');
            void writeActiveSource('local');
          }}
          onCancel={() => setDialog(undefined)}
        />
      )}

      {dialog?.art === 'export' && (
        <ExportDialog
          amount={dialog.offer.amount}
          mintUrl={dialog.offer.mintUrl}
          token={dialog.offer.token}
          copied={copied}
          onCopy={() => {
            void navigator.clipboard?.writeText(dialog.offer.token).then(() => setCopied(true));
          }}
          onSaveFile={() => {
            const blob = new Blob([dialog.offer.token], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'cashu-token.txt';
            link.click();
            URL.revokeObjectURL(url);
            setCopied(true);
          }}
          onDone={() => void finishExport(dialog.offer, true)}
          onCancel={() => void finishExport(dialog.offer, false)}
        />
      )}

    </div>
  );
}

const root = document.getElementById('app');
if (root) render(<App />, root);
