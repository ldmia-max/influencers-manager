"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { sendChatMessage } from "@/services/chat";
import type { ChatRequest, ChatResponse } from "@/services/chat";
import type { ChatMessage, CampaignState } from "@/models/chat";

export type { ChatMessage, CampaignState };

interface ChatContextType {
  // Estado
  isOpen: boolean;
  messages: ChatMessage[];
  campaignState: CampaignState;
  isLoading: boolean;
  error: string | null;

  // Acciones
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  sendMessage: (content: string) => Promise<void>;
  clearChat: () => void;
  updateCampaignState: (state: Partial<CampaignState>) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

const STORAGE_KEY = "campaign-chat";

const initialCampaignState: CampaignState = {
  selectedProfiles: [],
};

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [campaignState, setCampaignState] = useState<CampaignState>(initialCampaignState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Refs para acceder al estado actual dentro de callbacks
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const campaignStateRef = useRef(campaignState);
  campaignStateRef.current = campaignState;

  const chatMutation = useMutation<ChatResponse, Error, ChatRequest>({
    mutationFn: (payload) => sendChatMessage(payload),
    onSuccess: (data) => {
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: data.content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (data.campaignState) {
        setCampaignState(data.campaignState as unknown as CampaignState);

        if ((data.campaignState as Record<string, unknown>).campaignCreatedId) {
          router.refresh();
        }
      }
    },
  });

  const isLoading = chatMutation.isPending;
  const error = chatMutation.error?.message || null;

  // Cargar desde localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.messages) {
          setMessages(
            parsed.messages.map((m: ChatMessage) => ({
              ...m,
              timestamp: new Date(m.timestamp),
            }))
          );
        }
        if (parsed.campaignState) {
          setCampaignState(parsed.campaignState);
        }
      }
    } catch {
      // Ignorar errores de parsing
    }
    setIsHydrated(true);
  }, []);

  // Guardar en localStorage
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ messages, campaignState })
      );
    }
  }, [messages, campaignState, isHydrated]);

  const openChat = useCallback(() => setIsOpen(true), []);
  const closeChat = useCallback(() => setIsOpen(false), []);
  const toggleChat = useCallback(() => setIsOpen((prev) => !prev), []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || chatMutation.isPending) return;

      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      const apiMessages = [...messagesRef.current, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      chatMutation.mutate({
        messages: apiMessages,
        campaignState: campaignStateRef.current as unknown as Record<string, unknown>,
      });
    },
    [chatMutation]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setCampaignState(initialCampaignState);
    chatMutation.reset();
  }, [chatMutation]);

  const updateCampaignState = useCallback((state: Partial<CampaignState>) => {
    setCampaignState((prev) => ({ ...prev, ...state }));
  }, []);

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        messages,
        campaignState,
        isLoading,
        error,
        openChat,
        closeChat,
        toggleChat,
        sendMessage,
        clearChat,
        updateCampaignState,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat debe usarse dentro de un ChatProvider");
  }
  return context;
}
