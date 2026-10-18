import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import AppSidebar from "@/components/layout/AppSidebar";
import AppTopbar from "@/components/layout/AppTopbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <SidebarProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-background">
        <AppSidebar user={session} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppTopbar user={session} />
          <main className="flex-1 overflow-y-auto p-6 bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
