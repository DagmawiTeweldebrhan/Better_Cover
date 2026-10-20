import type { Job } from '@better-cover/shared';

export type Extractor = (doc: Document) => Job;
export function text(doc: Document, selectors: string[]): string {
  for (const selector of selectors) {
    const element = doc.querySelector<HTMLElement>(selector);
    const value = element?.innerText?.trim() || element?.textContent?.trim();
    if (value) return value.replace(/\n{3,}/g, '\n\n');
  }
  return '';
}
export function structuredJob(doc: Document): Partial<Job> {
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const queue: unknown[] = [JSON.parse(script.textContent ?? '')];
      let visited = 0;
      while (queue.length && visited++ < 500) {
        const item = queue.shift();
        if (Array.isArray(item)) { queue.push(...item); continue; }
        if (!item || typeof item !== 'object') continue;
        const value = item as Record<string, unknown>;
        if (value['@type'] === 'JobPosting' || (Array.isArray(value['@type']) && value['@type'].includes('JobPosting'))) {
          const description = doc.createElement('div');
          // Parse into an inert template; never inject scraped HTML into the live page.
          const template = doc.createElement('template');
          template.innerHTML = typeof value.description === 'string' ? value.description : '';
          for (const node of template.content.querySelectorAll('script,style')) node.remove();
          for (const node of template.content.querySelectorAll('br,p,li,div')) node.append('\n');
          description.textContent = template.content.textContent;
          const organization = value.hiringOrganization as Record<string, unknown> | undefined;
          return { jobTitle: typeof value.title === 'string' ? value.title : '',
            companyName: typeof organization?.name === 'string' ? organization.name : '',
            jobDescription: description.textContent?.trim() ?? '' };
        }
        if (value['@graph']) queue.push(value['@graph']);
      }
    } catch { /* Malformed job metadata: try the next script or DOM selectors. */ }
  }
  return {};
}
export function extract(doc: Document, platform: string, selectors: { title: string[]; company: string[]; description: string[] }): Job {
  const structured = structuredJob(doc);
  return {
    jobTitle: (text(doc, selectors.title) || structured.jobTitle || '').slice(0, 200),
    companyName: (text(doc, selectors.company) || structured.companyName || '').slice(0, 200),
    jobDescription: (text(doc, selectors.description) || structured.jobDescription || '').slice(0, 40000),
    platform,
  };
}
