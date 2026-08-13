"use client";

import { ChatProvider } from "./chat-provider";
import { ChatFloatingButton } from "./chat-floating-button";
import { ChatPanel } from "./chat-panel";

interface ChatWrapperProps {
  children: React.ReactNode;
}

export function ChatWrapper({ children }: ChatWrapperProps) {
  return (
    <ChatProvider>
      {children}
      <ChatFloatingButton />
      <ChatPanel />
    </ChatProvider>
  );
}
