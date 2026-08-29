"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { getRecentConversations } from "@/service/conv";
import { useChat } from "@/context/ChatContext";
import {
  PlusIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from "@heroicons/react/24/outline";
import { motion, AnimatePresence } from "framer-motion";

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
}

const Sidebar = ({ isOpen }: { isOpen: boolean }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedConv, setSelectedConv] = useState<string>("");
  const [showAllConversations, setShowAllConversations] = useState(false);
  const {
    setExchanges,
    setConvId,
    setConvTitle,
    setRefreshConversations,
    setAddNewConversation,
  } = useChat();
  const loader = useRef(null);

  const MAX_COLLAPSED_CONVERSATIONS = 5;

  const fetchConversations = async (page: number) => {
    try {
      setIsLoading(true);
      const res = await getRecentConversations(page);
      setConversations((prev) => {
        const existingIds = new Set(prev.map((conv) => conv.id));
        const newConversations = res.conversations.filter(
          (conv: Conversation) => !existingIds.has(conv.id)
        );
        return [...prev, ...newConversations];
      });
      setHasMore(res.pagination.totalPages > page);
    } catch (error) {
      console.error("Failed to fetch conversations", error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshConversationList = useCallback(async () => {
    try {
      setPage(1);
      const res = await getRecentConversations(1);
      setConversations(res.conversations);
      setHasMore(res.pagination.totalPages > 1);
    } catch (error) {
      console.error("Failed to refresh conversations", error);
    }
  }, []);

  const addNewConversationToList = useCallback((conversation: Conversation) => {
    setConversations((prev) => {
      const existingIds = new Set(prev.map((conv) => conv.id));
      if (existingIds.has(conversation.id)) return prev;
      return [conversation, ...prev];
    });
  }, []);

  useEffect(() => {
    setRefreshConversations(() => refreshConversationList);
    setAddNewConversation(() => addNewConversationToList);
    return () => {
      setRefreshConversations(() => () => {});
      setAddNewConversation(() => () => {});
    };
  }, [
    refreshConversationList,
    addNewConversationToList,
    setAddNewConversation,
    setRefreshConversations,
  ]);

  useEffect(() => {
    if (isOpen) fetchConversations(page);
  }, [page, isOpen]);

  const handleObserver = useCallback(
    (entities: IntersectionObserverEntry[]) => {
      const target = entities[0];
      if (target.isIntersecting && hasMore && !isLoading && showAllConversations) {
        setPage((prevPage) => prevPage + 1);
      }
    },
    [hasMore, isLoading, showAllConversations]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "20px",
      threshold: 0.1,
    });
    if (loader.current && showAllConversations) observer.observe(loader.current);
    return () => observer.disconnect();
  }, [handleObserver, showAllConversations]);

  const handleNewChat = () => {
    setExchanges([]);
    setConvId("");
    setConvTitle("");
    setSelectedConv("");
    setShowAllConversations(false);
  };

  const handleConversationClick = (conv: Conversation) => {
    setExchanges([]);
    setSelectedConv(conv.id);
    setConvId(conv.id);
    setConvTitle(conv.title);
  };

  const toggleShowAllConversations = () => {
    setShowAllConversations(!showAllConversations);
    if (!showAllConversations && hasMore && conversations.length <= MAX_COLLAPSED_CONVERSATIONS) {
      setPage(1);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const displayedConversations = showAllConversations
    ? conversations
    : conversations.slice(0, MAX_COLLAPSED_CONVERSATIONS);

  const shouldShowToggle = conversations.length > MAX_COLLAPSED_CONVERSATIONS;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: -300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -300, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex flex-col w-80 h-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-r border-gray-200 dark:border-gray-800 shadow-xl"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <ChatBubbleLeftRightIcon className="w-6 h-6 text-vsyellow" />
                Conversations
              </h2>
              {shouldShowToggle && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={toggleShowAllConversations}
                  className="text-xs text-vsyellow hover:text-yellow-600 dark:hover:text-yellow-400 font-medium flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors"
                >
                  {showAllConversations ? (
                    <>
                      <ArrowsPointingInIcon className="w-3 h-3" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ArrowsPointingOutIcon className="w-3 h-3" />
                      Show All
                    </>
                  )}
                </motion.button>
              )}
            </div>

            <button
              onClick={handleNewChat}
              className="w-full bg-gradient-to-r from-vsyellow to-yellow-500 hover:from-yellow-500 hover:to-vsyellow text-black font-semibold py-3 px-4 rounded-xl transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
            >
              <PlusIcon className="w-5 h-5" />
              New Chat
            </button>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
            <div className="p-4">
              {conversations.length === 0 && !isLoading ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-12"
                >
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <ChatBubbleLeftRightIcon className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">
                    No conversations yet
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Start a new chat to begin your conversation
                  </p>
                </motion.div>
              ) : (
                <>
                  <div className="space-y-2">
                    {displayedConversations.map((conv, index) => (
                      <motion.div
                        key={conv.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => handleConversationClick(conv)}
                        className={`p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 ${
                          selectedConv === conv.id
                            ? "bg-vsyellow/10 border-vsyellow/30 shadow-md"
                            : "bg-gray-50/50 dark:bg-gray-800/50 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:border-gray-200 dark:hover:border-gray-700"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3
                            className={`font-medium text-sm line-clamp-2 flex-1 ${
                              selectedConv === conv.id
                                ? "text-gray-800 dark:text-gray-200"
                                : "text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {conv.title || "Untitled Conversation"}
                          </h3>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(conv.createdAt)}
                          </span>
                          {selectedConv === conv.id && (
                            <div className="w-2 h-2 bg-vsyellow rounded-full animate-pulse"></div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {shouldShowToggle && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-center mt-4"
                    >
                      <button
                        onClick={toggleShowAllConversations}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-vsyellow hover:text-yellow-600 dark:hover:text-yellow-400 font-medium bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-lg transition-colors"
                      >
                        {showAllConversations ? (
                          <>
                            <ArrowsPointingInIcon className="w-4 h-4" />
                            Show Less
                          </>
                        ) : (
                          <>
                            <ArrowsPointingOutIcon className="w-4 h-4" />
                            Show All
                          </>
                        )}
                      </button>
                    </motion.div>
                  )}
                </>
              )}

              {(isLoading || (hasMore && showAllConversations)) && (
                <div ref={loader} className="flex justify-center py-6">
                  <div className="flex items-center space-x-3 text-gray-500 dark:text-gray-400">
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 border-t-vsyellow rounded-full animate-spin"></div>
                        <span className="text-sm">Loading conversations...</span>
                      </>
                    ) : (
                      <div className="flex items-center space-x-2 text-sm">
                        <ChevronDownIcon className="w-4 h-4 animate-bounce" />
                        <span>Load more</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50">
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              {showAllConversations
                ? `${conversations.length} conversation${
                    conversations.length !== 1 ? "s" : ""
                  }`
                : `Showing ${Math.min(
                    conversations.length,
                    MAX_COLLAPSED_CONVERSATIONS
                  )} of ${conversations.length}`}
              {hasMore && showAllConversations && " • More available"}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Sidebar;
