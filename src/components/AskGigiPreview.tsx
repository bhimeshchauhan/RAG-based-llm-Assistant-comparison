/**
 * =============================================================================
 * Ask GiGi Preview Component
 * =============================================================================
 * Single-provider view that mimics the actual Ask GiGi mobile app layout
 * Used for previewing how responses would look in the production app
 * =============================================================================
 */

import React, { useRef, useEffect } from 'react';
import { 
  Menu, 
  PenSquare, 
  Bookmark, 
  Mic, 
  ArrowUp, 
  ThumbsUp, 
  ThumbsDown,
  Home,
  BookOpen,
  MessageSquare,
  BookmarkIcon,
  Users,
  X
} from 'lucide-react';
import type { Conversation, ProviderId, ProviderResult, RelatedResource } from '../types';
import { PROVIDER_NAMES } from '../types';

interface AskGigiPreviewProps {
  conversation: Conversation | null;
  selectedProvider: ProviderId;
  isLoading: boolean;
  inputMessage: string;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onClose: () => void;
  feedback: Record<string, Record<ProviderId, 'up' | 'down' | null>>;
  onFeedback: (turnId: string, providerId: ProviderId, rating: 'up' | 'down' | null) => void;
}

// Community card component
function CommunityCard({ resource }: { resource: RelatedResource }) {
  const initials = resource.author
    ? resource.author.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'UC';
  
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500'];
  const colorIndex = resource.author ? resource.author.charCodeAt(0) % colors.length : 0;

  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex-shrink-0 w-44 bg-white rounded-xl p-3 shadow-sm border border-gray-100"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-full ${colors[colorIndex]} flex items-center justify-center text-white font-semibold text-xs`}>
          {initials}
        </div>
        <span className="font-semibold text-gray-900 text-sm truncate">
          {resource.author || 'Community'}
        </span>
      </div>
      <h4 className="font-medium text-gray-900 text-sm line-clamp-1 mb-1">
        {resource.title}
      </h4>
      <p className="text-xs text-gray-600 line-clamp-2">
        {resource.snippet}
      </p>
    </a>
  );
}

// Library card component
function LibraryCard({ resource }: { resource: RelatedResource }) {
  const gradients = [
    'from-blue-400 to-blue-600',
    'from-purple-400 to-purple-600',
    'from-green-400 to-green-600',
    'from-orange-400 to-orange-600',
    'from-pink-400 to-pink-600',
  ];
  const index = resource.title.length % gradients.length;

  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex-shrink-0 w-36 bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100"
    >
      {resource.imageUrl ? (
        <img src={resource.imageUrl} alt={resource.title} className="w-full h-20 object-cover" />
      ) : (
        <div className={`w-full h-20 bg-gradient-to-br ${gradients[index]} flex items-center justify-center`}>
          <BookOpen className="w-8 h-8 text-white/80" />
        </div>
      )}
      <div className="p-2">
        <h4 className="font-medium text-gray-900 text-xs line-clamp-2">
          {resource.title}
        </h4>
      </div>
    </a>
  );
}

// Single message with response
function MessageResponse({ 
  userMessage,
  result,
  turnId,
  providerId,
  feedback,
  onFeedback
}: { 
  userMessage: string;
  result?: ProviderResult;
  turnId: string;
  providerId: ProviderId;
  feedback: 'up' | 'down' | null;
  onFeedback: (rating: 'up' | 'down' | null) => void;
}) {
  const communityResources = result?.related_resources.filter(
    r => r.category === 'community' || r.author
  ) || [];
  const libraryResources = result?.related_resources.filter(
    r => r.category !== 'community' && !r.author
  ) || [];

  return (
    <div className="space-y-4">
      {/* Assistant Response */}
      {result && (
        <div className="space-y-4">
          <div className="text-gray-800 leading-relaxed">
            {result.answer_text.split('\n').map((p, i) => (
              <p key={i} className="mb-3 last:mb-0">{p}</p>
            ))}
          </div>

          {/* Connect in the community */}
          {communityResources.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 tracking-widest uppercase mb-3">
                Connect in the community
              </h4>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
                {communityResources.slice(0, 4).map((r, i) => (
                  <CommunityCard key={i} resource={r} />
                ))}
              </div>
            </div>
          )}

          {/* Explore the library */}
          {libraryResources.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 tracking-widest uppercase mb-3">
                Explore the library
              </h4>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
                {libraryResources.slice(0, 6).map((r, i) => (
                  <LibraryCard key={i} resource={r} />
                ))}
              </div>
            </div>
          )}

          {/* Show all resources if not categorized */}
          {communityResources.length === 0 && libraryResources.length === 0 && result.related_resources.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 tracking-widest uppercase mb-3">
                Explore the library
              </h4>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
                {result.related_resources.slice(0, 6).map((r, i) => (
                  <LibraryCard key={i} resource={r} />
                ))}
              </div>
            </div>
          )}

          {/* Feedback buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => onFeedback(feedback === 'up' ? null : 'up')}
              className={`p-2 rounded-full ${
                feedback === 'up' ? 'bg-gray-200' : 'hover:bg-gray-100'
              }`}
            >
              <ThumbsUp className={`w-5 h-5 ${feedback === 'up' ? 'text-gray-700' : 'text-gray-400'}`} />
            </button>
            <button
              onClick={() => onFeedback(feedback === 'down' ? null : 'down')}
              className={`p-2 rounded-full ${
                feedback === 'down' ? 'bg-gray-200' : 'hover:bg-gray-100'
              }`}
            >
              <ThumbsDown className={`w-5 h-5 ${feedback === 'down' ? 'text-gray-700' : 'text-gray-400'}`} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AskGigiPreview({
  conversation,
  selectedProvider,
  isLoading,
  inputMessage,
  onInputChange,
  onSendMessage,
  onClose,
  feedback,
  onFeedback,
}: AskGigiPreviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [conversation?.turns.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      {/* Phone Frame */}
      <div className="w-full max-w-md h-[700px] bg-gray-50 rounded-3xl overflow-hidden shadow-2xl flex flex-col relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 p-2 bg-white/80 rounded-full hover:bg-white transition-colors"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>

        {/* Provider indicator */}
        <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-white/80 rounded-full text-xs font-medium text-gray-600">
          {PROVIDER_NAMES[selectedProvider]}
        </div>

        {/* Header */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100">
          <button className="p-2 -ml-2">
            <Menu className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Ask GiGi</h1>
          <div className="flex items-center gap-1">
            <button className="p-2">
              <PenSquare className="w-5 h-5 text-gray-700" />
            </button>
            <button className="p-2 -mr-2">
              <Bookmark className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Chat Content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
          {conversation?.turns.map((turn) => (
            <MessageResponse
              key={turn.id}
              userMessage={turn.user_message}
              result={turn.results[selectedProvider]}
              turnId={turn.id}
              providerId={selectedProvider}
              feedback={feedback[turn.id]?.[selectedProvider] || null}
              onFeedback={(rating) => onFeedback(turn.id, selectedProvider, rating)}
            />
          ))}
          
          {isLoading && (
            <div className="flex items-center gap-2 text-gray-500">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
          )}

          {(!conversation || conversation.turns.length === 0) && !isLoading && (
            <div className="h-full flex items-center justify-center text-gray-400 text-center">
              <div>
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Ask a question to see how it looks in Ask GiGi</p>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-100 p-4">
          <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your question"
              className="flex-1 bg-transparent outline-none text-gray-800 placeholder-gray-500"
            />
            <button className="p-1 text-gray-500">
              <Mic className="w-5 h-5" />
            </button>
            <button 
              onClick={onSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="p-2 bg-gray-800 rounded-full disabled:opacity-50"
            >
              <ArrowUp className="w-4 h-4 text-white" />
            </button>
          </div>
          <p className="text-xs text-gray-500 text-center mt-2">
            AI can make mistakes and is not a crisis line. <span className="underline">Learn More</span>
          </p>
        </div>

        {/* Bottom Navigation */}
        <div className="bg-white border-t border-gray-100 px-6 py-2 flex justify-between">
          <button className="flex flex-col items-center gap-1 text-gray-400">
            <Home className="w-5 h-5" />
            <span className="text-xs">Home</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-400">
            <BookOpen className="w-5 h-5" />
            <span className="text-xs">Library</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-900">
            <MessageSquare className="w-5 h-5 fill-current" />
            <span className="text-xs font-medium">Ask GiGi</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-400">
            <BookmarkIcon className="w-5 h-5" />
            <span className="text-xs">Saved</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-400">
            <Users className="w-5 h-5" />
            <span className="text-xs">Community</span>
          </button>
        </div>
      </div>
    </div>
  );
}
