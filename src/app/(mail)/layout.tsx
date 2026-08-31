import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import MailShell from "@/components/MailShell";

export default async function MailLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <MailShell displayName={user.displayName} email={user.email}>
      {children}
    </MailShell>
  );
}
