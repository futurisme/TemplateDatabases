'use client';

import { useMemo, useRef, useState } from 'react';

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

type TokenType = 'plain' | 'keyword' | 'builtin' | 'string' | 'comment' | 'number' | 'function' | 'operator';

type Token = {
  text: string;
  type: TokenType;
};

const ALLOWED_TYPES = new Set<CreateTemplateRequest['type']>(['CODE', 'IDEA', 'STORY', 'OTHER']);
const TAG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,29}$/i;

const LUAU_KEYWORDS = new Set([
  'local', 'function', 'end', 'then', 'elseif', 'repeat', 'until', 'nil', 'not', 'and', 'or', 'for', 'while', 'do',
  'if', 'return', 'break', 'continue', 'in'
]);
const LUAU_BUILTINS = new Set([
  'pairs', 'ipairs', 'next', 'typeof', 'setmetatable', 'getmetatable', 'pcall', 'xpcall', 'require', 'game', 'workspace', 'script', 'task', 'math', 'string', 'table', 'Instance', 'Vector3', 'CFrame', 'Color3', 'Enum'
]);
const PYTHON_KEYWORDS = new Set([
  'def', 'import', 'from', 'class', 'self', 'elif', 'None', 'True', 'False', 'async', 'await', 'except', 'lambda',
  'with', 'yield', 'if', 'else', 'for', 'while', 'return', 'pass', 'break', 'continue', 'try', 'finally', 'as', 'in', 'is', 'not', 'and', 'or'
]);
const PYTHON_BUILTINS = new Set([
  'print', 'len', 'range', 'enumerate', 'map', 'filter', 'sum', 'min', 'max', 'open', 'str', 'int', 'float', 'dict', 'list', 'set', 'tuple', '__name__'
]);

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

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

function detectLanguage(content: string): DetectedLanguage {
  const luauHits = [
    /--.*$/gm,
    /\b(local|function|end|then|elseif|repeat|until|game|workspace|script|task|ipairs|pairs|Enum|Vector3|CFrame)\b/g,
    /\b[A-Z][A-Za-z0-9_]*\.new\(/g
  ].reduce((acc, pattern) => acc + (content.match(pattern)?.length ?? 0), 0);

  const pythonHits = [
    /#.*$/gm,
    /\b(def|import|from|class|elif|except|lambda|with|yield|async|await|self|None|True|False)\b/g,
    /:\s*$/gm,
    /\bself\./g
  ].reduce((acc, pattern) => acc + (content.match(pattern)?.length ?? 0), 0);

  if (luauHits === 0 && pythonHits === 0) return 'Unknown';
  if (luauHits === pythonHits) return 'Unknown';
  return luauHits > pythonHits ? 'Luau' : 'Python';
}

function lexLine(line: string, language: DetectedLanguage): Token[] {
  if (!line) return [{ text: ' ', type: 'plain' }];

  const keywords = language === 'Luau' ? LUAU_KEYWORDS : language === 'Python' ? PYTHON_KEYWORDS : new Set<string>();
  const builtins = language === 'Luau' ? LUAU_BUILTINS : language === 'Python' ? PYTHON_BUILTINS : new Set<string>();

  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    const rest = line.slice(i);

    const commentStart = language === 'Luau' ? '--' : language === 'Python' ? '#' : '';
    if (commentStart && rest.startsWith(commentStart)) {
      tokens.push({ text: rest, type: 'comment' });
      break;
    }

    const stringMatch = rest.match(/^(["'])(?:\\.|(?!\1).)*\1/);
    if (stringMatch) {
      tokens.push({ text: stringMatch[0], type: 'string' });
      i += stringMatch[0].length;
      continue;
    }

    const numberMatch = rest.match(/^\b\d+(?:\.\d+)?\b/);
    if (numberMatch) {
      tokens.push({ text: numberMatch[0], type: 'number' });
      i += numberMatch[0].length;
      continue;
    }

    const functionCallMatch = rest.match(/^\b([A-Za-z_][A-Za-z0-9_]*)\s*(?=\()/);
    if (functionCallMatch) {
      tokens.push({ text: functionCallMatch[1], type: 'function' });
      i += functionCallMatch[1].length;
      continue;
    }

    const wordMatch = rest.match(/^\b[A-Za-z_][A-Za-z0-9_]*\b/);
    if (wordMatch) {
      const word = wordMatch[0];
      if (keywords.has(word)) {
        tokens.push({ text: word, type: 'keyword' });
      } else if (builtins.has(word)) {
        tokens.push({ text: word, type: 'builtin' });
      } else {
        tokens.push({ text: word, type: 'plain' });
      }
      i += word.length;
      continue;
    }

    const opMatch = rest.match(/^(==|~=|!=|<=|>=|=>|:=|\+|-|\*|\/|=|<|>|\.|:|\(|\)|\[|\]|\{|\}|,)/);
    if (opMatch) {
      tokens.push({ text: opMatch[0], type: 'operator' });
      i += opMatch[0].length;
      continue;
    }

    tokens.push({ text: line[i], type: 'plain' });
    i += 1;
  }

  return tokens;
}

function highlightToHtml(content: string, language: DetectedLanguage): string {
  const lines = content.split('\n').slice(0, 220);
  return lines
    .map((line) => {
      const tokens = lexLine(line, language);
      return tokens
        .map((token) => `<span class="code-${token.type}">${escapeHtml(token.text)}</span>`)
        .join('');
    })
    .join('\n');
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
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);

  const detectedLanguage = useMemo(() => {
    if (selectedType !== 'CODE') return 'Unknown';
    return detectLanguage(contentDraft);
  }, [contentDraft, selectedType]);

  const highlightedHtml = useMemo(() => {
    if (selectedType !== 'CODE') return '';
    return highlightToHtml(contentDraft, detectedLanguage);
  }, [contentDraft, detectedLanguage, selectedType]);

  function syncScroll() {
    if (!editorRef.current || !highlightRef.current) return;
    highlightRef.current.scrollTop = editorRef.current.scrollTop;
    highlightRef.current.scrollLeft = editorRef.current.scrollLeft;
  }

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
    <section className="card form-compact">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3>Contribute Template Baru</h3>
        {selectedType === 'CODE' && <small className="lang-indicator">Detected: {detectedLanguage}</small>}
      </div>
      <form action={submit} className="form-grid">
        <input
          name="title"
          placeholder="Judul Template"
          required
          minLength={3}
          maxLength={120}
          disabled={isSubmitting}
          className="col-6"
        />
        <select
          name="type"
          value={selectedType}
          disabled={isSubmitting}
          onChange={(event) => setSelectedType((event.target.value as CreateTemplateRequest['type']) || 'OTHER')}
          className="col-6"
        >
          <option value="CODE">CODE</option>
          <option value="IDEA">IDEA</option>
          <option value="STORY">STORY</option>
          <option value="OTHER">OTHER</option>
        </select>

        <textarea
          name="summary"
          placeholder="Deskripsi"
          required
          minLength={10}
          maxLength={300}
          disabled={isSubmitting}
          rows={2}
          className="col-12"
        />

        {selectedType === 'CODE' ? (
          <div className="code-editor col-12">
            <pre ref={highlightRef} className="code-layer" aria-hidden="true" dangerouslySetInnerHTML={{ __html: highlightedHtml || ' ' }} />
            <textarea
              ref={editorRef}
              name="content"
              placeholder="Isi Template (kode)"
              required
              minLength={10}
              rows={8}
              disabled={isSubmitting}
              value={contentDraft}
              onChange={(event) => setContentDraft(event.target.value)}
              onScroll={syncScroll}
              className="code-input"
              spellCheck={false}
            />
          </div>
        ) : (
          <textarea
            name="content"
            placeholder="Isi Template"
            required
            minLength={10}
            rows={6}
            disabled={isSubmitting}
            value={contentDraft}
            onChange={(event) => setContentDraft(event.target.value)}
            className="col-12"
          />
        )}

        <label className="tags-field col-12">
          <span className="hash-prefix">#</span>
          <input name="tags" placeholder="tag1 tag2 tag3" required disabled={isSubmitting} className="tags-input" />
        </label>

        <button type="submit" disabled={isSubmitting} className="col-12 submit-wide">
          {isSubmitting ? 'Publishing...' : 'Publish Template'}
        </button>
      </form>
      {status && <p className="muted">{status}</p>}
    </section>
  );
}
