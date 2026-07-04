const recommendations = {
  competitive: {
    key: "competitive",
    title: "Lightning Feud + Meme Battle",
    games: ["Lightning Feud", "What the Meme"],
    badge: "Highly Competitive & Hilarious",
    desc: "Perfect for fast-paced teams who love friendly banter, rapid survey-style trivia, and creative meme rounds.",
  },
  social: {
    key: "social",
    title: "Sound Bite Trivia + Conversation Starter",
    games: ["Sound Bite Trivia", "Tell a Fun Fact"],
    badge: "Chill & Hilarious",
    desc: "Great for social hours: guess classic sound clips and discover funny stories from your colleagues.",
  },
  collaborative: {
    key: "collaborative",
    title: "Virtual Escape Room + Drawing Masterpiece",
    games: ["Boss Raid Escape", "Canvas Co-op"],
    badge: "Brainy & Collaborative",
    desc: "Designed for logical teams that enjoy cracking codes and building creative shared masterpieces.",
  },
  icebreaker: {
    key: "icebreaker",
    title: "Rapid Fire Standup + Dynamic Icebreaker",
    games: ["Quick Buzz", "Standup Trivia"],
    badge: "Fast-Paced & Connecting",
    desc: "Spark laughter quickly with structured, low-pressure prompts and rapid-fire team challenges.",
  },
};

export function getRecommendation(vibe = "competitive") {
  return recommendations[vibe] || recommendations.competitive;
}

