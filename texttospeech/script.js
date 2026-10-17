// Multi-language TTS demo using browser SpeechSynthesis
// - populates available voices
// - filters by language
// - provides "brand" presets (simulated)
// - allows loading an external Breaking Bad script (if present at the URL)
// - Includes commented examples for integrating cloud TTS (server-side).

const languageSelect = document.getElementById('languageSelect');
const voiceSelect = document.getElementById('voiceSelect');
const brandSelect = document.getElementById('brandSelect');
const pitchInput = document.getElementById('pitch');
const rateInput = document.getElementById('rate');
const volumeInput = document.getElementById('volume');
const textInput = document.getElementById('text');
const speakBtn = document.getElementById('speakBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const cancelBtn = document.getElementById('cancelBtn');
const loadBreakingBad = document.getElementById('loadBreakingBad');

let voices = [];
let currentUtterance = null;

// Map friendly language -> voice lang prefix(s)
const languageMap = {
  'en': ['en-US','en-GB','en'],
  'es': ['es-ES','es','es-MX','es-419'],
  'pt-BR': ['pt-BR','pt'],
  'pt': ['pt-PT','pt'],
  'de': ['de-DE','de'],
  'nl': ['nl-NL','nl'],
  'ru': ['ru-RU','ru'],
  'wo': ['wo','wo-SN'],
  'ca': ['ca-ES','ca']
};

// Brand/character presets (simulated). These are parameter presets only.
const brandPresets = {
  google: { pitch:1.0, rate:1.0, volume:1.0 },
  microsoft: { pitch:0.95, rate:1.05, volume:1.0 },
  arasaac: { pitch:1.05, rate:0.95, volume:1.0 },
  // character-ish flavors
  woody: { pitch:0.95, rate:0.95, volume:1.0 },
  mcqueen: { pitch:1.2, rate:1.15, volume:1.0 },
  jessie: { pitch:1.25, rate:1.05, volume:1.0 },
  fox: { pitch:1.0, rate:0.95, volume:1.0 },
  flash: { pitch:0.9, rate:1.5, volume:1.0 },
  mickey: { pitch:1.5, rate:1.1, volume:1.0 },
  breakingbad: { pitch:0.95, rate:0.9, volume:1.0 }
};

function loadVoices(){
  voices = speechSynthesis.getVoices();
  // Build full voice list for selected language
  populateVoiceList();
}

function populateVoiceList(){
  const lang = languageSelect.value;
  const candidates = languageMap[lang] || [lang];
  // Clear
  voiceSelect.innerHTML = '';
  // Preferred voices: those matching languages in candidates
  const matched = voices.filter(v => {
    if(!v.lang) return false;
    return candidates.some(c => v.lang.toLowerCase().startsWith(c.toLowerCase()));
  });
  // If nothing matched, show all voices
  const list = matched.length ? matched : voices.slice();

  list.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.name;
    opt.textContent = `${v.name} — ${v.lang}${v.localService ? ' (local)' : ''}`;
    voiceSelect.appendChild(opt);
  });
  if(list.length === 0){
    const o = document.createElement('option');
    o.textContent = 'No browser TTS voices found';
    voiceSelect.appendChild(o);
  }
}

// Attempt to pick a voice by heuristics (male/female label if available)
function pickVoiceByLabel(langPrefix, preferredGender){
  // preferredGender: 'female'|'male'|null
  let pool = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith(langPrefix.toLowerCase()));
  if(pool.length === 0) pool = voices;
  if(preferredGender){
    const match = pool.find(v => /female|woman|girl/i.test(v.name));
    if(preferredGender === 'male'){
      const m = pool.find(v => /male|man|boy/i.test(v.name));
      if(m) return m;
    } else {
      if(match) return match;
    }
  }
  return pool[0] || null;
}

function applyBrandPreset(utter, brandKey){
  const preset = brandPresets[brandKey];
  if(!preset) return;
  utter.pitch = preset.pitch;
  utter.rate = preset.rate;
  utter.volume = preset.volume;
}

function speak(){
  if(!('speechSynthesis' in window)){
    alert('SpeechSynthesis not supported in this browser.');
    return;
  }
  const text = textInput.value.trim();
  if(!text) return;
  // Cancel any in-progress utterances
  speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.lang = languageSelect.value || 'en-US';
  u.pitch = parseFloat(pitchInput.value);
  u.rate = parseFloat(rateInput.value);
  u.volume = parseFloat(volumeInput.value);

  // If user selected a browser voice, try to set it
  const selectedVoiceName = voiceSelect.value;
  if(selectedVoiceName){
    const found = voices.find(v => v.name === selectedVoiceName);
    if(found) u.voice = found;
  }

  // Apply brand presets if chosen
  const brand = brandSelect.value;
  if(brand){
    // Simulated: apply parameter preset and optionally pick a voice heuristic
    applyBrandPreset(u, brand);
    // Heuristic voice picks for language/gender where requested in your list.
    // Map some requested label names to heuristics:
    switch(brand){
      case 'google':
        // prefer en-US if language is English
        if(u.lang.startsWith('en')){
          const v = pickVoiceByLabel('en-US', null);
          if(v) u.voice = v;
        }
        break;
      case 'microsoft':
        // pick any local voice
        {
          const v = voices.find(vv => vv.localService) || voices[0];
          if(v) u.voice = v;
        }
        break;
      case 'breakingbad':
        // If the breaking bad loader registers a special voice, prefer it.
        // (The loader must expose window.breakingBadVoiceName or similar.)
        if(window.breakingBadVoiceName){
          const v = voices.find(vv => vv.name === window.breakingBadVoiceName);
          if(v) u.voice = v;
        }
        break;
      default:
        // character presets: choose matching language voice if possible
        if(u.lang){
          const v = pickVoiceByLabel(u.lang, /woody|jessie|mickey|mcqueen|fox|flash/i.test(brand) ? 'female' : null);
          if(v) u.voice = v;
        }
    }
  }

  u.onstart = () => { currentUtterance = u; speakBtn.disabled = true; };
  u.onend = () => { currentUtterance = null; speakBtn.disabled = false; };
  u.onerror = (e) => { console.error('TTS error', e); currentUtterance = null; speakBtn.disabled = false; };

  speechSynthesis.speak(u);
}

function pause(){
  if(speechSynthesis.speaking && !speechSynthesis.paused) speechSynthesis.pause();
}
function resume(){
  if(speechSynthesis.paused) speechSynthesis.resume();
}
function cancel(){
  speechSynthesis.cancel();
  currentUtterance = null;
  speakBtn.disabled = false;
}

// Load external Breaking Bad script (user-provided URL in request)
// The original URL: https://breakingbad.com/voice/script.js
loadBreakingBad.addEventListener('click', (e) => {
  e.preventDefault();
  const url = 'https://breakingbad.com/voice/script.js';
  // Inject script tag
  const s = document.createElement('script');
  s.src = url;
  s.crossOrigin = 'anonymous';
  s.onload = () => {
    console.log('Breaking Bad script loaded (if available).');
    alert('Breaking Bad script loaded (if available). Check console for details.');
    // If that script registers a voice name, try to add it to the list or store it.
  };
  s.onerror = () => {
    alert('Could not load the external script. It may not exist or CSP blocked it.');
  };
  document.head.appendChild(s);
});

// Event wiring
speakBtn.addEventListener('click', speak);
pauseBtn.addEventListener('click', pause);
resumeBtn.addEventListener('click', resume);
cancelBtn.addEventListener('click', cancel);
languageSelect.addEventListener('change', populateVoiceList);
brandSelect.addEventListener('change', (e) => {
  // Apply brand preset visually to controls
  const b = brandSelect.value;
  if(b && brandPresets[b]){
    pitchInput.value = brandPresets[b].pitch;
    rateInput.value = brandPresets[b].rate;
    volumeInput.value = brandPresets[b].volume;
  }
});

// Load voices when available
if ('speechSynthesis' in window) {
  // Some browsers load voices asynchronously
  window.speechSynthesis.onvoiceschanged = () => loadVoices();
  // Try immediate
  loadVoices();
} else {
  alert('Your browser does not support the Web Speech API (speechSynthesis). Try Chrome, Edge, or Safari with TTS enabled.');
}

/*
  Cloud TTS integration notes (server-side recommended)
  - Google Cloud TTS (REST v1):
    POST https://texttospeech.googleapis.com/v1/text:synthesize
    Body: {
      input: { text: "Hello" },
      voice: { languageCode: "en-US", name: "en-US-Wavenet-F" },
      audioConfig: { audioEncoding: "MP3" }
    }
    Use server credentials and return the audio blob to the browser for playback.

  - Microsoft Azure TTS:
    POST https://<region>.tts.speech.microsoft.com/cognitiveservices/v1
    Headers include Ocp-Apim-Subscription-Key and Content-Type: application/ssml+xml
    Body is SSML specifying voice name like "en-US-JennyNeural".

  Security note: do not put API keys into client-side code. Request audio from your server which calls the TTS API.
*/
