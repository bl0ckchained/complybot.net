const affirmations = [
  "I am not my past.",
  "I will build what I never had.",
  "Today I become who I needed years ago.",
  "Learning to be kind to myself changed my direction in life."
];

const affText = document.getElementById('affirmationText');
const affBtn = document.getElementById('newAffirmation');
const whisperToggle = document.getElementById('whisperToggle');
let whisperMode = false;

affBtn.addEventListener('click', () => {
  const rand = Math.floor(Math.random() * affirmations.length);
  affText.textContent = affirmations[rand];
  if (whisperMode) affText.style.opacity = "0.6";
  else affText.style.opacity = "1";
});

whisperToggle.addEventListener('click', () => {
  whisperMode = !whisperMode;
  whisperToggle.textContent = whisperMode ? "🔊 Whisper Mode: ON" : "🔇 Ninja Whisper Mode";
});
// Initialize with a random affirmation
affBtn.click();
