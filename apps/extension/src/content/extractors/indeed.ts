import { extract, type Extractor } from './common';
export const indeed: Extractor = doc => extract(doc, 'Indeed', {
  title: ['[data-testid="jobsearch-JobInfoHeader-title"]', '.jobsearch-JobInfoHeader-title'],
  company: ['[data-testid="inlineHeader-companyName"]', '[data-company-name="true"]', '.jobsearch-InlineCompanyRating-companyHeader'],
  description: ['#jobDescriptionText', '[data-testid="jobDescriptionText"]'],
});
