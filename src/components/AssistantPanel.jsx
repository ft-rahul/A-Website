import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, KeyRound, Square, Sparkles, Trash2, Wrench, X } from 'lucide-react';
import { storage } from '../lib/storage';
import { get, streamRequest } from '../lib/api';
import { Markdown } from '../lib/markdown';
import { usePrefersReducedMotion } from '../hooks/useMediaQuery';

/*
 * Tutor assistant.
 * When the Monklogy server has a Claude key configured, answers stream through
 * the API (POST /api/assistant/chat): the key and the tutor's instructions stay
 * on the server, with a per-learner daily limit. Otherwise a learner can use
 * their own Anthropic API key, called directly from the browser. Without either it falls back to an offline
 * helper that only rearranges what the app already knows (diagnostics, the line
 * explainer, the lesson's key points), and is labelled as not being AI.
 */

const MODEL = 'claude-opus-5-5';
const KEY_STORE = 'anthropic_api_key';

// Stable across every request so the prefix stays cacheable; per-turn context goes in the user turn.
const SYSTEM = `You are the Monklogy Tutor, a patient programming teacher inside a video course workspace.
Each learner message starts with a <workspace> block: the course, lesson, exercise, the file being edited (with line numbers), the cursor line, current problems, and recent terminal output. Treat it as the ground truth about their code.

How to help:
- Teach, don't solve. For exercises, point to the exact line and concept, and ask a guiding question or give the smallest next step. Only write the full solution if the learner explicitly asks for it.
- Explain what actually happens at runtime (call stack, event loop, DOM, memory) when that is what makes the answer click.
- Be concise: a few short paragraphs or a short list. Use fenced code blocks for code, and refer to lines as "line N".
- If the workspace data does not answer the question, say what you would need to see rather than guessing.`;

const QUICK = [
  { id: 'line', label: 'Explain my line', prompt: 'Explain what my cursor line does and what happens behind the scenes when it runs.' },
  { id: 'error', label: 'Why is it failing?', prompt: 'Why is my code failing or not passing? Point me at the problem without giving the full answer.' },
  { id: 'hint', label: 'Give me a hint', prompt: 'Give me one small hint for the next step of this exercise.' },
  { id: 'recap', label: 'Recap the lesson', prompt: 'Recap the key ideas of this lesson in a few bullet points.' }
];

const numbered = (code) => code.split('\n').map((l, i) => `${String(i + 1).padStart(3, ' ')} | ${l}`).join('\n');

const workspaceBlock = (c) => {
  const problems = c.diagnostics.length
    ? c.diagnostics.map((d) => `- ${d.file}:${d.line}:${d.col} ${d.severity}: ${d.message}`).join('\n')
    : '- none';
  return `<workspace>
Course: ${c.courseTitle}
Lesson ${c.lessonNumber}: ${c.lessonTitle}
Exercise: ${c.prompt}
Key points:
${c.keyPoints || '(none)'}
File: ${c.fileName} (${c.language}) — cursor on line ${c.cursorLine}
\`\`\`
${numbered(c.code)}
\`\`\`
Problems:
${problems}
Recent terminal output:
${c.terminal || '(empty)'}
</workspace>`;
};

/* ── Offline helper: deterministic, never pretends to be a model ── */
const offlineReply = (kind, c, offline) => {
  const errors = c.diagnostics.filter((d) => d.severity === 'error');
  const warnings = c.diagnostics.filter((d) => d.severity !== 'error');
  if (kind === 'error') {
    if (!c.diagnostics.length) {
      return `The static checker finds **no problems** in your files. If the exercise still fails, compare your code with the task:\n\n> ${c.prompt}\n\nThen press **Run** and read the terminal — runtime errors show there with a line number.`;
    }
    const list = [...errors, ...warnings].slice(0, 4)
      .map((d) => `- **${d.file}, line ${d.line}** — ${d.message}${d.hint ? `\n  ${d.hint}` : ''}`).join('\n');
    return `The checker found ${errors.length} error${errors.length === 1 ? '' : 's'} and ${warnings.length} warning${warnings.length === 1 ? '' : 's'}:\n\n${list}\n\nFix the first error first — later ones are often caused by it.`;
  }
  if (kind === 'line') {
    const e = offline.explanation;
    if (!e) return 'Put your cursor on a line in the editor and ask again.';
    return `**Line ${c.cursorLine}: ${e.title}**\n\n${[e.says, e.runtime, e.why && `**Why it matters:** ${e.why}`, e.next && `**Next:** ${e.next}`].filter(Boolean).join('\n\n')}`;
  }
  if (kind === 'recap') {
    return c.keyPoints ? `**${c.lessonTitle}** — key points:\n\n${c.keyPoints}` : `This lesson has no written key points yet. The task is:\n\n> ${c.prompt}`;
  }
  // hint
  if (errors.length) return `Start with **line ${errors[0].line}**: ${errors[0].message}${errors[0].hint ? ` — ${errors[0].hint}` : ''}`;
  return `Re-read the task and find the one line that has to change:\n\n> ${c.prompt}\n\nPut your cursor on the line you think it is — the Behind the scenes tab explains it.`;
};

const classify = (text) => {
  const t = text.toLowerCase();
  if (/error|fail|bug|wrong|broken|not work|doesn.t work|why/.test(t)) return 'error';
  if (/hint|stuck|next|help/.test(t)) return 'hint';
  if (/recap|summary|summar|key point|lesson/.test(t)) return 'recap';
  return 'line';
};

/** Reads a server-sent-events body and calls onEvent for every JSON event. */
const readEvents = async (res, onEvent) => {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const data = chunk.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
      if (data) {
        try { onEvent(JSON.parse(data)); } catch { /* ignore a malformed event */ }
      }
    }
  }
};

const describeError = (Anthropic, err) => {
  if (err instanceof Anthropic.AuthenticationError) return { text: 'Anthropic rejected this API key. Check it and enter it again.', resetKey: true };
  if (err instanceof Anthropic.PermissionDeniedError) return { text: 'This API key is not allowed to use this model.' };
  if (err instanceof Anthropic.RateLimitError) return { text: 'Rate limited by the API. Wait a moment and try again.' };
  if (err instanceof Anthropic.APIConnectionError) return { text: 'Could not reach the Anthropic API. Check your connection (or a browser extension blocking it).' };
  if (err instanceof Anthropic.APIError) return { text: `The API returned an error${err.status ? ` (${err.status})` : ''}: ${err.message}` };
  return { text: `Something went wrong: ${err?.message || err}` };
};

/*
 * Types a reply out like someone writing it: ~70 characters a second, a short
 * breath after sentences and line breaks, and faster catch-up when a streamed
 * answer runs far ahead. Each turn types once; revisiting a thread shows it whole.
 */
const TypedReply = ({ turn, onTick }) => {
  const reduced = usePrefersReducedMotion();
  const instant = reduced || turn.typed;
  const [shown, setShown] = useState(instant ? turn.text.length : 0);
  const target = turn.text;
  useEffect(() => {
    if (instant) { setShown(target.length); return undefined; }
    if (shown >= target.length) {
      if (!turn.streaming) turn.typed = true;
      return undefined;
    }
    const last = target[shown - 1];
    const pause = last === '\n' ? 140 : /[.!?]/.test(last || '') && target[shown] === ' ' ? 180 : /[,;:]/.test(last || '') ? 60 : 0;
    const id = setTimeout(() => {
      const left = target.length - shown;
      const step = Math.max(1, Math.round(left / 60)); // catch up on long answers
      setShown((n) => Math.min(target.length, n + step));
      onTick?.();
    }, 14 + pause);
    return () => clearTimeout(id);
  }, [shown, target, instant, turn, onTick]);
  const typing = !instant && (shown < target.length || turn.streaming);
  return (
    <div className={`ai-typed ${typing ? 'is-typing' : ''}`}>
      <Markdown text={target.slice(0, shown)} className="ai-md" />
    </div>
  );
};

export const AssistantPanel = ({ threadKey, getContext, offline }) => {
  const [apiKey, setApiKey] = useState(() => storage.getAccount(KEY_STORE, ''));
  // { enabled, model, dailyLimit, usedToday } from the server, or null while unknown
  const [server, setServer] = useState(null);
  useEffect(() => {
    let live = true;
    get('/assistant/status').then((s) => { if (live) setServer(s); }).catch(() => { if (live) setServer({ enabled: false }); });
    return () => { live = false; };
  }, []);
  const useServer = Boolean(server?.enabled);
  const [keyDraft, setKeyDraft] = useState('');
  const [showKeyForm, setShowKeyForm] = useState(false);
  // threads[threadKey] = { history: API messages (append-only), view: rendered turns }
  const threads = useRef({});
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const thread = threads.current[threadKey] || (threads.current[threadKey] = { history: [], view: [] });
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const streamRef = useRef(null);
  const listRef = useRef(null);

  const stick = useRef(true); // follow the newest text unless the reader scrolled up
  const follow = useCallback(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, []);
  useEffect(follow);
  useEffect(() => () => streamRef.current?.abort(), []);
  // Stop an answer that belongs to the previous lesson
  useEffect(() => () => streamRef.current?.abort(), [threadKey]);

  const saveKey = (e) => {
    e.preventDefault();
    const k = keyDraft.trim();
    if (!k) return;
    storage.setAccount(KEY_STORE, k);
    setApiKey(k);
    setKeyDraft('');
    setShowKeyForm(false);
  };
  const forgetKey = () => {
    storage.setAccount(KEY_STORE, '');
    setApiKey('');
  };

  const pushView = (turn) => { thread.view.push(turn); rerender(); return turn; };

  const ask = async (text, kind) => {
    const q = text.trim();
    if (!q || busy) return;
    setDraft('');
    const ctx = getContext();
    pushView({ role: 'user', text: q, chip: `${ctx.fileName} · line ${ctx.cursorLine}` });

    stick.current = true;
    if (useServer) {
      await askServer(q, ctx);
      return;
    }
    if (!apiKey) {
      const turn = pushView({ role: 'offline', text: '' });
      const text = offlineReply(kind || classify(q), ctx, offline());
      setTimeout(() => { turn.text = text; rerender(); }, 450);
      return;
    }

    const userMsg = { role: 'user', content: [{ type: 'text', text: workspaceBlock(ctx) }, { type: 'text', text: q }] };
    const answer = pushView({ role: 'assistant', text: '', streaming: true });
    setBusy(true);
    let Anthropic;
    try {
      ({ default: Anthropic } = await import('@anthropic-ai/sdk'));
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
      const stream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        cache_control: { type: 'ephemeral' },
        system: SYSTEM,
        messages: [...thread.history, userMsg]
      });
      streamRef.current = stream;
      stream.on('streamEvent', (event) => {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          answer.text += event.delta.text;
          rerender();
        }
      });
      const final = await stream.finalMessage();
      answer.streaming = false;
      if (final.stop_reason === 'refusal') {
        answer.role = 'notice';
        answer.text = 'Claude declined to answer this one. Try rephrasing the question about your code.';
      } else {
        // Append-only: the exact content returned (including thinking blocks) goes back next turn.
        thread.history.push(userMsg, { role: 'assistant', content: final.content });
        answer.text = final.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n\n') || answer.text;
        if (final.stop_reason === 'max_tokens') answer.text += '\n\n_(The answer hit the length limit.)_';
      }
    } catch (err) {
      answer.streaming = false;
      if (Anthropic && err instanceof Anthropic.APIUserAbortError) {
        answer.stopped = true;
        if (!answer.text) answer.text = '_Stopped._';
      } else {
        const d = Anthropic ? describeError(Anthropic, err) : { text: 'Could not load the Anthropic SDK.' };
        answer.role = 'notice';
        answer.text = d.text;
        if (d.resetKey) forgetKey();
      }
    } finally {
      streamRef.current = null;
      setBusy(false);
      rerender();
    }
  };

  // Streams through the Monklogy API, which holds the Claude key.
  const askServer = async (q, ctx) => {
    const answer = pushView({ role: 'assistant', text: '', streaming: true });
    setBusy(true);
    const controller = new AbortController();
    streamRef.current = controller;
    let finished = false;
    try {
      const res = await streamRequest('/assistant/chat', { history: thread.history, workspace: workspaceBlock(ctx), question: q }, controller.signal);
      await readEvents(res, (e) => {
        if (e.type === 'delta') {
          answer.text += e.text;
          rerender();
        } else if (e.type === 'done') {
          finished = true;
          answer.streaming = false;
          if (e.stopReason === 'refusal') {
            answer.role = 'notice';
            answer.text = 'Claude declined to answer this one. Try rephrasing the question about your code.';
          } else {
            // Append-only: the exact content returned (including thinking blocks) goes back next turn.
            thread.history.push(e.userMessage, { role: 'assistant', content: e.content });
            answer.text = e.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n\n') || answer.text;
            if (e.stopReason === 'max_tokens') answer.text += '\n\n_(The answer hit the length limit.)_';
          }
          setServer((s) => (s ? { ...s, usedToday: (s.usedToday || 0) + 1 } : s));
        } else if (e.type === 'error') {
          finished = true;
          answer.streaming = false;
          answer.role = 'notice';
          answer.text = e.message;
        }
      });
      if (!finished) {
        answer.streaming = false;
        if (!answer.text) { answer.role = 'notice'; answer.text = 'The answer was cut off. Try again.'; }
      }
    } catch (err) {
      answer.streaming = false;
      if (err?.name === 'AbortError') {
        answer.stopped = true;
        if (!answer.text) answer.text = '_Stopped._';
      } else {
        answer.role = 'notice';
        answer.text = err?.message || 'Could not reach the tutor. Try again.';
      }
    } finally {
      streamRef.current = null;
      setBusy(false);
      rerender();
    }
  };

  const clear = () => {
    streamRef.current?.abort();
    threads.current[threadKey] = { history: [], view: [] };
    rerender();
  };

  return (
    <div className="ai">
      <div className="ai-status">
        {useServer ? (
          <span className="ai-badge is-live" title={server.dailyLimit ? `${Math.max(0, server.dailyLimit - (server.usedToday || 0))} questions left today` : undefined}>
            <Sparkles size={12} /> Claude · {server.model}
          </span>
        ) : apiKey ? (
          <>
            <span className="ai-badge is-live"><Sparkles size={12} /> Claude · {MODEL}</span>
            <button className="ai-link" onClick={forgetKey}>Forget key</button>
          </>
        ) : (
          <>
            <span className="ai-badge"><Wrench size={12} /> Offline helper · not AI</span>
            <button className="ai-link" onClick={() => setShowKeyForm((s) => !s)}><KeyRound size={12} /> Connect Claude</button>
          </>
        )}
        {thread.view.length > 0 && (
          <button className="icon-btn is-quiet ai-clear" onClick={clear} aria-label="Clear conversation" title="Clear conversation"><Trash2 size={13} /></button>
        )}
      </div>

      {showKeyForm && !apiKey && !useServer && (
        <form className="ai-keyform" onSubmit={saveKey}>
          <div className="ai-keyform-head">
            <strong>Use your Anthropic API key</strong>
            <button type="button" className="icon-btn is-quiet" onClick={() => setShowKeyForm(false)} aria-label="Close"><X size={14} /></button>
          </div>
          <p>
            The Monklogy server has no Claude key configured, so requests go straight from this browser to Anthropic with your key. It is stored in
            this browser’s local storage only — use a key with a spending limit, and don’t use this on a shared computer.
          </p>
          <div className="ai-keyform-row">
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-ant-…"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              aria-label="Anthropic API key"
            />
            <button className="btn btn-sm btn-primary" type="submit" disabled={!keyDraft.trim()}>Save</button>
          </div>
        </form>
      )}

      <div
        ref={listRef}
        className="ai-thread"
        role="log"
        aria-live="polite"
        aria-label="Assistant conversation"
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {thread.view.length === 0 ? (
          <div className="ai-empty">
            <p className="ai-empty-title">Ask about this lesson</p>
            <p>
              {apiKey
                ? 'Claude sees your current file, cursor line, problems and terminal output, and nudges you toward the answer instead of handing it over.'
                : 'Without a key, the offline helper answers from the checker, the line explainer and the lesson notes. Connect Claude for free-form answers.'}
            </p>
          </div>
        ) : (
          thread.view.map((t, i) => (
            <div key={i} className={`ai-turn is-${t.role} ${t.streaming ? 'is-streaming' : ''}`}>
              {t.role === 'user' ? (
                <>
                  <span className="ai-chip mono">{t.chip}</span>
                  <p>{t.text}</p>
                </>
              ) : (
                <>
                  {t.role === 'offline' && <span className="ai-turn-label mono">Offline helper · from the checker and lesson notes</span>}
                  {!t.text ? (
                    <span className="ai-typing" aria-label={t.role === 'offline' ? 'Looking it up' : 'Claude is thinking'}><i /><i /><i /></span>
                  ) : t.role === 'notice' ? (
                    <Markdown text={t.text} className="ai-md" />
                  ) : (
                    <TypedReply turn={t} onTick={follow} />
                  )}
                  {t.stopped && <span className="ai-turn-label mono">stopped</span>}
                </>
              )}
            </div>
          ))
        )}
      </div>

      <div className="ai-quick" role="group" aria-label="Quick questions">
        {QUICK.map((q) => (
          <button key={q.id} className="ai-quick-btn" onClick={() => ask(q.prompt, q.id)} disabled={busy}>{q.label}</button>
        ))}
      </div>
      <form className="ai-compose" onSubmit={(e) => { e.preventDefault(); ask(draft); }}>
        <textarea
          rows={2}
          value={draft}
          placeholder={apiKey ? 'Ask Claude about your code…' : 'Ask the offline helper…'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(draft); }
          }}
          aria-label="Message"
        />
        {busy ? (
          <button type="button" className="ai-send is-stop" onClick={() => streamRef.current?.abort()} aria-label="Stop answer"><Square size={13} fill="currentColor" /></button>
        ) : (
          <button type="submit" className="ai-send" disabled={!draft.trim()} aria-label="Send"><ArrowUp size={16} /></button>
        )}
      </form>
    </div>
  );
};
