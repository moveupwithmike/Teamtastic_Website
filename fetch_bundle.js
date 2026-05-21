async function main() {
  const url = 'https://teamtastic.events/assets/index-ef8sopq-.js';
  console.log(`Fetching JavaScript bundle from ${url}...`);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const js = await res.text();
    console.log(`Fetched JS bundle. Length: ${js.length} characters.`);
    
    const fs = require('fs');
    fs.writeFileSync('bundle.js', js);
    console.log('Saved bundle to bundle.js');
    
    // Let's run a simple scan over the bundle to find text related to activities, games, categories
    // For example, let's look for "activities" or game titles or arrays of objects.
    console.log('\nScanning for keywords...');
    
    // Let's search for some strings that might represent categories or games in teamtastic.
    const categories = ['trivia', 'escape', 'survey', 'music', 'creative', 'icebreaker', 'activity', 'game'];
    for (const cat of categories) {
      const regex = new RegExp(`"[^"]*?${cat}[^"]*?"`, 'gi');
      const matches = js.match(regex);
      if (matches) {
        console.log(`Found matches for ${cat}: ${matches.slice(0, 10).join(', ')}`);
      }
    }
  } catch (err) {
    console.error('Error fetching JS bundle:', err);
  }
}

main();
