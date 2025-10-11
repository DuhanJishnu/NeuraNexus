"use client";
import React, { useState, useRef, ChangeEvent, KeyboardEvent } from "react";
import { PaperAirplaneIcon, PhotoIcon } from "@heroicons/react/24/outline";

interface ChatInputProps {
  onSend: (text: string, image?: File) => void;
  conv_id: string;
  setConvId: (id: string) => void;
}

export default function ChatInput({
  onSend,
  conv_id,
  setConvId,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleSend = () => {
    if (text.trim() || image) {
      onSend(text, image || undefined);
      setText("");
      setImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-center w-full p-2 rounded-full bg-gray-100 dark:bg-gray-800 border border-transparent focus-within:border-vsyellow transition-colors duration-200">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        className="flex-1 px-4 py-2 bg-transparent focus:outline-none resize-none text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400"
        rows={1}
        style={{ minHeight: "2.5rem" }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="p-2 text-gray-500 hover:text-vsyellow dark:hover:text-vsyellow transition-colors duration-200 rounded-full focus:outline-none"
        aria-label="Add image"
      >
        <PhotoIcon className="w-6 h-6" />
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageChange}
        className="hidden"
        accept="image/*"
      />
      <button
        type="button"
        onClick={handleSend}
        className="p-2 text-white bg-vsyellow rounded-full hover:bg-yellow-500 transition-colors duration-200 focus:outline-none disabled:bg-gray-400 dark:disabled:bg-gray-600"
        disabled={!text.trim() && !image}
        aria-label="Send message"
      >
        <PaperAirplaneIcon className="w-6 h-6" />
      </button>
    </div>
  );
}