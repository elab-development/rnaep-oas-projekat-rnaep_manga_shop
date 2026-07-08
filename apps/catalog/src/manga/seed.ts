import type { MangaDoc } from "./manga.schema";

/**
 * A handful of real manga so the catalog is demoable out of the box (issue 03).
 * Prices are EUR integer cents (ADR-0006). `reserved` starts at 0 — nothing is
 * held until an order reserves it (ADR-0002). Covers point at the MyAnimeList
 * CDN; the UI degrades gracefully if an image fails to load.
 */
export const SEED_MANGA: MangaDoc[] = [
  {
    title: "Berserk",
    author: "Kentaro Miura",
    genres: ["Action", "Adventure", "Fantasy", "Horror"],
    cover: "https://cdn.myanimelist.net/images/manga/1/157897.jpg",
    description:
      "Guts, a former mercenary now known as the Black Swordsman, is out for revenge in a dark medieval world stalked by demons.",
    price: 1499,
    stock: { quantity: 12, reserved: 0 },
    jikanId: 2,
  },
  {
    title: "One Piece",
    author: "Eiichiro Oda",
    genres: ["Action", "Adventure", "Comedy", "Fantasy"],
    cover: "https://cdn.myanimelist.net/images/manga/2/253146.jpg",
    description:
      "Monkey D. Luffy sets sail to find the legendary One Piece treasure and become the Pirate King.",
    price: 999,
    stock: { quantity: 30, reserved: 0 },
    jikanId: 13,
  },
  {
    title: "Fullmetal Alchemist",
    author: "Hiromu Arakawa",
    genres: ["Action", "Adventure", "Drama", "Fantasy"],
    cover: "https://cdn.myanimelist.net/images/manga/3/243675.jpg",
    description:
      "Two brothers search for a Philosopher's Stone to restore their bodies after a forbidden alchemical experiment goes wrong.",
    price: 1299,
    stock: { quantity: 20, reserved: 0 },
    jikanId: 25,
  },
  {
    title: "Vinland Saga",
    author: "Makoto Yukimura",
    genres: ["Action", "Adventure", "Drama", "Historical"],
    cover: "https://cdn.myanimelist.net/images/manga/2/188925.jpg",
    description:
      "A young Thorfinn grows up among Viking warriors, driven by revenge amid the wars of eleventh-century Europe.",
    price: 1599,
    stock: { quantity: 8, reserved: 0 },
    jikanId: 642,
  },
  {
    title: "Death Note",
    author: "Tsugumi Ohba",
    genres: ["Mystery", "Psychological", "Supernatural", "Thriller"],
    cover: "https://cdn.myanimelist.net/images/manga/1/258245.jpg",
    description:
      "A high-school prodigy finds a notebook that kills anyone whose name is written in it, and sets out to remake the world.",
    price: 899,
    stock: { quantity: 25, reserved: 0 },
    jikanId: 21,
  },
  {
    title: "Chainsaw Man",
    author: "Tatsuki Fujimoto",
    genres: ["Action", "Comedy", "Horror", "Supernatural"],
    cover: "https://cdn.myanimelist.net/images/manga/3/216464.jpg",
    description:
      "Denji, a young devil hunter drowning in debt, merges with his chainsaw devil dog Pochita to survive.",
    price: 1099,
    stock: { quantity: 0, reserved: 0 },
    jikanId: 116778,
  },
  {
    title: "Naruto",
    author: "Masashi Kishimoto",
    genres: ["Action", "Adventure", "Fantasy"],
    cover: "https://cdn.myanimelist.net/images/manga/3/249658.jpg",
    description:
      "Naruto Uzumaki, a mischievous young ninja with a demon fox sealed inside him, trains relentlessly to win his village's respect and become its greatest leader, the Hokage.",
    price: 999,
    stock: { quantity: 40, reserved: 0 },
    jikanId: 11,
  },
  {
    title: "Bleach",
    author: "Tite Kubo",
    genres: ["Action", "Adventure", "Supernatural"],
    cover: "https://cdn.myanimelist.net/images/manga/3/180031.jpg",
    description:
      "High-schooler Ichigo Kurosaki inherits the powers of a Soul Reaper and must hunt the monstrous Hollows that prey on the living and the dead.",
    price: 999,
    stock: { quantity: 35, reserved: 0 },
    jikanId: 12,
  },
  {
    title: "Attack on Titan",
    author: "Hajime Isayama",
    genres: ["Action", "Drama", "Thriller"],
    cover: "https://cdn.myanimelist.net/images/manga/2/37846.jpg",
    description:
      "Humanity shelters behind colossal walls from the man-eating Titans — until the walls are breached and Eren Yeager vows to wipe every Titan from the earth.",
    price: 1299,
    stock: { quantity: 22, reserved: 0 },
    jikanId: 23390,
  },
  {
    title: "Hunter x Hunter",
    author: "Yoshihiro Togashi",
    genres: ["Action", "Adventure", "Fantasy"],
    cover: "https://cdn.myanimelist.net/images/manga/2/253119.jpg",
    description:
      "Gon Freecss sets out to pass the deadly Hunter Exam and follow in the footsteps of the father who left him to pursue a life of adventure.",
    price: 1199,
    stock: { quantity: 18, reserved: 0 },
    jikanId: 26,
  },
  {
    title: "Monster",
    author: "Naoki Urasawa",
    genres: ["Drama", "Mystery"],
    cover: "https://cdn.myanimelist.net/images/manga/3/258224.jpg",
    description:
      "After choosing to save a boy's life over a politician's, gifted surgeon Kenzou Tenma is drawn into a chain of gruesome murders committed by the monster he once rescued.",
    price: 1599,
    stock: { quantity: 6, reserved: 0 },
    jikanId: 1,
  },
  {
    title: "Vagabond",
    author: "Takehiko Inoue",
    genres: ["Action", "Adventure", "Historical"],
    cover: "https://cdn.myanimelist.net/images/manga/1/259070.jpg",
    description:
      "A fictionalized retelling of the legendary swordsman Musashi Miyamoto's rise from a wild, feared young man to an enlightened warrior in 16th-century Japan.",
    price: 1699,
    stock: { quantity: 9, reserved: 0 },
    jikanId: 656,
  },
  {
    title: "Slam Dunk",
    author: "Takehiko Inoue",
    genres: ["Sports", "Comedy", "Drama"],
    cover: "https://cdn.myanimelist.net/images/manga/2/258749.jpg",
    description:
      "Delinquent Hanamichi Sakuragi joins his high school basketball team to impress a girl and discovers an unexpected talent — and love — for the game.",
    price: 1099,
    stock: { quantity: 14, reserved: 0 },
    jikanId: 51,
  },
  {
    title: "Nana",
    author: "Ai Yazawa",
    genres: ["Drama", "Romance"],
    cover: "https://cdn.myanimelist.net/images/manga/1/262324.jpg",
    description:
      "Two twenty-year-old women who share the same name meet on a train to Tokyo and become roommates, forging a bond through love, music, and heartbreak.",
    price: 1099,
    stock: { quantity: 0, reserved: 0 },
    jikanId: 28,
  },
  {
    title: "One-Punch Man",
    author: "Yusuke Murata",
    genres: ["Action", "Comedy"],
    cover: "https://cdn.myanimelist.net/images/manga/3/80661.jpg",
    description:
      "Saitama is a hero so overwhelmingly strong he defeats any foe with a single punch — and is bored to death because of it.",
    price: 1199,
    stock: { quantity: 27, reserved: 0 },
    jikanId: 44347,
  },
  {
    title: "Tokyo Ghoul",
    author: "Sui Ishida",
    genres: ["Action", "Fantasy", "Horror"],
    cover: "https://cdn.myanimelist.net/images/manga/3/114037.jpg",
    description:
      "After a deadly encounter leaves him a half-ghoul, college student Ken Kaneki must survive the hidden war between flesh-eating ghouls and the humans who hunt them.",
    price: 1099,
    stock: { quantity: 16, reserved: 0 },
    jikanId: 33327,
  },
  {
    title: "My Hero Academia",
    author: "Kohei Horikoshi",
    genres: ["Action", "Adventure"],
    cover: "https://cdn.myanimelist.net/images/manga/1/209370.jpg",
    description:
      "In a world where almost everyone has superpowers, the powerless Izuku Midoriya inherits the ability of his idol All Might and enrolls at the elite hero academy UA High.",
    price: 999,
    stock: { quantity: 33, reserved: 0 },
    jikanId: 75989,
  },
  {
    title: "Jujutsu Kaisen",
    author: "Gege Akutami",
    genres: ["Action", "Supernatural"],
    cover: "https://cdn.myanimelist.net/images/manga/3/210341.jpg",
    description:
      "After swallowing a cursed relic to save his friends, Yuuji Itadori becomes host to a powerful Curse and enrolls at a school for the sorcerers who battle them.",
    price: 1099,
    stock: { quantity: 24, reserved: 0 },
    jikanId: 113138,
  },
  {
    title: "Demon Slayer",
    author: "Koyoharu Gotouge",
    genres: ["Action", "Fantasy", "Historical"],
    cover: "https://cdn.myanimelist.net/images/manga/3/179023.jpg",
    description:
      "After a demon slaughters his family and turns his sister into one, Tanjirou Kamado becomes a demon slayer on a quest to avenge them and cure her.",
    price: 999,
    stock: { quantity: 31, reserved: 0 },
    jikanId: 96792,
  },
  {
    title: "Haikyu!!",
    author: "Haruichi Furudate",
    genres: ["Sports", "Comedy", "Drama"],
    cover: "https://cdn.myanimelist.net/images/manga/2/258225.jpg",
    description:
      "Determined to conquer the net despite his short stature, Shouyou Hinata joins Karasuno High's volleyball team — alongside his fiery rival, the setter Tobio Kageyama.",
    price: 999,
    stock: { quantity: 12, reserved: 0 },
    jikanId: 35243,
  },
  {
    title: "Dragon Ball",
    author: "Akira Toriyama",
    genres: ["Action", "Adventure", "Fantasy", "Comedy"],
    cover: "https://cdn.myanimelist.net/images/manga/1/267793.jpg",
    description:
      "Headstrong Bulma teams up with the impossibly strong, tailed orphan Gokuu to gather the seven magical Dragon Balls that grant any single wish.",
    price: 899,
    stock: { quantity: 0, reserved: 0 },
    jikanId: 42,
  },
];
