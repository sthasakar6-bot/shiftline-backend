// Curated set of solid/gradient colors a user can pick for their own app
// wallpaper (Profile > Appearance). Stored as a short key on
// User.wallpaperUrl (column name predates this change) rather than a CSS
// value, so the actual gradient definition lives client-side and a user
// can't inject arbitrary CSS through this endpoint -- only one of these
// keys is ever accepted on write.
export const WALLPAPER_URLS = [
  "aurora",
  "sunset",
  "ocean",
  "forest",
  "berry",
  "sand",
  "slate",
] as const;
