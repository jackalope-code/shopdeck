const axios = require('axios');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

async function main() {
  const res = await axios.get('https://www.microcenter.com/category/4294967029/memory', {
    timeout: 15000,
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
  });
  const html = res.data;

  // Is the data-name attribute inside a script block (serialized HTML)?
  const allDataNameIdx = [];
  let pos = 0;
  while (true) {
    const i = html.indexOf('data-name=', pos);
    if (i < 0) break;
    allDataNameIdx.push(i);
    pos = i + 1;
  }
  console.log('Total occurrences of data-name=:', allDataNameIdx.length);

  // Check what tag contains the first one
  allDataNameIdx.slice(0, 3).forEach(idx => {
    // Find the opening < before this attribute
    let start = idx;
    while (start > 0 && html[start] !== '<') start--;
    const snippet = html.slice(start, start + 200);
    console.log('\nContext:');
    console.log(snippet.slice(0, 200));
    // Check if it's inside a script block
    const scriptStart = html.lastIndexOf('<script', idx);
    const scriptEnd = html.lastIndexOf('</script>', idx);
    const isInScript = scriptStart > scriptEnd;
    console.log('Inside <script>?', isInScript);
  });

  // Check for any product-like patterns in non-script HTML
  const $ = cheerio.load(html);
  console.log('\n\nAll anchor hrefs matching /product/:');
  const productLinks = $('a[href*="/product/"]');
  console.log('Count:', productLinks.length);
  productLinks.slice(0, 3).each((i, el) => {
    const $el = $(el);
    console.log(`[${i}] href: ${$el.attr('href')}`);
    console.log(`     class: ${$el.attr('class')}`);
    console.log(`     text: ${$el.text().trim().slice(0, 80)}`);
    // All attributes
    const attrs = el.attribs;
    const interesting = Object.entries(attrs).filter(([k]) => k.startsWith('data-'));
    console.log(`     data-attrs: ${JSON.stringify(interesting)}`);
  });
}

main().catch(e => console.error('FATAL:', e.message));
