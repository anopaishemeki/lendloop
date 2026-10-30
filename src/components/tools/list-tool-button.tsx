import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ListToolButton() {
  return (
    <Button asChild>
      <Link href="/tools/new">
        <Plus aria-hidden />
        List a tool
      </Link>
    </Button>
  );
}
