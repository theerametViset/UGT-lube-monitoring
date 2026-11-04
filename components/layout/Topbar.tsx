import { NotificationBell, type NotifItem } from "@/components/layout/NotificationBell";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { PageTitle } from "@/components/layout/PageTitle";

export function Topbar({
  title,
  notifications,
  criticalCount,
  warningCount,
}: {
  title: string;
  notifications: NotifItem[];
  criticalCount: number;
  warningCount: number;
}) {
  return (
    // Same black + amber tint as the sidebar's logo row; data-theme="dark" keeps its text readable in light mode too.
    <header data-theme="dark" className="on-dark relative z-[500] flex h-[50px] flex-shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-nav bg-[linear-gradient(rgba(245,158,11,0.07),rgba(245,158,11,0.07))] px-3 text-t1 sm:px-5">
      {/* min-w-0 + truncate: a long title must not push the header wider than a phone screen */}
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="min-w-0 truncate whitespace-nowrap font-sans text-[16px] font-semibold tracking-tight text-t1">
          <PageTitle fallback={title} />
        </h1>
      </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <GlobalSearch />
        <NotificationBell items={notifications} criticalCount={criticalCount} warningCount={warningCount} />
      </div>
    </header>
  );
}
