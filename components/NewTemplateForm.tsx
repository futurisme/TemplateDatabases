'use client';

import { useMemo, useState } from 'react';

type CreateTemplateRequest = {
  ownerRef: string;
  title: string;
  summary: string;
  content: string;
  type: 'CODE' | 'IDEA' | 'STORY' | 'OTHER';
  tags: string[];
};

type ErrorResponse = { error?: string };

type Props = {
  ownerRef: string;
};

type DetectedLanguage = 'Luau' | 'Python' | 'Unknown';

type HighlightToken = {
  text: string;
  className: string;
};

const ALLOWED_TYPES = new Set<CreateTemplateRequest['type']>(['CODE', 'IDEA', 'STORY', 'OTHER']);
const TAG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,29}$/i;

const LUAU_KEYWORDS = [
  'local',
  'function',
  'end',
  'then',
  'elseif',
  'repeat',
  'until',
  'nil',
  'not',
  'and',
  'or',
  'pairs',
  'ipairs',
  'game',
  'workspace',
  'script',
  'wait',
  'task'
];

const PYTHON_KEYWORDS = [
  'def',
  'import',
  'from',
  'class',
  'self',
  'elif',
  'None',
  'True',
  'False',
  'async',
  'await',
  'except',
  'lambda',
  'with',
  'yield',
  'print',
  '__name__'
];

function parseTags(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.replace(/^#+/, '').trim())
    .filter(Boolean)
    .map((tag) => tag.toLowerCase());
}

function buildCreateTemplateRequest(formData: FormData, ownerRef: string): CreateTemplateRequest {
  const rawType = String(formData.get('type') ?? 'OTHER').trim().toUpperCase();

  return {
    ownerRef: ownerRef.trim(),
    title: String(formData.get('title') ?? '').trim(),
    summary: String(formData.get('summary') ?? '').trim(),
    content: String(formData.get('content') ?? '').trim(),
    type: ALLOWED_TYPES.has(rawType as CreateTemplateRequest['type'])
      ? (rawType as CreateTemplateRequest['type'])
      : 'OTHER',
    tags: parseTags(String(formData.get('tags') ?? ''))
  };
}

function validateRequestBody(body: CreateTemplateRequest): string | null {
  const errors: string[] = [];

  if (!body.ownerRef) errors.push('Profil tidak valid, silakan register ulang.');
  if (body.title.length < 3 || body.title.length > 120) errors.push('judul harus 3-120 karakter.');
  if (body.summary.length < 10 || body.summary.length > 300) errors.push('deskripsi harus 10-300 karakter.');
  if (body.content.length < 10) errors.push('isi template minimal 10 karakter.');
  if (body.tags.length < 1 || body.tags.length > 12) errors.push('jumlah tag harus 1-12 item.');
  if (body.tags.some((tag) => !TAG_PATTERN.test(tag))) errors.push('format tag tidak valid, gunakan huruf/angka/-/_ saja.');

  return errors.length > 0 ? errors.join(' ') : null;
}

function countMatches(content: string, patterns: RegExp[]): number {
  return patterns.reduce((acc, pattern) => {
    const matches = content.match(pattern);
    return acc + (matches ? matches.length : 0);
  }, 0);
}

function detectLanguage(content: string): DetectedLanguage {
  const luauScore =
    countMatches(content, [
      /--.*$/gm,
      /\b(local|function|end|then|elseif|repeat|until|pairs|ipairs)\b/g,
      /\b(game|workspace|script|task)\b/g,
      /\b[A-Z][A-Za-z0-9_]*\.new\(/g
    ]) + LUAU_KEYWORDS.filter((keyword) => content.includes(keyword)).length;

  const pythonScore =
    countMatches(content, [
      /#.*$/gm,
      /\b(def|import|from|class|elif|except|lambda|with|yield|async|await)\b/g,
      /:\s*$/gm,
      /\bself\./g
    ]) + PYTHON_KEYWORDS.filter((keyword) => content.includes(keyword)).length;

  if (luauScore === 0 && pythonScore === 0) return 'Unknown';
  if (luauScore === pythonScore) return 'Unknown';

  return luauScore > pythonScore ? 'Luau' : 'Python';
}

function tokenizeLine(line: string, language: DetectedLanguage): HighlightToken[] {
  if (!line) return [{ text: ' ', className: 'code-plain' }];

  const stringRegex = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
  const parts = line.split(stringRegex);
  const tokens: HighlightToken[] = [];

  for (const part of parts) {
    if (!part) continue;

    if ((part.startsWith('"') && part.endsWith('"')) || (part.startsWith("'") && part.endsWith("'"))) {
      tokens.push({ text: part, className: 'code-string' });
      continue;
    }

    const commentIndex =
      language === 'Luau' ? part.indexOf('--') : language === 'Python' ? part.indexOf('#') : Number.POSITIVE_INFINITY;

    const beforeComment = Number.isFinite(commentIndex) ? part.slice(0, commentIndex) : part;
    const comment = Number.isFinite(commentIndex) ? part.slice(commentIndex) : '';

    const keywordSet = language === 'Luau' ? LUAU_KEYWORDS : language === 'Python' ? PYTHON_KEYWORDS : [];
    const keywordRegex = keywordSet.length ? new RegExp(`\\b(${keywordSet.join('|')})\\b`, 'g') : null;

    if (keywordRegex) {
      let lastIndex = 0;
      for (const match of beforeComment.matchAll(keywordRegex)) {
        const start = match.index ?? 0;
        if (start > lastIndex) {
          tokens.push({ text: beforeComment.slice(lastIndex, start), className: 'code-plain' });
        }
        tokens.push({ text: match[0], className: 'code-keyword' });
        lastIndex = start + match[0].length;
      }
      if (lastIndex < beforeComment.length) {
        tokens.push({ text: beforeComment.slice(lastIndex), className: 'code-plain' });
      }
    } else {
      tokens.push({ text: beforeComment, className: 'code-plain' });
    }

    if (comment) {
      tokens.push({ text: comment, className: 'code-comment' });
    }
  }

  return tokens.length > 0 ? tokens : [{ text: line, className: 'code-plain' }];
}

function highlightContent(content: string, language: DetectedLanguage): HighlightToken[][] {
  return content.split('\n').slice(0, 120).map((line) => tokenizeLine(line, language));
}

async function parseErrorResponse(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const textBody = await response.text();

    if (textBody.trim().length > 0) {
      try {
        const parsed = JSON.parse(textBody) as ErrorResponse;
        if (typeof parsed.error === 'string' && parsed.error.trim().length > 0) {
          return parsed.error.trim();
        }
      } catch (error) {
        console.error('Failed to parse API error response JSON:', error, textBody);
      }
    }
  }

  return `Request gagal (${response.status} ${response.statusText}).`;
}

export function NewTemplateForm({ ownerRef }: Props) {
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState<CreateTemplateRequest['type']>('CODE');
  const [contentDraft, setContentDraft] = useState('');

  const detectedLanguage = useMemo(() => {
    if (selectedType !== 'CODE') return 'Unknown';
    return detectLanguage(contentDraft);
  }, [contentDraft, selectedType]);

  const highlightedLines = useMemo(() => {
    if (selectedType !== 'CODE') return [];
    return highlightContent(contentDraft, detectedLanguage);
  }, [contentDraft, detectedLanguage, selectedType]);

  async function submit(formData: FormData) {
    if (isSubmitting) return;

    setStatus('');
    setIsSubmitting(true);

    try {
      const requestBody = buildCreateTemplateRequest(formData, ownerRef);
      const validationError = validateRequestBody(requestBody);
      if (validationError) {
        setStatus(validationError);
        return;
      }

      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const serverMessage = await parseErrorResponse(response);
        setStatus(serverMessage);
        return;
      }

      setStatus('Template berhasil dibuat.');
    } catch (error) {
      console.error('Submit template failed:', error);
      setStatus(error instanceof Error ? error.message : 'Terjadi kesalahan tak terduga.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="card">
      <h3>Contribute Template Baru</h3>
      <form action={submit}>
        <input name="title" placeholder="Judul Template" required minLength={3} maxLength={120} disabled={isSubmitting} />
        <div className="space" />
        <textarea
          name="summary"
          placeholder="Deskripsi"
          required
          minLength={10}
          maxLength={300}
          disabled={isSubmitting}
        />
        <div className="space" />
        <textarea
          name="content"
          placeholder="Isi Template"
          required
          minLength={10}
          rows={6}
          disabled={isSubmitting}
          value={contentDraft}
          onChange={(event) => setContentDraft(event.target.value)}
        />
        {selectedType === 'CODE' && (
          <>
            <div className="space" />
            <p className="lang-indicator">Detected language: {detectedLanguage}</p>
            <div className="code-preview" aria-live="polite">
              {highlightedLines.length === 0 ? (
                <p className="muted">Live syntax highlight aktif saat Anda mulai mengetik kode.</p>
              ) : (
                highlightedLines.map((line, lineIndex) => (
                  <div key={`line-${lineIndex}`} className="code-line">
                    {line.map((token, tokenIndex) => (
                      <span key={`token-${lineIndex}-${tokenIndex}`} className={token.className}>
                        {token.text}
                      </span>
                    ))}
                  </div>
                ))
              )}
            </div>
          </>
        )}
        <div className="space" />
        <select
          name="type"
          value={selectedType}
          disabled={isSubmitting}
          onChange={(event) => setSelectedType((event.target.value as CreateTemplateRequest['type']) || 'OTHER')}
        >
          <option value="CODE">CODE</option>
          <option value="IDEA">IDEA</option>
          <option value="STORY">STORY</option>
          <option value="OTHER">OTHER</option>
        </select>
        <div className="space" />
        <label className="tags-field">
          <span className="hash-prefix">#</span>
          <input name="tags" placeholder="tag1 tag2 tag3" required disabled={isSubmitting} className="tags-input" />
        </label>
        <div className="space" />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Publishing...' : 'Publish Template'}
        </button>
      </form>
      {status && <p className="muted">{status}</p>}
    </section>
  );
}
