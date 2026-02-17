import packageJson from '@/package.json';

function normalizeVersion(raw: string | undefined): string {
  if (!raw) return '1.0.0';

  const normalized = raw.trim();
  if (!/^\d+\.\d+\.\d+$/.test(normalized)) {
    return '1.0.0';
  }

  return normalized;
}

export function getAppVersionLabel(): string {
  const version = normalizeVersion(packageJson.version);
  return `V${version}`;
}
