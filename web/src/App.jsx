import { useEffect, useRef, useState } from 'react';

// Paletas rápidas por tema
const THEMES = {
  cozy: {
    bg: 'bg-gradient-to-b from-rose-50 to-amber-50 dark:from-neutral-950 dark:to-neutral-900',
    user: 'bg-rose-600 text-white',
    ai: 'bg-white/80 dark:bg-neutral-800/70 border border-neutral-200/80 dark:border-neutral-700/60',
    ring: 'focus:ring-rose-400 dark:focus:ring-rose-500',
    button: 'bg-rose-600 hover:bg-rose-700 text-white',
    accentDot: 'from-rose-500 to-amber-400'
  },
  glass: {
    bg: 'bg-neutral-50 dark:bg-neutral-950',
    user: 'bg-black text-white dark:bg-white dark:text-black',
    ai: 'backdrop-blur bg-white/60 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/40',
    ring: 'focus:ring-neutral-400 dark:focus:ring-neutral-600',
    button: 'bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-black',
    accentDot: 'from-neutral-700 to-neutral-300'
  },
  midnight: {
    bg: 'bg-gradient-to-b from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-indigo-950',
    user: 'bg-indigo-600 text-white',
    ai: 'bg-white/80 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60',
    ring: 'focus:ring-indigo-400 dark:focus:ring-indigo-500',
    button: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    accentDot: 'from-indigo-500 to-blue-400'
  },
  chef: {
    bg: 'bg-gradient-to-b from-emerald-50 to-amber-50 dark:from-neutral-950 dark:to-emerald-950',
    user: 'bg-emerald-600 text-white',
    ai: 'bg-white/80 dark:bg-neutral-800/70 border border-emerald-200/70 dark:border-emerald-800/50',
    ring: 'focus:ring-emerald-400 dark:focus:ring-emerald-500',
    button: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    accentDot: 'from-emerald-500 to-amber-400'
  }
};

export default function App() {
  const [messages, setMessages] = useState([
    { role: 'system', content: 'Eres un asistente útil y conciso.' }
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [model, setModel] = useState('llama-3.1-8b-instant');
  const [error, setError] = useState(null);
  const [isDark, setIsDark] = useState(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  );
  const [theme, setTheme] = useState('chef'); // cambia por cozy | glass | midnight | chef

  const endRef = useRef(null);

  // Dark mode
  useEffect(() => {
    const root = document.documentElement;
    isDark ? root.classList.add('dark') : root.classList.remove('dark');
  }, [isDark]);

  // Autoscroll
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streaming]);

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim() || streaming) return;
    setError(null);

    const next = [...messages, { role: 'user', content: input.trim() }];
    setMessages(next);
    setInput('');
    setStreaming(true);

    // slot para el stream del assistant
    const idx = next.length;
    setMessages(m => [...m, { role: 'assistant', content: '' }]);

    try {
      const resp = await fetch('http://localhost:8787/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.filter(m => m.role !== 'system'),
          model
        })
      });

      if (!resp.ok || !resp.body) {
        let detail = '';
        try { detail = await resp.text(); } catch {}
        setError(`Error del servidor (${resp.status}): ${detail}`);
        setStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let partial = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const data = t.replace(/^data:\s*/, '');
          if (data === '[DONE]') { setStreaming(false); break; }
          try {
            const evt = JSON.parse(data);
            const delta = evt?.choices?.[0]?.delta?.content ?? '';
            if (delta) {
              partial += delta;
              setMessages(m => {
                const copy = [...m];
                copy[idx] = { role: 'assistant', content: partial };
                return copy;
              });
            }
          } catch {}
        }
      }
      setStreaming(false);
    } catch (err) {
      setError(`Fetch error: ${String(err)}`);
      setStreaming(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const T = THEMES[theme];

  const clearChat = () => {
    setMessages([{ role: 'system', content: 'Eres un asistente útil y conciso.' }]);
    setError(null);
  };

  const copyLast = async () => {
    const last = [...messages].reverse().find(m => m.role === 'assistant');
    if (last?.content) await navigator.clipboard.writeText(last.content);
  };
  // 1) Cargar estado inicial (arriba de todo, antes del return)
useEffect(() => {
  const saved = JSON.parse(localStorage.getItem('appState') || '{}');
  if (saved.messages) setMessages([{ role:'system', content:'Eres un asistente útil y conciso.' }, ...saved.messages]);
  if (saved.model) setModel(saved.model);
  if (typeof saved.isDark === 'boolean') setIsDark(saved.isDark);
}, []);

// 2) Persistir cada vez que cambie algo importante
useEffect(() => {
  localStorage.setItem('appState', JSON.stringify({
    messages: messages.filter(m => m.role !== 'system'),
    model,
    isDark
  }));
}, [messages, model, isDark]);

  return (
    <div className={`min-h-screen ${T.bg} text-neutral-900 dark:text-neutral-100`}>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-neutral-200/70 dark:border-neutral-800/70 bg-white/70 dark:bg-neutral-900/70 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`size-9 rounded-2xl bg-gradient-to-tr ${T.accentDot} shadow-sm`} />
            <div>
              <h1 className="font-semibold leading-tight">Chat · Proxy local</h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Groq (free tier)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Selector de modelos */}
            <select
              className="text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg px-2 py-1 bg-white dark:bg-neutral-800"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
              <option value="llama-3.1-70b-versatile">llama-3.1-70b-versatile</option>
            </select>

            {/* Tema */}
            <select
              className="text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg px-2 py-1 bg-white dark:bg-neutral-800"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              title="Tema"
            >
              <option value="chef">Chef</option>
              <option value="cozy">Cozy</option>
              <option value="glass">Glass</option>
              <option value="midnight">Midnight</option>
            </select>

            {/* Dark / Light */}
            <button
              onClick={() => setIsDark(d => !d)}
              className="text-sm border rounded-lg px-2 py-1 border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
              title="Tema del sistema"
            >
              {isDark ? '☀︎' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      {/* Chat */}
      <main className="max-w-3xl mx-auto px-4 py-5">
        {error && (
          <div className="mb-3 p-3 rounded-xl border border-red-300/70 text-red-700 dark:text-red-300 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/30">
            {error}
          </div>
        )}

        <div className="h-[65vh] md:h-[70vh] overflow-y-auto border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 bg-white/75 dark:bg-neutral-900/50 shadow-sm">
          {messages.filter(m => m.role !== 'system').map((m, i) => {
            const isUser = m.role === 'user';
                    
            return (
              <div key={i} className={`mb-3 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2 leading-relaxed shadow-sm ${isUser ? T.user : T.ai}`}>
                  <div className="text-[11px] uppercase tracking-wide opacity-70 mb-1">
                    {isUser ? 'Tú' : 'Asistente'}
                  </div>
            
                  <div className="whitespace-pre-wrap">{m.content}</div>
            
                  {/* timestamp dentro de la burbuja */}
                  <div className="text-[10px] opacity-60 mt-1">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}

          {streaming && (
            <div className="animate-pulse text-sm text-neutral-500 dark:text-neutral-400 px-1">
              Escribiendo…
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Acciones */}
        <div className="mt-3 flex gap-2">
          <button onClick={clearChat} className="text-sm px-3 py-1 rounded border border-neutral-300 dark:border-neutral-700">
            Borrar chat
          </button>
          <button onClick={copyLast} className="text-sm px-3 py-1 rounded border border-neutral-300 dark:border-neutral-700">
            Copiar última respuesta
          </button>
        </div>
      </main>

      {/* Composer */}
      <footer className="sticky bottom-0 border-t border-neutral-200/70 dark:border-neutral-800/70 bg-white/80 dark:bg-neutral-900/80 backdrop-blur"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}>
        <form onSubmit={sendMessage} className="max-w-3xl mx-auto px-4 py-3 flex items-end gap-2">
          <textarea
            rows={1}
            className={`flex-1 resize-none rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 outline-none focus:ring-2 ${T.ring}`}
            placeholder="Escribe tu mensaje… (Shift+Enter salto de línea)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            }}
            disabled={streaming}
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className={`rounded-xl px-4 py-2 shadow-sm disabled:opacity-50 ${T.button}`}
          >
            {streaming ? 'Generando…' : 'Enviar'}
          </button>
        </form>
      </footer>
    </div>
  );
}
