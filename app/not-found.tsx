import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-5 max-w-sm">
        <div className="space-y-2">
          <p className="text-7xl font-bold text-muted-foreground/20 select-none">404</p>
          <h1 className="text-xl font-semibold">Page not found</h1>
          <p className="text-sm text-muted-foreground">
            The page you are looking for does not exist or you do not have permission to view it.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Link href="/">
            <Button className="gap-2">
              <Home className="size-3.5" />
              Go to Dashboard
            </Button>
          </Link>
          <Link href="/items">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="size-3.5" />
              Work Items
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}