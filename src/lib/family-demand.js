export const FAMILY_OCCASIONS = {
  reunion: {
    slug: "virtual-family-reunion-game-show",
    eyebrow: "A reunion everyone can join",
    title: "Virtual Family Reunion Game Show",
    accent: "Bring every generation into the same room.",
    description: "A live host turns your family reunion into an easy, energetic online game show—with custom stories, friendly competition, and no relative stuck running the event.",
    metaDescription: "Host a live virtual family reunion game show with custom trivia, all-ages games, a professional emcee, and no downloads. From $35 per person.",
    image: "/family-occasion-reunion.png",
    imageAlt: "A family laughing together during an online reunion game show",
    occasion: "reunion",
    entryPoint: "family_reunion_money_page",
    intro: "Ideal for families spread across cities, countries, or time zones. We keep the pace moving while making space for the stories and people that make your family unique.",
    benefits: [
      "A professional host runs the entire experience",
      "Questions can include family history and favorite memories",
      "Kids, parents, grandparents, and cousins can play together",
      "Everyone joins from a normal web browser—no downloads",
    ],
    games: [
      ["Family Feud-style showdown", "Teams guess the family’s most popular answers."],
      ["Generations Battle", "Music, movies, sayings, and moments from different decades."],
      ["Family Story Trivia", "Turn approved memories and traditions into personalized questions."],
    ],
    examples: [
      "Which family recipe disappears first at every gathering?",
      "Who has traveled the farthest to join this reunion?",
      "Which decade produced the family’s favorite songs?",
    ],
    faqs: [
      ["Can older relatives participate?", "Yes. Players use a simple browser link, and we adjust the pace, question style, and instructions for the ages in your group."],
      ["Can relatives join from different countries?", "Yes. We help you choose a practical time and everyone can join from their own computer, tablet, or phone."],
      ["Do we have to provide family stories?", "No. We can run a complete show without private details. Custom stories and photos are optional and only used with your permission."],
      ["How many people can join?", "We support small reunions and large extended families. Tell us the number of players and households, and we will recommend the best format."],
    ],
  },
  birthday: {
    slug: "virtual-birthday-game-show",
    eyebrow: "A birthday show built around your guest of honor",
    title: "Virtual Birthday Game Show",
    accent: "More laughs than another group video call.",
    description: "Celebrate together from anywhere with a live-hosted birthday game show, personalized challenges, music, trivia, and a proper birthday finale.",
    metaDescription: "Plan a live virtual birthday game show with a professional host, custom trivia, music, and games for adults or mixed ages. From $35 per person.",
    image: "/family-occasion-birthday.png",
    imageAlt: "Friends and family celebrating a birthday together online",
    occasion: "birthday",
    entryPoint: "family_birthday_money_page",
    intro: "We handle the timing, teams, scoring, and energy so the birthday person gets to enjoy the party instead of managing it.",
    benefits: [
      "Built for adult birthdays, family birthdays, or mixed ages",
      "Custom questions can celebrate the guest of honor",
      "A live emcee keeps every household involved",
      "No game installation or participant account required",
    ],
    games: [
      ["Birthday Spotlight", "Guests compete in challenges inspired by the guest of honor."],
      ["Name That Tune", "Fast music rounds customized to favorite decades and styles."],
      ["Survey Showdown", "Friendly team competition with funny birthday prompts."],
    ],
    examples: [
      "What phrase does the birthday person say most often?",
      "Which song would get them onto the dance floor immediately?",
      "Who has known the guest of honor the longest?",
    ],
    faqs: [
      ["Is this only for children’s birthdays?", "No. The show is especially effective for adult birthdays and family groups. We adjust the content and energy for your guests."],
      ["Can we surprise the birthday person?", "Yes. A family member or friend can provide the approved details while we keep the custom content private until the event."],
      ["Can guests play from different homes?", "Yes. Every household joins the shared video call and opens the game in a browser."],
      ["Can you include photos?", "Yes. Approved photos can be included in selected custom rounds. We will explain exactly what to send after the date is reserved."],
    ],
  },
  distance: {
    slug: "long-distance-family-game-night",
    eyebrow: "Family time without the travel",
    title: "Long-Distance Family Game Night",
    accent: "Feel together, even when you live far apart.",
    description: "Replace the awkward family video call with a live-hosted game night that gives everyone something fun to do, talk about, and remember.",
    metaDescription: "Bring long-distance family together for a live online game night with an emcee, trivia, bingo, music, and all-ages games. No downloads required.",
    image: "/family-occasion-distance.png",
    imageAlt: "Long-distance family members smiling during a virtual game night",
    occasion: "long-distance",
    entryPoint: "long_distance_family_money_page",
    intro: "Perfect for families who want meaningful time together without asking one relative to prepare questions, explain rules, or keep score.",
    benefits: [
      "Easy for relatives joining from different locations",
      "Games create conversation without putting anyone on the spot",
      "Flexible formats for regular family nights or special occasions",
      "One live host handles instructions, pacing, and scoring",
    ],
    games: [
      ["Virtual Family Bingo", "Simple, social play that works well across generations."],
      ["Music & Memories", "Recognizable songs and conversation-starting moments."],
      ["Lightning Trivia", "Short, lively rounds covering interests your family enjoys."],
    ],
    examples: [
      "Which destination should be the next family trip?",
      "Which snack belongs at every family game night?",
      "Who is most likely to answer the phone on the first ring?",
    ],
    faqs: [
      ["Do we need to use Zoom?", "We can work with the major video meeting platforms. Players use a separate browser link for the games, with no download required."],
      ["Will this work for a small family?", "Yes. We can recommend formats for intimate groups as well as large extended families."],
      ["What if some relatives are not comfortable with technology?", "We provide simple joining instructions and design the experience so guests only need the basic controls on their device."],
      ["Can this become a regular event?", "Yes. We can vary the games and themes for recurring family nights so each event feels fresh."],
    ],
  },
};

export function familyOccasion(key) {
  return FAMILY_OCCASIONS[key];
}

export const FAMILY_DEMAND_ROUTES = Object.values(FAMILY_OCCASIONS).map((occasion) => `/${occasion.slug}`);
