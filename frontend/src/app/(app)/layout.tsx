import { Protected } from '@/components/protected';
import { AppShell } from '@/components/app-shell';
import { BackgroundJobsProvider } from '@/components/background-jobs';

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <Protected>
      <BackgroundJobsProvider>
        <AppShell>{children}</AppShell>
      </BackgroundJobsProvider>
    </Protected>
  );
}
