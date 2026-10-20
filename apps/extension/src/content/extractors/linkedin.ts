import { extract, type Extractor } from './common';
export const linkedin: Extractor = doc => extract(doc, 'LinkedIn', {
  title: ['.job-details-jobs-unified-top-card__job-title', '.jobs-unified-top-card__job-title', '.top-card-layout__title'],
  company: ['.job-details-jobs-unified-top-card__company-name', '.jobs-unified-top-card__company-name', '.topcard__org-name-link'],
  description: ['.jobs-description__content', '.jobs-box__html-content', '.show-more-less-html__markup'],
});
