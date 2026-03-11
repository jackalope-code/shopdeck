const axios = require('axios');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

async function main() {
  // Check if Microcenter has a search/category API endpoint
  const endpoints = [
    'https://www.microcenter.com/search/search_results.aspx?N=4294967029&NTT=&page=1&paging_mode=1',
    'https://www.microcenter.com/search/search_results.aspx?Ntk=all&N=4294967029&sortby=1&custcol_0=0&mystore=false',
    'https://www.microcenter.com/category/4294967029/memory?page=1',
  ];

  for (const url of endpoints) {
    console.log('\nTrying:', url.slice(0, 80));
    try {
      const res = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': UA,
          'Accept': 'text/html,application/json,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        validateStatus: () => true,
      });
      console.log('Status:', res.status, '| Length:', String(res.data).length);
      const ct = res.headers['content-type'] || '';
      console.log('Content-Type:', ct.slice(0, 50));
      if (res.status === 200) {
        const $ = cheerio.load(res.data);
        // Check for product grid in JSON embedded in page
        const scripts = $('script').map((_, el) => $(el).html() || '').get();
        const productScript = scripts.find(s => s.includes('"price"') || s.includes('"Price"') || s.includes('productList'));
        if (productScript) {
          console.log('Found embedded product data! Snippet:', productScript.slice(0, 200));
        }
        // Look for product containers
        ['#product-list li', 'ul#productGrid li', '.product-grid li',
         'li[data-id]', 'div[data-sku]', '.product', 'li.product'].forEach(s => {
          const n = $(s).length;
          if (n > 0) console.log(' Selector', s, '=', n);
        });
      }
    } catch(e) {
      console.log('ERROR:', e.message);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
}

main();
