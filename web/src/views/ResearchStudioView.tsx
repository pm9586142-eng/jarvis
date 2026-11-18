import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Globe,
  HelpCircle,
  Loader2,
  MessageSquare,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { MarkdownMessage } from '../components/MarkdownMessage';
import {
  generateStudioReport,
  parseOrAnalyzeDocument,
  runLiveWebSearch,
} from '../services/api';
import {
  ConnectionState,
  GeneratedReportItem,
  LanguageCode,
  LiveSearchResult,
  UploadedDocumentItem,
} from '../types/jarvis';

interface ResearchStudioViewProps {
  language: LanguageCode;
  connectionState: ConnectionState;
  tavilyConfigured?: boolean;
  uploadedDocuments: UploadedDocumentItem[];
  onAddDocument: (doc: UploadedDocumentItem) => void;
  onRemoveDocument: (id: string) => void;
  onDiscussDocumentInChat: (doc: UploadedDocumentItem) => void;
}

const MAX_DOC_BYTES = 5 * 1024 * 1024;

type StudioTab = 'search' | 'documents' | 'reports';

type ReportTypeId =
  | 'executive_report'
  | 'long_summary'
  | 'structured_notes'
  | 'study_guide'
  | 'coding_explanation';

const REPORT_TYPE_OPTIONS: Array<{ id: ReportTypeId; label: string; desc: string }> = [
  { id: 'executive_report', label: 'Executive Report', desc: 'Summary, findings, risks & roadmap' },
  { id: 'long_summary', label: 'Long Summary', desc: 'Condensed multi-section synthesis' },
  { id: 'structured_notes', label: 'Structured Notes', desc: 'Clean bulleted hierarchy & action items' },
  { id: 'study_guide', label: 'Study Material', desc: 'Concepts, glossary & practice quiz' },
  { id: 'coding_explanation', label: 'Code Explanation', desc: 'Architecture, line walkthrough & fixes' },
];

export const ResearchStudioView: React.FC<ResearchStudioViewProps> = ({
  language,
  connectionState,
  tavilyConfigured = false,
  uploadedDocuments,
  onAddDocument,
  onRemoveDocument,
  onDiscussDocumentInChat,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('search');

  // Tab 1: Live Web Search
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<LiveSearchResult | null>(null);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);

  // Tab 2: Document Intelligence
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(
    () => uploadedDocuments[0]?.id || null
  );
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [docQuestion, setDocQuestion] = useState('');
  const [docOutput, setDocOutput] = useState<{ title: string; answer: string } | null>(null);

  // Tab 3: Report & Productivity Studio
  const [reportType, setReportType] = useState<ReportTypeId>('executive_report');
  const [reportTitle, setReportTitle] = useState('');
  const [reportSourceText, setReportSourceText] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [generatedReport, setGeneratedReport] = useState<GeneratedReportItem | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);

  const selectedDoc = useMemo(
    () => uploadedDocuments.find((d) => d.id === selectedDocId) || uploadedDocuments[0] || null,
    [uploadedDocuments, selectedDocId]
  );

  const handleRunSearch = async (e?: React.FormEvent, overrideQuery?: string) => {
    e?.preventDefault();
    const q = (overrideQuery ?? searchQuery).trim();
    if (!q || isSearching) return;
    setSearchQuery(q);
    setSearchError(null);
    setIsSearching(true);
    try {
      const result = await runLiveWebSearch({ query: q, language });
      setSearchResult(result);
      setRecentQueries((prev) => [q, ...prev.filter((item) => item !== q)].slice(0, 5));
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Live web search failed.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleDocumentUpload = async (file: File) => {
    setDocError(null);
    if (file.size > MAX_DOC_BYTES) {
      setDocError(`"${file.name}" exceeds the 5 MB document limit.`);
      return;
    }

    const lower = file.name.toLowerCase();
    const isDocx =
      lower.endsWith('.docx') ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isPdf = lower.endsWith('.pdf') || file.type === 'application/pdf';
    const isText =
      file.type.startsWith('text/') ||
      file.type === 'application/json' ||
      /\.(txt|md|markdown|csv|json|log|yaml|yml|js|ts|py|kt)$/i.test(lower);

    if (!isDocx && !isPdf && !isText) {
      setDocError('Supported document types: PDF, DOCX, TXT, Markdown, CSV, JSON, and code text files.');
      return;
    }

    setDocLoading(true);
    try {
      if (isText) {
        const text = await file.text();
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const newDoc: UploadedDocumentItem = {
          id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          fileName: file.name,
          mimeType: file.type || 'text/plain',
          sizeBytes: file.size,
          kind: 'text',
          extractedText: text.slice(0, 80000),
          wordCount: words,
          uploadedAt: Date.now(),
        };
        onAddDocument(newDoc);
        setSelectedDocId(newDoc.id);
        setDocOutput(null);
        return;
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read file bytes.'));
        reader.readAsDataURL(file);
      });
      const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;

      if (isDocx) {
        const parsed = await parseOrAnalyzeDocument({
          fileName: file.name,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          fileBase64: base64Data,
          action: 'extract_only',
          language,
        });
        const newDoc: UploadedDocumentItem = {
          id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          fileName: file.name,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          sizeBytes: file.size,
          kind: 'docx',
          extractedText: parsed.extractedText || '',
          base64Data,
          wordCount: parsed.wordCount || 0,
          uploadedAt: Date.now(),
        };
        onAddDocument(newDoc);
        setSelectedDocId(newDoc.id);
        setDocOutput(null);
        return;
      }

      // PDF prepared for Gemini native multimodal PDF comprehension
      const newPdfDoc: UploadedDocumentItem = {
        id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        fileName: file.name,
        mimeType: 'application/pdf',
        sizeBytes: file.size,
        kind: 'pdf',
        base64Data,
        uploadedAt: Date.now(),
      };
      onAddDocument(newPdfDoc);
      setSelectedDocId(newPdfDoc.id);
      setDocOutput(null);
    } catch (err) {
      setDocError(err instanceof Error ? err.message : `Unable to process "${file.name}".`);
    } finally {
      setDocLoading(false);
    }
  };

  const handleAnalyzeDoc = async (action: 'summarize' | 'extract_facts' | 'qa') => {
    if (!selectedDoc || docLoading) return;
    if (action === 'qa' && !docQuestion.trim()) {
      setDocError('Enter a question about the selected document first.');
      return;
    }
    setDocError(null);
    setDocLoading(true);
    try {
      const res = await parseOrAnalyzeDocument({
        fileName: selectedDoc.fileName,
        mimeType: selectedDoc.mimeType,
        fileBase64: selectedDoc.kind === 'pdf' || selectedDoc.kind === 'docx' ? selectedDoc.base64Data : undefined,
        textContent: selectedDoc.extractedText,
        action,
        question: action === 'qa' ? docQuestion.trim() : undefined,
        language,
      });
      setDocOutput({
        title:
          action === 'summarize'
            ? `Summary of ${selectedDoc.fileName}`
            : action === 'extract_facts'
              ? `Key Facts & Entities — ${selectedDoc.fileName}`
              : `Q&A — ${docQuestion.trim()}`,
        answer: res.answer || 'No analysis returned.',
      });
    } catch (err) {
      setDocError(err instanceof Error ? err.message : 'Document analysis failed.');
    } finally {
      setDocLoading(false);
    }
  };

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportSourceText.trim() || reportLoading) return;
    setReportError(null);
    setReportLoading(true);
    try {
      const res = await generateStudioReport({
        reportType,
        title: reportTitle.trim() || undefined,
        sourceText: reportSourceText.trim(),
        language,
      });
      setGeneratedReport({
        id: `rep_${Date.now()}`,
        reportType,
        title: res.title,
        content: res.content,
        wordCount: res.wordCount,
        createdAt: Date.now(),
      });
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Report generation failed.');
    } finally {
      setReportLoading(false);
    }
  };

  const downloadReport = (format: 'md' | 'txt') => {
    if (!generatedReport) return;
    const slug = generatedReport.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'jarvis-report';
    const blob = new Blob([generatedReport.content], {
      type: format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Studio Mode Selector */}
      <div className="glass-panel-glow rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
            RESEARCH, DOCUMENT & REPORT STUDIO
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time Google Search {tavilyConfigured ? '+ Tavily Web API' : 'Grounding'}, PDF/DOCX/TXT intelligence, and downloadable reports.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'search' as StudioTab, label: 'LIVE WEB SEARCH', icon: Globe },
            { id: 'documents' as StudioTab, label: `DOCUMENTS (${uploadedDocuments.length})`, icon: FileText },
            { id: 'reports' as StudioTab, label: 'REPORT STUDIO', icon: BookOpen },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl border font-mono-hud text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  active
                    ? 'bg-cyan-400/20 border-cyan-400 text-cyan-200'
                    : 'bg-[#070D18] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: LIVE WEB SEARCH */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          <form onSubmit={(e) => void handleRunSearch(e)} className="glass-panel rounded-2xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-cyan-300" />
                <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
                  VERIFIED LIVE WEB INTELLIGENCE
                </h3>
              </div>
              <div className="flex items-center gap-2 font-mono-hud text-[10px]">
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/40 text-emerald-300">
                  GEMINI GOOGLE SEARCH
                </span>
                {tavilyConfigured && (
                  <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-400/40 text-sky-300">
                    + TAVILY API
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search current news, technology benchmarks, documentation, or live facts..."
                aria-label="Live web search query"
                className="flex-1 bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!searchQuery.trim() || isSearching}
                className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-45 text-[#02040A] font-display text-xs font-bold tracking-wider flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                <span>{isSearching ? 'SEARCHING...' : 'SEARCH LIVE WEB'}</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {(recentQueries.length > 0
                ? recentQueries
                : [
                    'Latest breakthroughs in solid-state batteries',
                    'Android Jetpack Compose latest stable release highlights',
                    'Current global renewable energy milestones',
                  ]
              ).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => void handleRunSearch(undefined, preset)}
                  className="px-2.5 py-1 rounded-lg bg-[#070D18] border border-slate-800 hover:border-cyan-400/50 font-mono-hud text-[10px] text-slate-300 cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>

            {connectionState !== 'online' && (
              <p className="font-mono-hud text-[11px] text-amber-300">
                Note: Live search requires the Express server with GEMINI_API_KEY (or TAVILY_API_KEY).
              </p>
            )}
          </form>

          {searchError && (
            <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 p-4 flex items-center gap-2.5 font-mono-hud text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          {searchResult && (
            <div className="space-y-4">
              <div className="glass-panel rounded-2xl p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
                    SYNTHESIZED RESEARCH BRIEF
                  </h4>
                  <span className="font-mono-hud text-[10px] text-slate-400">
                    Providers: {searchResult.providersUsed.join(' + ') || 'Gemini'}
                  </span>
                </div>
                <MarkdownMessage content={searchResult.summary} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-panel rounded-2xl p-4 space-y-2.5 border border-emerald-500/35">
                  <div className="flex items-center gap-2 text-emerald-300 font-mono-hud text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>VERIFIED INFORMATION ({searchResult.verifiedFacts.length})</span>
                  </div>
                  {searchResult.verifiedFacts.length > 0 ? (
                    <ul className="space-y-1.5 text-xs text-slate-200 list-disc pl-4">
                      {searchResult.verifiedFacts.map((fact, idx) => (
                        <li key={idx}>{fact}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400">
                      See synthesized brief and verified source links below.
                    </p>
                  )}
                </div>

                <div className="glass-panel rounded-2xl p-4 space-y-2.5 border border-amber-500/35">
                  <div className="flex items-center gap-2 text-amber-300 font-mono-hud text-xs font-bold">
                    <HelpCircle className="w-4 h-4" />
                    <span>UNCERTAIN / NEEDS VERIFICATION ({searchResult.uncertainPoints.length})</span>
                  </div>
                  {searchResult.uncertainPoints.length > 0 ? (
                    <ul className="space-y-1.5 text-xs text-slate-200 list-disc pl-4">
                      {searchResult.uncertainPoints.map((pt, idx) => (
                        <li key={idx}>{pt}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400">
                      No unverified claims flagged in this search synthesis.
                    </p>
                  )}
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-4 space-y-2.5">
                <h4 className="font-mono-hud text-xs font-bold text-sky-300 tracking-wider">
                  SOURCE CITATIONS ({searchResult.sources.length})
                </h4>
                {searchResult.sources.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No external URL citations were returned for this query. Treat claims accordingly.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {searchResult.sources.map((src) => (
                      <a
                        key={src.uri}
                        href={src.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 rounded-xl bg-[#040812] border border-slate-800 hover:border-cyan-400/60 flex items-start justify-between gap-2 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-sky-300 truncate">{src.title}</p>
                          <p className="font-mono-hud text-[10px] text-slate-400 truncate mt-0.5">
                            {src.uri}
                          </p>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-cyan-300 shrink-0 mt-0.5" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DOCUMENT INTELLIGENCE */}
      {activeTab === 'documents' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 glass-panel rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
                UPLOADED DOCUMENTS
              </h3>
              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#02040A] font-display text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>UPLOAD FILE</span>
              </button>
              <input
                ref={docInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*"
                aria-label="Upload PDF, DOCX, or TXT document"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleDocumentUpload(file);
                  e.target.value = '';
                }}
              />
            </div>

            <p className="text-xs text-slate-400">
              Supports native <strong className="text-slate-200">.PDF</strong>,{' '}
              <strong className="text-slate-200">.DOCX</strong> (real OOXML parser), and{' '}
              <strong className="text-slate-200">.TXT / .MD / .CSV / .JSON</strong> files up to 5 MB.
            </p>

            {docError && (
              <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 p-3 text-xs font-mono-hud text-rose-200">
                {docError}
              </div>
            )}

            <div className="space-y-2 max-h-[380px] overflow-y-auto">
              {uploadedDocuments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center space-y-2">
                  <FileText className="w-8 h-8 text-cyan-400/60 mx-auto" />
                  <p className="text-xs text-slate-300">No documents uploaded yet</p>
                  <p className="font-mono-hud text-[10px] text-slate-500">
                    Upload a PDF, DOCX, or TXT file to summarize or ask grounded questions.
                  </p>
                </div>
              ) : (
                uploadedDocuments.map((doc) => {
                  const active = selectedDoc?.id === doc.id;
                  return (
                    <div
                      key={doc.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                        active
                          ? 'bg-cyan-400/15 border-cyan-400/60'
                          : 'bg-[#040812] border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDocId(doc.id);
                          setDocOutput(null);
                        }}
                        className="flex-1 min-w-0 text-left cursor-pointer"
                      >
                        <p className="text-xs font-semibold text-slate-100 truncate">{doc.fileName}</p>
                        <p className="font-mono-hud text-[10px] text-slate-400 mt-0.5">
                          {doc.kind.toUpperCase()} • {Math.max(1, Math.round(doc.sizeBytes / 1024))} KB
                          {doc.wordCount ? ` • ${doc.wordCount} words` : ''}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveDocument(doc.id)}
                        aria-label={`Remove ${doc.fileName}`}
                        className="p-1.5 text-slate-400 hover:text-rose-400 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="lg:col-span-7 glass-panel rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
                {selectedDoc ? `ACTIVE DOCUMENT: ${selectedDoc.fileName}` : 'DOCUMENT WORKBENCH'}
              </h3>
              {selectedDoc && (
                <button
                  type="button"
                  onClick={() => onDiscussDocumentInChat(selectedDoc)}
                  className="px-3 py-1.5 rounded-lg bg-[#0D1527] border border-cyan-400/50 hover:border-cyan-300 font-mono-hud text-[11px] text-cyan-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>DISCUSS IN CHAT</span>
                </button>
              )}
            </div>

            {selectedDoc ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={docLoading}
                    onClick={() => void handleAnalyzeDoc('summarize')}
                    className="px-3.5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-45 text-[#02040A] font-display text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    {docLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>SUMMARIZE</span>
                  </button>
                  <button
                    type="button"
                    disabled={docLoading}
                    onClick={() => void handleAnalyzeDoc('extract_facts')}
                    className="px-3.5 py-2 rounded-xl bg-[#0D1527] border border-violet-400/50 hover:border-violet-300 disabled:opacity-45 text-violet-200 font-mono-hud text-xs font-bold cursor-pointer"
                  >
                    EXTRACT KEY FACTS
                  </button>
                  {selectedDoc.extractedText && (
                    <button
                      type="button"
                      onClick={() => {
                        setReportTitle(selectedDoc.fileName.replace(/\.[^.]+$/, ''));
                        setReportSourceText(selectedDoc.extractedText || '');
                        setActiveTab('reports');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-[#0D1527] border border-slate-700 hover:border-cyan-400 font-mono-hud text-xs text-slate-200 cursor-pointer"
                    >
                      SEND TO REPORT STUDIO
                    </button>
                  )}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleAnalyzeDoc('qa');
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={docQuestion}
                    onChange={(e) => setDocQuestion(e.target.value)}
                    placeholder={`Ask a grounded question about ${selectedDoc.fileName}...`}
                    className="flex-1 bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!docQuestion.trim() || docLoading}
                    className="px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-45 text-[#02040A] font-display text-xs font-bold cursor-pointer"
                  >
                    ASK
                  </button>
                </form>

                {selectedDoc.extractedText && !docOutput && (
                  <div className="rounded-xl bg-[#040812] border border-slate-800 p-3.5 space-y-1.5">
                    <p className="font-mono-hud text-[10px] text-slate-400 uppercase">
                      EXTRACTED TEXT PREVIEW ({selectedDoc.wordCount || 0} WORDS)
                    </p>
                    <pre className="text-xs text-slate-300 whitespace-pre-wrap max-h-60 overflow-y-auto font-mono-hud leading-relaxed">
                      {selectedDoc.extractedText.slice(0, 2800)}
                      {selectedDoc.extractedText.length > 2800 ? '\n\n... [truncated preview]' : ''}
                    </pre>
                  </div>
                )}

                {docOutput && (
                  <div className="rounded-xl bg-[#040812] border border-cyan-500/40 p-4 space-y-2.5">
                    <p className="font-mono-hud text-xs font-bold text-cyan-300">{docOutput.title}</p>
                    <MarkdownMessage content={docOutput.answer} />
                  </div>
                )}
              </>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                Select or upload a PDF, DOCX, or TXT file on the left to inspect, summarize, or ask questions.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PRODUCTIVITY & REPORT STUDIO */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <form onSubmit={(e) => void handleGenerateReport(e)} className="glass-panel rounded-2xl p-5 space-y-4">
            <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
              AI REPORT, STUDY MATERIAL & CODING EXPLANATION GENERATOR
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {REPORT_TYPE_OPTIONS.map((opt) => {
                const active = reportType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setReportType(opt.id)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                      active
                        ? 'bg-cyan-400/15 border-cyan-400 text-cyan-100'
                        : 'bg-[#040812] border-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <p className="font-mono-hud text-[11px] font-bold">{opt.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</p>
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="Report / document title (optional)..."
              className="w-full bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            />

            <textarea
              rows={6}
              value={reportSourceText}
              onChange={(e) => setReportSourceText(e.target.value)}
              placeholder="Paste source notes, long document text, study topic, or code snippet to transform into a structured downloadable document..."
              className="w-full bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono-hud text-[10px] text-slate-400">
                {reportSourceText.trim() ? `${reportSourceText.trim().split(/\s+/).length} input words` : 'Provide topic, document text, or code'}
              </span>
              <button
                type="submit"
                disabled={!reportSourceText.trim() || reportLoading}
                className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-45 text-[#02040A] font-display text-xs font-bold tracking-wider flex items-center gap-2 cursor-pointer"
              >
                {reportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{reportLoading ? 'GENERATING...' : 'GENERATE DOCUMENT'}</span>
              </button>
            </div>
          </form>

          {reportError && (
            <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 p-4 text-xs font-mono-hud text-rose-200">
              {reportError}
            </div>
          )}

          {generatedReport && (
            <div className="glass-panel rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <h4 className="font-display text-sm font-bold text-cyan-300">{generatedReport.title}</h4>
                  <p className="font-mono-hud text-[10px] text-slate-400">
                    {generatedReport.wordCount} words • {new Date(generatedReport.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(generatedReport.content).catch(() => {});
                      setCopiedReport(true);
                      window.setTimeout(() => setCopiedReport(false), 1800);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400 font-mono-hud text-xs text-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedReport ? 'COPIED' : 'COPY'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadReport('md')}
                    className="px-3 py-1.5 rounded-lg bg-cyan-400/20 border border-cyan-400/50 hover:bg-cyan-400/30 font-mono-hud text-xs text-cyan-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>DOWNLOAD .MD</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadReport('txt')}
                    className="px-3 py-1.5 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400 font-mono-hud text-xs text-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>DOWNLOAD .TXT</span>
                  </button>
                </div>
              </div>
              <MarkdownMessage content={generatedReport.content} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
