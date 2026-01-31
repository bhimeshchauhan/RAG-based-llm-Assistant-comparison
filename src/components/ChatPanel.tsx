/**
 * =============================================================================
 * Chat Panel Component
 * =============================================================================
 * Main chat interface with 3-column side-by-side provider responses
 * =============================================================================
 */

import React, { useRef, useEffect } from 'react';
import { Send, MessageSquare, Loader2, Trash2, User } from 'lucide-react';
import type { Conversation, ProviderId } from '../types';
import { PROVIDER_NAMES } from '../types';
import { ChatTurn } from './ChatTurn';

interface ChatPanelProps {
  conversation: Conversation | null;
  configuredProviders: ProviderId[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onClearConversation: () => void;
  feedback: Record<string, Record<ProviderId, 'up' | 'down' | null>>;
  onFeedback: (turnId: string, providerId: ProviderId, rating: 'up' | 'down' | null) => void;
}

export function ChatPanel({ 
  conversation, 
  configuredProviders, 
  isLoading,
  onSendMessage,
  onClearConversation,
  feedback,
  onFeedback
}: ChatPanelProps) {
  const [inputMessage, setInputMessage] = React.useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new turns are added
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.turns.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() && !isLoading) {
      onSendMessage(inputMessage.trim());
      setInputMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (configuredProviders.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-700 mb-2">No Providers Configured</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          Configure at least one provider in your .env.local file to start chatting.
        </p>
      </div>
    );
  }

  // Provider colors for headers
  const providerColors: Record<ProviderId, string> = {
    customgpt: 'bg-purple-500',
    botpress: 'bg-blue-500',
    pinecone: 'bg-emerald-500',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Chat Comparison</h2>
          {conversation && (
            <span className="text-sm text-gray-500">
              {conversation.turns.length} turn(s)
            </span>
          )}
        </div>
        {conversation && conversation.turns.length > 0 && (
          <button
            onClick={onClearConversation}
            disabled={isLoading}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {/* Three Column Headers */}
      <div className="grid grid-cols-3 border-b border-gray-200">
        {configuredProviders.map(providerId => (
          <div 
            key={providerId}
            className={`px-4 py-3 text-center text-white font-semibold ${providerColors[providerId]}`}
          >
            {PROVIDER_NAMES[providerId]}
          </div>
        ))}
        {/* Fill empty columns if less than 3 providers */}
        {Array.from({ length: 3 - configuredProviders.length }).map((_, i) => (
          <div key={`empty-${i}`} className="px-4 py-3 bg-gray-200 text-gray-400 text-center">
            Not Configured
          </div>
        ))}
      </div>

      {/* Chat Content Area */}
      <div className="min-h-[500px] max-h-[600px] overflow-y-auto">
        {!conversation || conversation.turns.length === 0 ? (
          <div className="h-[500px] flex flex-col items-center justify-center text-gray-400">
            <MessageSquare className="w-16 h-16 mb-4 text-gray-200" />
            <p className="text-lg mb-2">Start a conversation</p>
            <p className="text-sm text-center max-w-md px-4">
              Type a question below and press Enter to see responses from all {configuredProviders.length} providers side-by-side
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {conversation.turns.map((turn, index) => (
              <div key={turn.id} className="p-4">
                {/* User Message */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 text-sm">You</span>
                      <span className="text-xs text-gray-400">
                        {new Date(turn.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-gray-800">{turn.user_message}</p>
                  </div>
                </div>

                {/* Three Column Responses */}
                <div className="grid grid-cols-3 gap-4">
                  {configuredProviders.map(providerId => {
                    const result = turn.results[providerId];
                    const isCurrentlyLoading = isLoading && index === conversation.turns.length - 1 && !result;
                    
                    return (
                      <ProviderResponseColumn
                        key={providerId}
                        providerId={providerId}
                        result={result}
                        isLoading={isCurrentlyLoading}
                        feedback={feedback[turn.id]?.[providerId] || null}
                        onFeedback={(rating) => onFeedback(turn.id, providerId, rating)}
                      />
                    );
                  })}
                  {/* Fill empty columns */}
                  {Array.from({ length: 3 - configuredProviders.length }).map((_, i) => (
                    <div key={`empty-col-${i}`} className="bg-gray-50 rounded-lg p-4 text-gray-400 text-center text-sm">
                      Provider not configured
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="flex-1">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question... (Enter to send, Shift+Enter for new line)"
              disabled={isLoading}
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 self-end font-medium"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Send to All
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// Provider Response Column Component
// =============================================================================

import { Bot, Clock, AlertCircle, ThumbsUp, ThumbsDown, BookOpen, Users } from 'lucide-react';
import type { ProviderResult, RelatedResource } from '../types';

interface ProviderResponseColumnProps {
  providerId: ProviderId;
  result?: ProviderResult;
  isLoading: boolean;
  feedback: 'up' | 'down' | null;
  onFeedback: (rating: 'up' | 'down' | null) => void;
}

function ProviderResponseColumn({ 
  providerId, 
  result, 
  isLoading, 
  feedback, 
  onFeedback 
}: ProviderResponseColumnProps) {
  const bgColors: Record<ProviderId, string> = {
    customgpt: 'bg-purple-50 border-purple-200',
    botpress: 'bg-blue-50 border-blue-200',
    pinecone: 'bg-emerald-50 border-emerald-200',
  };

  if (isLoading) {
    return (
      <div className={`rounded-lg border p-4 ${bgColors[providerId]}`}>
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Generating...</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className={`rounded-lg border p-4 ${bgColors[providerId]} text-gray-400 text-sm`}>
        Waiting for response...
      </div>
    );
  }

  if (result.error) {
    return (
      <div className={`rounded-lg border p-4 ${bgColors[providerId]}`}>
        <div className="flex items-start gap-2 text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="text-sm">{result.error}</span>
        </div>
      </div>
    );
  }

  // Categorize resources
  const communityResources = result.related_resources.filter(
    r => r.category === 'community' || r.author
  );
  const libraryResources = result.related_resources.filter(
    r => r.category !== 'community' && !r.author
  );

  return (
    <div className={`rounded-lg border p-4 ${bgColors[providerId]}`}>
      {/* Response Text */}
      <div className="text-gray-800 text-sm leading-relaxed mb-3">
        {result.answer_text.split('\n').map((p, i) => (
          <p key={i} className="mb-2 last:mb-0">{p}</p>
        ))}
      </div>

      {/* Latency */}
      {result.latency_ms && (
        <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
          <Clock className="w-3 h-3" />
          {result.latency_ms}ms
        </div>
      )}

      {/* Related Resources - Community */}
      {communityResources.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            <Users className="w-3 h-3" />
            Community
          </div>
          <div className="space-y-1">
            {communityResources.slice(0, 2).map((r, i) => (
              <ResourceCard key={i} resource={r} />
            ))}
          </div>
        </div>
      )}

      {/* Related Resources - Library */}
      {libraryResources.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            <BookOpen className="w-3 h-3" />
            Library
          </div>
          <div className="space-y-1">
            {libraryResources.slice(0, 3).map((r, i) => (
              <ResourceCard key={i} resource={r} />
            ))}
          </div>
        </div>
      )}

      {/* Show uncategorized resources */}
      {communityResources.length === 0 && libraryResources.length === 0 && result.related_resources.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            <BookOpen className="w-3 h-3" />
            Resources
          </div>
          <div className="space-y-1">
            {result.related_resources.slice(0, 3).map((r, i) => (
              <ResourceCard key={i} resource={r} />
            ))}
          </div>
        </div>
      )}

      {/* No resources warning */}
      {result.related_resources.length === 0 && (
        <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded mb-3">
          ⚠️ No related resources
        </div>
      )}

      {/* Feedback */}
      <div className="flex items-center gap-1 pt-2 border-t border-gray-200">
        <button
          onClick={() => onFeedback(feedback === 'up' ? null : 'up')}
          className={`p-1.5 rounded transition-colors ${
            feedback === 'up' ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:bg-gray-100'
          }`}
        >
          <ThumbsUp className="w-4 h-4" />
        </button>
        <button
          onClick={() => onFeedback(feedback === 'down' ? null : 'down')}
          className={`p-1.5 rounded transition-colors ${
            feedback === 'down' ? 'bg-red-100 text-red-600' : 'text-gray-400 hover:bg-gray-100'
          }`}
        >
          <ThumbsDown className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Resource Card Component
function ResourceCard({ resource }: { resource: RelatedResource }) {
  const isValidUrl = resource.url && resource.url !== '#';
  
  const content = (
    <div className="bg-white rounded px-2 py-1.5 border border-gray-200 hover:border-gray-300 transition-colors">
      <div className="text-xs font-medium text-gray-800 truncate">{resource.title}</div>
      {resource.snippet && (
        <div className="text-xs text-gray-500 truncate">{resource.snippet}</div>
      )}
    </div>
  );

  if (isValidUrl) {
    return (
      <a href={resource.url} target="_blank" rel="noopener noreferrer" className="block">
        {content}
      </a>
    );
  }

  return content;
}
