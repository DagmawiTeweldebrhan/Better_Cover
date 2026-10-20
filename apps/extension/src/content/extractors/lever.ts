import { extract, type Extractor } from './common';
export const lever: Extractor = doc => {
  const job = extract(doc, 'Lever', {
    title: ['.posting-headline h2', 'h1'], company: ['.posting-headline .company-name', '[data-company]'],
    description: ['.section-wrapper.page-full-width', '.posting-description'],
  });
  const sections = Array.from(doc.querySelectorAll('.posting-page .section-wrapper, .posting-page .posting-requirements'));
  if (sections.length) job.jobDescription = sections.map(s => s.textContent?.trim() ?? '').filter(Boolean).join('\n\n').slice(0, 40000);
  if (!job.companyName) {
    const logo = doc.querySelector<HTMLImageElement>('.main-header-logo img');
    job.companyName = logo?.alt?.replace(/\s+logo$/i, '').trim().slice(0, 200) || '';
  }
  return job;
};
