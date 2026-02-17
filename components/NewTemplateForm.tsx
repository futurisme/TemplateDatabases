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

async function parseErrorResponse(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    return `Request gagal (${response.status} ${response.statusText}).`;
  }

  try {
    const parsed = (await response.json()) as ErrorResponse;
    if (parsed.error && parsed.error.trim().length > 0) {
      return parsed.error.trim();
    }
  } catch (error) {
    console.error('Failed to parse API error response:', error);
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

      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(await parseErrorResponse(response));
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
        <input name="ownerRef" placeholder="Owner ID atau username atau nama baru" required disabled={isSubmitting} />
        <div className="space" />
        <input name="title" placeholder="Judul template" required disabled={isSubmitting} />
        <div className="space" />
        <textarea name="summary" placeholder="Ringkasan" required disabled={isSubmitting} />
        <div className="space" />
        <textarea name="content" placeholder="Isi template" required rows={6} disabled={isSubmitting} />
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
