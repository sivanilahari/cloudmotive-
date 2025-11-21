import { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './App.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PDF_URL = '/Maersk Q2 2025 Interim Report.pdf';

const analysisPoints = [
  'No extraordinary or one-off items affecting EBITDA were reported in Q2 2025. The release attributes the improvement to better operational performance.',
  'Management highlights that EBITDA gains stem from volume growth, cost control, and margin expansion across Ocean, Logistics & Services, and Terminals.',
  'Gains or losses from asset disposals are disclosed below EBITDA under EBIT. The USD 25 m gain on sale of non-current assets in Q2 2025 therefore does not impact EBITDA.',
];

const initialFindings = [
  {
    id: '[1]',
    title: 'Highlights Q2 2025',
    description:
      'Page 3 confirms the USD 2.3 bn EBITDA result was achieved without extraordinary items, crediting core operational improvements.',
    pageNumber: 3,
    yPercent: 0.34,
    locator: 'Page 3 — Highlights Q2 2025',
    anchorText: 'EBITDA of USD 2.3 bn',
    highlightLines: 3,
    highlightHeight: 12,
    highlightLeft: 6,
    highlightWidth: 88,
  },
  {
    id: '[2]',
    title: 'Review Q2 2025',
    description:
      'Page 5 reiterates EBITDA gains were driven by revenue and cost management across all business segments, not one-off gains.',
    pageNumber: 5,
    yPercent: 0.52,
    locator: 'Page 5 — Review Q2 2025',
    anchorText: 'EBITDA increased to USD 2.3 bn',
    highlightLines: 3,
    highlightHeight: 12,
    highlightLeft: 6,
    highlightWidth: 88,
  },
  {
    id: '[3]',
    title: 'Condensed Income Statement',
    description:
      'Page 15 discloses a USD 25 m gain on sale of non-current assets presented below EBITDA, reinforcing that EBITDA is free of extraordinary items.',
    pageNumber: 15,
    yPercent: 0.64,
    locator: 'Page 15 — Condensed Income Statement',
    anchorText: 'Gain on sale of non-current assets',
    highlightLines: 2,
    highlightHeight: 10,
    highlightLeft: 6,
    highlightWidth: 88,
  },
];

const supportingEvidence = [
  {
    id: '[1]',
    location: 'Page 3 → Highlights Q2 2025',
    excerpt:
      '“Maersk’s results continued to improve year-on-year … EBITDA of USD 2.3 bn (USD 2.1 bn) … driven by volume and other revenue growth in Ocean, margin improvements in Logistics & Services and significant top line growth in Terminals.”',
  },
  {
    id: '[2]',
    location: 'Page 5 → Review Q2 2025',
    excerpt:
      '“EBITDA increased to USD 2.3 bn (USD 2.1 bn) … driven by higher revenue and cost management … Logistics & Services contributed significantly with a USD 71 m increase … Terminals’ EBITDA increased by USD 50 m.”',
  },
  {
    id: '[3]',
    location: 'Page 15 → Condensed income statement',
    excerpt:
      '“Gain on sale of non-current assets, etc., net 25 (208) … Profit before depreciation, amortisation and impairment losses, etc. (EBITDA) 2,298.”',
  },
];

const clampValue = (value, min, max) =>
  Math.min(Math.max(value ?? min, min), max);

const normalizeSnippet = (text) =>
  text?.replace(/\s+/g, ' ').trim().toLowerCase() ?? '';

const buildFallbackHighlight = (finding) => ({
  pageNumber: finding.pageNumber,
  topPercent: clampValue((finding.yPercent ?? 0.5) * 100, 2, 98),
  heightPercent: clampValue(finding.highlightHeight ?? 12, 4, 40),
  leftPercent: clampValue(finding.highlightLeft ?? 5, 0, 50),
  widthPercent: clampValue(finding.highlightWidth ?? 90, 10, 100),
});

const findAnchorMetrics = (pageElement, finding) => {
  if (!finding?.anchorText) return null;

  const textLayer = pageElement.querySelector('.react-pdf__Page__textContent');
  if (!textLayer) return null;

  const spans = Array.from(textLayer.querySelectorAll('span'));
  const anchorNeedle = normalizeSnippet(finding.anchorText);
  const targetSpan = spans.find((span) =>
    normalizeSnippet(span.textContent).includes(anchorNeedle),
  );

  if (!targetSpan) return null;

  const canvas = pageElement.querySelector('canvas');
  if (!canvas) return null;
  const canvasRect = canvas.getBoundingClientRect();
  const spanRect = targetSpan.getBoundingClientRect();
  if (!canvasRect.height) return null;

  const lines = finding.highlightLines ?? 3;
  const computedHeight =
    ((spanRect.height * lines) / canvasRect.height) * 100;
  const centerPercent =
    ((spanRect.top + spanRect.height / 2 - canvasRect.top) /
      canvasRect.height) *
    100;

  const spanMid = spanRect.top + spanRect.height / 2;
  const rowSpans = spans.filter((span) => {
    const rect = span.getBoundingClientRect();
    const rectMid = rect.top + rect.height / 2;
    const tolerance = Math.max(spanRect.height, rect.height) * 0.65;
    return Math.abs(rectMid - spanMid) <= tolerance;
  });

  const rowBounds = rowSpans.reduce(
    (acc, span) => {
      const rect = span.getBoundingClientRect();
      return {
        left: Math.min(acc.left, rect.left),
        right: Math.max(acc.right, rect.right),
      };
    },
    { left: spanRect.left, right: spanRect.right },
  );

  const leftPercent = clampValue(
    ((rowBounds.left - canvasRect.left) / canvasRect.width) * 100,
    0,
    95,
  );
  const widthPercent = clampValue(
    ((rowBounds.right - rowBounds.left) / canvasRect.width) * 100,
    5,
    100 - leftPercent,
  );

  return {
    topPercent: clampValue(centerPercent, 2, 98),
    heightPercent: clampValue(computedHeight, 4, 40),
    leftPercent,
    widthPercent,
  };
};

function App() {
  const [findings] = useState(initialFindings);
  const [activeFindingId, setActiveFindingId] = useState(
    findings[0]?.id ?? null,
  );

  const activeFinding = useMemo(
    () => findings.find((finding) => finding.id === activeFindingId) ?? null,
    [findings, activeFindingId],
  );

  useEffect(() => {
    if (!activeFinding && findings.length > 0) {
      setActiveFindingId(findings[0].id);
    }
  }, [findings, activeFinding]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-context">Case #2217</p>
          <h1>Document Review Dashboard</h1>
        </div>
        <p className="app-description">
          Left: Maersk Q2 2025 Interim Report (PDF). Right: analyst summary,
          findings, and quoted evidence. Click any reference to jump to the PDF
          location and flash the highlight.
        </p>
      </header>

      <main className="app-main">
        <section className="pdf-pane">
          <PDFPane file={PDF_URL} activeFinding={activeFinding} />
        </section>
        <aside className="insights-pane">
          <InsightsPane
            analysis={analysisPoints}
            findings={findings}
            supportingEvidence={supportingEvidence}
            activeFindingId={activeFindingId}
            onSelect={setActiveFindingId}
          />
        </aside>
      </main>
    </div>
  );
}

function PDFPane({ file, activeFinding }) {
  const [numPages, setNumPages] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [pageWidth, setPageWidth] = useState(600);
  const [highlightState, setHighlightState] = useState(null);
  const viewerRef = useRef(null);
  const pageRefs = useRef({});

  useEffect(() => {
    const updateWidth = () => {
      if (!viewerRef.current) return;
      const { width } = viewerRef.current.getBoundingClientRect();
      const nextWidth = Math.min(900, Math.max(320, width - 32));
      setPageWidth(nextWidth);
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  useEffect(() => {
    if (!activeFinding) return;

    const fallback = buildFallbackHighlight(activeFinding);
    let attempts = 0;
    const maxAttempts = 8;

    const attemptHighlight = (forceFallback = false) => {
      const pageElement = pageRefs.current[activeFinding.pageNumber];
      if (!pageElement) {
        return false;
      }

      pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

      const anchorMetrics = forceFallback
        ? null
        : findAnchorMetrics(pageElement, activeFinding);

      if (!anchorMetrics && !forceFallback) {
        return false;
      }

      const finalConfig = {
        pageNumber: activeFinding.pageNumber,
        topPercent: anchorMetrics?.topPercent ?? fallback.topPercent,
        heightPercent: anchorMetrics?.heightPercent ?? fallback.heightPercent,
        leftPercent: anchorMetrics?.leftPercent ?? fallback.leftPercent,
        widthPercent: anchorMetrics?.widthPercent ?? fallback.widthPercent,
      };

      setHighlightState(finalConfig);

      requestAnimationFrame(() => {
        const highlight =
          pageRefs.current[activeFinding.pageNumber]?.querySelector(
            '.page-highlight',
          );
        if (highlight) {
          highlight.classList.remove('animate');
          void highlight.offsetWidth;
          highlight.classList.add('animate');
        }
      });

      return true;
    };

    if (attemptHighlight()) {
      return undefined;
    }

    const timer = setInterval(() => {
      attempts += 1;
      const done = attemptHighlight(attempts >= maxAttempts);
      if (done || attempts >= maxAttempts) {
        clearInterval(timer);
      }
    }, 150);

    return () => clearInterval(timer);
  }, [activeFinding, numPages]);

  const handleDocumentLoad = ({ numPages: loadedPages }) => {
    setNumPages(loadedPages);
    pageRefs.current = {};
    setLoadError(null);
  };

  const renderPages = () => {
    if (!numPages) return null;
    return Array.from({ length: numPages }, (_, index) => {
      const pageNumber = index + 1;
      const isActivePage = activeFinding?.pageNumber === pageNumber;
      const isHighlightReady = highlightState?.pageNumber === pageNumber;
      const highlightTop = isHighlightReady
        ? highlightState.topPercent
        : (activeFinding?.yPercent ?? 0.5) * 100;
      const highlightHeight = isHighlightReady
        ? highlightState.heightPercent
        : activeFinding?.highlightHeight ?? 10;
      const highlightLeft = isHighlightReady
        ? highlightState.leftPercent
        : activeFinding?.highlightLeft ?? 5;
      const highlightWidth = isHighlightReady
        ? highlightState.widthPercent
        : activeFinding?.highlightWidth ?? 90;
      const highlightStyle = {
        top: `${highlightTop}%`,
        height: `${highlightHeight}%`,
        left: `${highlightLeft}%`,
        width: `${highlightWidth}%`,
      };

      return (
        <div
          key={`page-${pageNumber}`}
          className="page-wrapper"
          ref={(el) => {
            pageRefs.current[pageNumber] = el;
          }}
        >
          {isActivePage && (
            <div className="page-highlight animate" style={highlightStyle} />
          )}
          <Page
            width={pageWidth}
            pageNumber={pageNumber}
            renderAnnotationLayer
            renderTextLayer
          />
          <div className="page-number-tag">Page {pageNumber}</div>
        </div>
      );
    });
  };

  return (
    <div className="pdf-viewer" ref={viewerRef}>
      <Document
        file={file}
        loading={<div className="pdf-placeholder">Loading PDF…</div>}
        error={
          <div className="pdf-placeholder">
            Unable to load the PDF. Make sure the file exists.
          </div>
        }
        onLoadSuccess={handleDocumentLoad}
        onLoadError={(error) => setLoadError(error.message)}
      >
        {renderPages()}
      </Document>
      {loadError && (
        <div className="pdf-placeholder error">
          {loadError}. Check that <code>{file}</code> is reachable.
        </div>
      )}
    </div>
  );
}

function InsightsPane({
  analysis,
  findings,
  supportingEvidence,
  activeFindingId,
  onSelect,
}) {
  return (
    <div className="insights">
      <section className="analysis-block">
        <div className="section-heading">
          <span>Analysis</span>
          <p>EBITDA drivers and extraordinary item screen</p>
        </div>
        <ol>
          {analysis.map((point, index) => (
            <li key={`analysis-${index}`}>{point}</li>
          ))}
        </ol>
      </section>

      <section className="findings-block">
        <div className="section-heading">
          <span>Findings</span>
          <p>{findings.length} references</p>
        </div>
        <div className="findings-list">
          {findings.map((finding) => {
            const isActive = finding.id === activeFindingId;
            return (
              <button
                key={finding.id}
                className={`finding-card ${isActive ? 'active' : ''}`}
                onClick={() => onSelect(finding.id)}
              >
                <div className="finding-headline">
                  <span className="finding-id">{finding.id}</span>
                  <span className="finding-location">{finding.locator}</span>
                </div>
                <h3>{finding.title}</h3>
                <p>{finding.description}</p>
                <span className="finding-meta">
                  Page {finding.pageNumber} ·{' '}
                  {(finding.yPercent * 100).toFixed(0)}% depth
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="supporting-evidence">
        <div className="section-heading">
          <span>Supporting Evidence</span>
          <p>Quoted passages from the interim report</p>
        </div>
        <ul>
          {supportingEvidence.map((item) => (
            <li key={item.id}>
              <div className="evidence-label">
                <span>{item.id}</span>
                <button
                  type="button"
                  className="evidence-jump"
                  onClick={() => onSelect(item.id)}
                >
                  Jump to PDF
                </button>
              </div>
              <p className="evidence-location">{item.location}</p>
              <p className="evidence-quote">{item.excerpt}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default App;
