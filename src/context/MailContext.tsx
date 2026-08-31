"use client";

import { createContext, useCallback, useContext, useState } from "react";

export interface ComposePrefill {
  draftId?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  bodyText?: string;
  threadId?: string;
  inReplyToId?: string;
}

interface MailContextValue {
  composeOpen: boolean;
  composePrefill: ComposePrefill | null;
  openCompose: (prefill?: ComposePrefill) => void;
  closeCompose: () => void;
  refreshToken: number;
  notifyChanged: () => void;
}

const MailContext = createContext<MailContextValue | null>(null);

export function MailProvider({ children }: { children: React.ReactNode }) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [composePrefill, setComposePrefill] = useState<ComposePrefill | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const openCompose = useCallback((prefill?: ComposePrefill) => {
    setComposePrefill(prefill ?? null);
    setComposeOpen(true);
  }, []);

  const closeCompose = useCallback(() => {
    setComposeOpen(false);
    setComposePrefill(null);
  }, []);

  const notifyChanged = useCallback(() => {
    setRefreshToken((t) => t + 1);
  }, []);

  return (
    <MailContext.Provider
      value={{ composeOpen, composePrefill, openCompose, closeCompose, refreshToken, notifyChanged }}
    >
      {children}
    </MailContext.Provider>
  );
}

export function useMail() {
  const ctx = useContext(MailContext);
  if (!ctx) throw new Error("useMail must be used within MailProvider");
  return ctx;
}
