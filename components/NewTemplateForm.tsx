'use client';

import { useState } from 'react';

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

const ALLOWED_TYPES = new Set<CreateTemplateRequest['type']>(['CODE', 'IDEA', 'STORY', 'OTHER']);
const TAG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,29}$/i;

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
        />
        <div className="space" />
        <select name="type" defaultValue="CODE" disabled={isSubmitting}>
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
