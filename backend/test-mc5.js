const axios = require('axios');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

async function main() {
  const res = await axios.get('https://www.microcenter.com/category/4294967029/memory', {
    timeout: 15000,
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
  });
  const $ = cheerio.load(res.data);

  const results = [];
  $('a.productClickItemV2').each((_, el) => {
    const $el = $(el);
    const name = $el.attr('data-name');
    const price = $el.attr('data-price');
    let url = $el.attr('href') || '';
    if (url && url.startsWith('/')) url = 'https://www.microcenter.com' + url;
    const image = $el.find('img.img-100').attr('src');
    if (name) results.push({ name, price, url, image });
  });

  console.log('Total products found:', results.length);
  results.slice(0, 5).forEach((r, i) => {
    console.log(`\n[${i}]`, r.name);
    console.log('  price:', r.price);
    console.log('  url:', (r.url || '').slice(0, 80));
    console.log('  image:', (r.image || '').slice(0, 80));
  });
}

main().catch(e => console.error('FATAL:', e.message));
