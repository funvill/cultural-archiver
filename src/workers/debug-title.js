// Quick debug script to test title similarity
function normalizeString(str) {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .trim();
}

function calculateTitleSimilarity(title1, title2) {
  const normalized1 = normalizeString(title1);
  const normalized2 = normalizeString(title2);
  
  console.log(`Input: "${title1}" -> "${normalized1}" (length: ${normalized1.length})`);
  console.log(`Input: "${title2}" -> "${normalized2}" (length: ${normalized2.length})`);

  if (!normalized1 || !normalized2) {
    console.log('Early return due to falsy normalized strings');
    return 0;
  }

  // Handle empty strings after normalization
  if (normalized1.length === 0 || normalized2.length === 0) {
    console.log('Empty string check:', normalized1.length === normalized2.length ? 1 : 0);
    return normalized1.length === normalized2.length ? 1 : 0;
  }

  console.log('Would continue to Levenshtein distance');
  return 1; // Mock for this debug
}

// Test cases from the failing test
console.log('=== Test: Solo vs Solo ===');
console.log('Result:', calculateTitleSimilarity('Solo', 'Solo'));

console.log('\n=== Test: Solo vs solo ===');
console.log('Result:', calculateTitleSimilarity('Solo', 'solo'));

console.log('\n=== Test: Solo vs empty ===');
console.log('Result:', calculateTitleSimilarity('Solo', ''));
