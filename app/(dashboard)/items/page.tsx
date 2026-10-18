import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import WorkItemListClient from "@/components/items/WorkItemListClient";

export default async function ItemsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl tracking-tight">Work Items</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage and track operational work items</p>
      </div>
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading items…</div>}>
        <WorkItemListClient userId={session.sub} userName={session.name} />
      </Suspense>
    </div>
  );
}
