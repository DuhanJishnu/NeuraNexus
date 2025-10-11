"use client";

import { Response } from "@/types/exchange";
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useMemo,
} from "react";


interface Exchange {
  id: string;
  userQuery: string;
  systemResponse: Response;
  createdAt: string;
  files?: Array<string>;
  fileNames?: Array<string>;
}

interface ChatContextType {
  exchanges: Exchange[];
  setExchanges: React.Dispatch<React.SetStateAction<Exchange[]>>;
  convId: string;
  setConvId: React.Dispatch<React.SetStateAction<string>>;
  convTitle: string;
  setConvTitle: React.Dispatch<React.SetStateAction<string>>;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  refreshConversations: () => void;
  setRefreshConversations: (fn: () => void) => void;
  addNewConversation: (conversation: { id: string; title: string }) => void;
  setAddNewConversation: (fn: (conversation: { id: string; title: string }) => void) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [convId, setConvId] = useState("");
  const [convTitle, setConvTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [refreshConversations, setRefreshConversations] = useState<() => void>(() => () => {});
  const [addNewConversation, setAddNewConversation] = useState<(conversation: { id: string; title: string }) => void>(() => () => {});

  const contextValue = useMemo(() => ({
    exchanges,
    setExchanges,
    convId,
    setConvId,
    convTitle,
    setConvTitle,
    isLoading,
    setIsLoading,
    refreshConversations,
    setRefreshConversations,
    addNewConversation,
    setAddNewConversation
  }), [
    exchanges,
    convId,
    convTitle,
    isLoading,
    refreshConversations,
    addNewConversation
  ]);

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};