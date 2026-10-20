import type { GenerateInput } from './index';

const skills: [string, RegExp][] = [
  ['React', /\breact\b/i], ['TypeScript', /\btypescript\b/i], ['JavaScript', /\bjavascript\b/i],
  ['Python', /\bpython\b/i], ['SQL', /\bsql\b/i], ['HTML', /\bhtml\b/i], ['CSS', /\bcss\b/i],
  ['Excel', /\bexcel\b/i], ['Figma', /\bfigma\b/i], ['accessibility', /\baccessib(?:le|ility)\b/i],
  ['data analysis', /\bdata analysis\b/i], ['project management', /\bproject management\b/i],
  ['customer service', /\bcustomer service\b/i], ['sales', /\bsales\b/i], ['Git', /\bgit\b/i],
  ['Java', /\bjava\b/i], ['C++', /\bc\+\+/i], ['leadership', /\bleadership\b/i],
  ['communication', /\bcommunication\b/i], ['research', /\bresearch\b/i], ['design', /\bdesign(?:er|ers)?\b/i],
];
const stopWords = new Set('about after also and are been being both build company could description experience from have into job more most must our position requirements role should skills some team that their these they this through using want were what when where which while will with work would years your'.split(' '));
const words = (text: string) => new Set((text.toLowerCase().match(/[a-z][a-z+#.-]{2,}/g) || []).filter(word => !stopWords.has(word)));

export function createTemplateDraft(input: GenerateInput, resume: string): string {
  const requirements = words(input.jobDescription);
  const lines = resume.split(/\r?\n/).map(line => line.replace(/^\s*[-*•#]+\s*/, '').trim()).filter(Boolean);
  const evidence = lines.flatMap(line => line.length > 400 ? line.split(/(?<=[.!?])\s+/) : [line])
    .filter(line => line.length >= 40 && !/@|https?:\/\/|www\./i.test(line) && !/^\+?[\d\s().-]{8,}$/.test(line))
    .map((line, index) => ({ line: line.slice(0, 500), index, score: [...words(line)].filter(word => requirements.has(word)).length }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const count = { short: 1, medium: 2, long: 3 }[input.length];
  const excerpts = [...new Set(evidence.map(item => item.line))].slice(0, count);
  const matchedSkills = skills.filter(([, pattern]) => pattern.test(resume) && pattern.test(input.jobDescription)).map(([skill]) => skill).slice(0, input.length === 'short' ? 4 : 7);
  const skillList = matchedSkills.length > 1 ? `${matchedSkills.slice(0, -1).join(', ')} and ${matchedSkills.at(-1)}` : matchedSkills[0];
  const opening = {
    professional: `I am applying for the ${input.jobTitle} position at ${input.companyName}. I would welcome the opportunity to discuss how my experience aligns with your requirements.`,
    friendly: `I would love to be considered for the ${input.jobTitle} role at ${input.companyName}. Thank you for taking the time to review my application.`,
    confident: `Please consider my application for the ${input.jobTitle} position at ${input.companyName}. I am ready to discuss the experience and skills described in my resume.`,
  }[input.tone];
  const paragraphs = ['Dear Hiring Manager,', opening];
  if (skillList) paragraphs.push(`My resume includes ${skillList}, which also appear in the job description. I would welcome a conversation about how I could apply these skills in this role.`);
  if (excerpts.length) paragraphs.push(`Relevant details from my resume include:\n${excerpts.map(line => `- ${line}`).join('\n')}`);
  else paragraphs.push('I have attached my resume for your review and would appreciate the opportunity to discuss the parts of my background most relevant to this role.');
  if (input.length === 'long') paragraphs.push(`I would also value learning more about your team's priorities for this position and how success is measured at ${input.companyName}.`);
  paragraphs.push('Thank you for considering my application. I look forward to the possibility of discussing this opportunity with you.', 'Sincerely,');
  const name = lines[0];
  if (name && /^[\p{L}][\p{L} .'-]{2,60}$/u.test(name) && name.split(/\s+/).length >= 2 && name.split(/\s+/).length <= 4 && !/resume|curriculum|engineer|developer|profile|summary/i.test(name)) paragraphs.push(name);
  return paragraphs.join('\n\n');
}
