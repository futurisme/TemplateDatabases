'use client';

import { useState } from 'react';

export function NewTemplateForm() {
  const [status, setStatus] = useState('');

  async function submit(formData: FormData) {
    const payload = {
      title: String(formData.get('title') ?? ''),
      summary: String(formData.get('summary') ?? ''),
      content: String(formData.get('content') ?? ''),
      type: String(formData.get('type') ?? 'OTHER'),
      tags: String(formData.get('tags') ?? '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      ownerRef: String(formData.get('ownerRef') ?? '')
    };

    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      setStatus('Template berhasil dibuat.');
    } else {
      setStatus('Gagal membuat template. Periksa owner/title/content lalu coba lagi.');
    }
  }

  return (
    <section className="card">
      <h3>Contribute Template Baru</h3>
      <form action={submit}>
        <input name="ownerRef" placeholder="Owner ID atau username atau nama baru" required />
        <div className="space" />
        <input name="title" placeholder="Judul template" required />
        <div className="space" />
        <textarea name="summary" placeholder="Ringkasan" required />
        <div className="space" />
        <textarea name="content" placeholder="Isi template" required rows={6} />
        <div className="space" />
        <select name="type" defaultValue="CODE">
          <option value="CODE">CODE</option>
          <option value="IDEA">IDEA</option>
          <option value="STORY">STORY</option>
          <option value="OTHER">OTHER</option>
        </select>
        <div className="space" />
        <input name="tags" placeholder="tag1, tag2, tag3" required />
        <div className="space" />
        <button type="submit">Publish Template</button>
      </form>
      {status && <p className="muted">{status}</p>}
    </section>
  );
}
