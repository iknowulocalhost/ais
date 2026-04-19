import { Protected } from '@/components/protected';
import { AppShell } from '@/components/app-shell';

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <Protected>
      <AppShell>{children}</AppShell>
    </Protected>
  );
}
