"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { createExchange, getExchanges, streamResponse, updateExchange } from "@/service/exch";
import { useChat } from "@/context/ChatContext";
import { updateConvTitle } from "@/service/conv";
import Spinner from "./spinner";

export default function ChatWindow() {
  const {
    exchanges,
    setExchanges,
    convId,
    setConvId,
    convTitle,
    setConvTitle,
    refreshConversations,
    addNewConversation,
    isLoading,
    setIsLoading,
  } = useChat();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [exchangePage, setExchangePage] = useState(1);
  const [hasMoreExchanges, setHasMoreExchanges] = useState(true);
  const loader = useRef(null);
  const activeStreams = useRef<Array<() => void>>([]);
  const [titleIsSet, setTitleIsSet] = useState(false);

  const scrollToBottom = useCallback(() => {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    if (atBottom) scrollToBottom();
  }, [exchanges, atBottom, scrollToBottom]);

  useEffect(() => {
    if (!convTitle || convTitle === "" || convTitle === "A new Title") {
      setTitleIsSet(false);
    }
  }, [convTitle, convId]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAtBottom(scrollTop + clientHeight >= scrollHeight - 50);
  }, []);

  const handleObserver = useCallback(
    (entities: IntersectionObserverEntry[]) => {
      const target = entities[0];
      if (target.isIntersecting && hasMoreExchanges && !isLoading) {
        setExchangePage((prevPage) => prevPage + 1);
      }
    },
    [hasMoreExchanges, isLoading]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "20px",
    });
    if (loader.current) {
      observer.observe(loader.current);
    }
    return () => observer.disconnect();
  }, [handleObserver]);

  useEffect(() => {
    setExchangePage(1);
    setHasMoreExchanges(true);
    
    activeStreams.current.forEach(closeStream => closeStream());
    activeStreams.current = [];
  }, [convId]);

  useEffect(() => {
    return () => {
      activeStreams.current.forEach(closeStream => closeStream());
      activeStreams.current = [];
    };
  }, []);

  useEffect(() => {
    if (convId) {
      setIsLoading(true);
      getExchanges(convId, exchangePage).then((res) => {
        const processedExchanges = res.exchanges.map((exchange: any) => ({
          ...exchange,
          systemResponse: {
            answer: exchange.systemResponse.answer || "",
            citation: exchange.systemResponse.citation 
          },
        }));
        
        if (exchangePage === 1) {
          setExchanges([...processedExchanges].reverse());
        } else {
          setExchanges((prev) => [[...processedExchanges].reverse(), ...prev].flat());
        }
        setHasMoreExchanges(res.exchanges.length > 0);
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, [convId, exchangePage, setExchanges, setIsLoading]);

  const onSend = async (text: string, image?: File) => {
    if (!text.trim() && !image) return;
    
    setIsLoading(true);
    const tempId = Date.now().toString();
    const tempExchange = {
      id: tempId,
      userQuery: text,
      systemResponse: { 
        answer: "", 
        citation: { 
          files: [], 
          fileNames: [] 
        } 
      },
      createdAt: new Date().toISOString(),
      image: image ? URL.createObjectURL(image) : undefined,
    };

    setExchanges((prev) => [...prev, tempExchange]);
    
    try {
      const res = await createExchange(text, convId, convTitle, image);

      if (!convId && res.conversation) {
        setConvId(res.conversation.id);
        setConvTitle(res.conversation.title);
        addNewConversation({
          id: res.conversation.id,
          title: res.conversation.title
        });
      }

      let answer = ""; 
      const closeStream = await streamResponse(
        res.responseId,
        async (message: string) => {

          answer += message;

          setExchanges((prev) =>
            prev.map((m) =>
              m.id === tempId ? { 
                ...m, 
                systemResponse: { 
                  ...m.systemResponse, 
                  answer: m.systemResponse.answer + message }
                 } : m
            )
          );
        },
        async (retrievals: any) => {
          const retrievedFilesSet: Set<string> = new Set();
          const fileInfos: Array<Record<string, any>> = [];

          const files_to_pages = new Map<string, Set<number>>();

          for (const document of retrievals.retrieved_documents) {
            const fileId = document.metadata.file_id.replace(".pdf", "");
            retrievedFilesSet.add(fileId);

            const chunkType = document.metadata.chunk_type;

            if (chunkType === "audio_transcript") {
              fileInfos.push({
                startTime: document.metadata.start_time,
                endTime: document.metadata.end_time,
                duration: document.metadata.duration,
              });

            } else if (chunkType === "text") {
              if (!files_to_pages.has(fileId)) {
                files_to_pages.set(fileId, new Set());
              }
              files_to_pages.get(fileId)!.add(document.metadata.page_number);
            }
          }

          for (const [fileId, pagesSet] of files_to_pages.entries()) {
            fileInfos.push({
              fileId,
              pageNumbers: Array.from(pagesSet).sort((a, b) => a - b),
            });
          }

          const retrievedFiles = Array.from(retrievedFilesSet);

          if (!titleIsSet && convId) {
            
            let newTitle = answer
              .split(/\\n|\n/)[0]
              .trim();
            
            newTitle = newTitle
              .replace(/^#+\s*/, '')
              .replace(/\*\*(.+?)\*\*/g, '$1')
              .replace(/\*(.+?)\*/g, '$1')
              .trim();
            
            if (newTitle && newTitle.length > 0) {
              setTitleIsSet(true);
              setConvTitle(newTitle);
              
              updateConvTitle(convId, newTitle).then(() => {
                refreshConversations();
              }).catch((error) => {
                console.error("Failed to update title:", error);
              });
            }
          }

          let fileNames: string[] = [];
          
          if (retrievedFiles.length > 0) {
            try {
              const response = await fetch(`${process.env.NEXT_PUBLIC_FILE_BASE_URL}/api/file/v1/getFileNamesbyId`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ encryptedIds: retrievedFiles }),
              });
              const data = await response.json();
              fileNames = data.fileNames || [];
            } catch (error) {
              console.error('Error fetching file names:', error);
              fileNames = [];
            }
          }

          setExchanges((prev) =>
            prev.map((exchange) =>
              exchange.id === tempId 
                ? { 
                    ...exchange, 
                    systemResponse: {
                      ...exchange.systemResponse,
                      citation: {
                        files: retrievedFiles,
                        fileNames: fileNames,
                        fileInfos: fileInfos
                      }
                    }
                  }
                : exchange
            )
          );
          
          await updateExchange(
            res.exchange.id,
            {
              answer: answer,
              citation: {
                files: retrievedFiles,
                fileNames: fileNames,
                fileInfos: fileInfos
              }
            }
          );
        },
        (error: any) => {
          console.error("Streaming error:", error);
          setExchanges((prev) =>
            prev.map((m) =>
              m.id === tempId 
                ? { ...m, systemResponse: {
                   ...m.systemResponse, 
                   answer: m.systemResponse.answer + "\n\nError: Failed to receive response"
                  }
                } : m
            )
          );
        }
      );

      activeStreams.current.push(closeStream);
    } catch (err) {
      console.error("Send failed", err);
      setExchanges((prev) =>
        prev.map((m) =>
          m.id === tempId ? { 
            ...m, systemResponse: {
              ...m.systemResponse,
              answer: m.systemResponse.answer + "\n\nError: Failed to receive response"
            } 
          } : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col w-full h-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <h1 className="font-semibold text-gray-800 dark:text-gray-200 text-lg">
              {convTitle || "New Chat"}
            </h1>
          </div>
          {convId && (
            <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
              {convId.slice(0, 8)}...
            </div>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
      >
        <div className="max-w-4xl mx-auto px-4 py-6">
          {hasMoreExchanges && (
            <div ref={loader} className="flex justify-center py-4">
              {isLoading && <Spinner />}
            </div>
          )}
          
          <AnimatePresence initial={false} mode="popLayout">
            {exchanges.length === 0 && !isLoading ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16"
              >
                <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-full flex items-center justify-center">
                  <div className="text-3xl">💬</div>
                </div>
                <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">
                  Start a conversation
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                  Send a message to begin chatting. Ask questions, share images, or explore ideas together.
                </p>
              </motion.div>
            ) : (
              exchanges.map((m, index) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="mb-6 last:mb-0"
                >
                  <MessageBubble
                    role="user"
                    text={m.userQuery}
                    timestamp={m.createdAt}
                  />
                  <MessageBubble
                    role="assistant"
                    isStreaming={isLoading && index === exchanges.length - 1}
                    text={m.systemResponse.answer}
                    timestamp={m.createdAt}
                    files={m.systemResponse.citation?.files ?? []}
                    fileNames={m.systemResponse.citation?.fileNames ?? []}
                    fileInfos={m.systemResponse.citation?.fileInfos ?? []}
                  />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {!atBottom && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          type="button" 
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
          className="absolute bottom-24 right-6 p-3 rounded-full bg-vsyellow text-black shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 border border-yellow-300"
        >
          <ChevronDownIcon className="w-5 h-5" />
        </motion.button>
      )}
      <div className="border-t border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <ChatInput onSend={onSend} conv_id={convId} setConvId={setConvId} />
        </div>
      </div>
    </div>
  );
}