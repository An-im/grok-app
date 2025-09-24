// server/index.js — Express proxy con streaming (SSE) para Groq
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();

const allowed = [
  'http://localhost:5173',
  'https://an-im.github.io',
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl/health
    if (allowed.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked: ' + origin));
  }
}));

app.use(express.json());

// Health
app.get('/health', (req, res) => {
  const g = process.env.GROQ_API_KEY || '';
  const x = process.env.XAI_API_KEY || '';
  res.json({
    ok: true,
    node: process.version,
    hasGroqKey: !!g,
    groqPrefix: g ? g.slice(0, 4) : null,
    hasXaiKey: !!x,
    xaiPrefix: x ? x.slice(0, 3) : null,
  });
});

// === Streaming SSE ===
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model = 'llama-3.1-8b-instant', temperature = 0.7 } = req.body || {};

    // Cabeceras SSE (importante para proxies)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // evitar buffering en proxies
    res.flushHeaders?.();

    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, temperature, stream: true }),
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '');
      res.write(`data: ${JSON.stringify({ error: 'upstream_error', status: upstream.status, body: text })}\n\n`);
      return res.end();
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Proxy error /api/chat:', err);
    try { res.write(`data: ${JSON.stringify({ error: 'proxy_error' })}\n\n`); } catch {}
    res.end();
  }
});

// === No streaming (debug) ===
app.post('/api/chat-nostream', async (req, res) => {
  try {
    const { messages, model = 'llama-3.1-8b-instant', temperature = 0.7 } = req.body || {};

    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, temperature, stream: false }),
    });

    const text = await upstream.text();
    res.status(upstream.status).type('application/json').send(text);
  } catch (err) {
    console.error('Proxy error /api/chat-nostream:', err);
    try { res.status(500).json({ error: 'proxy_error' }); } catch {}
  }
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
