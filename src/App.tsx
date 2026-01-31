/**
 * =============================================================================
 * RAG Chatbot Comparison Tool - Main Application
 * =============================================================================
 * A single-page React application for comparing three RAG chatbot approaches:
 * 1. CustomGPT (SaaS RAG chatbot)
 * 2. Botpress Cloud
 * 3. Pinecone-backed custom RAG
 * 
 * This tool is for LOCAL TESTING ONLY.
 * =============================================================================
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

import type {
  AppConfig,
  UserContext,
  IngestionRun,
  IngestionFile,
  Conversation,
  Turn,
  QuestionSet,
  ProviderId,
  ProviderAdapter,
  ProviderIngestionState,
} from './types';

import { loadAppConfig, getConfiguredProviders, loadUserContext } from './config/env';
import { createAdapters } from './adapters';
import { useLocalStorage } from './hooks/useLocalStorage';

import {
  SettingsPanel,
  UserContextPanel,
  IngestionPanel,
  ChatPanel,
  QuestionSetPanel,
  ScoreboardPanel,
} from './components';

// Load user context from environment variables (from onboarding)
// This allows personalization without manual entry
const ENV_USER_CONTEXT = loadUserContext();

// Default user context - merge env values with undefined defaults
const DEFAULT_USER_CONTEXT: UserContext = {
  caregiver_name: ENV_USER_CONTEXT.caregiver_name || undefined,
  loved_one_name: ENV_USER_CONTEXT.loved_one_name || undefined,
  diagnosis: ENV_USER_CONTEXT.diagnosis || undefined,
  relationship: ENV_USER_CONTEXT.relationship || undefined,
  care_stage: ENV_USER_CONTEXT.care_stage || undefined,
};

export default function App() {
  // =========================================================================
  // Configuration State
  // =========================================================================
  const [config] = useState<AppConfig>(() => loadAppConfig());
  const [adapters] = useState(() => createAdapters(config));
  const configuredProviders = getConfiguredProviders(config);

  // =========================================================================
  // Persisted State (localStorage)
  // =========================================================================
  const [userContext, setUserContext] = useLocalStorage<UserContext>(
    'rag-comparison-user-context',
    DEFAULT_USER_CONTEXT
  );

  // =========================================================================
  // Application State
  // =========================================================================
  const [currentIngestion, setCurrentIngestion] = useState<IngestionRun | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [questionSet, setQuestionSet] = useState<QuestionSet | null>(null);
  const [isRunningQuestionSet, setIsRunningQuestionSet] = useState(false);
  const [questionSetIndex, setQuestionSetIndex] = useState(0);
  const [feedback, setFeedback] = useState<Record<string, Record<ProviderId, 'up' | 'down' | null>>>({});
  
  // Refs for cancellation
  const stopQuestionSetRef = useRef(false);

  // =========================================================================
  // Ingestion Handlers
  // =========================================================================
  const handleStartIngestion = useCallback(async (files: IngestionFile[]) => {
    if (configuredProviders.length === 0) return;

    setIsIngesting(true);

    // Initialize ingestion run
    const run: IngestionRun = {
      id: uuidv4(),
      startedAt: new Date().toISOString(),
      files,
      providers: configuredProviders.reduce((acc, id) => {
        acc[id] = { status: 'queued' };
        return acc;
      }, {} as Record<ProviderId, ProviderIngestionState>),
    };

    setCurrentIngestion(run);

    // Ingest to each provider in parallel
    const ingestionPromises = configuredProviders.map(async (providerId) => {
      const adapter = adapters[providerId];
      
      try {
        const result = await adapter.ingest({
          files,
          onProgress: (status, progress) => {
            setCurrentIngestion(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                providers: {
                  ...prev.providers,
                  [providerId]: { status, progress },
                },
              };
            });
          },
        });

        setCurrentIngestion(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            providers: {
              ...prev.providers,
              [providerId]: result.success
                ? { status: 'ready', sourceId: result.sourceId }
                : { status: 'error', error: result.error },
            },
          };
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setCurrentIngestion(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            providers: {
              ...prev.providers,
              [providerId]: { status: 'error', error: message },
            },
          };
        });
      }
    });

    await Promise.all(ingestionPromises);

    setCurrentIngestion(prev => {
      if (!prev) return prev;
      return { ...prev, completedAt: new Date().toISOString() };
    });

    setIsIngesting(false);
  }, [configuredProviders, adapters]);

  const handleClearIngestion = useCallback(async () => {
    // Clear Pinecone namespace if configured
    if (adapters.pinecone.isConfigured) {
      await adapters.pinecone.clearKnowledge?.();
    }
    setCurrentIngestion(null);
  }, [adapters]);

  // =========================================================================
  // Chat Handlers
  // =========================================================================
  const sendMessageToProviders = useCallback(async (message: string) => {
    if (configuredProviders.length === 0) return;

    setIsChatLoading(true);

    // Create or extend conversation
    const turnId = uuidv4();
    const turn: Turn = {
      id: turnId,
      user_message: message,
      timestamp: new Date().toISOString(),
      results: {},
    };

    setConversation(prev => {
      if (!prev) {
        return {
          id: uuidv4(),
          startedAt: new Date().toISOString(),
          turns: [turn],
          providerSessionIds: {},
        };
      }
      return {
        ...prev,
        turns: [...prev.turns, turn],
      };
    });

    // Send to each provider in parallel
    const chatPromises = configuredProviders.map(async (providerId) => {
      const adapter = adapters[providerId];
      
      try {
        const result = await adapter.chat({
          message,
          userContext,
          sessionId: conversation?.providerSessionIds[providerId],
        });

        // Update turn with result
        setConversation(prev => {
          if (!prev) return prev;
          
          const updatedTurns = prev.turns.map(t => {
            if (t.id === turnId) {
              return {
                ...t,
                results: {
                  ...t.results,
                  [providerId]: result.success
                    ? result.result
                    : { answer_text: '', related_resources: [], error: result.error },
                },
              };
            }
            return t;
          });

          return {
            ...prev,
            turns: updatedTurns,
            providerSessionIds: result.sessionId
              ? { ...prev.providerSessionIds, [providerId]: result.sessionId }
              : prev.providerSessionIds,
          };
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setConversation(prev => {
          if (!prev) return prev;
          
          const updatedTurns = prev.turns.map(t => {
            if (t.id === turnId) {
              return {
                ...t,
                results: {
                  ...t.results,
                  [providerId]: { answer_text: '', related_resources: [], error: errorMessage },
                },
              };
            }
            return t;
          });

          return { ...prev, turns: updatedTurns };
        });
      }
    });

    await Promise.all(chatPromises);
    setIsChatLoading(false);
  }, [configuredProviders, adapters, userContext, conversation]);

  const handleClearConversation = useCallback(() => {
    setConversation(null);
    setQuestionSetIndex(0);
    setFeedback({});
  }, []);

  // =========================================================================
  // Feedback Handlers
  // =========================================================================
  const handleFeedback = useCallback((
    turnId: string,
    providerId: ProviderId,
    rating: 'up' | 'down' | null
  ) => {
    setFeedback(prev => ({
      ...prev,
      [turnId]: {
        ...prev[turnId],
        [providerId]: rating,
      },
    }));
  }, []);

  // =========================================================================
  // Question Set Handlers
  // =========================================================================
  const handleRunQuestionSet = useCallback(async () => {
    if (!questionSet || questionSetIndex >= questionSet.questions.length) return;

    setIsRunningQuestionSet(true);
    stopQuestionSetRef.current = false;

    // Run questions sequentially
    for (let i = questionSetIndex; i < questionSet.questions.length; i++) {
      if (stopQuestionSetRef.current) break;

      const question = questionSet.questions[i];
      setQuestionSetIndex(i);

      // Send main question
      await sendMessageToProviders(question.text);

      // Wait a bit between questions for UI to update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Send follow-ups if any
      if (question.followups && question.followups.length > 0) {
        for (const followup of question.followups) {
          if (stopQuestionSetRef.current) break;
          await sendMessageToProviders(followup);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    setQuestionSetIndex(questionSet.questions.length);
    setIsRunningQuestionSet(false);
  }, [questionSet, questionSetIndex, sendMessageToProviders]);

  const handleStopQuestionSet = useCallback(() => {
    stopQuestionSetRef.current = true;
    setIsRunningQuestionSet(false);
  }, []);

  const handleClearQuestionSet = useCallback(() => {
    setQuestionSet(null);
    setQuestionSetIndex(0);
  }, []);

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                RAG Chatbot Comparison Tool
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Compare CustomGPT, Botpress, and Pinecone RAG side-by-side
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                Local Testing Only
              </span>
              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                {configuredProviders.length}/3 providers
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Configuration Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SettingsPanel config={config} />
          <UserContextPanel 
            userContext={userContext} 
            onUpdate={setUserContext} 
          />
        </div>

        {/* Data Ingestion */}
        <IngestionPanel
          currentIngestion={currentIngestion}
          isIngesting={isIngesting}
          configuredProviders={configuredProviders}
          onStartIngestion={handleStartIngestion}
          onClearIngestion={handleClearIngestion}
        />

        {/* Question Set Evaluation */}
        <QuestionSetPanel
          questionSet={questionSet}
          isRunning={isRunningQuestionSet}
          currentQuestionIndex={questionSetIndex}
          onLoadQuestionSet={setQuestionSet}
          onClearQuestionSet={handleClearQuestionSet}
          onRunQuestionSet={handleRunQuestionSet}
          onStopQuestionSet={handleStopQuestionSet}
        />

        {/* Scoreboard (shown when there are turns) */}
        {conversation && conversation.turns.length > 0 && (
          <ScoreboardPanel
            turns={conversation.turns}
            configuredProviders={configuredProviders}
            userContext={userContext}
          />
        )}

        {/* Chat Interface */}
        <ChatPanel
          conversation={conversation}
          configuredProviders={configuredProviders}
          isLoading={isChatLoading}
          onSendMessage={sendMessageToProviders}
          onClearConversation={handleClearConversation}
          feedback={feedback}
          onFeedback={handleFeedback}
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-600">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">CustomGPT</h4>
              <p>✓ Native citations via sources endpoint</p>
              <p>✓ Conversation continuity</p>
              <p>✓ File ingestion support</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Botpress</h4>
              <p>✓ Knowledge base file upload</p>
              <p>✓ User variables for context</p>
              <p className="text-amber-600">⚠ No native citation support</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Pinecone RAG</h4>
              <p>✓ Full control over retrieval</p>
              <p>✓ Citations from vector metadata</p>
              <p>✓ Custom chunking strategy</p>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
            <p>
              This is an evaluation tool for local testing only. 
              API keys are exposed in browser requests - do not use in production.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
