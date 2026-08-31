import MessageList from "@/components/MessageList";

const LABELS: Record<string, string> = {
  inbox: "Inbox",
  sent: "Sent",
  drafts: "Drafts",
  archive: "Archive",
  spam: "Spam",
  trash: "Trash",
  starred: "Starred",
};

export default function FolderPage({ params }: { params: { folder: string } }) {
  const label = LABELS[params.folder] ?? "Inbox";
  const isStarredView = params.folder === "starred";

  return (
    <div>
      <div className="px-4 py-3 border-b border-line">
        <h1 className="text-lg font-display text-ink">{label}</h1>
      </div>
      {isStarredView ? (
        <MessageList starredOnly />
      ) : (
        <MessageList folder={params.folder} />
      )}
    </div>
  );
}
