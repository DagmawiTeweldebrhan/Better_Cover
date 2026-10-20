// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { extractorFor } from './index';

describe('job board extraction', () => {
  const fixtures = [
    ['www.linkedin.com', '<h1 class="job-details-jobs-unified-top-card__job-title">Developer</h1><div class="job-details-jobs-unified-top-card__company-name">Acme</div><div class="jobs-description__content">Build useful applications</div>'],
    ['www.indeed.com', '<h1 class="jobsearch-JobInfoHeader-title">Developer</h1><div data-testid="inlineHeader-companyName">Acme</div><div id="jobDescriptionText">Build useful applications</div>'],
    ['boards.greenhouse.io', '<h1 class="app-title">Developer</h1><div class="company-name">Acme</div><div id="content">Build useful applications</div>'],
    ['jobs.lever.co', '<div class="posting-headline"><h2>Developer</h2><span class="company-name">Acme</span></div><div class="posting-description">Build useful applications</div>'],
    ['app.joinhandshake.com', '<h1 data-hook="job-title">Developer</h1><div data-hook="employer-name">Acme</div><div data-hook="job-description">Build useful applications</div>'],
  ];
  it.each(fixtures)('extracts fields from %s', (host, html) => {
    document.body.innerHTML = html;
    expect(extractorFor(host)!(document)).toMatchObject({ jobTitle: 'Developer', companyName: 'Acme', jobDescription: 'Build useful applications' });
  });
  it('uses JSON-LD when board selectors change', () => {
    document.body.innerHTML = '<script type="application/ld+json">' + JSON.stringify({ '@graph': [{ '@type': 'JobPosting', title: 'Engineer', hiringOrganization: { name: 'Example' }, description: '<p>Build APIs</p><p>Work together</p>' }] }) + '</script>';
    const job = extractorFor('jobs.lever.co')!(document);
    expect(job.jobTitle).toBe('Engineer'); expect(job.companyName).toBe('Example');
    expect(job.jobDescription).toContain('Build APIs'); expect(job.jobDescription).not.toContain('<p>');
  });
  it('rejects lookalike domains', () => { expect(extractorFor('linkedin.com.evil.example')).toBeUndefined(); });
  it('returns empty fields for missing data without scraping unrelated page text', () => {
    document.body.innerHTML = '<main>Unrelated private information</main>';
    expect(extractorFor('www.indeed.com')!(document).jobDescription).toBe('');
  });
});
