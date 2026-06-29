import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import LeavesPage from "@/app/leaves/page";
import OvertimePage from "@/app/overtime/page";
import TimeCorrectionsPage from "@/app/time-corrections/page";
import { type RequestTab, RequestsTabs } from "@/app/requests/requests-tabs";

export const dynamic = "force-dynamic";

const REQUEST_TABS = ["pffd", "ot", "time-corrections"] as const;

function getActiveTab(tab?: string): RequestTab {
  return REQUEST_TABS.includes(tab as RequestTab) ? (tab as RequestTab) : "pffd";
}

function RequestPanelError({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-6 py-12 text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
        <AlertCircle className="size-5" />
      </div>
      <h2 className="mt-3 font-semibold text-foreground">{label} could not be loaded</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
        The database connection is temporarily unavailable. Refresh the page after the connection recovers.
      </p>
    </div>
  );
}

function DeferredRequestPanel({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-6 py-12 text-center">
      <h2 className="font-semibold text-foreground">{label}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
        Select this tab to load the latest requests.
      </p>
    </div>
  );
}

async function safePanel(label: string, load: () => Promise<ReactNode>) {
  try {
    return await load();
  } catch (error) {
    console.error(`Failed to load ${label} requests panel:`, error);
    return <RequestPanelError label={label} />;
  }
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const activeTab = getActiveTab(params?.tab);
  const statusSearchParams: Promise<{ status?: string }> = Promise.resolve(
    params?.status ? { status: params.status } : {}
  );

  const pffdPanel =
    activeTab === "pffd"
      ? await safePanel("PFFD", () => LeavesPage())
      : <DeferredRequestPanel label="Flex Day Requests" />;
  const overtimePanel =
    activeTab === "ot"
      ? await safePanel("OT", () => OvertimePage({ searchParams: statusSearchParams, basePath: "/requests?tab=ot" }))
      : <DeferredRequestPanel label="Overtime Requests" />;
  const timeCorrectionsPanel =
    activeTab === "time-corrections"
      ? await safePanel(
        "Time corrections",
        () => TimeCorrectionsPage({ searchParams: statusSearchParams, basePath: "/requests?tab=time-corrections" })
      )
      : <DeferredRequestPanel label="Manual Entry Requests" />;

  return (
    <RequestsTabs
      activeTab={activeTab}
      panels={{
        pffd: pffdPanel,
        ot: overtimePanel,
        "time-corrections": timeCorrectionsPanel,
      }}
    />
  );
}
