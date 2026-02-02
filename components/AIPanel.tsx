import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Loader2 } from 'lucide-react';
import { SheetData, ChatMessage, MessageRole } from '../types';
import { convertSheetToCSV } from '../utils/excel';
import { analyzeSheetData } from '../services/geminiService';

interface AIPanelProps {
  data: SheetData;
  onClose: () => void;
}

export const AIPanel: React.FC<AIPanelProps> = ({ data, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: MessageRole.MODEL, text: "Hi! I'm your data assistant. Ask me anything about your spreadsheet, or ask for help with formulas." }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: MessageRole.USER, text: userMsg }]);
    setIsLoading(true);

    try {
      // Get data context
      const csv = convertSheetToCSV(data);
      const aiResponse = await analyzeSheetData(csv, userMsg);
      
      setMessages(prev => [...prev, { 
        role: MessageRole.MODEL, 
        text: aiResponse || "I couldn't generate a response." 
      }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { 
        role: MessageRole.MODEL, 
        text: "Sorry, I encountered an error connecting to the AI service." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#121212] text-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#1a1a1a]">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-blue-400" />
          <h2 className="font-semibold text-gray-200">Data Assistant</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0a0a0a]">
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`
              max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm
              ${msg.role === MessageRole.USER 
                ? 'bg-blue-700 text-white rounded-br-none' 
                : 'bg-[#1e1e1e] text-gray-200 border border-gray-700 rounded-bl-none'}
            `}>
              {msg.text.split('\n').map((line, i) => (
                 <p key={i} className="mb-1 last:mb-0">{line}</p>
              ))}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#1e1e1e] border border-gray-700 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-800 bg-[#1a1a1a]">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Analyze this data..."
            className="flex-1 bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 text-white rounded-lg p-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <div className="mt-2 text-xs text-center text-gray-500">
          AI can make mistakes. Verify important info.
        </div>
      </div>
    </div>
  );
};