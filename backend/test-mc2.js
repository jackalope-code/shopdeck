const axios = require('axios');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

async function main() {
  const res = await axios.get('https://www.microcenter.com/category/4294967029/memory', {
    timeout: 15000,
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
  });
  const html = res.data;
  const $ = cheerio.load(html);

  // Check __NEXT_DATA__
  const nextData = $('script#__NEXT_DATA__').html();
  if (nextData) {
    try {
      const parsed = JSON.parse(nextData);
      console.log('Found __NEXT_DATA__! Top keys:', Object.keys(parsed));
      const props = parsed?.props?.pageProps;
      if (props) console.log('pageProps keys:', Object.keys(props).slice(0, 15));
      // Look for products array
      const str = JSON.stringify(parsed);
      const productIdx = str.indexOf('"price"');
      if (productIdx > 0) {
        console.log('Has "price" field at idx', productIdx);
        console.log('Context around price:', str.slice(Math.max(0, productIdx-100), productIdx+200));
      }
    } catch(e) { console.log('Parse error:', e.message); }
  } else {
    console.log('No __NEXT_DATA__ found');
  }

  // Check JSON-LD
  const jsonLds = $('script[type="application/ld+json"]').map((_, el) => $(el).html()).get();
  console.log('\nJSON-LD scripts found:', jsonLds.length);
  jsonLds.forEach((s, i) => {
    try {
      const o = JSON.parse(s);
      console.log(`JSON-LD[${i}] type:`, o['@type'], '| keys:', Object.keys(o).slice(0, 8));
    } catch(e) {}
  });

  // Look for any script with product arrays
  const scripts = $('script:not([src])').map((_, el) => $(el).html() || '').get();
  console.log('\nInline scripts count:', scripts.length);
  const prodScript = scripts.find(s => /\bsku\b|\bSKU\b|\bproductList\b|\bproducts\b/.test(s) && s.length > 500);
  if (prodScript) {
    console.log('Possible product script (first 400):', prodScript.slice(0, 400));
  }

  // Raw HTML snippet around "memory" products
  const idx = html.indexOf('"inStock"');
  if (idx > 0) console.log('\ninStock context:', html.slice(Math.max(0,idx-50), idx+300));
  else {
    const idx2 = html.indexOf('DDR');
    if (idx2 > 0) console.log('\nDDR context:', html.slice(Math.max(0,idx2-100), idx2+300));
    else console.log('\nNo "inStock" or "DDR" found in HTML');
  }
}

main().catch(e => console.error('FATAL:', e.message));
