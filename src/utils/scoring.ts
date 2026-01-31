/**
 * =============================================================================
 * Scoring Utilities
 * =============================================================================
 * Calculate metrics for provider responses
 * =============================================================================
 */

import type { 
  Turn, 
  ProviderId, 
  TurnScore, 
  ProviderScoreSummary, 
  UserContext,
  ProviderResult 
} from '../types';

/**
 * Check if a URL is valid and accessible
 */
export function isValidUrl(url: string): boolean {
  if (!url || url === '#' || url.trim() === '') return false;
  try {
    new URL(url);
    return true;
  } catch {
    // Allow local references
    return url.startsWith('#') || url.startsWith('/');
  }
}

/**
 * Detect if response references user context fields
 */
export function detectPersonalization(
  text: string,
  userContext: UserContext
): { score: number; fields: string[] } {
  const referencedFields: string[] = [];
  let matches = 0;
  let possibleMatches = 0;

  // Check each context field
  if (userContext.caregiver_name) {
    possibleMatches++;
    if (text.toLowerCase().includes(userContext.caregiver_name.toLowerCase())) {
      matches++;
      referencedFields.push('caregiver_name');
    }
  }

  if (userContext.loved_one_name) {
    possibleMatches++;
    if (text.toLowerCase().includes(userContext.loved_one_name.toLowerCase())) {
      matches++;
      referencedFields.push('loved_one_name');
    }
  }

  if (userContext.diagnosis) {
    possibleMatches++;
    if (text.toLowerCase().includes(userContext.diagnosis.toLowerCase())) {
      matches++;
      referencedFields.push('diagnosis');
    }
  }

  if (userContext.relationship) {
    possibleMatches++;
    if (text.toLowerCase().includes(userContext.relationship.toLowerCase())) {
      matches++;
      referencedFields.push('relationship');
    }
  }

  if (userContext.care_stage) {
    possibleMatches++;
    if (text.toLowerCase().includes(userContext.care_stage.toLowerCase())) {
      matches++;
      referencedFields.push('care_stage');
    }
  }

  return {
    score: possibleMatches > 0 ? matches / possibleMatches : 0,
    fields: referencedFields,
  };
}

/**
 * Detect if response references previous turns (continuity)
 */
export function detectContinuity(
  text: string,
  previousTurns: Turn[],
  providerId: ProviderId
): boolean {
  if (previousTurns.length === 0) return false;

  // Check for references to previous answers or topics
  const previousResponses = previousTurns
    .map(t => t.results[providerId]?.answer_text)
    .filter(Boolean);

  // Simple heuristic: check for continuity markers
  const continuityMarkers = [
    'as I mentioned',
    'as we discussed',
    'previously',
    'earlier',
    'building on',
    'continuing from',
    'as noted',
    'to follow up',
  ];

  const textLower = text.toLowerCase();
  return continuityMarkers.some(marker => textLower.includes(marker));
}

/**
 * Calculate score for a single turn's provider result
 */
export function calculateTurnScore(
  result: ProviderResult | undefined,
  userContext: UserContext,
  previousTurns: Turn[],
  providerId: ProviderId
): TurnScore {
  if (!result) {
    return {
      linkCount: 0,
      validUrls: 0,
      invalidUrls: 0,
      uniqueUrls: 0,
      duplicateUrls: 0,
      personalizationScore: 0,
      personalizationFields: [],
      hasNoLinksWarning: false,
      hasContinuityIndicator: false,
    };
  }

  const resources = result.related_resources || [];
  
  // URL analysis
  const urls = resources.map(r => r.url).filter(Boolean);
  const validUrls = urls.filter(isValidUrl);
  const uniqueUrls = [...new Set(validUrls)];

  // Personalization analysis
  const personalization = detectPersonalization(result.answer_text, userContext);

  // Continuity analysis
  const hasContinuity = detectContinuity(result.answer_text, previousTurns, providerId);

  return {
    linkCount: resources.length,
    validUrls: validUrls.length,
    invalidUrls: urls.length - validUrls.length,
    uniqueUrls: uniqueUrls.length,
    duplicateUrls: validUrls.length - uniqueUrls.length,
    personalizationScore: personalization.score,
    personalizationFields: personalization.fields,
    hasNoLinksWarning: result.answer_text.length > 0 && resources.length === 0,
    hasContinuityIndicator: hasContinuity,
  };
}

/**
 * Calculate summary scores for a provider across all turns
 */
export function calculateProviderSummary(
  turns: Turn[],
  providerId: ProviderId,
  userContext: UserContext
): ProviderScoreSummary {
  if (turns.length === 0) {
    return {
      totalTurns: 0,
      avgLinkCount: 0,
      avgValidUrlRate: 0,
      avgPersonalizationScore: 0,
      noLinksWarnings: 0,
      continuityIndicators: 0,
      avgLatencyMs: 0,
      errorCount: 0,
    };
  }

  let totalLinks = 0;
  let totalValidUrls = 0;
  let totalUrls = 0;
  let totalPersonalization = 0;
  let noLinksWarnings = 0;
  let continuityIndicators = 0;
  let totalLatency = 0;
  let latencyCount = 0;
  let errorCount = 0;
  let validTurns = 0;

  turns.forEach((turn, idx) => {
    const result = turn.results[providerId];
    
    if (result?.error) {
      errorCount++;
      return;
    }

    if (!result) return;

    validTurns++;
    const previousTurns = turns.slice(0, idx);
    const score = calculateTurnScore(result, userContext, previousTurns, providerId);

    totalLinks += score.linkCount;
    totalValidUrls += score.validUrls;
    totalUrls += score.validUrls + score.invalidUrls;
    totalPersonalization += score.personalizationScore;
    
    if (score.hasNoLinksWarning) noLinksWarnings++;
    if (score.hasContinuityIndicator) continuityIndicators++;

    if (result.latency_ms) {
      totalLatency += result.latency_ms;
      latencyCount++;
    }
  });

  return {
    totalTurns: turns.length,
    avgLinkCount: validTurns > 0 ? totalLinks / validTurns : 0,
    avgValidUrlRate: totalUrls > 0 ? totalValidUrls / totalUrls : 0,
    avgPersonalizationScore: validTurns > 0 ? totalPersonalization / validTurns : 0,
    noLinksWarnings,
    continuityIndicators,
    avgLatencyMs: latencyCount > 0 ? totalLatency / latencyCount : 0,
    errorCount,
  };
}
