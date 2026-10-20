import { extractorFor } from './extractors';

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'EXTRACT_JOB') return;
  const extractor = extractorFor(location.hostname);
  respond(extractor ? { ok: true, data: extractor(document) } : { ok: false, error: 'This job board is not supported. Paste the job details manually.' });
});
