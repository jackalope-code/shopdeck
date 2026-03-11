const axios = require('axios');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

async function probe(label, url, containerSel, nameSel) {
  console.log(`\n--- ${label} ---`);
  try {
    const res = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
      validateStatus: () => true,
    });
    console.log('Status:', res.status, '| Content-Type:', String(res.headers['content-type']).slice(0, 60));
    if (res.status >= 400) { console.log('BLOCKED'); return; }
    const $ = cheerio.load(res.data);
    const containers = $(containerSel);
    console.log(`Containers [${containerSel}]:`, containers.length);
    if (containers.length > 0) {
      const first = containers.first();
      console.log('First container text (100):', first.text().trim().slice(0, 100));
      if (nameSel) {
        const name = first.find(nameSel).first().text().trim();
        console.log('Name selector result:', name || '(empty)');
      }
    } else {
      // Suggest alternatives
      console.log('Actual product-like elements found:');
      ['div.product', 'article', 'li.product', '.product-item', '.product_wrapper',
       'div[class*="product"]', 'li[class*="product"]', 'div[class*="item"]'].forEach(s => {
        const n = $(s).length;
        if (n > 0) console.log(' ', s, '=', n);
      });
    }
  } catch(e) {
    console.log('ERROR:', e.message);
  }
}

async function main() {
  // Microcenter — find item containers
  console.log('\n--- Microcenter RAM deep probe ---');
  try {
    const res = await axios.get('https://www.microcenter.com/category/4294967029/memory', {
      timeout: 15000,
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
      validateStatus: () => true,
    });
    const $ = cheerio.load(res.data);
    // Print all divs with class containing 'item' and count > 3
    const candidates = {};
    $('[class]').each((_, el) => {
      const cls = $(el).attr('class') || '';
      // look for repeating containers
      const tag = el.name;
      const key = tag + '.' + cls.split(' ').filter(c => c.length > 2 && c.length < 40)[0];
      candidates[key] = (candidates[key] || 0) + 1;
    });
    const top = Object.entries(candidates).filter(([,v]) => v >= 5 && v <= 100)
      .sort((a,b) => b[1]-a[1]).slice(0, 12);
    console.log('Repeating containers (5-100 occurrences):');
    top.forEach(([k, v]) => console.log(' ', k, '=', v));

    // Also check if it's JS-rendered (no products in HTML)
    const title = $('title').text();
    console.log('Page title:', title);
    const bodyLen = res.data.length;
    console.log('Body length:', bodyLen);
  } catch(e) { console.log('ERROR:', e.message); }

  await new Promise(r => setTimeout(r, 3000));

  // TigerDirect — check what's actually on their page
  console.log('\n--- TigerDirect RAM deep probe ---');
  try {
    const res = await axios.get('https://www.tigerdirect.com/applications/SearchTools/item-list.asp?Sku=memory-ram', {
      timeout: 15000,
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
      validateStatus: () => true,
    });
    const $ = cheerio.load(res.data);
    console.log('Status:', res.status);
    console.log('Title:', $('title').text().slice(0, 80));
    console.log('Body length:', res.data.length);
    console.log('First 500 chars of body:', $('body').text().trim().slice(0, 300));
    // Check if redirected to something
    const meta = $('meta[http-equiv="refresh"]').attr('content');
    if (meta) console.log('Meta refresh:', meta);
  } catch(e) { console.log('ERROR:', e.message); }
}

main();
