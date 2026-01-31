/**
 * =============================================================================
 * Chat Turn Component
 * =============================================================================
 * Renders a single turn in the conversation with side-by-side provider responses
 * Includes thumbs up/down feedback buttons
 * =============================================================================
 */

import React from 'react';
import { User, Bot, Loader2, AlertCircle, Clock, ThumbsUp, ThumbsDown } from 'lucide-react';
import type { Turn, ProviderId, ProviderResult } from '../types';
import { PROVIDER_NAMES } from '../types';
import { RelatedResources } from './RelatedResources';

interface ChatTurnProps {
  turn: Turn;
  configuredProviders: ProviderId[];
  isLoading?: boolean;
  feedback?: Record<ProviderId, 'up' | 'down' | null>;
  onFeedback?: (providerId: ProviderId, rating: 'up' | 'down' | null) => void;
  compact?: boolean;
}

interface ProviderResponseProps {
  providerId: ProviderId;
  result?: ProviderResult;
  isLoading?: boolean;
  feedback?: 'up' | 'down' | null;
  onFeedback?: (rating: 'up' | 'down' | null) => void;
  compact?: boolean;
}

function FeedbackButtons({ 
  feedback, 
  onFeedback 
}: { 
  feedback?: 'up' | 'down' | null;
  onFeedback?: (rating: 'up' | 'down' | null) => void;
}) {
  if (!onFeedback) return null;

  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
      <button
        onClick={() => onFeedback(feedback === 'up' ? null : 'up')}
        className={`p-2 rounded-full transition-colors ${
          feedback === 'up'
            ? 'bg-green-100 text-green-600'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
        }`}
        title="Helpful response"
      >
        <ThumbsUp className="w-4 h-4" />
      </button>
      <button
        onClick={() => onFeedback(feedback === 'down' ? null : 'down')}
        className={`p-2 rounded-full transition-colors ${
          feedback === 'down'
            ? 'bg-red-100 text-red-600'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
        }`}
        title="Not helpful"
      >
        <ThumbsDown className="w-4 h-4" />
      </button>
    </div>
  );
}

function ProviderResponse({ 
  providerId, 
  result, 
  isLoading,
  feedback,
  onFeedback,
  compact = false
}: ProviderResponseProps) {
  const providerColors: Record<ProviderId, { bg: string; border: string; header: string }> = {
    customgpt: { bg: 'bg-purple-50', border: 'border-purple-200', header: 'bg-purple-100' },
    botpress: { bg: 'bg-blue-50', border: 'border-blue-200', header: 'bg-blue-100' },
    pinecone: { bg: 'bg-emerald-50', border: 'border-emerald-200', header: 'bg-emerald-100' },
  };

  const colors = providerColors[providerId];
  const isBotpressWorkaround = providerId === 'botpress' && 
    result?.raw?.note?.includes('limitation');

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden`}>
      {/* Provider Header */}
      <div className={`px-4 py-2 ${colors.header} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4" />
          <span className="text-sm font-semibold">{PROVIDER_NAMES[providerId]}</span>
        </div>
        {result?.latency_ms && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {result.latency_ms}ms
          </span>
        )}
      </div>

      {/* Response Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Generating response...</span>
          </div>
        ) : result?.error ? (
          <div className="flex items-start gap-2 text-red-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{result.error}</span>
          </div>
        ) : result ? (
          <>
            <div className="prose prose-sm max-w-none text-gray-800">
              {result.answer_text.split('\n').map((paragraph, idx) => (
                <p key={idx} className="mb-2 last:mb-0 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
            <RelatedResources 
              resources={result.related_resources} 
              providerName={PROVIDER_NAMES[providerId]}
              isCitationWorkaround={isBotpressWorkaround}
              compact={compact}
            />
            <FeedbackButtons 
              feedback={feedback} 
              onFeedback={onFeedback}
            />
          </>
        ) : (
          <span className="text-sm text-gray-400">No response yet</span>
        )}
      </div>
    </div>
  );
}

export function ChatTurn({ 
  turn, 
  configuredProviders, 
  isLoading,
  feedback = {},
  onFeedback,
  compact = false
}: ChatTurnProps) {
  return (
    <div className="space-y-4">
      {/* User Message - Full Width */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
          <User className="w-5 h-5 text-gray-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900">You</span>
            <span className="text-xs text-gray-500">
              {new Date(turn.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-800 shadow-sm">
            {turn.user_message}
          </div>
        </div>
      </div>

      {/* Provider Responses - Side by Side */}
      <div className="ml-13 pl-13">
        <div className={`grid gap-4 ${
          configuredProviders.length === 1 
            ? 'grid-cols-1 max-w-2xl' 
            : configuredProviders.length === 2 
              ? 'grid-cols-1 lg:grid-cols-2'
              : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
        }`}>
          {configuredProviders.map(providerId => (
            <ProviderResponse
              key={providerId}
              providerId={providerId}
              result={turn.results[providerId]}
              isLoading={isLoading && !turn.results[providerId]}
              feedback={feedback[providerId]}
              onFeedback={onFeedback ? (rating) => onFeedback(providerId, rating) : undefined}
              compact={compact}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
