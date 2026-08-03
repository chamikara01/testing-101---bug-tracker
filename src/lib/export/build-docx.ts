import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  ImageRun,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
} from "docx";
import { SEVERITY_DOC, hex } from "@/lib/brand";
import { SEVERITY_LABELS } from "@/lib/types";
import type { ReportBug, ReportData } from "@/lib/export/report-data";

const CHARCOAL = "1e293b";
const SLATE = "64748b";
const LINE = "e2e8f0";
const BLUE = "2563eb";
const LIGHTBG = "f8fafc";

const LABEL_W = 2500;
const VALUE_W = 6500;
const FULL_W = LABEL_W + VALUE_W;
const MAX_IMAGE_WIDTH = 400;
const MAX_IMAGE_HEIGHT = 520;

const CELL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const TABLE_BORDERS = {
  top: CELL_BORDER,
  bottom: CELL_BORDER,
  left: CELL_BORDER,
  right: CELL_BORDER,
  insideHorizontal: CELL_BORDER,
  insideVertical: CELL_BORDER,
};
const CELL_MARGINS = { top: 80, bottom: 80, left: 120, right: 120 };

function run(text: string, opts: Partial<{ bold: boolean; italics: boolean; color: string; size: number }> = {}) {
  return new TextRun({ text, size: opts.size ?? 22, bold: opts.bold, italics: opts.italics, color: opts.color });
}

function textPara(text: string, muted = false): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [run(text, muted ? { italics: true, color: SLATE } : {})],
  });
}

function labelCell(label: string): TableCell {
  return new TableCell({
    width: { size: LABEL_W, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, color: "auto", fill: LIGHTBG },
    margins: CELL_MARGINS,
    verticalAlign: VerticalAlign.TOP,
    children: [new Paragraph({ children: [run(label, { bold: true })] })],
  });
}

function valueCell(children: Paragraph[]): TableCell {
  return new TableCell({
    width: { size: VALUE_W, type: WidthType.DXA },
    margins: CELL_MARGINS,
    verticalAlign: VerticalAlign.TOP,
    children: children.length > 0 ? children : [textPara("-", true)],
  });
}

function dataRow(label: string, children: Paragraph[]): TableRow {
  return new TableRow({ children: [labelCell(label), valueCell(children)] });
}

function headerRow(text: string, reporter: string | null): TableRow {
  const paragraphs = [
    new Paragraph({ children: [run(text, { bold: true, color: "ffffff", size: 24 })] }),
  ];
  if (reporter) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 20 },
        children: [run(`Reported by ${reporter}`, { color: "cbd5e1", size: 18 })],
      }),
    );
  }
  return new TableRow({
    children: [
      new TableCell({
        columnSpan: 2,
        width: { size: FULL_W, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, color: "auto", fill: CHARCOAL },
        margins: CELL_MARGINS,
        children: paragraphs,
      }),
    ],
  });
}

function severityRow(severity: ReportBug["bug"]["severity"]): TableRow {
  const color = SEVERITY_DOC[severity];
  return new TableRow({
    children: [
      labelCell("Severity"),
      new TableCell({
        width: { size: VALUE_W, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, color: "auto", fill: hex(color.bg) },
        margins: CELL_MARGINS,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [run(SEVERITY_LABELS[severity].toUpperCase(), { bold: true, color: hex(color.fg) })],
          }),
        ],
      }),
    ],
  });
}

function stepParas(steps: string[]): Paragraph[] {
  if (steps.length === 0) return [textPara("No steps provided.", true)];
  return steps.map(
    (step, i) =>
      new Paragraph({
        spacing: { after: 40 },
        indent: { left: 280, hanging: 280 },
        children: [run(`${i + 1}.  `, { bold: true }), run(step)],
      }),
  );
}

function screenshotParas(shots: ReportBug["screenshots"]): Paragraph[] {
  const out: Paragraph[] = [];
  for (const shot of shots) {
    const scale = Math.min(
      MAX_IMAGE_WIDTH / shot.width,
      MAX_IMAGE_HEIGHT / shot.height,
      1,
    );
    out.push(
      new Paragraph({
        spacing: { before: 60, after: shot.caption ? 20 : 80 },
        children: [
          new ImageRun({
            type: shot.ext,
            data: shot.data,
            transformation: { width: Math.round(shot.width * scale), height: Math.round(shot.height * scale) },
          }),
        ],
      }),
    );
    if (shot.caption) {
      out.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [run(shot.caption, { italics: true, color: SLATE, size: 18 })],
        }),
      );
    }
  }
  return out;
}

function urlParas(url: string | null): Paragraph[] {
  if (!url) return [textPara("N/A", true)];
  return [
    new Paragraph({
      children: [
        new ExternalHyperlink({
          link: url,
          children: [
            new TextRun({
              text: url,
              size: 22,
              color: BLUE,
              underline: { type: UnderlineType.SINGLE },
            }),
          ],
        }),
      ],
    }),
  ];
}

function bugTable(rb: ReportBug, index: number): Table {
  const { bug } = rb;
  const env = [bug.browser && `Browser: ${bug.browser}`, bug.os && `OS: ${bug.os}`]
    .filter(Boolean)
    .join("  ·  ");
  const rows: TableRow[] = [
    headerRow(`BUG-${String(index + 1).padStart(2, "0")} - ${bug.title}`, rb.reporterEmail),
    severityRow(bug.severity),
    dataRow("Description", [textPara(bug.description ?? "N/A", !bug.description)]),
    dataRow("Steps to Reproduce", stepParas(bug.steps_to_reproduce)),
    dataRow("Expected Result", [textPara(bug.expected_result ?? "N/A", !bug.expected_result)]),
    dataRow("Actual Result", [textPara(bug.actual_result ?? "N/A", !bug.actual_result)]),
    dataRow("Environment", [textPara(env || "N/A", !env)]),
    dataRow("URL", urlParas(bug.url)),
    dataRow(
      "Screenshots",
      rb.screenshots.length > 0
        ? screenshotParas(rb.screenshots)
        : [textPara("No screenshots attached.", true)],
    ),
    dataRow("Notes", [textPara(bug.notes ?? "N/A", !bug.notes)]),
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [LABEL_W, VALUE_W],
    borders: TABLE_BORDERS,
    rows,
  });
}

function metaLine(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [run(`${label}: `, { bold: true }), run(value)],
  });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 260, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 } },
    children: [run(text, { bold: true, color: BLUE, size: 26 })],
  });
}

export async function buildReportDocx(data: ReportData): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  children.push(new Paragraph({ spacing: { after: 120 }, children: [run(data.title, { bold: true, size: 36 })] }));
  children.push(metaLine("Date", data.date));

  children.push(sectionHeading("Summary"));
  children.push(new Paragraph({ spacing: { after: 80 }, children: [run(data.summary)] }));

  children.push(sectionHeading("Issue Details"));
  if (data.bugs.length === 0) {
    children.push(textPara("No issues to report.", true));
  } else {
    data.bugs.forEach((rb, i) => {
      children.push(bugTable(rb, i));
      children.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
    });
  }

  const header = new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: FULL_W }],
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 2 } },
        children: [run(data.title, { color: SLATE, size: 16 }), run("\t", { size: 16 }), run(data.date, { color: SLATE, size: 16 })],
      }),
    ],
  });

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], size: 16, color: SLATE }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [{ headers: { default: header }, footers: { default: footer }, children }],
  });

  return Packer.toBuffer(doc);
}
