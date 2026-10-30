import { UserButton } from "@clerk/nextjs";

export default function ToolsPage() {
  return (
    <main className="mx-auto flex max-w-5xl items-center justify-between px-6 py-8">
      <h1 className="text-2xl font-semibold">Tools</h1>
      <UserButton />
    </main>
  );
}
