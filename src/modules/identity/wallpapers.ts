// Curated set of freely-licensed background photos a user can pick for
// their own app wallpaper (Profile > Appearance). All sourced from Unsplash
// under the Unsplash License (free for commercial and personal use, no
// permission or attribution required) -- https://unsplash.com/license.
// Stored as the literal CDN URL on User.wallpaperUrl rather than a key, but
// validated against this exact whitelist on write so a user can't set an
// arbitrary external image URL through this endpoint.
export const WALLPAPER_URLS = [
  "https://images.unsplash.com/photo-1759851942096-cf73a51532ba",
  "https://images.unsplash.com/photo-1752679813117-49fdab167868",
  "https://images.unsplash.com/photo-1761429528505-e153940c62a1",
  "https://images.unsplash.com/photo-1761888855526-674732099103",
  "https://images.unsplash.com/photo-1772733694354-3b4a33568ef4",
  "https://images.unsplash.com/photo-1648563643923-2091f9c0c12f",
  "https://images.unsplash.com/photo-1745403322174-626cac65213c",
] as const;
