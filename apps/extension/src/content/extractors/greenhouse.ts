import { extract, type Extractor } from './common';
export const greenhouse: Extractor = doc => extract(doc, 'Greenhouse', {
  title: ['.app-title', '.job__title', 'h1'], company: ['.company-name', '.job__company', '[data-testid="company-name"]'],
  description: ['#content', '.job__description', '[data-testid="job-description"]'],
});
