'use client';

import { useEffect, useMemo, useState } from 'react';
import { NewTemplateForm } from '@/components/NewTemplateForm';

type LocalProfile = {
  name: string;
  password: string;
};

const STORAGE_KEY = 'templatedb_profile_v1';

function readProfile(): LocalProfile | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<LocalProfile>;
    if (typeof parsed.name === 'string' && typeof parsed.password === 'string') {
      return { name: parsed.name, password: parsed.password };
    }
  } catch {
    return null;
  }

  return null;
}

function saveProfile(profile: LocalProfile): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function ContributeGate() {
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setProfile(readProfile());
  }, []);

  const isRegistered = useMemo(() => profile !== null, [profile]);

  function register(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    if (!name || !password) {
      setError('Nama dan Password wajib diisi.');
      return;
    }

    const nextProfile = { name: name.trim(), password };
    if (!nextProfile.name) {
      setError('Nama wajib diisi.');
      return;
    }

    saveProfile(nextProfile);
    setProfile(nextProfile);
  }

  return (
    <>
      {!isRegistered && (
        <div className="register-overlay" role="dialog" aria-modal="true" aria-labelledby="register-title">
          <section className="register-modal card">
            <h2 id="register-title">Register untuk Contribute</h2>
            <p className="muted">Sebelum kontribusi template, buat profil sederhana dulu.</p>
            <form onSubmit={register}>
              <input
                type="text"
                placeholder="Nama"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
              <div className="space" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <div className="space" />
              <button type="submit">Register</button>
              {error && <p className="muted">{error}</p>}
            </form>
          </section>
        </div>
      )}
      {isRegistered && <NewTemplateForm ownerRef={profile.name} />}
    </>
  );
}
