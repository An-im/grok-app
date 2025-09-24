// server/index.js — usa fetch nativo de Node 22 (sin node-fetch)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Health check
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

// === Elige PROVEEDOR: GROQ (gratis) o XAI (requiere créditos) ===
const PROVIDER = process.env.PROVIDER || 'groq'; // 'groq' | 'xai'

// Endpoint común con streaming SSE
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model, temperature = 0.7 } = req.body || {};

    let url, headers, body;
    if (PROVIDER === 'xai') {
      // xAI (Grok) — necesita XAI_API_KEY=xa-... y créditos
      url = 'https://api.x.ai/v1/chat/completions';
      headers = {
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
        'Content-Type': 'application/json'
      };
      body = JSON.stringify({
        model: model || 'grok-4',
        messages,
        temperature,
        stream: true
      });
    } else {
      // GROQ (gratis) — usa GROQ_API_KEY=gsk-...
      url = 'https://api.groq.com/openai/v1/chat/completions';
      headers = {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      };
      body = JSON.stringify({
        model: model || 'llama-3.1-8b-instant',
        messages,
        temperature,
        stream: true
      });
    }

    // fetch nativo de Node 22
    const upstream = await fetch(url, { method: 'POST', headers, body });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '');
      res.status(upstream.status || 500).json({
        error: 'upstream_error',
        status: upstream.status,
        body: text
      });
      return;
    }

    // Cabeceras SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Streaming con Web ReadableStream (getReader existe en fetch nativo)
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
    try { res.status(500).json({ error: 'proxy_error' }); } catch {}
  }
});

// Endpoint de debug SIN streaming (útil para ver errores claros)
app.post('/api/chat-nostream', async (req, res) => {
  try {
    const { messages, model, temperature = 0.7 } = req.body || {};
    let url, headers, body;
    if (PROVIDER === 'xai') {
      url = 'https://api.x.ai/v1/chat/completions';
      headers = {
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
        'Content-Type': 'application/json'
      };
      body = JSON.stringify({ model: model || 'grok-4', messages, temperature, stream: false });
    } else {
      url = 'https://api.groq.com/openai/v1/chat/completions';
      headers = {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      };
      body = JSON.stringify({ model: model || 'llama-3.1-8b-instant', messages, temperature, stream: false });
    }
    const upstream = await fetch(url, { method: 'POST', headers, body });
    const text = await upstream.text();
    res.status(upstream.status).type('application/json').send(text);
  } catch (err) {
    console.error('Proxy error /api/chat-nostream:', err);
    try { res.status(500).json({ error: 'proxy_error' }); } catch {}
  }
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
