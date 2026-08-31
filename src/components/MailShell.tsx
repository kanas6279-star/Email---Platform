"use client";

import { MailProvider } from "@/context/MailContext";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import ComposeModal from "./ComposeModal";

export default function MailShell({
  displayName,
  email,
  children,
}: {
  displayName: string;
  email: string;
  children: React.ReactNode;
}) {
  return (
    <MailProvider>
      <div className="h-screen flex overflow-hidden">
        <div className="hidden sm:block">
          <Sidebar displayName={displayName} email={email} />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
      <ComposeModal />
    </MailProvider>
  );
}
