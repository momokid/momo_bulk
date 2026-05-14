import Fuse from "fuse.js";

// ─── Normalise name for comparison ───────────────────
// Lowercase, trim extra spaces, remove punctuation
const normalise = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ");

// ─── Token Sort ───────────────────────────────────────
// Splits name into words, sorts them, rejoins
// Handles flipped names: "John Mensah" === "Mensah John"
const tokenSort = (name) => normalise(name).split(" ").sort().join(" ");

// ─── Token Sort Score ─────────────────────────────────
// Returns 0-100 based on how similar two sorted names are
const tokenSortScore = (nameA, nameB) => {
  const sortedA = tokenSort(nameA);
  const sortedB = tokenSort(nameB);

  if (sortedA === sortedB) return 100;

  // Use Fuse.js on the sorted versions
  const fuse = new Fuse([sortedA], {
    includeScore: true,
    threshold: 1.0,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });

  const results = fuse.search(sortedB);
  if (results.length === 0) return 0;

  // Fuse score is 0 (perfect) to 1 (no match) — we invert to 0-100
  return Math.round((1 - results[0].score) * 100);
};

// ─── Fuse Score ───────────────────────────────────────
// Handles spelling variations and character differences
const fuseScore = (nameA, nameB) => {
  const normA = normalise(nameA);
  const normB = normalise(nameB);

  if (normA === normB) return 100;

  const fuse = new Fuse([normA], {
    includeScore: true,
    threshold: 1.0,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });

  const results = fuse.search(normB);
  if (results.length === 0) return 0;

  return Math.round((1 - results[0].score) * 100);
};

// ─── Main Match Function ──────────────────────────────
// Returns score 0-100 and a status label
export const matchNames = (inputName, mtnName) => {
  if (!inputName || !mtnName) return { score: 0, status: "NO_MATCH" };

  const score1 = fuseScore(inputName, mtnName);
  const score2 = tokenSortScore(inputName, mtnName);

  // Take the higher of the two scores
  const score = Math.max(score1, score2);

  let status;
  if (score >= 90) status = "STRONG";
  else if (score >= 70) status = "LIKELY";
  else if (score >= 50) status = "WEAK";
  else status = "NO_MATCH";

  return { score, status };
};
