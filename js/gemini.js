/**
 * Gemini API service module for StudyMind
 */

import { getGeminiKey } from './storage.js';

// Construct system prompt containing profile context and history
export function buildSystemPrompt(profile, moodHistory, todayEntry) {
  const exam = profile.exam || 'Competitive Exam';
  const examDate = profile.examDate || '';
  const name = profile.name || 'Student';

  let daysRemainingStr = '';
  if (examDate) {
    const diff = new Date(examDate) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    daysRemainingStr = days > 0 ? `${days} days remaining` : 'Exam date is passed/today';
  }

  let historyStr = '';
  if (moodHistory && moodHistory.length > 0) {
    historyStr = moodHistory.slice(-7).map(h => {
      return `- Date: ${h.date}, Mood: ${h.mood}/10, Energy: ${h.energy}, Focus: ${h.focus}, Journal: "${h.journal}"`;
    }).join('\n');
  } else {
    historyStr = 'No previous logs available.';
  }

  const todayStr = `- Mood: ${todayEntry.mood}/10, Energy: ${todayEntry.energy}, Focus: ${todayEntry.focus}, Journal: "${todayEntry.journal}"`;

  return `You are StudyMind, a calm and intelligent AI study companion for Indian competitive exam students. You are like a wise senior who has been through it all. Your job is to help the student understand exactly what is draining their energy or focus, explain the root cause clearly in simple language, and give them 2–3 specific, practical actions they can take today to feel better and study more effectively. Your advice must always be tailored to their exam type and what they wrote. You track patterns across days and call them out when you see them. You are warm but direct. You never give empty encouragement. You always end with one honest, powerful line that makes the student feel capable. Never mention doctors, therapy, or helplines. This is purely about helping them perform and feel better as a student.

Profile Details:
- Student Name: ${name}
- Exam Target: ${exam}
- Exam Date: ${examDate} (${daysRemainingStr})

Past 7 Days History:
${historyStr}

Today's Check-in:
${todayStr}

Format your response strictly under these 3 specific sections:
🔍 What's Going On
[Your root cause analysis of their mental focus, energy, and patterns over the past week. Be direct, clear, and highlight possible connections.]

🛠 What To Do Today
[2-3 concrete, exam-relevant physical or cognitive actions today based on their needs/routine/patterns. Reference their exam prep context specifically.]

✨ One Thing To Remember
[A single honest, powerful line of motivation tailored to their exact state today.]`;
}

// Call streaming API
export async function streamGeminiChat(contents, systemInstruction, onChunk, onError) {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    onError(new Error("API Key is missing. Please set it in Settings/Onboarding."));
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: contents,
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // Parse SSE / stream chunks
      // Gemini stream responses look like a JSON array of objects or individual chunks
      // When streaming using streamGenerateContent, it is returned as a JSON array of response structures
      // which grows. However, sometimes it is formatted as individual JSON objects per line or standard chunk parsing.
      // Let's implement a robust chunk/JSON parse.
      
      // The stream format for streamGenerateContent is actually a JSON array of objects, starting with `[`
      // and elements separated by `,`.
      // Let's clean the buffer to parse individual content.
      let cleanedBuffer = buffer.trim();
      if (cleanedBuffer.startsWith('[')) {
        cleanedBuffer = cleanedBuffer.substring(1);
      }
      if (cleanedBuffer.endsWith(']')) {
        cleanedBuffer = cleanedBuffer.substring(0, cleanedBuffer.length - 1);
      }
      
      // Split by components or try to find valid JSON blocks
      // A safe way for Gemini streaming: it streams back parts inside `candidates[0].content.parts[0].text`
      // Standard JSON responses stream can be split on "},\n{" or similar.
      // Let's process chunk parser:
      const parts = splitJsonObjects(buffer);
      for (const part of parts) {
        try {
          const obj = JSON.parse(part);
          const text = obj.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            onChunk(text);
          }
        } catch (e) {
          // Incomplete chunk, keep waiting
        }
      }
      
      // Save remaining for next chunk
      // We can also extract the text incrementally if standard splitting works:
    }
  } catch (err) {
    onError(err);
  }
}

// Extract Stress Triggers & Positive Factors from journal entry
export async function extractTriggersAndPositives(journalText) {
  const apiKey = getGeminiKey();
  if (!apiKey) return { triggers: [], positives: [] };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const prompt = `From this journal entry, extract up to 4 stress triggers (things causing difficulty) and up to 3 positive factors (things that helped or went well). Return only a JSON object: { "triggers": [strings], "positives": [strings] }. Use short 2–4 word labels. If nothing is clearly positive, return empty array.
  
  Journal Entry: "${journalText}"`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Extraction failed: ${response.status}`);
    }

    const data = await response.json();
    const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (textResult) {
      return JSON.parse(textResult.trim());
    }
  } catch (e) {
    console.error("Failed trigger extraction:", e);
  }
  return { triggers: [], positives: [] };
}

// Generate weekly insight card from 7-day logs
export async function generateWeeklyInsight(logs7Days, profile) {
  const apiKey = getGeminiKey();
  if (!apiKey) return "API Key is required to generate weekly insights.";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const logsStr = logs7Days.map(log => 
    `- Date: ${log.date}, Mood: ${log.mood}/10, Energy: ${log.energy}, Focus: ${log.focus}, Triggers: [${(log.triggers || []).join(', ')}], Positives: [${(log.positives || []).join(', ')}], Journal: "${log.journal}"`
  ).join('\n');

  const prompt = `You are StudyMind, a wise study mentor. Provide a short, powerful weekly insight analysis (max 120 words) for a student preparing for the ${profile.exam} exam, based on their last 7 days of logs.
  
  Format:
  - Paragraph 1: Highlight the biggest pattern (e.g. how energy and focus related) and the most recurring stress trigger.
  - Paragraph 2: One direct action recommendation and one encouraging line.
  
  Data:
  ${logsStr}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) throw new Error("Weekly summary fetch failed");
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to extract summary.";
  } catch (e) {
    console.error(e);
    return "Failed to load weekly analysis. Check your connection or API Key.";
  }
}

// Helper: robust streaming chunk processor
function splitJsonObjects(str) {
  const results = [];
  let braceCount = 0;
  let startIdx = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') {
        if (braceCount === 0) {
          startIdx = i;
        }
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
