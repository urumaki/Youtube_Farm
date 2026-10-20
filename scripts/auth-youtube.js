// One-time authorization: get a refresh token for your YouTube channel (upload, playlist + analytics scopes).
// Run on your own computer: `npm run auth:youtube` (add `-- --save` to write it into .env).
// Needs YT_OAUTH_CLIENT_ID and YT_OAUTH_CLIENT_SECRET (OAuth client of type "Desktop app") in .env.
// The token is printed only in your terminal; never paste it into chats or commit it.
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { loadEnv } from './env.js';

loadEnv();
const save = process.argv.includes('--save');
const clientId = process.env.YT_OAUTH_CLIENT_ID, clientSecret = process.env.YT_OAUTH_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Set YT_OAUTH_CLIENT_ID and YT_OAUTH_CLIENT_SECRET in .env first (Google Cloud → Credentials → OAuth client ID → Desktop app).');
  process.exit(1);
}
// youtube: adding each new Short to the channel's playlist (YT_PLAYLIST_ID)
const scopes = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube', 'https://www.googleapis.com/auth/yt-analytics.readonly'];
const verifier = crypto.randomBytes(48).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
const stateParam = crypto.randomBytes(16).toString('hex');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname !== '/') { res.writeHead(404).end(); return; }
  const code = url.searchParams.get('code');
  if (url.searchParams.get('state') !== stateParam || !code) {
    res.end(`Authorization failed: ${url.searchParams.get('error') || 'bad state'}`);
    return finish(1, 'Authorization failed or was cancelled.');
  }
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verifier }),
    });
    const body = await r.json();
    if (!body.refresh_token) throw new Error(JSON.stringify(body));
    res.end('Done. You can close this tab and go back to the terminal.');
    if (save) {
      const file = '.env';
      let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      text = /^YT_OAUTH_REFRESH_TOKEN=.*$/m.test(text) ? text.replace(/^YT_OAUTH_REFRESH_TOKEN=.*$/m, `YT_OAUTH_REFRESH_TOKEN=${body.refresh_token}`) : `${text.replace(/\n?$/, '\n')}YT_OAUTH_REFRESH_TOKEN=${body.refresh_token}\n`;
      fs.writeFileSync(file, text);
      finish(0, 'Refresh token saved to .env as YT_OAUTH_REFRESH_TOKEN. Copy the same value into the GitHub secret YT_OAUTH_REFRESH_TOKEN.');
    } else {
      finish(0, `\nYT_OAUTH_REFRESH_TOKEN=${body.refresh_token}\n\nPut it in .env and in the GitHub secret YT_OAUTH_REFRESH_TOKEN.`);
    }
  } catch (e) {
    res.end('Token exchange failed, see the terminal.');
    finish(1, `Token exchange failed: ${e.message}`);
  }
});

let redirect;
function finish(code, msg) {
  (code ? console.error : console.log)(msg);
  server.close();
  process.exitCode = code;
}

server.listen(0, '127.0.0.1', () => {
  redirect = `http://127.0.0.1:${server.address().port}`;
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.search = new URLSearchParams({
    client_id: clientId, redirect_uri: redirect, response_type: 'code', scope: scopes.join(' '),
    access_type: 'offline', prompt: 'consent', state: stateParam, code_challenge: challenge, code_challenge_method: 'S256',
  });
  console.log('Open this URL and sign in with the account that owns the channel (pick the Subscriber Kingdom channel):\n');
  console.log(auth.toString() + '\n');
  // not `cmd /c start`: cmd cuts the URL at the first '&' (Google then reports a missing response_type)
  const opener = process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', auth.toString()]] : process.platform === 'darwin' ? ['open', [auth.toString()]] : ['xdg-open', [auth.toString()]];
  try { spawn(opener[0], opener[1], { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch { /* print only */ }
});
