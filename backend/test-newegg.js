const axios = require('axios');

const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

async function testNewegg(keywords, categoryId) {
  const params = new URLSearchParams({ keyword: keywords, pageSize: '20', pageIndex: '1' });
  if (categoryId) params.set('N', categoryId);
  const url = `https://www.newegg.com/p/pl?${params.toString()}&ajax=1`;
  console.log('URL:', url);

  try {
    const res = await axios.get(url, {
      timeout: 15000,
      responseType: 'text',   // get raw text first to see what's returned
      headers: {
        'User-Agent': UAS[0],
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'application/json, text/plain, */*',
        'Cache-Control': 'no-cache',
        'Referer': 'https://www.newegg.com/',
      },
    });
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers['content-type']);
    const raw = String(res.data).slice(0, 500);
    console.log('Body preview:', raw);

    // Try to parse as JSON
    try {
      const json = JSON.parse(res.data);
      const keys = Object.keys(json);
      console.log('JSON keys:', keys);
      const products = json?.Filters?.ProductList ?? json?.ProductList ?? json?.SearchResult?.Items ?? [];
      console.log('Products found via standard paths:', products.length);
      if (products.length === 0) {
        console.log('Checking nested keys...');
        // Try to find arrays recursively one level deep
        for (const k of keys) {
          if (Array.isArray(json[k])) console.log(' ', k, '[] len=', json[k].length);
          else if (json[k] && typeof json[k] === 'object') {
            for (const k2 of Object.keys(json[k])) {
              if (Array.isArray(json[k][k2])) console.log(' ', k + '.' + k2, '[] len=', json[k][k2].length);
            }
          }
        }
      }
    } catch (e) {
      console.log('Not JSON — probably HTML/redirect. First 200 chars:', raw.slice(0, 200));
    }
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}

async function main() {
  console.log('\n--- Newegg RAM no category ---');
  await testNewegg('DDR4 RAM memory', null);

  await new Promise(r => setTimeout(r, 3000));

  console.log('\n--- Newegg RAM with N ---');
  await testNewegg('DDR4 RAM', '17-341');

  await new Promise(r => setTimeout(r, 3000));

  // Try Newegg's actual category URL directly
  console.log('\n--- Newegg direct category URL ---');
  try {
    const res = await axios.get('https://www.newegg.com/Desktop-Memory/SubCategory/ID-147?ajax=1', {
      timeout: 15000,
      responseType: 'text',
      headers: {
        'User-Agent': UAS[0],
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.newegg.com/',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    console.log('Status:', res.status, '| Content-Type:', res.headers['content-type']);
    console.log('Body preview:', String(res.data).slice(0, 300));
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}

main();
