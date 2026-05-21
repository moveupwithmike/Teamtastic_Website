const fs = require('fs');
const html = fs.readFileSync('original_activities.html', 'utf8');

console.log('--- HTML length: ---', html.length);
// Print all script tags
const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
const scriptSrcRegex = /<script[^>]+src="([^"]+)"[^>]*>/gi;

console.log('\n--- Script tags with inline content: ---');
let match;
while ((match = scriptRegex.exec(html)) !== null) {
  const content = match[1].trim();
  if (content.length > 0) {
    console.log(`Script (inline, ${content.length} chars):`, content.substring(0, 300) + '...');
  }
}

console.log('\n--- Script tags with src: ---');
while ((match = scriptSrcRegex.exec(html)) !== null) {
  console.log(`Script src: ${match[1]}`);
}

// Let's print the entire raw HTML to understand its structure
fs.writeFileSync('html_structure.txt', html);
console.log('Saved html structure.');
