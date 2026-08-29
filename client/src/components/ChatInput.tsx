"use client";

import { KeyboardEvent, useRef, useState } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';


interface ChatInputProps {
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleSend = async () => {
    const message = text.trim();
    if (!message || disabled) return;
    setText('');
    await onSend(message);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex items-end w-full p-2 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-transparent focus-within:border-vsyellow transition-colors">
      <label htmlFor="chat-message" className="sr-only">Message</label>
      <textarea
        id="chat-message"
        ref={textareaRef}
        value={text}
        onChange={event => setText(event.target.value.slice(0, 8_000))}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question about your documents…"
        className="flex-1 max-h-40 px-4 py-2 bg-transparent focus:outline-none resize-none text-gray-800 dark:text-gray-200 placeholder-gray-500"
        rows={1}
        maxLength={8_000}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={() => void handleSend()}
        className="p-2 text-black bg-vsyellow rounded-full hover:bg-yellow-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 disabled:cursor-not-allowed disabled:bg-gray-400"
        disabled={disabled || !text.trim()}
        aria-label={disabled ? 'Waiting for the current response' : 'Send message'}
      >
        <PaperAirplaneIcon className="w-6 h-6" />
      </button>
    </div>
  );
}
