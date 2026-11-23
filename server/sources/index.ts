import { openverseSource } from './openverseSource.ts';
import type { SlideSourceConnector } from './types.ts';
import { universitySources } from './universitySources.ts';
import { wikimediaSource } from './wikimediaSource.ts';

export const ALL_SOURCES: SlideSourceConnector[] = [
  wikimediaSource,
  openverseSource,
  ...universitySources,
];

export const SOURCE_MAP = new Map<string, SlideSourceConnector>(
  ALL_SOURCES.map((connector) => [connector.descriptor.id, connector])
);
