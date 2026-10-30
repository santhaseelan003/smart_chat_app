// Lightweight, explainable keyword classifier. This is not a psychological assessment.
const WORDS = {
  Happy: ['happy', 'great', 'good', ' wonderful', 'awesome', 'excited', 'joy', 'joyful', 'love', 'glad', 'amazing', 'fantastic', 'cheerful', 'grateful', 'delighted', 'proud', 'relieved'],
  Sad: ['sad', 'lonely', 'depressed', 'unhappy', 'cry', 'crying', 'miss', 'hopeless', 'hurt', 'down', 'upset', 'heartbroken', 'disappointed', 'empty', 'grief'],
  Angry: ['angry', 'furious', 'mad', 'annoyed', 'irritated', 'hate', 'rage', 'frustrated', 'unfair', 'annoying', 'outraged'],
  Stressed: ['stress', 'stressed', 'overwhelmed', 'pressure', 'anxious', 'anxiety', 'worried', 'worry', 'exhausted', 'tired', 'deadline', 'too much', 'panic', 'burden', 'busy']
};
const PRIORITY = ['Angry', 'Stressed', 'Sad', 'Happy'];

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9'\s-]/g, ' ').split(/\s+/).filter(Boolean);
}

function detectMood(text) {
  if (typeof text !== 'string' || !text.trim()) return 'Neutral';
  const normalized = text.toLowerCase().replace(/[^a-z0-9'\s-]/g, ' ');
  const tokens = tokenize(text);
  const scores = { Happy: 0, Sad: 0, Angry: 0, Stressed: 0 };
  for (const [mood, terms] of Object.entries(WORDS)) {
    for (const raw of terms) {
      const term = raw.trim();
      if (term.includes(' ')) {
        if (normalized.includes(term)) scores[mood] += 2;
      } else {
        const count = tokens.filter(word => word === term).length;
        scores[mood] += count;
      }
    }
  }
  // Negation reduces a nearby keyword's contribution (e.g. "not happy").
  const negations = new Set(['not', 'never', "n't", 'no', 'dont', "don't", 'cannot', "can't", 'hardly', 'without']);
  for (const mood of Object.keys(scores)) {
    for (const term of WORDS[mood].map(w => w.trim()).filter(w => !w.includes(' '))) {
      const index = tokens.indexOf(term);
      if (index > 0 && tokens.slice(Math.max(0, index - 2), index).some(w => negations.has(w))) {
        scores[mood] = Math.max(0, scores[mood] - 1);
      }
    }
  }
  const max = Math.max(...Object.values(scores));
  if (max === 0) return 'Neutral';
  const tied = Object.keys(scores).filter(mood => scores[mood] === max);
  if (tied.length > 1) return PRIORITY.find(mood => tied.includes(mood));
  return tied[0];
}

module.exports = { detectMood };
