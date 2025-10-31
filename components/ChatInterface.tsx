import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';
import { MessageAuthor } from '../types';
import StyleControls from './StyleControls';
import StoryControls from './StoryControls';
import type { FontSize } from '../App';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  choices: string[];
  fontSize: FontSize;
  fontFamily: string;
  onFontSizeChange: (size: FontSize) => void;
  onFontFamilyChange: (family: string) => void;
  onSaveStory: () => void;
  onLoadStory: () => void;
  isSaveAvailable: boolean;
  onShareStory: () => void;
  isShareable: boolean;
  isAmbianceMuted: boolean;
  onToggleAmbianceMute: () => void;
  onUndo: () => void;
  onRedo: () => void;
  isUndoDisabled: boolean;
  isRedoDisabled: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  messages, 
  onSendMessage, 
  isLoading, 
  choices,
  fontSize,
  fontFamily,
  onFontSizeChange,
  onFontFamilyChange,
  onSaveStory,
  onLoadStory,
  isSaveAvailable,
  onShareStory,
  isShareable,
  isAmbianceMuted,
  onToggleAmbianceMute,
  onUndo,
  onRedo,
  isUndoDisabled,
  isRedoDisabled,
}) => {
  const [input, setInput] = useState('');
  const [tooltip, setTooltip] = useState<{ content: string; x: number; y: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, choices]);

  useEffect(() => {
    const closeTooltip = () => setTooltip(null);
    if (tooltip) {
      window.addEventListener('click', closeTooltip, true);
      chatContainerRef.current?.addEventListener('scroll', closeTooltip);
    }
    return () => {
      window.removeEventListener('click', closeTooltip, true);
      chatContainerRef.current?.removeEventListener('scroll', closeTooltip);
    };
  }, [tooltip]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading && choices.length === 0) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleWordClick = (definition: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({ 
      content: definition, 
      x: rect.left + window.scrollX, 
      y: rect.top + window.scrollY - 10 
    });
  };

  const renderInteractiveText = (text: string) => {
    const parts = text.split(/({[^}]+})/g);
    return parts.map((part, i) => {
      const match = part.match(/{([\w\s'-]+)\|(.+?)}/);
      if (match) {
        const [, word, definition] = match;
        return (
          <span
            key={i}
            className="text-purple-600 font-bold underline decoration-dotted cursor-pointer hover:text-purple-800 word-glow"
            onClick={(e) => handleWordClick(definition, e)}
          >
            {word}
          </span>
        );
      }
      // Strip out speaker tags for rendering
      return part.replace(/\[[A-Z\s]+\]/g, '');
    });
  };

  const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
    </svg>
  );

  return (
    <div className="w-full lg:w-1/2 h-full flex flex-col p-4 md:p-6 lg:p-8">
      {tooltip && (
        <div 
          style={{ top: `${tooltip.y}px`, left: `${tooltip.x}px`, transform: 'translateY(-100%)' }}
          className="fixed z-50 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg shadow-sm"
        >
          {tooltip.content}
           <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-gray-900"></div>
        </div>
      )}
      <div className="flex-grow bg-white/80 backdrop-blur-sm rounded-2xl shadow-inner overflow-hidden flex flex-col border border-gray-200">
        <div className="p-2 flex items-center justify-between bg-white/50 border-b border-gray-200 text-gray-600 shrink-0">
            <StyleControls 
              fontSize={fontSize}
              fontFamily={fontFamily}
              onFontSizeChange={onFontSizeChange}
              onFontFamilyChange={onFontFamilyChange}
            />
            <StoryControls
              onSave={onSaveStory}
              onLoad={onLoadStory}
              isLoadDisabled={!isSaveAvailable}
              onShare={onShareStory}
              isShareDisabled={!isShareable}
              isMuted={isAmbianceMuted}
              onToggleMute={onToggleAmbianceMute}
              onUndo={onUndo}
              onRedo={onRedo}
              isUndoDisabled={isUndoDisabled}
              isRedoDisabled={isRedoDisabled}
            />
        </div>
        <div ref={chatContainerRef} className="p-4 flex-grow overflow-y-auto space-y-4">
          {messages.map((msg, index) => {
            const isModel = msg.author === MessageAuthor.MODEL;
            const textSizeClass = `md:text-${isModel ? fontSize : 'base'}`;
            const textStyle = isModel ? { fontFamily: fontFamily } : {};
            
            return (
              <div key={index} className={`flex items-end gap-2 ${msg.author === MessageAuthor.USER ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs md:max-w-md p-3 rounded-2xl ${msg.author === MessageAuthor.USER ? 'bg-purple-500 text-white rounded-br-none' : 'bg-gray-200 text-gray-800 rounded-bl-none'}`}>
                  <p className={`text-sm ${textSizeClass} whitespace-pre-wrap`} style={textStyle}>
                    {isModel ? renderInteractiveText(msg.text) : msg.text}
                  </p>
                </div>
              </div>
            );
          })}
          {isLoading && (
             <div className="flex items-end gap-2 justify-start">
               <div className="max-w-xs md:max-w-md p-3 rounded-2xl bg-gray-200 text-gray-800 rounded-bl-none">
                 <div className="flex items-center justify-center space-x-1">
                   <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
	                 <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
	                 <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                 </div>
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {choices.length > 0 && !isLoading && (
          <div className="p-4 border-t border-gray-200">
            <p className="text-center text-sm font-bold text-gray-600 mb-3">What happens next?</p>
            <div className="flex flex-wrap justify-center gap-2">
              {choices.map((choice, index) => (
                <button
                  key={index}
                  onClick={() => onSendMessage(choice)}
                  disabled={isLoading}
                  className="px-4 py-2 bg-purple-500 text-white rounded-full hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-transform duration-200 active:scale-95 disabled:bg-gray-400"
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-white/50">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={choices.length > 0 ? "Choose an option above to continue!" : "What should the story be about?"}
              disabled={isLoading || choices.length > 0}
              className="w-full py-3 pl-4 pr-14 text-gray-700 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-400 transition duration-300 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || choices.length > 0}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-purple-500 text-white rounded-full hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-transform duration-200 active:scale-90 disabled:bg-gray-400 disabled:scale-100"
            >
              <SendIcon />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;