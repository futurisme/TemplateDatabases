'use client';

import { useEffect, useMemo, useState } from 'react';
import { NewTemplateForm } from '@/components/NewTemplateForm';

type LocalProfile = {
  name: string;
  password: string;
};

type GateState =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'registered'; profile: LocalProfile }
  | { status: 'error'; message: string };

const STORAGE_KEY = 'templatedb_profile_v1';

function isValidProfile(value: unknown): value is LocalProfile {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<LocalProfile>;
  return typeof candidate.name === 'string' && typeof candidate.password === 'string';
}

function readProfileFromStorage(): LocalProfile | null {
  if (typeof window === 'undefined') {
    throw new Error('window is not available in this runtime.');
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid profile JSON in localStorage (${String(error)}).`);
  }

  if (!isValidProfile(parsed)) {
    throw new Error('Invalid profile shape in localStorage.');
  }

  return {
    name: parsed.name.trim(),
    password: parsed.password
  };
}

function persistProfile(profile: LocalProfile): void {
  if (typeof window === 'undefined') {
    throw new Error('window is not available in this runtime.');
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function ContributeGate() {
  const [gateState, setGateState] = useState<GateState>({ status: 'loading' });
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const existingProfile = readProfileFromStorage();
      if (existingProfile && existingProfile.name.length > 0) {
        setGateState({ status: 'registered', profile: existingProfile });
        return;
      }

      setGateState({ status: 'guest' });
    } catch (error) {
      console.error('Failed to read profile from localStorage:', error);

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STORAGE_KEY);
      }

      setGateState({ status: 'error', message: 'Profil lokal rusak. Silakan register ulang.' });
    }
  }, []);

  const registeredProfile = useMemo(() => {
    if (gateState.status === 'registered') {
      return gateState.profile;
    }

    return null;
  }, [gateState]);

  function register(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    if (!name || !password) {
      setError('Nama dan Password wajib diisi.');
      return;
    }

    const nextProfile: LocalProfile = { name: name.trim(), password };
    if (!nextProfile.name) {
      setError('Nama wajib diisi.');
      return;
    }

    try {
      persistProfile(nextProfile);
      setGateState({ status: 'registered', profile: nextProfile });
    } catch (persistError) {
      console.error('Failed to persist profile into localStorage:', persistError);
      setError('Gagal menyimpan profil lokal. Coba lagi.');
    }
  }

  const shouldShowRegisterModal = gateState.status === 'guest' || gateState.status === 'error';

  return (
    <>
      {shouldShowRegisterModal && (
        <div className="register-overlay" role="dialog" aria-modal="true" aria-labelledby="register-title">
          <section className="register-modal card">
            <h2 id="register-title">Register untuk Contribute</h2>
            <p className="muted">Sebelum kontribusi template, buat profil sederhana dulu.</p>
            {gateState.status === 'error' && <p className="muted">{gateState.message}</p>}
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
      {registeredProfile && <NewTemplateForm ownerRef={registeredProfile.name} />}
    </>
  );
}
