"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { createExchange, getExchanges, streamResponse, updateExchange } from "@/service/exch";
import { useChat } from "@/context/ChatContext";
import { updateConvTitle } from "@/service/conv";

export default function ChatWindow() {
  const {
    exchanges,
    setExchanges,
    convId,
    setConvId,
    convTitle,
    setConvTitle,
    refreshConversations,
    addNewConversation
  } = useChat();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [exchangePage, setExchangePage] = useState(1);
  const [hasMoreExchanges, setHasMoreExchanges] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
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
    console.log("Title: ", convTitle);
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

  // Reset page when conversation changes
  useEffect(() => {
    setExchangePage(1);
    setHasMoreExchanges(true);
    
    // Clean up any active streams when conversation changes
    activeStreams.current.forEach(closeStream => closeStream());
    activeStreams.current = [];
  }, [convId]);

  // Cleanup streams on unmount
  useEffect(() => {
    return () => {
      activeStreams.current.forEach(closeStream => closeStream());
      activeStreams.current = [];
    };
  }, []);

  useEffect(() => {
    if (convId) {
      getExchanges(convId, exchangePage).then((res) => {
        const processedExchanges = res.exchanges.map((exchange: any) => ({
          ...exchange,
          systemResponse: {
            answer: exchange.systemResponse.answer || "",
            citation: exchange.systemResponse.citation 
          },
        }));
        
        if (exchangePage === 1) {
          // First page: reverse to show oldest first, newest last
          setExchanges([...processedExchanges].reverse());
        } else {
          // Additional pages: prepend older messages (already in desc order from backend)
          setExchanges((prev) => [[...processedExchanges].reverse(), ...prev].flat());
        }
        setHasMoreExchanges(res.exchanges.length > 0);
      });
    }

    console.log("Exchanges", exchanges);
  }, [convId, exchangePage, setExchanges]);

  useEffect(()=>{
    setExchanges((prev)=>{
      return prev.map((m)=> ({...m, systemResponse: m.systemResponse}))  
    })
  },[])

  const onSend = async (text: string, image?: File) => {
    if (!text.trim() && !image) return;
    
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
        // Add the new conversation to the sidebar list
        addNewConversation({
          id: res.conversation.id,
          title: res.conversation.title
        });
      }

      let answer = ""; 
      // Start streaming the response
      const closeStream = await streamResponse(
        res.responseId,
        async (message: string) => {

          answer += message;

          // Update the temporary exchange with streamed content 
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
          const retrievedFiles: Array<string> = []
          console.log("Stream ended. Retrievals:", retrievals.retrieved_documents);
          for (const document of retrievals.retrieved_documents) {
            console.log(document.metadata.file_id.replace(".pdf", ""));
            retrievedFiles.push(document.metadata.file_id.replace(".pdf", ""));
          }

          if (!titleIsSet && convId) {
            
            let newTitle = answer
              .split(/\\n|\n/)[0]
              .trim();
            
            // Clean up markdown formatting and limit length
            newTitle = newTitle
              .replace(/^#+\s*/, '') // Remove markdown headers (# ## ###)
              .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold formatting
              .replace(/\*(.+?)\*/g, '$1') // Remove italic formatting
              .trim();
            
            if (newTitle && newTitle.length > 0) {
              setTitleIsSet(true);
              setConvTitle(newTitle);
              
              // Update the conversation title in the database
              updateConvTitle(convId, newTitle).then(() => {
                console.log("Title updated successfully");
                // Refresh conversations to update the sidebar
                refreshConversations();
              }).catch((error) => {
                console.error("Failed to update title:", error);
              });
            }
          }

          let fileNames: string[] = [];
          
          // Fetch file names synchronously if we have retrieved files
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

          // Update the exchange in the UI with files and file names
          setExchanges((prev) =>
            prev.map((exchange) =>
              exchange.id === tempId 
                ? { 
                    ...exchange, 
                    systemResponse: {
                      ...exchange.systemResponse,
                      citation: {
                        files: retrievedFiles,
                        fileNames: fileNames
                      }
                    }
                  }
                : exchange
            )
          );

          // Update the exchange in the database using the locally tracked answer
          await updateExchange(
            res.exchange.id,
            {
              answer: answer,
              citation: {
                files: retrievedFiles,
                fileNames: fileNames
              }
            }
          );
          console.log("Update exchange response:", res.data);
        },
        (error: any) => {
          console.log("Error in stream response function");
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

      // Store the close function for cleanup
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
    }
  };

  return (
    <div className="relative flex flex-col w-full h-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Header */}
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

      {/* Messages Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
      >
        <div className="max-w-4xl mx-auto px-4 py-6">
          {hasMoreExchanges && (
            <div ref={loader} className="flex justify-center py-4">
              <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-vsyellow rounded-full animate-spin"></div>
                <span className="text-sm">Loading earlier messages...</span>
              </div>
            </div>
          )}
          
          <AnimatePresence initial={false} mode="popLayout">
            {exchanges.length === 0 ? (
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
              exchanges.map((m) => (
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
                    // image={m}
                  />
                  <MessageBubble
                    role="assistant"
                    isStreaming={true}
                    text={m.systemResponse.answer}
                    timestamp={m.createdAt}
                    files={m.systemResponse.citation?.files ?? []}
                    fileNames={m.systemResponse.citation?.fileNames ?? []}
                  />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Scroll to Bottom Button */}
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
      {/* Input Area */}
      <div className="border-t border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <ChatInput onSend={onSend} conv_id={convId} setConvId={setConvId} />
        </div>
      </div>
    </div>
  );
}