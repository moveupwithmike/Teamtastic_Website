const fs = require('fs');
const games = JSON.parse(fs.readFileSync('all_game_types.json', 'utf8'));

// Find unique active games
const uniqueGames = {};
games.forEach(g => {
  if (g.is_active && !uniqueGames[g.id]) {
    uniqueGames[g.id] = g;
  }
});

const gameList = Object.values(uniqueGames);
console.log("Total unique active games:", gameList.length);

// Let's print out the categories we find in these games
const categories = {};
gameList.forEach(g => {
  categories[g.category] = (categories[g.category] || 0) + 1;
});
console.log("Existing database categories:", categories);

// Now let's map these games to the 5 marketing categories:
// 1. High Energy
// 2. Competitive
// 3. Creative
// 4. Collaborative
// 5. Chill

// Let's write a categorizer
const categorized = {
  "high-energy": [],
  "competitive": [],
  "creative": [],
  "collaborative": [],
  "chill": []
};

gameList.forEach(g => {
  const cat = g.category ? g.category.toLowerCase() : "";
  const name = g.name.toLowerCase();
  const desc = g.description.toLowerCase();
  
  let target = "chill";
  
  if (name.includes("feud") || name.includes("trivia") || cat.includes("trivia") || cat.includes("general") || name.includes("clash") || name.includes("standing") || name.includes("hot seat") || name.includes("facts")) {
    target = "competitive";
    if (name.includes("lightning") || name.includes("hot seat") || name.includes("fast") || desc.includes("rapid") || desc.includes("speed")) {
      target = "high-energy";
    }
  } else if (cat.includes("drawing") || cat.includes("art") || cat.includes("humor") || cat.includes("pop culture") || name.includes("meme") || name.includes("scribble") || name.includes("masterpiece") || name.includes("wrong answers") || cat.includes("visual")) {
    target = "creative";
  } else if (cat.includes("puzzle") || cat.includes("logic") || name.includes("escape") || name.includes("link") || name.includes("bottle") || name.includes("rebus") || name.includes("out") || name.includes("difference")) {
    target = "collaborative";
  } else if (cat.includes("party") || cat.includes("social") || cat.includes("memory") || cat.includes("luck") || cat.includes("music") || cat.includes("audio") || name.includes("bingo") || name.includes("selfie") || name.includes("wheel") || name.includes("tune") || name.includes("lane") || name.includes("camp")) {
    target = "chill";
  }
  
  categorized[target].push({
    id: g.id,
    name: g.name,
    description: g.description,
    category: g.category,
    icon: g.icon,
    color: g.color
  });
});

console.log("Categorization breakdown:");
Object.keys(categorized).forEach(c => {
  console.log(`- ${c}: ${categorized[c].length} games`);
});

fs.writeFileSync('categorized_games.json', JSON.stringify(categorized, null, 2));
console.log("Wrote categorized games to categorized_games.json");
