import type { MangaDoc } from "./manga.schema";

/**
 * A handful of real manga so the catalog is demoable out of the box (issue 03).
 * Prices are EUR integer cents (ADR-0006). `reserved` starts at 0 — nothing is
 * held until an order reserves it (ADR-0002). Covers point at the MyAnimeList
 * CDN; the UI degrades gracefully if an image fails to load.
 */
export const SEED_MANGA: MangaDoc[] = [
  {
    title: "Berserk, Vol. 1",
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
    title: "One Piece, Vol. 1",
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
    title: "Fullmetal Alchemist, Vol. 1",
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
    title: "Vinland Saga, Vol. 1",
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
    title: "Death Note, Vol. 1",
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
    title: "Chainsaw Man, Vol. 1",
    author: "Tatsuki Fujimoto",
    genres: ["Action", "Comedy", "Horror", "Supernatural"],
    cover: "https://cdn.myanimelist.net/images/manga/3/216464.jpg",
    description:
      "Denji, a young devil hunter drowning in debt, merges with his chainsaw devil dog Pochita to survive.",
    price: 1099,
    stock: { quantity: 0, reserved: 0 },
    jikanId: 116778,
  },
];
