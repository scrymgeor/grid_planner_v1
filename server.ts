import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import { mountPushRoutes, startPushScheduler } from './serverPush';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '2mb' }));
mountPushRoutes(app);

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'grid-planner' });
});

app.post('/api/chat', async (req, res) => {
  try {
    const ai = getAiClient();
    if (!ai) {
      return res.status(500).json({
        error: 'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets.',
      });
    }

    const { message, mood, tasks, schedule, freeHours, currentTime, streak } = req.body ?? {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    const systemInstruction = `You are Echo, an empathetic, practical scheduling assistant built inside the Grid planner app.
Your job is to support the user emotionally and practically, detect their mood/energy, and rearrange their task schedule when they miss a deadline, fall behind, feel tired/stressed/overwhelmed, or ask for adjustments.

Guidelines:
- Keep your reply concise (2-4 sentences), warm, grounded, and actionable.
- Never guilt-trip the user for missing a task or deadline. Focus on realistic recovery and protecting their streak with manageable wins.
- Only set "shouldRearrange": true if the user asks to reschedule/rearrange, mentions missing a task/deadline, expresses low energy/stress/overwhelm that warrants shifting tasks, or asks to optimize for a mood/focus state.
- When "shouldRearrange" is true, choose the best "strategy":
  - "light_recovery": when user is tired, burnt out, or overwhelmed (moves heavy deep work later, keeps light quick wins today, increases break buffer).
  - "deadline_crunch": when deadlines are imminent or tasks were missed (prioritizes overdue/urgent items immediately).
  - "deep_focus": when user feels energized or wants maximum output on high-priority work.
  - "balanced": standard priority + deadline balance.
- You may optionally include "taskAdjustments" (using exact task IDs from the provided list) to bump priority or change energy tagging, and "customMoves" if the user explicitly requested moving a specific task to a specific date/time (within valid YYYY-MM-DD and HH:mm 24h formats).
- Always provide 2-3 helpful short "suggestedPrompts" for what the user might say next.`;

    const contextPayload = {
      currentTime,
      selectedMood: mood,
      streak,
      tasks: (tasks || []).slice(0, 25),
      upcomingBlocks: (schedule || []).slice(0, 25),
      freeHoursSummary: freeHours,
    };

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `User message: "${message}"\n\nCurrent Grid state:\n${JSON.stringify(contextPayload)}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: 'Supportive, practical response explaining any schedule changes or advice.',
            },
            moodDetected: {
              type: Type.STRING,
              description: 'One of: focused, energized, tired, stressed, overwhelmed',
            },
            shouldRearrange: {
              type: Type.BOOLEAN,
              description: 'Whether the schedule should be rearranged now.',
            },
            strategy: {
              type: Type.STRING,
              description: 'One of: balanced, light_recovery, deadline_crunch, deep_focus',
            },
            rearrangedReason: {
              type: Type.STRING,
              description: 'Short label explaining why blocks were rearranged, e.g., "Adjusted for tired mood"',
            },
            taskAdjustments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  taskId: { type: Type.STRING },
                  newPriority: { type: Type.STRING, description: 'Optional: high, medium, or low' },
                  boostScore: { type: Type.NUMBER, description: 'Optional score offset from -200 to +300' },
                },
                required: ['taskId'],
              },
            },
            suggestedPrompts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['reply', 'moodDetected', 'shouldRearrange', 'strategy', 'suggestedPrompts'],
        },
      },
    });

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText);
    return res.json(parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate AI coaching response.';
    console.error('[/api/chat] error:', msg);
    return res.status(502).json({ error: msg });
  }
});

app.post('/api/schedule/ai-optimize', async (req, res) => {
  try {
    const ai = getAiClient();
    if (!ai) {
      return res.status(500).json({
        error: 'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets.',
      });
    }

    const { tasks, mood, freeHours, currentTime, reason } = req.body ?? {};

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Optimize task ordering and strategy for this user.\nReason: ${reason || 'Manual AI schedule optimization'}\nMood: ${mood || 'focused'}\nCurrent time: ${currentTime}\nTasks: ${JSON.stringify(tasks)}\nFree hours: ${JSON.stringify(freeHours)}`,
      config: {
        systemInstruction:
          'You are Grid Schedule Optimizer. Analyze task deadlines, priorities, cognitive energy, and the user mood. Return a scheduling strategy and per-task priority boost weights (-200 to +300) plus a concise 1-sentence summary of your optimization rationale.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            strategy: {
              type: Type.STRING,
              description: 'One of: balanced, light_recovery, deadline_crunch, deep_focus',
            },
            taskWeights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  taskId: { type: Type.STRING },
                  boostScore: { type: Type.NUMBER },
                },
                required: ['taskId', 'boostScore'],
              },
            },
          },
          required: ['summary', 'strategy', 'taskWeights'],
        },
      },
    });

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText);
    return res.json(parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI schedule optimization failed.';
    console.error('[/api/schedule/ai-optimize] error:', msg);
    return res.status(502).json({ error: msg });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(process.cwd(), 'dist');
  const httpServer = http.createServer(app);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: { server: httpServer },
        hmr: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Grid server running on http://0.0.0.0:${PORT}`);
    startPushScheduler();
  });
}

startServer();
