/**
 * XML-Namespace-Bezeichner der Feed-Formate.
 *
 * Diese URIs sind Bezeichner, keine Endpunkte — sie werden nie abgerufen.
 * Der iTunes-Namespace ist historisch als http-URI definiert und lässt sich
 * nicht durch https ersetzen, ohne die Erkennung zu brechen. Deshalb ist genau
 * diese Datei von der NR-05-Regel ausgenommen; siehe tools/guardrails.ts.
 */
export const ITUNES_NS = 'http://www.itunes.com/dtds/podcast-1.0.dtd';

/** Podcasting 2.0. Feeds in freier Wildbahn verwenden beide Schreibweisen. */
export const PODCAST_NS = ['https://podcastindex.org/namespace/1.0', 'http://podcastindex.org/namespace/1.0'];
