const fs = require('fs');
const js = fs.readFileSync('bundle.js', 'utf8');

console.log('--- Searching for activity data structures in the bundle ---');

// Let's look for objects that have properties like: slug, title, category, image
// We can use a regex to find occurrences of properties.
// In Vite/React builds, arrays of activities are often defined as static arrays of objects.
// Let's find patterns like {slug:"...", or title:"...", or id:"..."
const activityPattern = /\{\s*id\s*:\s*[^,]+,\s*title\s*:\s*["'][^"']+["'],\s*slug\s*:\s*["'][^"']+["']/gi;
const matches = js.match(activityPattern);
if (matches) {
  console.log(`Found matches with simple regex:`, matches);
}

// Let's search for the word "slug" and see the surrounding code
const index = js.indexOf('slug:');
if (index !== -1) {
  console.log('Surrounding "slug:":', js.substring(index - 200, index + 800));
}

// Let's search for "activities" in more detail
const activitiesRegex = /activities\s*=\s*\[([\s\S]*?)\]/gi;
const actMatches = js.match(activitiesRegex);
if (actMatches) {
  console.log('Found activities list:', actMatches);
}

// Let's scan for any text in double quotes that contains "/activities/"
const urlMatches = js.match(/"\/activities\/[^"]+?"/g);
if (urlMatches) {
  console.log('Found activity URLs:', [...new Set(urlMatches)]);
}

// Let's search for all slugs that are in the bundle.
// Usually, we can look for strings like: "survey-showdown", "lightning-feud", "meme-battle", "sound-bite-trivia", etc.
// Are there other slugs? Let's check for "escape", "scavenger", etc.
const keywords = ['survey', 'feud', 'meme', 'trivia', 'escape', 'scavenger', 'pictionary', 'bingo', 'casino', 'mystery', 'cooking', 'mixology', 'drawing'];
const foundSlugs = [];
for (const kw of keywords) {
  const re = new RegExp(`"([^"]*?${kw}[^"]*?)"`, 'gi');
  let m;
  while ((m = re.exec(js)) !== null) {
    if (m[1].startsWith('/') || m[1].length < 30) {
      foundSlugs.push(m[1]);
    }
  }
}
console.log('Found keywords/slugs/titles:', [...new Set(foundSlugs)].slice(0, 50));
