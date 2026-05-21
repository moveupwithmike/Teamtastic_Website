async function main() {
  const url = 'https://teamtastic.events/activities';
  console.log(`Fetching raw HTML from ${url}...`);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    console.log(`Fetched ${html.length} characters.`);
    
    // Look for __NEXT_DATA__ or main content
    const fs = require('fs');
    fs.writeFileSync('original_activities.html', html);
    console.log('HTML saved to original_activities.html');
  } catch (err) {
    console.error('Error fetching original page:', err);
  }
}

main();
