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

const ALLOWED_TYPES = new Set<CreateTemplateRequest['type']>(['CODE', 'IDEA', 'STORY', 'OTHER']);

function buildCreateTemplateRequest(formData: FormData): CreateTemplateRequest {
  const rawType = String(formData.get('type') ?? 'OTHER').trim().toUpperCase();

  return {
    ownerRef: String(formData.get('ownerRef') ?? '').trim(),
    title: String(formData.get('title') ?? '').trim(),
    summary: String(formData.get('summary') ?? '').trim(),
    content: String(formData.get('content') ?? '').trim(),
    type: ALLOWED_TYPES.has(rawType as CreateTemplateRequest['type'])
      ? (rawType as CreateTemplateRequest['type'])
      : 'OTHER',
    tags: String(formData.get('tags') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  };
}

function validateRequestBody(body: CreateTemplateRequest): string | null {
  const errors: string[] = [];

  if (body.ownerRef.length < 2 || body.ownerRef.length > 64) errors.push('ownerRef harus 2-64 karakter.');
  if (body.title.length < 3 || body.title.length > 120) errors.push('judul harus 3-120 karakter.');
  if (body.summary.length < 10 || body.summary.length > 300) errors.push('ringkasan harus 10-300 karakter.');
  if (body.content.length < 10) errors.push('isi template minimal 10 karakter.');
  if (body.tags.length < 1 || body.tags.length > 12) errors.push('jumlah tag harus 1-12 item.');
  if (body.tags.some((tag) => tag.length < 1 || tag.length > 30)) errors.push('panjang tiap tag harus 1-30 karakter.');

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

export function NewTemplateForm() {
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(formData: FormData) {
    if (isSubmitting) return;

    setStatus('');
    setIsSubmitting(true);

    try {
      const requestBody = buildCreateTemplateRequest(formData);
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
        <input
          name="ownerRef"
          placeholder="Owner ID atau username atau nama baru"
          required
          minLength={2}
          maxLength={64}
          disabled={isSubmitting}
        />
        <div className="space" />
        <input name="title" placeholder="Judul template" required minLength={3} maxLength={120} disabled={isSubmitting} />
        <div className="space" />
        <textarea
          name="summary"
          placeholder="Ringkasan"
          required
          minLength={10}
          maxLength={300}
          disabled={isSubmitting}
        />
        <div className="space" />
        <textarea
          name="content"
          placeholder="Isi template"
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
        <input name="tags" placeholder="tag1, tag2, tag3" required disabled={isSubmitting} />
        <div className="space" />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Publishing...' : 'Publish Template'}
        </button>
      </form>
      {status && <p className="muted">{status}</p>}
    </section>
  );
}
