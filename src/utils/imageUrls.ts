import { Slide } from '../types/histology';

/**
 * Normalizes Wikimedia Commons thumb widths that CDN buckets reject (e.g. /480px- -> /500px-).
 */
export function normalizeSlideImageUrl(url?: string): string {
  if (!url) return '';
  if (url.includes('wikimedia.org') && url.includes('/480px-')) {
    return url.replace('/480px-', '/500px-');
  }
  return url;
}

export function getSlideThumbnailUrl(slide: Slide): string {
  return (
    normalizeSlideImageUrl(slide.thumbnailUrl) ||
    normalizeSlideImageUrl(slide.imageUrl) ||
    normalizeSlideImageUrl(slide.highResUrl) ||
    ''
  );
}

export function getSlideFullUrl(slide: Slide): string {
  return (
    normalizeSlideImageUrl(slide.highResUrl) ||
    normalizeSlideImageUrl(slide.imageUrl) ||
    getSlideThumbnailUrl(slide) ||
    ''
  );
}
