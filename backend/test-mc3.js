const axios = require('axios');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

async function main() {
  const res = await axios.get('https://www.microcenter.com/category/4294967029/memory', {
    timeout: 15000,
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
  });
  const $ = cheerio.load(res.data);

  // Find elements with data-price + data-name
  const withPrice = $('[data-price][data-name]');
  console.log('Elements with data-price+data-name:', withPrice.length);
  withPrice.slice(0, 3).each((i, el) => {
    const $el = $(el);
    console.log(`\n[${i}] tag=${el.name} class="${$el.attr('class')}"`);
    console.log('  name:', $el.attr('data-name'));
    console.log('  price:', $el.attr('data-price'));
    console.log('  id:', $el.attr('data-id'));
    // Check for image and link in/around this element
    const img = $el.find('img').first().attr('src') || $el.parent().find('img').first().attr('src');
    const link = $el.attr('href') || $el.find('a').first().attr('href') || $el.parent().find('a').first().attr('href');
    console.log('  img:', img);
    console.log('  link:', link);
  });

  // Also check for a wrapping li/article
  const productItems = $('[data-id][data-price]');
  console.log('\nElements with data-id+data-price:', productItems.length);
  if (productItems.length > 0) {
    const first = productItems.first();
    console.log('First element:', first[0].name, '| class:', first.attr('class'));
    // Walk up to find product container
    let el = first;
    for (let i = 0; i < 5; i++) {
      el = el.parent();
      if (!el || !el[0]) break;
      console.log(`  parent[${i}]:`, el[0].name, '| class:', (el.attr('class') || '').slice(0, 60));
    }
  }
}

main().catch(e => console.error('FATAL:', e.message));
