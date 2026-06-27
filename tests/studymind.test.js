/**
 * StudyMind Unit Tests
 * Covers: storage utilities, date helpers, markdown formatter, JSON parsing
 * Run via: open tests/index.html in a browser
 */

// ─── Minimal test harness ───────────────────────────────────────────────────
const results = [];

function describe(suiteName, fn) {
  results.push({ type: 'suite', name: suiteName });
  fn();
}

function it(testName, fn) {
  try {
    fn();
    results.push({ type: 'pass', name: testName });
  } catch (err) {
    results.push({ type: 'fail', name: testName, error: err.message });
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected) {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b) {
        throw new Error(`Expected ${b}, got ${a}`);
      }
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${actual}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${actual}`);
    },
    toContain(item) {
      if (!actual.includes(item)) {
        throw new Error(`Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(item)}`);
      }
    },
    toBeGreaterThan(n) {
      if (!(actual > n)) throw new Error(`Expected ${actual} > ${n}`);
    },
    toBeGreaterThanOrEqual(n) {
      if (!(actual >= n)) throw new Error(`Expected ${actual} >= ${n}`);
    }
  };
}

// ─── Utility functions under test (copied from bundle.js for isolation) ──────

/**
 * Format a date string "YYYY-MM-DD" to short display like "27 Jun"
 * @param {string} dateStr
 * @returns {string}
 */
function formatDateShort(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d)} ${months[parseInt(m)-1]}`;
}

/**
 * Format a Date object to ISO "YYYY-MM-DD"
 * @param {Date} d
 * @returns {string}
 */
function formatDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const r = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${r}`;
}

/**
 * Convert basic markdown to HTML with XSS sanitization
 * @param {string} text
 * @returns {string}
 */
function formatMarkdown(text) {
  if (!text) return '';
  // Sanitize HTML entities first to prevent XSS
  const sanitized = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  return sanitized
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*?)$/gm, '• $1')
    .replace(/\n/g, '<br>');
}

/**
 * Extract complete JSON objects from a potentially partial stream buffer
 * @param {string} str
 * @returns {string[]}
 */
function splitJsonObjects(str) {
  const results = [];
  let braceCount = 0;
  let startIdx = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escape) { escape = false; continue; }
    if (char === '\\') { escape = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (!inString) {
      if (char === '{') {
        if (braceCount === 0) startIdx = i;
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && startIdx !== -1) {
          results.push(str.substring(startIdx, i + 1));
          startIdx = -1;
        }
      }
    }
  }
  return results;
}

/**
 * Calculate current logging streak from an array of log objects
 * @param {Array<{date: string}>} logs
 * @param {Date} today - injectable for testability
 * @returns {number}
 */
function calculateStreakFromLogs(logs, today = new Date()) {
  if (logs.length === 0) return 0;

  const logDates = new Set(logs.map(log => log.date));

  const formatDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const r = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${r}`;
  };

  let streak = 0;
  let checkDate = new Date(today);

  if (!logDates.has(formatDate(checkDate))) {
    checkDate.setDate(checkDate.getDate() - 1);
    if (!logDates.has(formatDate(checkDate))) return 0;
  }

  while (logDates.has(formatDate(checkDate))) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }
  return streak;
}

/**
 * Sanitize user text content to prevent XSS
 * @param {string} str
 * @returns {string}
 */
function sanitizeText(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate a log entry has required fields in correct format
 * @param {object} log
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateLogEntry(log) {
  const errors = [];
  if (!log || typeof log !== 'object') return { valid: false, errors: ['Log must be an object'] };
  if (!log.date || !/^\d{4}-\d{2}-\d{2}$/.test(log.date)) errors.push('Invalid date format');
  if (typeof log.mood !== 'number' || log.mood < 1 || log.mood > 10) errors.push('Mood must be 1-10');
  if (!['Drained','Low','Okay','High','Charged'].includes(log.energy)) errors.push('Invalid energy value');
  if (!["Couldn't focus",'Scattered','Moderate','Sharp','In the zone'].includes(log.focus)) errors.push('Invalid focus value');
  return { valid: errors.length === 0, errors };
}

// ─── Test Suites ─────────────────────────────────────────────────────────────

describe('formatDateShort()', () => {
  it('formats a date string correctly', () => {
    expect(formatDateShort('2026-06-27')).toBe('27 Jun');
  });

  it('handles January correctly', () => {
    expect(formatDateShort('2026-01-01')).toBe('1 Jan');
  });

  it('handles December correctly', () => {
    expect(formatDateShort('2026-12-31')).toBe('31 Dec');
  });

  it('strips leading zero from day', () => {
    expect(formatDateShort('2026-06-05')).toBe('5 Jun');
  });
});

describe('formatDateISO()', () => {
  it('formats a Date to YYYY-MM-DD', () => {
    const d = new Date(2026, 5, 27); // June 27, 2026
    expect(formatDateISO(d)).toBe('2026-06-27');
  });

  it('pads month and day with zeros', () => {
    const d = new Date(2026, 0, 5); // Jan 5
    expect(formatDateISO(d)).toBe('2026-01-05');
  });
});

describe('formatMarkdown()', () => {
  it('converts **bold** to <strong>', () => {
    expect(formatMarkdown('**hello**')).toContain('<strong>hello</strong>');
  });

  it('converts *italic* to <em>', () => {
    expect(formatMarkdown('*hi*')).toContain('<em>hi</em>');
  });

  it('converts list items to bullet points', () => {
    expect(formatMarkdown('- item')).toContain('• item');
  });

  it('returns empty string for null input', () => {
    expect(formatMarkdown(null)).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(formatMarkdown('')).toBe('');
  });

  it('sanitizes XSS: escapes < and > characters', () => {
    const result = formatMarkdown('<script>alert("xss")</script>');
    expect(result.includes('<script>')).toBe(false);
  });

  it('sanitizes XSS: raw HTML in bold does not render tags', () => {
    const result = formatMarkdown('**<img src=x onerror=alert(1)>**');
    expect(result.includes('<img')).toBe(false);
  });
});

describe('splitJsonObjects()', () => {
  it('extracts a single JSON object from string', () => {
    const input = 'prefix{"a":1}suffix';
    const results = splitJsonObjects(input);
    expect(results.length).toBe(1);
    expect(results[0]).toBe('{"a":1}');
  });

  it('extracts multiple JSON objects', () => {
    const input = '{"a":1},{"b":2}';
    const results = splitJsonObjects(input);
    expect(results.length).toBe(2);
  });

  it('handles nested objects', () => {
    const input = '{"a":{"b":1}}';
    const results = splitJsonObjects(input);
    expect(results.length).toBe(1);
    expect(JSON.parse(results[0]).a.b).toBe(1);
  });

  it('handles strings containing braces', () => {
    const input = '{"text":"hello {world}"}';
    const results = splitJsonObjects(input);
    expect(results.length).toBe(1);
  });

  it('returns empty array for input with no JSON', () => {
    const results = splitJsonObjects('no json here');
    expect(results.length).toBe(0);
  });
});

describe('calculateStreakFromLogs()', () => {
  it('returns 0 for empty logs', () => {
    expect(calculateStreakFromLogs([], new Date('2026-06-27'))).toBe(0);
  });

  it('returns 1 for single log today', () => {
    const logs = [{ date: '2026-06-27' }];
    const today = new Date('2026-06-27');
    expect(calculateStreakFromLogs(logs, today)).toBe(1);
  });

  it('returns 3 for 3 consecutive days including today', () => {
    const logs = [
      { date: '2026-06-25' },
      { date: '2026-06-26' },
      { date: '2026-06-27' }
    ];
    const today = new Date('2026-06-27');
    expect(calculateStreakFromLogs(logs, today)).toBe(3);
  });

  it('returns 0 if streak is broken before yesterday', () => {
    const logs = [
      { date: '2026-06-20' },
      { date: '2026-06-21' }
    ];
    const today = new Date('2026-06-27');
    expect(calculateStreakFromLogs(logs, today)).toBe(0);
  });

  it('continues streak from yesterday if no entry today', () => {
    const logs = [
      { date: '2026-06-25' },
      { date: '2026-06-26' }
    ];
    const today = new Date('2026-06-27');
    expect(calculateStreakFromLogs(logs, today)).toBe(2);
  });
});

describe('sanitizeText()', () => {
  it('escapes < and > to HTML entities', () => {
    expect(sanitizeText('<b>test</b>')).toBe('&lt;b&gt;test&lt;/b&gt;');
  });

  it('escapes & to &amp;', () => {
    expect(sanitizeText('a & b')).toBe('a &amp; b');
  });

  it('escapes double quotes', () => {
    expect(sanitizeText('"hello"')).toBe('&quot;hello&quot;');
  });

  it('returns empty string for null', () => {
    expect(sanitizeText(null)).toBe('');
  });

  it('returns empty string for non-string', () => {
    expect(sanitizeText(42)).toBe('');
  });

  it('preserves normal text', () => {
    expect(sanitizeText('hello world')).toBe('hello world');
  });
});

describe('validateLogEntry()', () => {
  const validLog = {
    date: '2026-06-27',
    mood: 7,
    energy: 'High',
    focus: 'Sharp'
  };

  it('passes for a valid log', () => {
    expect(validateLogEntry(validLog).valid).toBe(true);
  });

  it('fails when mood is out of range', () => {
    expect(validateLogEntry({ ...validLog, mood: 11 }).valid).toBe(false);
  });

  it('fails when mood is 0', () => {
    expect(validateLogEntry({ ...validLog, mood: 0 }).valid).toBe(false);
  });

  it('fails with invalid energy value', () => {
    expect(validateLogEntry({ ...validLog, energy: 'Flying' }).valid).toBe(false);
  });

  it('fails with invalid focus value', () => {
    expect(validateLogEntry({ ...validLog, focus: 'Laser' }).valid).toBe(false);
  });

  it('fails with bad date format', () => {
    expect(validateLogEntry({ ...validLog, date: '27-06-2026' }).valid).toBe(false);
  });

  it('fails for null input', () => {
    expect(validateLogEntry(null).valid).toBe(false);
  });
});

// ─── Render results to DOM ────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('test-results');
  if (!container) return;

  let html = '';
  let passed = 0;
  let failed = 0;

  results.forEach(r => {
    if (r.type === 'suite') {
      html += `<div class="suite">${r.name}</div>`;
    } else if (r.type === 'pass') {
      passed++;
      html += `<div class="test pass">✅ ${r.name}</div>`;
    } else {
      failed++;
      html += `<div class="test fail">❌ ${r.name}<span class="error">${r.error}</span></div>`;
    }
  });

  const total = passed + failed;
  const summaryClass = failed === 0 ? 'summary-pass' : 'summary-fail';
  container.innerHTML = `
    <div class="summary ${summaryClass}">${passed} / ${total} tests passed${failed > 0 ? ` (${failed} failed)` : ' ✅'}</div>
    ${html}
  `;
});
