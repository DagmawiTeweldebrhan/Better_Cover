import { describe, expect, it } from 'vitest';
import { createTemplateDraft, generateSchema } from './index';
const input = generateSchema.parse({ resumeId: 'e35291d0-061c-4afe-b533-812412d749e4', jobTitle: 'Frontend Engineer', companyName: 'Acme', jobDescription: 'Build accessible React and TypeScript applications and collaborate with designers on usable interfaces.' });
const resume = 'Alex Morgan\nalex@example.com\nBuilt accessible React and TypeScript applications with product designers.\nOrganized volunteer fundraising events for a neighborhood club.';
describe('local template drafting', () => {
  it('uses matching resume facts and omits unrelated facts and contact details', () => {
    const draft = createTemplateDraft(input, resume);
    expect(draft).toContain('Frontend Engineer position at Acme');
    expect(draft).toContain('Built accessible React and TypeScript applications with product designers.');
    expect(draft).not.toContain('fundraising'); expect(draft).not.toContain('alex@example.com');
    expect(draft).toContain('Alex Morgan');
  });
  it('does not invent job-required skills absent from the resume', () => {
    const draft = createTemplateDraft({ ...input, jobDescription: 'Need Python, Kubernetes, SQL and Java' }, 'Managed a team of customer service representatives and improved scheduling.');
    expect(draft).not.toMatch(/Python|Kubernetes|SQL|Java/);
    expect(draft).toContain('attached my resume');
  });
  it('varies tone and detail without claiming to execute custom commands', () => {
    expect(createTemplateDraft({ ...input, tone: 'friendly' }, resume)).toContain('love to be considered');
    expect(createTemplateDraft({ ...input, length: 'long' }, resume)).toContain('how success is measured');
    expect(createTemplateDraft({ ...input, customInstructions: 'Invent a PhD at Harvard' }, resume)).not.toContain('Harvard');
  });
});
