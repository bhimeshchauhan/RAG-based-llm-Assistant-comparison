/**
 * =============================================================================
 * Related Resources Component (Ask GiGi Style)
 * =============================================================================
 * Renders categorized resource sections below each response:
 * - "Connect in the community" - Community posts from other users
 * - "Explore the library" - Curated content cards with images
 * =============================================================================
 */

import React from 'react';
import { Users, BookOpen, AlertCircle } from 'lucide-react';
import type { RelatedResource } from '../types';

interface RelatedResourcesProps {
  resources: RelatedResource[];
  providerName: string;
  isCitationWorkaround?: boolean;
  compact?: boolean; // For comparison view
}

function isValidUrl(url: string): boolean {
  if (!url || url === '#') return false;
  try {
    new URL(url);
    return true;
  } catch {
    return url.startsWith('#') || url.startsWith('/');
  }
}

// Categorize resources based on available metadata
function categorizeResources(resources: RelatedResource[]): {
  community: RelatedResource[];
  library: RelatedResource[];
} {
  const community: RelatedResource[] = [];
  const library: RelatedResource[] = [];

  resources.forEach(resource => {
    if (resource.category === 'community' || resource.author) {
      community.push({ ...resource, category: 'community' });
    } else {
      library.push({ ...resource, category: 'library' });
    }
  });

  return { community, library };
}

// Community post card (like Margaret C, Maura Gilland in screenshot)
function CommunityCard({ resource }: { resource: RelatedResource }) {
  const hasValidUrl = isValidUrl(resource.url);
  const initials = resource.author
    ? resource.author.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'UC';
  
  // Generate a consistent color based on author name
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500'];
  const colorIndex = resource.author 
    ? resource.author.charCodeAt(0) % colors.length 
    : 0;

  const CardWrapper = hasValidUrl ? 'a' : 'div';
  const cardProps = hasValidUrl 
    ? { href: resource.url, target: '_blank', rel: 'noopener noreferrer' }
    : {};

  return (
    <CardWrapper
      {...cardProps}
      className="flex-shrink-0 w-64 bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-full ${colors[colorIndex]} flex items-center justify-center text-white font-semibold text-sm`}>
          {initials}
        </div>
        <span className="font-semibold text-gray-900 truncate">
          {resource.author || 'Community Member'}
        </span>
      </div>
      <h4 className="font-medium text-gray-900 text-sm mb-1 line-clamp-2">
        {resource.title}
      </h4>
      {resource.snippet && (
        <p className="text-sm text-gray-600 line-clamp-2">
          {resource.snippet}
        </p>
      )}
    </CardWrapper>
  );
}

// Library content card (like "Scripts for After You've Yelled" in screenshot)
function LibraryCard({ resource, compact }: { resource: RelatedResource; compact?: boolean }) {
  const hasValidUrl = isValidUrl(resource.url);
  
  // Placeholder images based on content type
  const getPlaceholderImage = (title: string): string => {
    // Return a placeholder gradient based on title
    const gradients = [
      'from-blue-400 to-blue-600',
      'from-purple-400 to-purple-600',
      'from-green-400 to-green-600',
      'from-orange-400 to-orange-600',
      'from-pink-400 to-pink-600',
    ];
    const index = title.length % gradients.length;
    return gradients[index];
  };

  const CardWrapper = hasValidUrl ? 'a' : 'div';
  const cardProps = hasValidUrl 
    ? { href: resource.url, target: '_blank', rel: 'noopener noreferrer' }
    : {};

  if (compact) {
    return (
      <CardWrapper
        {...cardProps}
        className="flex-shrink-0 w-48 bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      >
        {resource.imageUrl ? (
          <img 
            src={resource.imageUrl} 
            alt={resource.title}
            className="w-full h-20 object-cover"
          />
        ) : (
          <div className={`w-full h-20 bg-gradient-to-br ${getPlaceholderImage(resource.title)} flex items-center justify-center`}>
            <BookOpen className="w-8 h-8 text-white/80" />
          </div>
        )}
        <div className="p-2">
          <h4 className="font-medium text-gray-900 text-xs line-clamp-2">
            {resource.title}
          </h4>
        </div>
      </CardWrapper>
    );
  }

  return (
    <CardWrapper
      {...cardProps}
      className="flex-shrink-0 w-64 bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
    >
      {resource.imageUrl ? (
        <img 
          src={resource.imageUrl} 
          alt={resource.title}
          className="w-full h-32 object-cover"
        />
      ) : (
        <div className={`w-full h-32 bg-gradient-to-br ${getPlaceholderImage(resource.title)} flex items-center justify-center`}>
          <BookOpen className="w-12 h-12 text-white/80" />
        </div>
      )}
      <div className="p-3">
        <h4 className="font-semibold text-gray-900 text-sm line-clamp-2">
          {resource.title}
        </h4>
        {resource.snippet && (
          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
            {resource.snippet}
          </p>
        )}
      </div>
    </CardWrapper>
  );
}

export function RelatedResources({ 
  resources, 
  providerName, 
  isCitationWorkaround,
  compact = false 
}: RelatedResourcesProps) {
  if (resources.length === 0) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">
            No related resources available from {providerName}
          </span>
        </div>
      </div>
    );
  }

  const { community, library } = categorizeResources(resources);

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
      {isCitationWorkaround && (
        <div className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full inline-block">
          ⚠️ Citations extracted as workaround - not native support
        </div>
      )}

      {/* Connect in the community */}
      {community.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-gray-500" />
            <h4 className="text-sm font-semibold text-gray-700 tracking-wide uppercase">
              Connect in the community
            </h4>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {community.slice(0, 4).map((resource, index) => (
              <CommunityCard key={`community-${index}`} resource={resource} />
            ))}
          </div>
        </div>
      )}

      {/* Explore the library */}
      {library.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-gray-500" />
            <h4 className="text-sm font-semibold text-gray-700 tracking-wide uppercase">
              Explore the library
            </h4>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {library.slice(0, 6).map((resource, index) => (
              <LibraryCard 
                key={`library-${index}`} 
                resource={resource} 
                compact={compact}
              />
            ))}
          </div>
        </div>
      )}

      {/* Fallback: Show all as library if no categorization */}
      {community.length === 0 && library.length === 0 && resources.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-gray-500" />
            <h4 className="text-sm font-semibold text-gray-700 tracking-wide uppercase">
              Related Resources
            </h4>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {resources.slice(0, 6).map((resource, index) => (
              <LibraryCard 
                key={`resource-${index}`} 
                resource={resource}
                compact={compact}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
