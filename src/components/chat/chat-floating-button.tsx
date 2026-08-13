"use client";

import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChat } from "./chat-provider";
import { cn } from "@/lib/utils";

export function ChatFloatingButton() {
  const { isOpen, toggleChat, messages } = useChat();

  // Contar mensajes no leídos (cuando está cerrado)
  const hasMessages = messages.length > 0;

  return (
    <Button
      onClick={toggleChat}
      size="lg"
      className={cn(
        "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg",
        "transition-all duration-300 hover:scale-105",
        isOpen
          ? "bg-gray-600 hover:bg-gray-700"
          : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
      )}
    >
      {isOpen ? (
        <X className="h-6 w-6" />
      ) : (
        <>
          <MessageCircle className="h-6 w-6" />
          {hasMessages && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-white" />
          )}
        </>
      )}
    </Button>
  );
}
