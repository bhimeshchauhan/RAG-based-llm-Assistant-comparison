/**
 * =============================================================================
 * Scoreboard Panel Component
 * =============================================================================
 * Summary scoreboard showing per-provider metrics after running questions
 * =============================================================================
 */

import React from 'react';
import { 
  BarChart3, 
  Link2, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  User,
  MessageSquare,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import type { Turn, ProviderId, UserContext, ProviderScoreSummary } from '../types';
import { PROVIDER_NAMES } from '../types';
import { calculateProviderSummary } from '../utils/scoring';

interface ScoreboardPanelProps {
  turns: Turn[];
  configuredProviders: ProviderId[];
  userContext: UserContext;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  subtext?: string;
  highlight?: 'good' | 'warning' | 'bad' | 'neutral';
}

function MetricCard({ label, value, icon, subtext, highlight = 'neutral' }: MetricCardProps) {
  const highlightColors = {
    good: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    bad: 'bg-red-50 border-red-200',
    neutral: 'bg-gray-50 border-gray-200',
  };

  return (
    <div className={`p-3 rounded-lg border ${highlightColors[highlight]}`}>
      <div className="flex items-center gap-2 text-gray-600 mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-lg font-semibold text-gray-900">{value}</div>
      {subtext && <div className="text-xs text-gray-500 mt-0.5">{subtext}</div>}
    </div>
  );
}

function ProviderScoreCard({ 
  providerId, 
  summary 
}: { 
  providerId: ProviderId; 
  summary: ProviderScoreSummary;
}) {
  const providerColors: Record<ProviderId, string> = {
    customgpt: 'border-purple-300 bg-purple-50',
    botpress: 'border-blue-300 bg-blue-50',
    pinecone: 'border-emerald-300 bg-emerald-50',
  };

  return (
    <div className={`rounded-lg border-2 ${providerColors[providerId]} p-4`}>
      <h4 className="font-semibold text-gray-900 mb-3">{PROVIDER_NAMES[providerId]}</h4>
      
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="Avg Links"
          value={summary.avgLinkCount.toFixed(1)}
          icon={<Link2 className="w-3 h-3" />}
          highlight={summary.avgLinkCount > 2 ? 'good' : summary.avgLinkCount > 0 ? 'neutral' : 'warning'}
        />
        
        <MetricCard
          label="Valid URL Rate"
          value={`${(summary.avgValidUrlRate * 100).toFixed(0)}%`}
          icon={<CheckCircle className="w-3 h-3" />}
          highlight={summary.avgValidUrlRate > 0.8 ? 'good' : summary.avgValidUrlRate > 0.5 ? 'warning' : 'bad'}
        />
        
        <MetricCard
          label="Personalization"
          value={`${(summary.avgPersonalizationScore * 100).toFixed(0)}%`}
          icon={<User className="w-3 h-3" />}
          highlight={summary.avgPersonalizationScore > 0.5 ? 'good' : summary.avgPersonalizationScore > 0 ? 'neutral' : 'warning'}
        />
        
        <MetricCard
          label="Avg Latency"
          value={summary.avgLatencyMs > 0 ? `${Math.round(summary.avgLatencyMs)}ms` : 'N/A'}
          icon={<Clock className="w-3 h-3" />}
          highlight={summary.avgLatencyMs < 2000 ? 'good' : summary.avgLatencyMs < 5000 ? 'warning' : 'bad'}
        />
        
        <MetricCard
          label="Continuity"
          value={`${summary.continuityIndicators}/${summary.totalTurns}`}
          icon={<MessageSquare className="w-3 h-3" />}
          subtext="follow-up refs"
        />
        
        <MetricCard
          label="Issues"
          value={summary.noLinksWarnings + summary.errorCount}
          icon={<AlertCircle className="w-3 h-3" />}
          subtext={`${summary.noLinksWarnings} no-links, ${summary.errorCount} errors`}
          highlight={summary.noLinksWarnings + summary.errorCount === 0 ? 'good' : 'warning'}
        />
      </div>
    </div>
  );
}

export function ScoreboardPanel({ turns, configuredProviders, userContext }: ScoreboardPanelProps) {
  const [isOpen, setIsOpen] = React.useState(true);

  if (turns.length === 0) {
    return null;
  }

  // Calculate summaries for each provider
  const summaries = configuredProviders.reduce((acc, providerId) => {
    acc[providerId] = calculateProviderSummary(turns, providerId, userContext);
    return acc;
  }, {} as Record<ProviderId, ProviderScoreSummary>);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Comparison Scoreboard</h2>
          <span className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-700">
            {turns.length} turn(s) analyzed
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isOpen && (
        <div className="px-6 pb-6">
          <div className="pt-2 border-t border-gray-100">
            <div className={`grid gap-4 ${
              configuredProviders.length === 1 
                ? 'grid-cols-1' 
                : configuredProviders.length === 2 
                  ? 'grid-cols-1 md:grid-cols-2'
                  : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            }`}>
              {configuredProviders.map(providerId => (
                <ProviderScoreCard
                  key={providerId}
                  providerId={providerId}
                  summary={summaries[providerId]}
                />
              ))}
            </div>

            {/* Legend */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <h5 className="text-xs font-medium text-gray-700 mb-2">Metrics Explained:</h5>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-600">
                <div><strong>Avg Links:</strong> Related resources per response</div>
                <div><strong>Valid URL Rate:</strong> % of links that are valid URLs</div>
                <div><strong>Personalization:</strong> % of user context fields referenced</div>
                <div><strong>Avg Latency:</strong> Response time in milliseconds</div>
                <div><strong>Continuity:</strong> Responses referencing prior turns</div>
                <div><strong>Issues:</strong> Missing links + error count</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
