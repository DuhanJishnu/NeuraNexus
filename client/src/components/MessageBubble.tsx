"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Streamdown } from "streamdown";
import { useState, useCallback } from "react";
import {
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

const TypingIndicator = () => (
    <div className="flex items-center space-x-1.5 py-2">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
    </div>
);

export default function MessageBubble({
  role,
  text,
  image,
  timestamp,
  isStreaming,
  files,
  fileNames,
  onRetry,
  fileInfos
}: Readonly<{
  role: "user" | "assistant";
  text: string;
  image?: File | string;
  timestamp: string | Date;
  isStreaming?: boolean;
  files?: Array<string>;
  fileNames?: Array<string>;
  onRetry?: () => void;
  fileInfos?: Array<Record<string, any>>;
}>) {

  if (text === undefined) text = "";
  const isUser = role === "user";
  const time = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const formattedTime = time.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    if (navigator.clipboard && text) {
      navigator.clipboard.writeText(text).then(() => {
        setIsCopied(true);
        setTimeout(() => {
          setIsCopied(false);
        }, 2000);
      });
    }
  };

  const processedText = role === "assistant" 
    ? text.replace(/\\n/g, '\n')
    : text;


  const [failedThumbs, setFailedThumbs] = useState<Set<string>>(new Set());

  const handleThumbnailError = useCallback((fileId: string) => {
    setFailedThumbs((prev) => new Set(prev).add(fileId));
  }, []);

  return (
    <div
      className={`w-fit max-w-[80%] ${
        isUser ? "ml-auto text-right" : "mr-auto text-left"
      }`}
    >
      <div
        className={`relative p-3 rounded-xl transition-all ${
          isUser
            ? "bg-white/10 text-white"
            : "text-gray-900 dark:text-gray-100"
        }`}
      >
        {image && (
          <div className="relative w-full max-w-sm h-64">
            <Image
              src={
                typeof image === "string" ? image : URL.createObjectURL(image)
              }
              alt="message"
              fill
              className="object-cover rounded-md"
            />
          </div>
        )}

        {role === "assistant" ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {isStreaming && !text ? <TypingIndicator /> : <Streamdown>{processedText}</Streamdown>}
          </motion.div>
        ) : (
          <p>{text}</p>
        )}
      </div>

      <div>
        {files && files.length > 0 && (
          <>
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-white mb-3">
                Citations 👇
              </h1>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-full bg-gray-700 text-gray-400 hover:bg-gray-600 focus:outline-none"
                  aria-label="Copy response"
                >
                  {isCopied ? (
                    <CheckIcon className="w-4 h-4 text-green-500" />
                  ) : (
                    <ClipboardDocumentIcon className="w-4 h-4" />
                  )}
                </button>
                {!isUser && !isStreaming && onRetry && (
                  <button
                    onClick={onRetry}
                    className="p-1.5 rounded-full bg-gray-700 text-gray-400 hover:bg-gray-600 focus:outline-none"
                    aria-label="Try again"
                  >
                    <ArrowPathIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <ul className="space-y-3">
              {files.map((file, index) => (
                <li
                  key={index}
                  className="flex justify-between items-center gap-4 p-1 rounded-lg hover:bg-blue-800/50 transition-colors duration-200"
                >
                  <div className="flex items-center gap-4">
                      {failedThumbs.has(file) ? (
                        <Image
                          src="/thumb_file.svg"
                          alt="document thumbnail"
                          height={40}
                          width={40}
                          className="rounded-md shadow-sm opacity-70"
                        />
                      ) : (
                        <Image
                          src={`${process.env.NEXT_PUBLIC_FILE_BASE_URL}/api/file/v1/thumb/${file}`}
                          alt="document thumbnail"
                          height={40}
                          width={40}
                          className="rounded-md shadow-sm"
                          onError={() => handleThumbnailError(file)}
                        />
                      )}

                    <a
                      href={`${process.env.NEXT_PUBLIC_FILE_BASE_URL}/api/file/v1/files/${file}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-200 hover:text-white font-medium transition-colors duration-150"
                    >
                      {fileNames ? fileNames[index] : file}
                    </a>
                  </div>
                  {fileInfos && Object.keys(fileInfos[index] || {}).length > 0 && (
                    <div className="text-sm text-gray-400">
                      {fileInfos[index].startTime ? (
                        <span className="text-white">
                          <i>Duration</i> ~ {fileInfos[index].duration}s [{fileInfos[index].startTime} - {fileInfos[index].endTime}]
                        </span>
                      ) : null}
                      {fileInfos[index].pageNumbers ? (
                        <span className="text-white">
                          <i>Page</i> ~ {fileInfos[index].pageNumbers.join(", ")}
                        </span>
                      ) : null
                      }
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div
        className={`mt-1 text-xs ${isUser ? "text-gray-300" : "text-gray-500"}`}
      >
        {formattedTime}
      </div>
    </div>
  );
}