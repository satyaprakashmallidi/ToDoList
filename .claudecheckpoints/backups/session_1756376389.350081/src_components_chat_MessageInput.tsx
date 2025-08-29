import React, { useState } from 'react';
import { Send } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  disabled?: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = ({ 
  onSendMessage, 
  disabled = false 
}) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex-shrink-0 bg-white border-t border-gray-200 p-3 sm:p-4">
      <form onSubmit={handleSubmit} className="flex items-end gap-2 sm:gap-3">
        <div className="flex-1">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-3 text-sm bg-gray-100 border-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            style={{
              minHeight: '44px',
              maxHeight: '120px',
              lineHeight: '1.5',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = '44px';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
        </div>
        <button
          type="submit"
          disabled={!message.trim() || disabled}
          className={`w-10 sm:w-11 h-10 sm:h-11 rounded-full transition-all duration-200 flex items-center justify-center flex-shrink-0 ${
            message.trim() && !disabled
              ? 'bg-blue-500 text-white hover:bg-blue-600 hover:scale-105 shadow-lg'
              : 'bg-gray-200 text-gray-400'
          }`}
        >
          <Send className="w-4 sm:w-5 h-4 sm:h-5" />
        </button>
      </form>
    </div>
  );
};