import MessageList from "@/components/MessageList";

export default function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q ?? "";

  return (
    <div>
      <div className="px-4 py-3 border-b border-line">
        <h1 className="text-lg font-display text-ink">Search results for "{q}"</h1>
      </div>
      <MessageList q={q} />
    </div>
  );
}
