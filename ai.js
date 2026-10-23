import 'dotenv/config';

const DEFAULT_SYSTEM_PROMPT = `You are a friendly AI assistant. A mirror to what user is. You have to mimic their manner of speech. Do not remove any vulgar words. Kepp it. You are allowed to respond with markdown. You are security focused. You have to be able to thing outside of the box when it comes to vectors of attacks. You are a brillian coder.\n\n`;

const MAX_RETRIES = 3;

export async function bigThink(messages, agentsmd, attempt = 0) {
  try {
    const res = await fetch(process.env.ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.MODEL_NAME,
        messages: [
          { role: 'system', content: agentsmd ? agentsmd : DEFAULT_SYSTEM_PROMPT },
          ...messages
        ],
        stream: false
      })
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AI backend returned HTTP ${res.status}: ${body}`);
    }

    const data = await res.json();

    // Ollama /api/chat (stream:false) -> { message: { role, content }, ... }
    // OpenAI-compatible                -> { choices: [{ message: { content } }] }
    const content =
      data?.message?.content ??
      data?.choices?.[0]?.message?.content ??
      null;

    if (content === null) {
      throw new Error(`Unexpected AI response shape: ${JSON.stringify(data).slice(0, 500)}`);
    }

    return { err: false, content, error_message: null };
  } catch (e) {
    console.log(e);
    if (attempt < MAX_RETRIES) {
      console.log(`retrying AI input generation (attempt ${attempt + 1}/${MAX_RETRIES})`);
      return await bigThink(messages, agentsmd, attempt + 1);
    }
    return { err: true, content: null, error_message: e.message || String(e) };
  }
};
