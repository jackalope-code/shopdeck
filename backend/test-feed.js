const http = require('http');

function req(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 4000,
      path,
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { resolve({ _raw: d }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function main() {
  // 1. Get developer token
  const auth = await req('POST', '/api/auth/developer', {}, {});
  if (!auth.token) {
    console.log('AUTH FAILED:', JSON.stringify(auth));
    return;
  }
  console.log('Token OK');

  const headers = { Authorization: 'Bearer ' + auth.token };

  function printSources(label, data) {
    console.log('\n=== ' + label + ' ===');
    if (data.error) { console.log('TOP ERROR:', data.error); return; }
    console.log('cached:', data.cached, '| at:', data.at);
    const sources = data.sources || {};
    const ids = Object.keys(sources);
    if (!ids.length) { console.log('  (no sources returned — check widget config)'); return; }
    for (const [id, s] of Object.entries(sources)) {
      const items = (s.data || []).length;
      const err = s.error || 'none';
      console.log('  ' + id + ': ' + items + ' items | err: ' + err);
      if (items > 0) console.log('    sample:', JSON.stringify(s.data[0]).slice(0, 140));
    }
  }

  // 2. Test RAM feed
  const ram = await req('GET', '/api/feed-config/data/ram-availability', null, headers);
  printSources('RAM AVAILABILITY', ram);

  // 3. Test GPU feed
  const gpu = await req('GET', '/api/feed-config/data/gpu-availability', null, headers);
  printSources('GPU AVAILABILITY', gpu);

  // 4. Test keyboard-releases feed
  const kr = await req('GET', '/api/feed-config/data/keyboard-releases', null, headers);
  printSources('KEYBOARD RELEASES', kr);

  // 5. Test keyboard-sales feed
  const ks = await req('GET', '/api/feed-config/data/keyboard-sales', null, headers);
  printSources('KEYBOARD SALES', ks);

  // 6. Test drops feed
  const drops = await req('GET', '/api/feed-config/data/drops', null, headers);
  printSources('DROPS', drops);
}

main().catch(e => console.error('FATAL:', e));
