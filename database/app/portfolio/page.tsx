'use client';

import {
  ActionGroup,
  Container,
  Grid,
  HeaderShell,
  Inline,
  KeyValueList,
  Metric,
  Notice,
  ProgressBar,
  Section,
  Stack,
  StatusChip,
  Surface,
  ThemeScope
} from '@/lib/fadhilweblib';

const projects = [
  {
    name: 'TemplateDatabase Core',
    category: 'Database Product',
    status: 'stable',
    summary: 'Pipeline template open-source dengan indexing cepat, fallback aman, dan kontribusi publik.'
  },
  {
    name: 'Search UX Experiments',
    category: 'Frontend Research',
    status: 'active',
    summary: 'Eksperimen UX untuk instant search, compact filters, dan navigation minim friction.'
  },
  {
    name: 'Railway Bootstrap Flow',
    category: 'DevOps Reliability',
    status: 'monitoring',
    summary: 'Rangkaian startup resilient untuk mengurangi error saat cold boot dan migrasi runtime.'
  }
] as const;

export default function PortfolioPage() {
  return (
    <ThemeScope theme="portfolio">
      <Container maxWidth="xl" style={{ padding: '2rem 1rem' }}>
        <Stack gap="lg">
          <Section
            title="Portfolio Testing"
            description="Halaman portfolio untuk validasi antarmuka. Akses utama lewat /portfolio."
            actions={
              <ActionGroup>
                <StatusChip value="Portfolio Route" tone="brand" />
                <StatusChip value="FadhilWebLib" tone="info" />
              </ActionGroup>
            }
          >
            <Notice tone="info" title="Testing Mode" description="Bukan portfolio utama, hanya untuk validasi komponen." />
          </Section>

          <Grid columns={3} gap="md">
            <Metric label="Projects" value={String(projects.length)} description="Testing scope" tone="brand" />
            <Metric label="UI Library" value="100%" description="FadhilWebLib components" tone="success" />
            <Metric label="Visibility" value="Direct URL" description="No public navigation link" tone="warning" />
          </Grid>

          <Surface tone="neutral" style={{ padding: '1rem' }}>
            <ProgressBar value={86} max={100} label="Readiness" tone="brand" showValue />
          </Surface>

          <Grid columns={3} gap="md">
            {projects.map((project) => (
              <Surface key={project.name} tone="neutral" style={{ padding: '1rem' }}>
                <Stack>
                  <Inline justify="between">
                    <StatusChip value={project.category} tone="brand" />
                    <StatusChip value={project.status} tone="neutral" />
                  </Inline>
                  <HeaderShell title={project.name} subtitle={project.summary} compact />
                </Stack>
              </Surface>
            ))}
          </Grid>

          <Surface tone="neutral" style={{ padding: '1rem' }}>
            <KeyValueList
              items={[
                { label: 'Route', value: '/portfolio' },
                { label: 'Compatibility', value: '/Portfolio redirects' },
                { label: 'Dependency', value: 'database/lib/fadhilweblib' }
              ]}
            />
          </Surface>
        </Stack>
      </Container>
    </ThemeScope>
  );
}
