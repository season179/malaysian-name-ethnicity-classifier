import { ClassificationResultSchema, EthnicityEnumSchema } from './schemas';

/**
 * ClassificationResult interface for rule-based classifier output
 */
export type ClassificationResult = {
  predictedEthnicity: typeof EthnicityEnumSchema._type;
  confidence: number; // 0 to 1
  method: string;
  reasoning: string;
  llmModelUsed?: string;
  error?: string;
};

/**
 * Sanitizes a full name for rule-based processing
 * - Trims whitespace
 * - Converts to lowercase
 * - Replaces multiple spaces with a single space
 * - Removes most special characters (except hyphens and apostrophes)
 */
export function sanitizeName(fullName: string): string {
  return fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s\-']/g, '') // remove special chars except - and '
    .replace(/\s+/g, ' ');
}

/**
 * Rule-based classifier skeleton
 * @param fullName Full name to classify
 * @returns ClassificationResult or null if no high-confidence match
 */
/**
 * Detects if a name is likely Malay based on patronymics and prefixes
 */
function detectMalay(sanitized: string): { match: boolean; confidence: number; reasoning: string } {
  const malayPrefixes = [
    'tengku', 'nik', 'raja', 'wan', 'syed', 'puteri', 'megat', 'che', "che'"
  ];
  if (/\b(bin|binti|binte)\b/.test(sanitized)) {
    return {
      match: true,
      confidence: 0.98,
      reasoning: "Contains Malay patronymic 'bin', 'binti', or 'binte'"
    };
  }
  for (const prefix of malayPrefixes) {
    if (sanitized.startsWith(prefix + ' ')) {
      return {
        match: true,
        confidence: 0.95,
        reasoning: `Name starts with common Malay prefix '${prefix}'`
      };
    }
  }
  return { match: false, confidence: 0, reasoning: '' };
}

/**
 * Detects if a name is likely Indian based on patronymics and common names
 */
function detectIndian(sanitized: string): { match: boolean; confidence: number; reasoning: string } {
  if (/\b(a\/l|a\/p)\b/.test(sanitized)) {
    return {
      match: true,
      confidence: 0.98,
      reasoning: "Contains Indian patronymic 'a/l' or 'a/p'"
    };
  }
  const indianNames = [
    'muthu', 'arumugam', 'maniam', 'krishnan', 'sundram', 'raj', 'velu', 'selvam', 'gopal', 'kumar', 'prasad'
  ];
  for (const name of indianNames) {
    if (sanitized.includes(name)) {
      return {
        match: true,
        confidence: 0.85,
        reasoning: `Contains common Indian name '${name}'`
      };
    }
  }
  return { match: false, confidence: 0, reasoning: '' };
}

/**
 * Detects if a name is likely Chinese based on surname and structure
 */
function detectChinese(sanitized: string): { match: boolean; confidence: number; reasoning: string } {
  // List of common Chinese surnames in Malaysia
  const chineseSurnames = [
    'tan', 'lim', 'lee', 'wong', 'ng', 'chan', 'chong', 'chin', 'chew', 'koh', 'go', 'cheah', 'cheong', 'teh', 'teo', 'ong', 'loh', 'ling', 'foo', 'goh', 'yeoh', 'chai', 'chai', 'chia', 'choo', 'chua', 'heng', 'ho', 'koh', 'kwan', 'lai', 'lam', 'lau', 'liew', 'ling', 'loh', 'low', 'lu', 'mah', 'mak', 'ng', 'oh', 'ong', 'peh', 'phang', 'poon', 'quah', 'seah', 'see', 'seow', 'sim', 'soh', 'soo', 'sung', 'tan', 'tang', 'tay', 'tee', 'teh', 'teo', 'tham', 'tiew', 'toh', 'wan', 'wee', 'wong', 'woo', 'wye', 'yeap', 'yeo', 'yeoh', 'yew', 'yong', 'yow'
  ];
  // Chinese names often: Surname (1st word) + 1-2 given names
  const parts = sanitized.split(' ');
  if (parts.length >= 2 && typeof parts[0] === 'string' && chineseSurnames.includes(parts[0])) {
    return {
      match: true,
      confidence: 0.9,
      reasoning: `First word '${parts[0]}' is a common Chinese surname`
    };
  }
  return { match: false, confidence: 0, reasoning: '' };
}

/**
 * Rule-based classifier for Malaysian names
 * @param fullName Full name to classify
 * @returns ClassificationResult or null if no high-confidence match
 */
export function classifyByNameRules(fullName: string): ClassificationResult | null {
  const sanitized = sanitizeName(fullName);

  // Malay rules
  const malay = detectMalay(sanitized);
  if (malay.match && malay.confidence >= 0.9) {
    return {
      predictedEthnicity: 'Malay',
      confidence: malay.confidence,
      method: 'rule-based',
      reasoning: malay.reasoning,
      llmModelUsed: '',
    };
  }

  // Indian rules
  const indian = detectIndian(sanitized);
  if (indian.match && indian.confidence >= 0.85) {
    return {
      predictedEthnicity: 'Indian',
      confidence: indian.confidence,
      method: 'rule-based',
      reasoning: indian.reasoning,
      llmModelUsed: '',
    };
  }

  // Chinese rules
  const chinese = detectChinese(sanitized);
  if (chinese.match && chinese.confidence >= 0.85) {
    return {
      predictedEthnicity: 'Chinese',
      confidence: chinese.confidence,
      method: 'rule-based',
      reasoning: chinese.reasoning,
      llmModelUsed: '',
    };
  }

  // No high-confidence match
  return null;
}

