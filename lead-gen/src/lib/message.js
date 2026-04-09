// Layer 3: Context-Aware Message Engine
function generateMessage(lead) {
  const firstName = lead.name.split(' ')[0];
  const interaction = lead.interaction || 'engagement';
  const context = lead.post_context || "that thread";
  
  const greetings = [
    `Hey ${firstName}`,
    `${firstName}`,
    `Hi ${firstName}`
  ];

  const coreQuestions = [
    `Saw your ${interaction} on the thread about ${context}. Are you currently exploring that?`,
    `Noticed you engaged with that post on ${context}. Are you guys actively figuring that out right now?`,
    `Saw your ${interaction} on the ${context} post. Are you still trying to solve that on your end?`,
    `We crossed paths on that ${context} thread. Just curious, what are you doing for that right now?`
  ];

  const punctuations = ['!', '?', '', ' - thoughts?'];
  
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];
  const question = coreQuestions[Math.floor(Math.random() * coreQuestions.length)];
  const punctuation = punctuations[Math.floor(Math.random() * punctuations.length)];
  
  const separator = Math.random() > 0.5 ? ' — ' : ' - ';
  const spacing = Math.random() > 0.7 ? '\n\n' : ' ';
  
  return `${greeting}${separator}${spacing}${question}${punctuation}`;
}

module.exports = { generateMessage };
