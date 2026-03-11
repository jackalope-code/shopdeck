const axios = require('axios');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

async function main() {
  const res = await axios.get('https://www.microcenter.com/category/4294967029/memory', {
    timeout: 15000,
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
  });
  const html = res.data;

  // Find the raw context around the DDR product we saw before
  const idx = html.indexOf('data-name="');
  if (idx < 0) { console.log('No data-name found'); return; }

  // Print 200 chars before and 600 chars after
  const snippet = html.slice(Math.max(0, idx - 200), idx + 800);
  console.log('=== Context around data-name ===');
  console.log(snippet);
}

main().catch(e => console.error(e.message));
