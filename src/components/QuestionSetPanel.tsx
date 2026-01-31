/**
 * =============================================================================
 * Question Set Panel Component
 * =============================================================================
 * Upload and run evaluation question sets
 * Supports JSON format with questions and optional follow-ups
 * =============================================================================
 */

import React, { useRef } from 'react';
import { 
  FileQuestion, 
  Upload, 
  Play, 
  Pause, 
  FileText, 
  Trash2,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Circle,
  Loader2
} from 'lucide-react';
import type { QuestionSet, QuestionItem } from '../types';

interface QuestionSetPanelProps {
  questionSet: QuestionSet | null;
  isRunning: boolean;
  currentQuestionIndex: number;
  onLoadQuestionSet: (questionSet: QuestionSet) => void;
  onClearQuestionSet: () => void;
  onRunQuestionSet: () => void;
  onStopQuestionSet: () => void;
}

function QuestionList({ 
  questions, 
  currentIndex, 
  isRunning 
}: { 
  questions: QuestionItem[]; 
  currentIndex: number;
  isRunning: boolean;
}) {
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {questions.map((q, idx) => {
        const isCompleted = idx < currentIndex;
        const isCurrent = idx === currentIndex && isRunning;
        const isPending = idx > currentIndex || (idx === currentIndex && !isRunning);

        return (
          <div 
            key={q.id} 
            className={`flex items-start gap-2 p-2 rounded-lg ${
              isCurrent ? 'bg-blue-50 border border-blue-200' : 
              isCompleted ? 'bg-green-50' : 
              'bg-gray-50'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {isCompleted ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : isCurrent ? (
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              ) : (
                <Circle className="w-4 h-4 text-gray-300" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${isCurrent ? 'text-blue-800 font-medium' : 'text-gray-700'}`}>
                {idx + 1}. {q.text}
              </p>
              {q.followups && q.followups.length > 0 && (
                <div className="mt-1 pl-3 border-l-2 border-gray-200">
                  {q.followups.map((followup, fIdx) => (
                    <p key={fIdx} className="text-xs text-gray-500">
                      ↳ {followup}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function QuestionSetPanel({
  questionSet,
  isRunning,
  currentQuestionIndex,
  onLoadQuestionSet,
  onClearQuestionSet,
  onRunQuestionSet,
  onStopQuestionSet
}: QuestionSetPanelProps) {
  const [isOpen, setIsOpen] = React.useState(true);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);

    try {
      const content = await file.text();
      const parsed = JSON.parse(content);

      // Validate structure
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error('JSON must have a "questions" array');
      }

      // Normalize questions
      const normalizedQuestions: QuestionItem[] = parsed.questions.map(
        (q: string | { id?: string; text: string; followups?: string[] }, idx: number) => {
          if (typeof q === 'string') {
            return { id: `q-${idx}`, text: q, followups: [] };
          }
          return {
            id: q.id || `q-${idx}`,
            text: q.text,
            followups: q.followups || [],
          };
        }
      );

      const qSet: QuestionSet = {
        name: parsed.name || file.name.replace('.json', ''),
        description: parsed.description,
        questions: normalizedQuestions,
      };

      onLoadQuestionSet(qSet);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON file';
      setParseError(message);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const totalQuestions = questionSet?.questions.reduce(
    (sum, q) => sum + 1 + (q.followups?.length || 0),
    0
  ) || 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <FileQuestion className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Question Set Evaluation</h2>
          {questionSet && (
            <span className={`text-sm px-3 py-1 rounded-full ${
              isRunning 
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700'
            }`}>
              {isRunning 
                ? `Running ${currentQuestionIndex + 1}/${questionSet.questions.length}`
                : `${totalQuestions} question(s)`
              }
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isOpen && (
        <div className="px-6 pb-6 space-y-4">
          <div className="pt-2 border-t border-gray-100">
            {/* File Upload */}
            {!questionSet && (
              <>
                <div className="mb-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="question-set-upload"
                  />
                  <label
                    htmlFor="question-set-upload"
                    className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    <Upload className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      Upload question set JSON file
                    </span>
                  </label>
                </div>

                {parseError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {parseError}
                  </div>
                )}

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Expected Format:</h4>
                  <pre className="text-xs text-gray-600 overflow-x-auto">
{`{
  "name": "My Question Set",
  "description": "Optional description",
  "questions": [
    "Simple question as string",
    {
      "id": "q1",
      "text": "Question with follow-ups",
      "followups": [
        "Follow-up question 1",
        "Follow-up question 2"
      ]
    }
  ]
}`}
                  </pre>
                </div>
              </>
            )}

            {/* Loaded Question Set */}
            {questionSet && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <span className="font-medium text-gray-800">{questionSet.name}</span>
                  </div>
                  <button
                    onClick={onClearQuestionSet}
                    disabled={isRunning}
                    className="text-sm text-gray-500 hover:text-red-600 disabled:opacity-50 flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear
                  </button>
                </div>

                {questionSet.description && (
                  <p className="text-sm text-gray-600 mb-4">{questionSet.description}</p>
                )}

                <QuestionList 
                  questions={questionSet.questions}
                  currentIndex={currentQuestionIndex}
                  isRunning={isRunning}
                />

                <div className="mt-4 flex gap-2">
                  {isRunning ? (
                    <button
                      onClick={onStopQuestionSet}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <Pause className="w-4 h-4" />
                      Stop
                    </button>
                  ) : (
                    <button
                      onClick={onRunQuestionSet}
                      disabled={currentQuestionIndex >= questionSet.questions.length}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      {currentQuestionIndex > 0 ? 'Resume' : 'Run All Questions'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
