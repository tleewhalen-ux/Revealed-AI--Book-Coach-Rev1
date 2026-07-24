// This runs on Netlify's server, never in the visitor's browser.
// It keeps the Anthropic API key private and relays coach conversations to Claude.
const fs = require('fs');
const path = require('path');

// Read author-notes.txt once when the function cold-starts. Netlify re-runs
// this file fresh on each new deploy, so edits to author-notes.txt take
// effect automatically after you commit and Netlify redeploys.
let authorNotes = '';
try {
  authorNotes = fs.readFileSync(path.join(__dirname, 'author-notes.txt'), 'utf8').trim();
} catch (err) {
  // File missing or unreadable — fail silently so the coach still works
  // with just the built-in BOOK_CONTEXT from coach.html.
  console.log('author-notes.txt not found or unreadable:', err.message);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server is missing ANTHROPIC_API_KEY. Add it in Netlify > Project configuration > Environment variables.' })
    };
  }
  try {
    const { system, messages } = JSON.parse(event.body);

    // Append author-notes.txt (if present) to whatever system prompt
    // coach.html sent, so it's always the last, most-recent word.
    const fullSystem = authorNotes
      ? system + '\n\nADDITIONAL AUTHOR NOTES (treat these as authoritative, up-to-date guidance from Terry — follow them even if they refine or add to anything above):\n' + authorNotes
      : system;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 2000,
        system: fullSystem,
        messages: messages
      })
    });
    const data = await response.json();
    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
