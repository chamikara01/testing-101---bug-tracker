import {
  Document,
  Font,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { SEVERITY_DOC } from "@/lib/brand";
import { SEVERITY_LABELS } from "@/lib/types";
import type { ExportScreenshot, ReportBug, ReportData } from "@/lib/export/report-data";

// Allow long unbreakable tokens (e.g. URLs) to wrap inside a table cell instead
// of overflowing the margin: expose break opportunities every ~16 chars. Short
// words (< 18 chars) are returned whole, so normal prose is unaffected.
Font.registerHyphenationCallback((word) =>
  word.length > 18 ? (word.match(/.{1,16}/g) ?? [word]) : [word],
);

const LINE = "#e2e8f0";
const CHARCOAL = "#1e293b";
const SLATE = "#64748b";
const BLUE = "#2563eb";
const LIGHTBG = "#f8fafc";
const MAX_IMAGE_WIDTH = 330;
// Also bound height so a tall (portrait) screenshot can never exceed the usable
// page height. A wrap={false} block taller than a page makes react-pdf's
// pagination produce an invalid coordinate ("unsupported number") and throw.
const MAX_IMAGE_HEIGHT = 360;

// -----------------------------------------------------------------------------
// Text sanitisation. The built-in Helvetica font can only encode WinAnsi
// (CP1252). A glyph outside it (arrows, checkmarks, emoji, non-Latin scripts,
// "smart" punctuation) makes the layout engine fail to measure the text and
// throw `unsupported number: <huge>` at render time. Map the common ones to
// ASCII and replace anything else still outside Latin-1 so the render never
// crashes on user-entered content.
// -----------------------------------------------------------------------------
const CHAR_MAP: Record<string, string> = {
  "→": "->", "⇒": "=>", "←": "<-", "↔": "<->",
  "✓": "[x]", "✔": "[x]", "✗": "[x]", "✘": "[x]",
  "•": "-", "●": "-", "▪": "-", "⁃": "-", "·": "-",
  "…": "...", "–": "-", "—": "-", "−": "-",
  "‘": "'", "’": "'", "‚": "'", "“": '"', "”": '"',
  "„": '"', " ": " ", "€": "EUR", "™": "(TM)",
  "®": "(R)", "©": "(C)",
};

function sanitizePdfText(text: string): string {
  let out = "";
  for (const ch of text) {
    if (ch in CHAR_MAP) {
      out += CHAR_MAP[ch];
      continue;
    }
    const cp = ch.codePointAt(0) ?? 0;
    out += cp <= 0xff ? ch : "?";
  }
  return out;
}

function sanitizeReportData(data: ReportData): ReportData {
  const s = sanitizePdfText;
  const opt = (t: string | null) => (t ? s(t) : t);
  return {
    ...data,
    title: s(data.title),
    date: s(data.date),
    summary: s(data.summary),
    bugs: data.bugs.map((rb) => ({
      ...rb,
      reporterEmail: opt(rb.reporterEmail),
      portalName: opt(rb.portalName),
      sectionName: opt(rb.sectionName),
      bug: {
        ...rb.bug,
        title: s(rb.bug.title),
        description: opt(rb.bug.description),
        expected_result: opt(rb.bug.expected_result),
        actual_result: opt(rb.bug.actual_result),
        notes: opt(rb.bug.notes),
        url: opt(rb.bug.url),
        browser: opt(rb.bug.browser),
        os: opt(rb.bug.os),
        steps_to_reproduce: rb.bug.steps_to_reproduce.map(s),
      },
      screenshots: rb.screenshots.map((sh) => ({
        ...sh,
        caption: opt(sh.caption),
      })),
    })),
  };
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 74,
    paddingBottom: 54,
    paddingHorizontal: 48,
    fontSize: 10,
    color: CHARCOAL,
    fontFamily: "Helvetica",
    lineHeight: 1.45,
  },
  runningHeader: {
    position: "absolute",
    top: 28,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    paddingBottom: 6,
  },
  runningHeaderText: { fontSize: 8, color: SLATE },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 10 },
  metaLine: { flexDirection: "row", marginBottom: 2 },
  metaLabel: { fontFamily: "Helvetica-Bold" },
  sectionHeading: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: BLUE,
    marginTop: 18,
    marginBottom: 8,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  summary: { marginBottom: 4 },
  bugBox: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: LINE,
    marginBottom: 16,
  },
  bugHeader: { backgroundColor: CHARCOAL, paddingVertical: 6, paddingHorizontal: 10 },
  bugHeaderText: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 11 },
  bugHeaderMeta: { color: "#cbd5e1", fontSize: 8.5, marginTop: 2 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderColor: LINE },
  labelCell: {
    width: "28%",
    backgroundColor: LIGHTBG,
    borderRightWidth: 1,
    borderColor: LINE,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  labelText: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  valueCell: { flex: 1, paddingVertical: 6, paddingHorizontal: 8 },
  severityCell: { flex: 1, paddingVertical: 6, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  severityText: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 10 },
  muted: { color: SLATE, fontFamily: "Helvetica-Oblique" },
  link: { color: BLUE, textDecoration: "underline" },
  stepRow: { flexDirection: "row", marginBottom: 3 },
  stepNumber: { fontFamily: "Helvetica-Bold", color: BLUE, width: 16 },
  stepText: { flex: 1 },
  caption: { fontSize: 8, color: SLATE, fontFamily: "Helvetica-Oblique", marginTop: 3, marginBottom: 6 },
});

function fit(width: number, height: number) {
  const ratio = Math.min(
    MAX_IMAGE_WIDTH / width,
    MAX_IMAGE_HEIGHT / height,
    1,
  );
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

function Row({
  label,
  children,
  severity,
  breakable,
}: {
  label: string;
  children: React.ReactNode;
  severity?: boolean;
  /** Allow this row to split across pages. Needed for the screenshots row,
   *  which can be taller than a single page. */
  breakable?: boolean;
}) {
  return (
    <View style={styles.row} wrap={breakable ?? false}>
      <View style={styles.labelCell}>
        <Text style={styles.labelText}>{label}</Text>
      </View>
      <View style={severity ? styles.severityCell : styles.valueCell}>{children}</View>
    </View>
  );
}

function ScreenshotView({ shot }: { shot: ExportScreenshot }) {
  const { width, height } = fit(shot.width, shot.height);
  return (
    <View wrap={false}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image has no alt prop */}
      <Image src={{ data: Buffer.from(shot.data), format: shot.ext }} style={{ width, height, marginTop: 2 }} />
      {shot.caption ? <Text style={styles.caption}>{shot.caption}</Text> : null}
    </View>
  );
}

function BugBlock({ rb, index }: { rb: ReportBug; index: number }) {
  const { bug } = rb;
  const sev = SEVERITY_DOC[bug.severity];
  const env = [bug.browser && `Browser: ${bug.browser}`, bug.os && `OS: ${bug.os}`].filter(Boolean).join("   ·   ");
  // Portal · Section. Omitted entirely for projects that use neither.
  const location = [rb.portalName, rb.sectionName].filter(Boolean).join("   ·   ");

  return (
    <View style={styles.bugBox}>
      <View style={styles.bugHeader} wrap={false}>
        <Text style={styles.bugHeaderText}>
          BUG-{String(index + 1).padStart(2, "0")} - {bug.title}
        </Text>
        {rb.reporterEmail ? (
          <Text style={styles.bugHeaderMeta}>Reported by {rb.reporterEmail}</Text>
        ) : null}
      </View>

      <Row label="Severity" severity>
        <View style={{ backgroundColor: sev.bg, width: "100%", paddingVertical: 4, alignItems: "center" }}>
          <Text style={styles.severityText}>{SEVERITY_LABELS[bug.severity].toUpperCase()}</Text>
        </View>
      </Row>

      {location ? (
        <Row label="Location">
          <Text>{location}</Text>
        </Row>
      ) : null}

      <Row label="Description" breakable>
        <Text style={bug.description ? {} : styles.muted}>{bug.description ?? "N/A"}</Text>
      </Row>

      <Row label="Steps to Reproduce" breakable>
        {bug.steps_to_reproduce.length > 0 ? (
          bug.steps_to_reproduce.map((step, i) => (
            <View style={styles.stepRow} key={i}>
              <Text style={styles.stepNumber}>{i + 1}.</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.muted}>No steps provided.</Text>
        )}
      </Row>

      <Row label="Expected Result" breakable>
        <Text style={bug.expected_result ? {} : styles.muted}>{bug.expected_result ?? "N/A"}</Text>
      </Row>

      <Row label="Actual Result" breakable>
        <Text style={bug.actual_result ? {} : styles.muted}>{bug.actual_result ?? "N/A"}</Text>
      </Row>

      <Row label="Environment">
        <Text style={env ? {} : styles.muted}>{env || "N/A"}</Text>
      </Row>

      <Row label="URL" breakable>
        {bug.url ? (
          <Link src={bug.url} style={styles.link}>
            {bug.url}
          </Link>
        ) : (
          <Text style={styles.muted}>N/A</Text>
        )}
      </Row>

      <Row label="Screenshots" breakable>
        {rb.screenshots.length > 0 ? (
          <View>
            {rb.screenshots.map((shot, i) => (
              <ScreenshotView shot={shot} key={i} />
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>No screenshots attached.</Text>
        )}
      </Row>

      <Row label="Notes" breakable>
        <Text style={bug.notes ? {} : styles.muted}>{bug.notes ?? "N/A"}</Text>
      </Row>
    </View>
  );
}

function ReportPdf({ data }: { data: ReportData }) {
  return (
    <Document title={data.title}>
      <Page size="A4" style={styles.page}>
        {/* Running header repeats on every page. NB: do NOT add a `fixed`
            element with a render callback (e.g. page numbers) - combined with
            images across many pages it makes react-pdf accumulate an invalid
            coordinate and throw "unsupported number". */}
        <View style={styles.runningHeader} fixed>
          <Text style={styles.runningHeaderText}>{data.title}</Text>
          <Text style={styles.runningHeaderText}>{data.date}</Text>
        </View>

        <Text style={styles.title}>{data.title}</Text>
        <View style={styles.metaLine}>
          <Text style={styles.metaLabel}>Date: </Text>
          <Text>{data.date}</Text>
        </View>

        <Text style={styles.sectionHeading}>Summary</Text>
        <Text style={styles.summary}>{data.summary}</Text>

        <Text style={styles.sectionHeading}>Issue Details</Text>
        {data.bugs.length === 0 ? (
          <Text style={styles.muted}>No issues to report.</Text>
        ) : (
          data.bugs.map((rb, i) => <BugBlock rb={rb} index={i} key={rb.bug.id} />)
        )}
      </Page>
    </Document>
  );
}

export async function buildReportPdf(data: ReportData): Promise<Buffer> {
  return renderToBuffer(<ReportPdf data={sanitizeReportData(data)} />);
}
