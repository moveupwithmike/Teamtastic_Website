const fs = require('fs');
const js = fs.readFileSync('bundle.js', 'utf8');

const startIndex = js.indexOf('const mg=[');
if (startIndex === -1) {
  console.error("Could not find 'const mg=[' in bundle.js");
  process.exit(1);
}

// Let's parse the array by finding matching brackets
let bracketCount = 1;
let index = startIndex + 'const mg=['.length;
let result = '[';

while (index < js.length && bracketCount > 0) {
  const char = js[index];
  result += char;
  
  if (char === '[') {
    bracketCount++;
  } else if (char === ']') {
    bracketCount--;
  }
  
  index++;
}

console.log("Extracted raw array string length:", result.length);

// Let's write the raw array string
fs.writeFileSync('original_activities_raw.json', result);
console.log("Wrote raw array to original_activities_raw.json");

// Let's try to evaluate it in node to get a real JS object
try {
  const activities = eval(result);
  fs.writeFileSync('original_activities.json', JSON.stringify(activities, null, 2));
  console.log("Successfully evaluated and wrote to original_activities.json. Game count:", activities.length);
} catch (err) {
  console.error("Could not evaluate raw string directly. Writing as js file to parse.");
  const jsContent = `module.exports = ${result};`;
  fs.writeFileSync('original_activities_eval.js', jsContent);
  try {
    const activities = require('./original_activities_eval.js');
    fs.writeFileSync('original_activities.json', JSON.stringify(activities, null, 2));
    console.log("Successfully required and wrote to original_activities.json. Game count:", activities.length);
  } catch (requireErr) {
    console.error("Error requiring:', requireErr");
  }
}
