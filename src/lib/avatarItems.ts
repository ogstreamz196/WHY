// Avatar dress-up: extra characters, wearables (hats, face gear, things to
// hold, jewellery), pets and auras, plus the special "drop" items that can't
// be bought and only arrive as free gifts (the weekly drop and Daily Challenge
// rewards). Everything here is cosmetic and bought with coins earned by
// playing, never with money.
import type { StoreItem } from "@/lib/store";

/** Places on the avatar where a wearable goes. */
export const OUTFIT_SLOTS = ["hat", "face", "hand", "neck", "pet", "aura"] as const;
export type OutfitSlot = (typeof OUTFIT_SLOTS)[number];
export type Outfit = Partial<Record<OutfitSlot, string>>;

export type Rarity = "common" | "rare" | "epic" | "legendary";

type Seed = [id: string, name: string, emoji: string, cost: number, description: string];

function items(category: StoreItem["category"], seeds: Seed[], extra?: Partial<StoreItem>) {
  return seeds.map(([id, name, emoji, cost, description]): StoreItem => ({
    id,
    category,
    name,
    emoji,
    cost,
    description,
    ...extra,
  }));
}

// ---------- New characters: animals and funny faces ----------
const CHARACTERS = items("avatar", [
  ["avatar-puppy", "Puppy", "🐶", 40, "Loyal, waggy and always asking why."],
  ["avatar-bunny", "Bunny", "🐰", 40, "Hops from fact to fact."],
  ["avatar-piggy", "Piggy", "🐷", 40, "Oink if you love facts."],
  ["avatar-bear", "Teddy Bear", "🐻", 60, "Big hugs, bigger questions."],
  ["avatar-mouse", "Mouse", "🐭", 40, "Small but very, very curious."],
  ["avatar-hamster", "Hamster", "🐹", 50, "Stuffs its cheeks with knowledge."],
  ["avatar-cow", "Moo-ver", "🐮", 50, "Udderly fascinated by everything."],
  ["avatar-chicken", "Chicken", "🐔", 50, "Which came first? Let's find out."],
  ["avatar-horse", "Pony", "🐴", 70, "Gallops through the galaxy of facts."],
  ["avatar-raccoon", "Raccoon", "🦝", 90, "A sneaky little fact collector."],
  ["avatar-zany", "Zany Face", "🤪", 60, "Wacky, wild and wonderful."],
  ["avatar-party", "Party Face", "🥳", 80, "Every fact is a celebration."],
  ["avatar-nerd", "Brainiac", "🤓", 60, "Knows a fact about everything."],
  ["avatar-cool", "Too Cool", "😎", 80, "Stays chill while learning."],
  ["avatar-disguise", "Master of Disguise", "🥸", 120, "Nobody knows who's under there."],
  ["avatar-starstruck", "Starstruck", "🤩", 100, "Amazed by every answer."],
  ["avatar-pumpkin", "Pumpkin Head", "🎃", 150, "Spooky, silly and full of seeds."],
  ["avatar-snowman", "Snow Buddy", "☃️", 150, "Cool facts all year round."],
  ["avatar-sun", "Sunny", "🌞", 200, "Shines a light on every question."],
  ["avatar-moon", "Moon Face", "🌝", 200, "Wonders about the night sky."],
  ["avatar-ogre", "Ogre", "👹", 250, "Grumpy outside, curious inside."],
  ["avatar-goblin", "Goblin", "👺", 250, "Cheeky mischief-maker."],
  ["avatar-shocked-cat", "Shocked Cat", "🙀", 120, "Can't believe that fact!"],
  ["avatar-space-invader", "Pixel Invader", "👾", 300, "Arrived from an old arcade."],
]);

// ---------- Hats ----------
const HATS = items("hat", [
  ["hat-cap", "Cool Cap", "🧢", 40, "A classic for every explorer."],
  ["hat-bow", "Big Bow", "🎀", 50, "Pretty, pink and perfect."],
  ["hat-tophat", "Top Hat", "🎩", 80, "Very fancy. Very curious."],
  ["hat-sunhat", "Sun Hat", "👒", 70, "For sunny fact safaris."],
  ["hat-helmet", "Rescue Helmet", "⛑️", 90, "Safety first, questions second."],
  ["hat-pizza", "Pizza Hat", "🍕", 100, "Yes, a slice of pizza. On your head."],
  ["hat-mushroom", "Mushroom Cap", "🍄", 120, "Straight from a fairy-tale forest."],
  ["hat-cake", "Birthday Cake", "🎂", 130, "Every day is a party."],
  ["hat-grad", "Graduation Cap", "🎓", 150, "Top of the class."],
  ["hat-feather", "Feather", "🪶", 160, "A dashing adventurer's feather."],
  ["hat-star", "Star Topper", "⭐", 200, "You're a star. Literally."],
  ["hat-rainbow", "Rainbow Arc", "🌈", 250, "A rainbow over your head."],
  ["hat-flame", "Flame Hair", "🔥", 300, "Hot new hairstyle."],
  ["hat-crown", "Golden Crown", "👑", 450, "Rule the leaderboard in style."],
]);

// ---------- Face gear ----------
const FACE = items("face", [
  ["face-plaster", "Plaster", "🩹", 30, "Oops! Bumped into a big idea."],
  ["face-specs", "Reading Specs", "👓", 40, "For reading the fine print."],
  ["face-googly", "Googly Eyes", "👀", 50, "Look around in every direction."],
  ["face-shades", "Shades", "🕶️", 80, "Too bright to look at."],
  ["face-goggles", "Lab Goggles", "🥽", 100, "Science time!"],
  ["face-snorkel", "Snorkel Mask", "🤿", 120, "Ready to dive deep."],
  ["face-mask", "Theatre Mask", "🎭", 200, "Happy or sad? You choose."],
]);

// ---------- Things to hold ----------
const HAND = items("hand", [
  ["hand-balloon", "Balloon", "🎈", 30, "Floaty and fun."],
  ["hand-tulip", "Tulip", "🌷", 40, "A fresh spring flower."],
  ["hand-lollipop", "Lollipop", "🍭", 40, "Swirly and sweet."],
  ["hand-icecream", "Ice Cream", "🍦", 40, "Don't let it melt!"],
  ["hand-rose", "Rose", "🌹", 60, "A rose for a curious mind."],
  ["hand-sunflower", "Sunflower", "🌻", 60, "Always faces the sun."],
  ["hand-bouquet", "Bouquet", "💐", 90, "A whole bunch of flowers."],
  ["hand-books", "Stack of Books", "📚", 80, "Bookworm approved."],
  ["hand-kite", "Kite", "🪁", 100, "Let your ideas fly."],
  ["hand-boomerang", "Boomerang", "🪃", 110, "Questions always come back."],
  ["hand-potion", "Potion", "🧪", 130, "Bubbling with ideas."],
  ["hand-telescope", "Telescope", "🔭", 160, "Spot faraway stars."],
  ["hand-microscope", "Microscope", "🔬", 160, "See the tiny world."],
  ["hand-shield", "Shield", "🛡️", 180, "Protects your streak."],
  ["hand-dagger", "Brave Blade", "🗡️", 200, "For the boldest explorers."],
  ["hand-wand", "Magic Wand", "🪄", 220, "Turns questions into answers."],
  ["hand-guitar", "Guitar", "🎸", 240, "Rock out with facts."],
  ["hand-bow", "Bow and Arrow", "🏹", 240, "Aim for the answer."],
  ["hand-swords", "Twin Swords", "⚔️", 300, "Legendary fact warrior."],
  ["hand-trident", "Trident", "🔱", 350, "Ruler of the seas."],
]);

// ---------- Jewellery and neckwear ----------
const NECK = items("neck", [
  ["neck-tie", "Smart Tie", "👔", 50, "Ready for the big meeting."],
  ["neck-bell", "Jingle Bell", "🔔", 60, "Jingles when you learn."],
  ["neck-beads", "Bead Necklace", "📿", 70, "Colourful and calm."],
  ["neck-scarf", "Cosy Scarf", "🧣", 80, "Warm and snug."],
  ["neck-lei", "Flower Lei", "🌺", 100, "Aloha, explorer!"],
  ["neck-heart", "Heart Locket", "❤️", 130, "Full of love for learning."],
  ["neck-medal", "Gold Medal", "🏅", 180, "Winner, winner."],
  ["neck-coin", "Coin Pendant", "🪙", 220, "Shiny and golden."],
  ["neck-ring", "Gem Ring", "💍", 280, "Sparkles on a chain."],
  ["neck-diamond", "Diamond", "💎", 450, "The rarest of jewels."],
]);

// ---------- Pets that follow you around ----------
const PETS = items("pet", [
  ["pet-snail", "Snail", "🐌", 50, "Slow and steady."],
  ["pet-chick", "Chick", "🐥", 80, "Peep peep!"],
  ["pet-bee", "Bee Buddy", "🐝", 90, "Buzzing with facts."],
  ["pet-turtle", "Turtle", "🐢", 100, "Wise beyond its years."],
  ["pet-bunny", "Bunny", "🐇", 120, "A hoppy little friend."],
  ["pet-hamster", "Hamster", "🐹", 120, "Runs on a wheel of ideas."],
  ["pet-puppy", "Puppy", "🐕", 150, "Fetches facts for you."],
  ["pet-kitty", "Kitty", "🐈", 150, "Purrs when you get it right."],
  ["pet-parrot", "Parrot", "🦜", 220, "Repeats every fact you learn."],
  ["pet-rex", "Mini Rex", "🦖", 350, "A dinosaur in your pocket."],
  ["pet-ufo", "Mini UFO", "🛸", 400, "Follows you from outer space."],
  ["pet-dragon", "Mini Dragon", "🐉", 500, "Small, fierce and loyal."],
]);

// ---------- Auras: a glow and floating sparkles behind you ----------
const AURAS = items("aura", [
  ["aura-clover", "Lucky Clover", "🍀", 120, "A little bit of luck."],
  ["aura-hearts", "Hearts", "💖", 150, "Lovely floating hearts."],
  ["aura-sparkles", "Sparkles", "✨", 150, "Shiny all over."],
  ["aura-petals", "Petals", "🌸", 180, "Blossoms drift around you."],
  ["aura-snow", "Snowfall", "❄️", 200, "A cool frosty glow."],
  ["aura-stars", "Starlight", "⭐", 250, "Stars circle your head."],
  ["aura-lightning", "Electric", "⚡", 300, "Crackling with energy."],
  ["aura-fire", "Fire Ring", "🔥", 350, "Too hot to handle."],
  ["aura-rainbow", "Rainbow Glow", "🌈", 400, "Every colour at once."],
]);

// ---------- Special drops: never sold, only gifted ----------
const DROPS: StoreItem[] = [
  ...items("hat", [
    ["drop-hat-planet", "Planet Ring", "🪐", 0, "Special drop. A whole planet on your head."],
    ["drop-hat-dizzy", "Dizzy Stars", "💫", 0, "Special drop. Spinning with ideas."],
    ["drop-hat-ice", "Ice Cube Crown", "🧊", 0, "Special drop. The coolest crown there is."],
  ]),
  ...items("face", [
    ["drop-face-sparkle", "Sparkle Eyes", "✨", 0, "Special drop. Eyes full of wonder."],
  ]),
  ...items("hand", [
    ["drop-hand-crystal", "Crystal Ball", "🔮", 0, "Special drop. See tomorrow's facts."],
    ["drop-hand-lightning", "Lightning Bolt", "⚡", 0, "Special drop. Pure power."],
  ]),
  ...items("neck", [
    ["drop-neck-charm", "Lucky Charm", "🧿", 0, "Special drop. Keeps your streak safe."],
  ]),
  ...items("pet", [
    ["drop-pet-otter", "Otter Pal", "🦦", 0, "Special drop. Holds your hand while you read."],
    ["drop-pet-octo", "Baby Octopus", "🐙", 0, "Special drop. Eight arms of curiosity."],
  ]),
  ...items("aura", [
    ["drop-aura-galaxy", "Galaxy Swirl", "🌌", 0, "Special drop. The universe around you."],
    ["drop-aura-fireworks", "Fireworks", "🎆", 0, "Special drop. A celebration every day."],
  ]),
  ...items("avatar", [
    ["drop-avatar-peacock", "Peacock", "🦚", 0, "Special drop. The fanciest bird around."],
    ["drop-avatar-ladybird", "Ladybird", "🐞", 0, "Special drop. Tiny, spotty and lucky."],
  ]),
].map((i) => ({ ...i, dropOnly: true }));

export const AVATAR_ITEMS: StoreItem[] = [
  ...CHARACTERS,
  ...HATS,
  ...FACE,
  ...HAND,
  ...NECK,
  ...PETS,
  ...AURAS,
  ...DROPS,
];

export const DROP_ITEM_IDS: string[] = DROPS.map((i) => i.id);

export function rarityOf(item: Pick<StoreItem, "cost" | "dropOnly" | "vipOnly">): Rarity {
  if (item.dropOnly || item.vipOnly) return "legendary";
  if (item.cost >= 400) return "legendary";
  if (item.cost >= 200) return "epic";
  if (item.cost >= 100) return "rare";
  return "common";
}

export const RARITY_STYLE: Record<Rarity, { label: string; ring: string; text: string }> = {
  common: { label: "Common", ring: "ring-white/15", text: "text-white/60" },
  rare: { label: "Rare", ring: "ring-sky-300/50", text: "text-sky-200" },
  epic: { label: "Epic", ring: "ring-fuchsia-300/60", text: "text-fuchsia-200" },
  legendary: { label: "Legendary", ring: "ring-amber-300/70", text: "text-amber-200" },
};

/** Glow colours and the floating particle for each aura. */
export const AURA_LOOK: Record<string, { glow: string; particle: string }> = {
  "aura-clover": { glow: "rgba(74,222,128,0.55)", particle: "🍀" },
  "aura-hearts": { glow: "rgba(244,114,182,0.6)", particle: "💖" },
  "aura-sparkles": { glow: "rgba(253,224,71,0.5)", particle: "✨" },
  "aura-petals": { glow: "rgba(249,168,212,0.55)", particle: "🌸" },
  "aura-snow": { glow: "rgba(147,197,253,0.6)", particle: "❄️" },
  "aura-stars": { glow: "rgba(250,204,21,0.55)", particle: "⭐" },
  "aura-lightning": { glow: "rgba(96,165,250,0.65)", particle: "⚡" },
  "aura-fire": { glow: "rgba(249,115,22,0.65)", particle: "🔥" },
  "aura-rainbow": {
    glow: "conic-gradient(from 0deg, #f87171, #fbbf24, #4ade80, #60a5fa, #c084fc, #f87171)",
    particle: "🌈",
  },
  "drop-aura-galaxy": {
    glow: "conic-gradient(from 90deg, #1e1b4b, #7c3aed, #ec4899, #1e1b4b)",
    particle: "🌟",
  },
  "drop-aura-fireworks": { glow: "rgba(236,72,153,0.6)", particle: "🎆" },
};

// ---------- Weekly drop ----------
// Every week (Monday, UTC) a different special item can be claimed for free.
const WEEK_MS = 7 * 24 * 3600 * 1000;
// 1970-01-05 was a Monday.
const FIRST_MONDAY = Date.UTC(1970, 0, 5);

export function weekIndex(now: Date = new Date()): number {
  return Math.floor((now.getTime() - FIRST_MONDAY) / WEEK_MS);
}

/** The special item anyone can claim this week. */
export function weeklyDropId(now: Date = new Date()): string {
  const n = DROP_ITEM_IDS.length;
  return DROP_ITEM_IDS[((weekIndex(now) % n) + n) % n];
}

// ---------- Daily Challenge mystery reward ----------
export type DailyReward = { kind: "coins"; amount: number } | { kind: "item"; itemId: string };

const BONUS_COINS = [5, 5, 10, 10, 10, 15, 15, 20, 30];
const ITEM_CHANCE = 0.35;

/**
 * Roll the free mystery reward for finishing the Daily Challenge. It's never
 * sold. Usually a few bonus coins; sometimes a wearable or a special drop the
 * player doesn't own yet. `rand` returns numbers in [0, 1).
 */
export function rollDailyReward(
  owned: Iterable<string>,
  catalog: StoreItem[],
  rand: () => number = Math.random,
): DailyReward {
  const have = new Set(owned);
  if (rand() < ITEM_CHANCE) {
    // Mostly cheaper wearables, with special drops as the rare prize.
    const pool = catalog.filter(
      (i) =>
        !have.has(i.id) &&
        !i.vipOnly &&
        (i.dropOnly || (i.category !== "avatar" && i.category !== "theme" && i.cost <= 200)),
    );
    if (pool.length > 0) {
      const drops = pool.filter((i) => i.dropOnly);
      const regular = pool.filter((i) => !i.dropOnly);
      const pickFrom =
        drops.length > 0 && (regular.length === 0 || rand() < 0.25) ? drops : regular;
      const item = pickFrom[Math.floor(rand() * pickFrom.length)] ?? pickFrom[0];
      return { kind: "item", itemId: item.id };
    }
  }
  const amount = BONUS_COINS[Math.floor(rand() * BONUS_COINS.length)] ?? BONUS_COINS[0];
  return { kind: "coins", amount };
}

/** Keep only real items worn in the right slot. */
export function sanitizeOutfit(raw: unknown, catalog: StoreItem[]): Outfit {
  if (!raw || typeof raw !== "object") return {};
  const out: Outfit = {};
  for (const slot of OUTFIT_SLOTS) {
    const id = (raw as Record<string, unknown>)[slot];
    if (typeof id !== "string") continue;
    if (catalog.some((i) => i.id === id && i.category === slot)) out[slot] = id;
  }
  return out;
}
