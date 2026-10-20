import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateSchema } from '@better-cover/shared';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('openai', () => ({ default: class { responses = { create }; } }));
import { createWriter } from '../src/services/llm';

const input = generateSchema.parse({ resumeId: 'e35291d0-061c-4afe-b533-812412d749e4', jobTitle: 'Engineer', companyName: 'Acme', jobDescription: 'Build accessible interfaces and robust backend systems with a collaborative team.' });
beforeEach(() => { create.mockReset(); });
describe('OpenAI writing boundary', () => {
  it('uses the configured model and avoids storing resume responses', async () => {
    create.mockResolvedValue({ status: 'completed', output_text: '  Dear Hiring Manager  ' });
    const letter = await createWriter('server-only-test-key', 'gpt-4o')(input, 'My real experience');
    expect(letter).toBe('Dear Hiring Manager');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: 'gpt-4o', store: false, max_output_tokens: 1800 }));
  });
  it.each([
    { status: 'incomplete', output_text: 'A truncated partial letter' },
    { status: 'completed', output_text: '   ' },
    { status: 'failed', output_text: '' },
  ])('rejects incomplete, refused or empty output: %j', async result => {
    create.mockResolvedValue(result);
    await expect(createWriter('test-key', 'gpt-4o')(input, 'Resume')).rejects.toMatchObject({ status: 502 });
  });
  it('returns a safe provider error without leaking upstream details', async () => {
    create.mockRejectedValue(new Error('sensitive upstream request details'));
    await expect(createWriter('test-key', 'gpt-4o')(input, 'Resume')).rejects.toThrow('The writing service could not finish.');
  });
});
