import { extract, type Extractor } from './common';
export const handshake: Extractor = doc => extract(doc, 'Handshake', {
  title: ['[data-hook="job-title"]', '[data-testid="job-title"]', '[class*="job-title"]', 'main h1'],
  company: ['[data-hook="employer-name"]', '[data-testid="employer-name"]', '[class*="employer-name"]', '[class*="company-name"]'],
  description: ['[data-hook="job-description"]', '[data-testid="job-description"]', '[class*="job-description"]', '[class*="description-body"]'],
});
