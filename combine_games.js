const fs = require('fs');

// Read original activities (6 games)
const originalActivities = JSON.parse(fs.readFileSync('original_activities.json', 'utf8'));

// Read database games (47 game types)
const dbGames = JSON.parse(fs.readFileSync('all_game_types.json', 'utf8'));

// Unique active db games
const uniqueDbGames = {};
dbGames.forEach(g => {
  if (g.is_active && !uniqueDbGames[g.id]) {
    uniqueDbGames[g.id] = g;
  }
});

const gameList = Object.values(uniqueDbGames);

// Map database game to marketing category
function getMarketingCategory(g) {
  const cat = g.category ? g.category.toLowerCase() : "";
  const name = g.name.toLowerCase();
  const desc = g.description.toLowerCase();
  
  if (name.includes("feud") || name.includes("trivia") || cat.includes("trivia") || cat.includes("general") || name.includes("clash") || name.includes("standing") || name.includes("hot seat") || name.includes("facts")) {
    if (name.includes("lightning") || name.includes("hot seat") || name.includes("fast") || desc.includes("rapid") || desc.includes("speed")) {
      return "high-energy";
    }
    return "competitive";
  } else if (cat.includes("drawing") || cat.includes("art") || cat.includes("humor") || cat.includes("pop culture") || name.includes("meme") || name.includes("scribble") || name.includes("masterpiece") || name.includes("wrong answers") || cat.includes("visual")) {
    return "creative";
  } else if (cat.includes("puzzle") || cat.includes("logic") || name.includes("escape") || name.includes("link") || name.includes("bottle") || name.includes("rebus") || name.includes("out") || name.includes("difference")) {
    return "collaborative";
  } else {
    return "chill";
  }
}

// Convert string id to slug (hyphens instead of underscores)
function toSlug(id) {
  return id.toLowerCase().replace(/_/g, '-');
}

// Build unified games pool
const combined = [];

// 1. Add original activities first, with high priority details
originalActivities.forEach(og => {
  combined.push({
    id: og.id,
    slug: og.slug,
    title: og.title,
    tagline: og.tagline,
    description: og.tagline + " " + (og.includes ? og.includes.join(". ") : ""),
    category: og.vibe && og.vibe[0] ? og.vibe[0].toLowerCase().replace(' ', '-') : "collaborative",
    heroColor: og.heroColor || "#7c3aed",
    players: `${og.teamSizeMin} - ${og.teamSizeMax}+`,
    time: `${og.durationMinutes} min`,
    vibe: og.vibe ? og.vibe.join(" & ") : "Fun & Engaging",
    skill: "Team Synergy",
    badge: og.vibe && og.vibe[0] ? og.vibe[0] : "B2B Favorite",
    includes: og.includes || [],
    howToPlay: og.howItWorks ? og.howItWorks.map((step, i) => ({ step: String(i+1), title: step, desc: step })) : [],
    testimonials: og.testimonials || [],
    faqs: og.faqs || [],
    isOriginal: true
  });
});

// 2. Add database games
gameList.forEach(g => {
  const slug = toSlug(g.id);
  
  // Skip if already added as an original
  if (combined.some(c => c.slug === slug)) {
    return;
  }
  
  const mCategory = getMarketingCategory(g);
  
  // Set nice color hex based on color name
  let hexColor = "#8B5CF6"; // default purple
  if (g.color) {
    const c = g.color.toLowerCase();
    if (c === "green") hexColor = "#10B981";
    else if (c === "blue") hexColor = "#3B82F6";
    else if (c === "red") hexColor = "#EF4444";
    else if (c === "orange") hexColor = "#F59E0B";
    else if (c === "pink") hexColor = "#EC4899";
    else if (c === "indigo") hexColor = "#6366F1";
    else if (c === "violet") hexColor = "#8B5CF6";
    else if (c === "emerald") hexColor = "#059669";
    else if (c === "amber") hexColor = "#F59E0B";
    else if (c === "cyan") hexColor = "#06B6D4";
    else if (c.startsWith("#")) hexColor = g.color;
  }
  
  // Format nice badge and vibes based on category
  let badge = "Arcade Live";
  let vibe = "Casual & Playful";
  let skill = "Quick Thinking";
  
  if (mCategory === "high-energy") {
    badge = "Fast-Paced";
    vibe = "Electric & Energetic";
    skill = "Speed Recognition";
  } else if (mCategory === "competitive") {
    badge = "Pure Battle";
    vibe = "Challenging & Competitive";
    skill = "General Knowledge";
  } else if (mCategory === "creative") {
    badge = "Imagination";
    vibe = "Laugh-Out-Loud Banter";
    skill = "Out-Of-The-Box";
  } else if (mCategory === "collaborative") {
    badge = "Cooperative";
    vibe = "Puzzle & Team Solving";
    skill = "Logical Deduction";
  }
  
  combined.push({
    id: g.id,
    slug: slug,
    title: g.name,
    tagline: g.description,
    description: g.description + " A premium interactive " + mCategory + " experience custom-tailored for professional corporate team-building. Playable in seconds directly in any modern desktop or mobile browser.",
    category: mCategory,
    heroColor: hexColor,
    players: "4 - 250+",
    time: "15 - 45 min",
    vibe: vibe,
    skill: skill,
    badge: badge,
    includes: [
      "No-download mobile controllers",
      "Live spectator scoreboard",
      "Custom question pack options"
    ],
    howToPlay: [
      { step: "1", title: "Join the Room", desc: "Scan the QR code or click the invite link on your phone. No logins needed." },
      { step: "2", title: "Compete & Laugh", desc: "Submit answers, vote on memes, or solve puzzles together under a live countdown timer." },
      { step: "3", title: "Crown the Champion", desc: "Celebrate with dynamic leaderboard animations, confetti showers, and team awards." }
    ],
    testimonials: [
      {
        quote: "Our remote engineering squad plays this during virtual socials and it is a massive hit!",
        name: "Jessica Miller",
        "role": "VP of Engineering"
      }
    ],
    faqs: [
      { q: "Is any software installation required?", a: "No! It is 100% browser-based. All players need is a smartphone or browser." },
      { q: "Can we run this inside Zoom or MS Teams?", a: "Absolutely! Just screen share the live host stage and let players scan the QR code to join." }
    ],
    isOriginal: false
  });
});

console.log("Combined games count:", combined.length);
fs.writeFileSync('combined_games.json', JSON.stringify(combined, null, 2));
console.log("Wrote combined games to combined_games.json");
