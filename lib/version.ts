import { execSync } from 'node:child_process';

function readGitCommitCount(): number | null {
  try {
    const output = execSync('git rev-list --count HEAD', {
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .toString()
      .trim();

    const count = Number.parseInt(output, 10);
    return Number.isFinite(count) && count > 0 ? count : null;
  } catch {
    return null;
  }
}

export function getAppVersionLabel(): string {
  const gitCount = readGitCommitCount();

  if (gitCount !== null) {
    return `V1.0.${gitCount}`;
  }

  return 'V1.0.0';
}
