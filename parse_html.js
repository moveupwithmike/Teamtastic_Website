const fs = require('fs');
const html = fs.readFileSync('original_activities.html', 'utf8');

console.log('--- Printing Headings & Links found in the HTML ---');
// Match all headings <h1>, <h2>, <h3>, <h4>
const headingRegex = /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi;
let match;
while ((match = headingRegex.exec(html)) !== null) {
  console.log(`Heading: ${match[1].replace(/<[^>]*>/g, '').trim()}`);
}

console.log('\n--- Printing meta tags and scripting contexts ---');
// Match page titles and other elements
const titleRegex = /<title[^>]*>([\s\S]*?)<\/title>/gi;
const titleMatch = titleRegex.exec(html);
if (titleMatch) {
  console.log(`Title: ${titleMatch[1].trim()}`);
}

// Let's also write a script to look for links that look like activities or games
const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
console.log('\n--- Links: ---');
while ((match = linkRegex.exec(html)) !== null) {
  const href = match[1];
  const text = match[2].replace(/<[^>]*>/g, '').trim();
  if (href.includes('activities') || href.includes('games') || text.length > 0) {
    console.log(`Link: ${text} -> ${href}`);
  }
}
