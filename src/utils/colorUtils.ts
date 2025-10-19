// Generate consistent colors based on string hash
export function getColorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const gradients = [
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", // Purple
    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", // Pink
    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", // Blue
    "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)", // Green
    "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", // Orange/Yellow
    "linear-gradient(135deg, #30cfd0 0%, #330867 100%)", // Teal/Purple
    "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)", // Pastel
    "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)", // Rose
    "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)", // Peach
    "linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)", // Red/Blue
  ];
  
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

// Get icon emoji based on topic
export function getIconForTopic(topic: string): string {
  const topicLower = topic.toLowerCase();
  
  // Math & Science
  if (topicLower.includes('mat') || topicLower.includes('alge') || topicLower.includes('geomet')) return '🔢';
  if (topicLower.includes('fysik') || topicLower.includes('physic')) return '⚛️';
  if (topicLower.includes('kemi') || topicLower.includes('chemi')) return '🧪';
  if (topicLower.includes('biologi') || topicLower.includes('biology')) return '🧬';
  if (topicLower.includes('astronomi') || topicLower.includes('rum') || topicLower.includes('space') || topicLower.includes('univers')) return '🌌';
  
  // Programming & Tech
  if (topicLower.includes('python') || topicLower.includes('java') || topicLower.includes('kod') || topicLower.includes('program')) return '💻';
  if (topicLower.includes('web') || topicLower.includes('html') || topicLower.includes('css')) return '🌐';
  if (topicLower.includes('data') || topicLower.includes('database') || topicLower.includes('sql')) return '💾';
  if (topicLower.includes('ai') || topicLower.includes('machine learning') || topicLower.includes('neural')) return '🤖';
  
  // Languages
  if (topicLower.includes('engelsk') || topicLower.includes('english')) return '🇬🇧';
  if (topicLower.includes('spansk') || topicLower.includes('spanish')) return '🇪🇸';
  if (topicLower.includes('fransk') || topicLower.includes('french')) return '🇫🇷';
  if (topicLower.includes('tysk') || topicLower.includes('german')) return '🇩🇪';
  if (topicLower.includes('sprog') || topicLower.includes('language') || topicLower.includes('gramm')) return '📚';
  
  // History & Social
  if (topicLower.includes('historie') || topicLower.includes('history')) return '📜';
  if (topicLower.includes('geografi') || topicLower.includes('geography')) return '🗺️';
  if (topicLower.includes('økonomi') || topicLower.includes('econom')) return '📊';
  if (topicLower.includes('politik') || topicLower.includes('politic')) return '🏛️';
  
  // Arts & Creative
  if (topicLower.includes('musik') || topicLower.includes('music')) return '🎵';
  if (topicLower.includes('kunst') || topicLower.includes('art') || topicLower.includes('design')) return '🎨';
  if (topicLower.includes('foto') || topicLower.includes('photo')) return '📸';
  
  // Other
  if (topicLower.includes('sundhed') || topicLower.includes('health')) return '🏥';
  if (topicLower.includes('sport') || topicLower.includes('træning') || topicLower.includes('fitness')) return '⚽';
  if (topicLower.includes('mad') || topicLower.includes('food') || topicLower.includes('cooking')) return '🍳';
  
  // Default
  return '📖';
}
