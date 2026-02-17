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

type ApiError = { error?: string };

const ALLOWED_TYPES = new Set<CreateTemplateRequest['type']>(['CODE', 'IDEA', 'STORY', 'OTHER']);

function buildPayload(formData: FormData): CreateTemplateRequest {
  const ownerRef = String(formData.get('ownerRef') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const summary = String(formData.get('summary') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();
  const typeRaw = String(formData.get('type') ?? 'OTHER').trim().toUpperCase();
  const tags = String(formData.get('tags') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const errors: string[] = [];

  if (ownerRef.length < 2 || ownerRef.length > 64) errors.push('ownerRef harus 2-64 karakter.');
  if (title.length < 3 || title.length > 120) errors.push('judul harus 3-120 karakter.');
  if (summary.length < 10 || summary.length > 300) errors.push('ringkasan harus 10-300 karakter.');
  if (content.length < 10) errors.push('isi template minimal 10 karakter.');
  if (!ALLOWED_TYPES.has(typeRaw as CreateTemplateRequest['type'])) errors.push('tipe template tidak valid.');
  if (tags.length === 0 || tags.length > 12) errors.push('tag harus 1-12 item.');

  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }

  return {
    ownerRef,
    title,
    summary,
    content,
    type: typeRaw as CreateTemplateRequest['type'],
    tags
  };
}

export function NewTemplateForm() {
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(formData: FormData) {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setStatus('');

    try {
      const requestPayload = buildPayload(formData);

      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });

      const contentType = response.headers.get('content-type') ?? '';
      const responseBody: ApiError | null = contentType.includes('application/json')
        ? ((await response.json()) as ApiError)
        : null;

      if (!response.ok) {
        const apiMessage = responseBody?.error?.trim();
        throw new Error(apiMessage || 'Gagal membuat template. Periksa data lalu coba lagi.');
      }

      setStatus('Template berhasil dibuat.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan tak terduga.';
      console.error('Submit template failed:', error);
      setStatus(message);
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
