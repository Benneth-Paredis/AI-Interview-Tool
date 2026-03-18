import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequestBody {
  messages: ChatMessage[];
  topic: string;
}

app.post('/api/chat', async (req: Request<{}, {}, ChatRequestBody>, res: Response) => {
  const { messages, topic } = req.body;

  if (!topic || !Array.isArray(messages)) {
    res.status(400).json({ error: 'topic and messages are required' });
    return;
  }

  const systemPrompt = `You are a professional user researcher conducting a one-on-one interview about the following topic: "${topic}".

Your role is to explore the participant's thoughts, experiences, and opinions in depth. Follow these rules strictly:
- Ask exactly one focused follow-up question at a time — never more.
- Keep questions open-ended to encourage detailed responses.
- Build naturally on what the participant just said.
- Do not offer opinions, suggestions, or commentary — only ask questions.
- Be concise; the question itself should be one or two sentences at most.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    });

    const reply = completion.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    console.error('OpenAI API error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

interface SummaryRequestBody {
  messages: ChatMessage[];
  topic: string;
}

app.post('/api/summary', async (req: Request<{}, {}, SummaryRequestBody>, res: Response) => {
  const { messages, topic } = req.body;

  if (!topic || !Array.isArray(messages)) {
    res.status(400).json({ error: 'topic and messages are required' });
    return;
  }

  const systemPrompt = `You are a senior user researcher. You have just completed a user interview about the topic: "${topic}".

Analyse the conversation and return a JSON object with exactly these three fields:
- "summary": a 2-3 sentence overview of what was learned
- "insights": an array of 3-5 key insight strings distilled from the participant's answers
- "quotes": an array of 2-3 notable direct quotes copied verbatim from the participant's messages

Rules:
- Return only valid JSON. No markdown, no code fences, no backticks, no commentary outside the JSON.
- Every string must be plain text with no embedded newlines.
- quotes must be taken word-for-word from the participant; do not paraphrase.`;

  const transcript = messages
    .map(m => `${m.role === 'user' ? 'Participant' : 'Interviewer'}: ${m.content}`)
    .join('\n');

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcript },
      ],
    });

    const raw = completion.choices[0].message.content ?? '{}';
    const parsed = JSON.parse(raw);
    res.json(parsed);
  } catch (err) {
    console.error('OpenAI summary error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
