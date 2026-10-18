import Link from "next/link";
import { ArrowLeft, Search, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Custom not-found page for /items/[id].
 *
 * Shown when:
 *   - The item ID does not exist in the database, OR
 *   - The item belongs to a team the current user is not a member of
 *     (we intentionally return 404 for cross-team reads to prevent enumeration)
 */
export default function ItemNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="border-border/60 max-w-md w-full">
        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted/30">
            <ShieldAlert className="size-7 text-muted-foreground/50" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold">Item not found</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              This item either does not exist or belongs to a team you are not
              a member of. Check that you have the right link.
            </p>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <Link href="/items">
              <Button className="gap-2">
                <Search className="size-3.5" />
                Browse all items
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="size-3.5" />
                Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}