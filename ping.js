import 'dotenv/config';
import fetch from 'node-fetch';

const res = await fetch('https://api.x.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    // Cambia el modelo si quieres (ej: grok-4, grok-4-fast, grok-3, etc.)
    // Revisa los modelos disponibles y precios en la doc oficial.
    model: 'grok-4',
    messages: [{ role: 'user', content: 'Dime hola en español en 3 palabras.' }]
  })
});

const json = await res.json();
console.log(JSON.stringify(json, null, 2));
