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
  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    textAlign: "center",
    fontSize: 8,
    color: SLATE,
  },
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
  if (width <= MAX_IMAGE_WIDTH) return { width, height };
  const ratio = MAX_IMAGE_WIDTH / width;
  return { width: MAX_IMAGE_WIDTH, height: Math.round(height * ratio) };
}

function Row({ label, children, severity }: { label: string; children: React.ReactNode; severity?: boolean }) {
  return (
    <View style={styles.row} wrap={false}>
      <View style={styles.labelCell}>
        <Text style={styles.labelText}>{label}</Text>
      </View>
      <View style={severity ? styles.severityCell : styles.valueCell}>{children}</View>
    </View>
  );
}

function ScreenshotView({ shot }: { shot: ExportScreenshot }) {
  if (shot.ext !== "png" && shot.ext !== "jpg") {
    return <Text style={styles.caption}>{shot.caption ? `${shot.caption} ` : ""}(image .{shot.ext} not supported in PDF)</Text>;
  }
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

  return (
    <View style={styles.bugBox}>
      <View style={styles.bugHeader} wrap={false}>
        <Text style={styles.bugHeaderText}>
          BUG-{String(index + 1).padStart(2, "0")} - {bug.title}
        </Text>
      </View>

      <Row label="Severity" severity>
        <View style={{ backgroundColor: sev.bg, width: "100%", paddingVertical: 4, alignItems: "center" }}>
          <Text style={styles.severityText}>{SEVERITY_LABELS[bug.severity].toUpperCase()}</Text>
        </View>
      </Row>

      <Row label="Description">
        <Text style={bug.description ? {} : styles.muted}>{bug.description ?? "N/A"}</Text>
      </Row>

      <Row label="Steps to Reproduce">
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

      <Row label="Expected Result">
        <Text style={bug.expected_result ? {} : styles.muted}>{bug.expected_result ?? "N/A"}</Text>
      </Row>

      <Row label="Actual Result">
        <Text style={bug.actual_result ? {} : styles.muted}>{bug.actual_result ?? "N/A"}</Text>
      </Row>

      <Row label="Environment">
        <Text style={env ? {} : styles.muted}>{env || "N/A"}</Text>
      </Row>

      <Row label="URL">
        {bug.url ? (
          <Link src={bug.url} style={styles.link}>
            {bug.url}
          </Link>
        ) : (
          <Text style={styles.muted}>N/A</Text>
        )}
      </Row>

      <Row label="Screenshots">
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

      <Row label="Notes">
        <Text style={bug.notes ? {} : styles.muted}>{bug.notes ?? "N/A"}</Text>
      </Row>
    </View>
  );
}

function ReportPdf({ data }: { data: ReportData }) {
  return (
    <Document title={data.title}>
      <Page size="A4" style={styles.page}>
        <View style={styles.runningHeader} fixed>
          <Text style={styles.runningHeaderText}>{data.title}</Text>
          <Text style={styles.runningHeaderText}>Version {data.version}</Text>
        </View>
        <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />

        <Text style={styles.title}>{data.title}</Text>
        <View style={styles.metaLine}>
          <Text style={styles.metaLabel}>Version: </Text>
          <Text>{data.version}</Text>
        </View>
        <View style={styles.metaLine}>
          <Text style={styles.metaLabel}>Date: </Text>
          <Text>{data.date}</Text>
        </View>
        <View style={styles.metaLine}>
          <Text style={styles.metaLabel}>Prepared by: </Text>
          <Text>{data.preparedBy ?? "-"}</Text>
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
  return renderToBuffer(<ReportPdf data={data} />);
}
