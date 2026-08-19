import { OfflineBanner } from '@/components/offline-banner';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';

export default function CampoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 pb-safe">
      <div className="max-w-xl mx-auto min-h-screen bg-gray-50 shadow-sm relative flex flex-col">
        <OfflineBanner />
        <div className="flex-1">
          {children}
        </div>
        <PwaInstallPrompt />
      </div>
    </div>
  );
}

