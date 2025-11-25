import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Play, RefreshCw, Volume2, Info, CheckCircle, AlertCircle, XCircle, Settings } from 'lucide-react';

/**
 * SPANISH PARAGRAPH DATA
 * A small database of paragraphs categorized by difficulty.
 */
const PARAGRAPHS = {
  Beginner: [
    "Hola, me llamo Carlos. Vivo en una casa pequeña con mi familia. Me gusta jugar al fútbol con mis amigos en el parque. Hoy hace mucho sol y estoy feliz.",
    "El gato duerme en el sofá. La comida está en la cocina. Mi hermano tiene un perro grande y blanco. Nosotros vamos a la escuela todos los días.",
    "Yo desayuno pan con café. Mi hermana bebe jugo de naranja. Me gusta leer libros interesantes en la biblioteca. La biblioteca es muy grande y silenciosa.",
    "Tengo una bicicleta roja. Me gusta pasear por la ciudad los domingos. Las flores en el parque son muy bonitas. El cielo es azul y hay nubes blancas."
  ],
  Intermediate: [
    "Ayer fui al mercado para comprar frutas frescas. Me encanta cocinar platos tradicionales para mi familia los fines de semana. Aunque a veces es difícil encontrar todos los ingredientes, siempre intento preparar algo delicioso.",
    "El próximo verano, planeo viajar a España. Quiero visitar Madrid y Barcelona para conocer la cultura y la historia. Estoy aprendiendo español todos los días para poder hablar con la gente local.",
    "Mi trabajo es muy interesante pero a veces es estresante. Trabajo en una oficina en el centro de la ciudad. Cuando termino de trabajar, me gusta ir al gimnasio para relajarme y hacer ejercicio.",
    "La tecnología cambia nuestra vida rápidamente. Ahora podemos comunicarnos con personas de todo el mundo en segundos. Sin embargo, es importante pasar tiempo con la familia sin usar los teléfonos móviles."
  ],
  Advanced: [
    "La economía global enfrenta desafíos significativos en la actualidad. Los expertos sugieren que la innovación tecnológica y la sostenibilidad deben ser prioridades para garantizar un futuro próspero para las próximas generaciones.",
    "La literatura latinoamericana es conocida por su realismo mágico, un estilo que mezcla elementos fantásticos con la realidad cotidiana. Autores como Gabriel García Márquez han dejado una huella imborrable en la cultura mundial.",
    "Aunque el cambio climático es un problema complejo, pequeñas acciones individuales pueden tener un gran impacto colectivo. Reducir el consumo de plástico y utilizar energías renovables son pasos fundamentales hacia un planeta más saludable.",
    "El desarrollo de la inteligencia artificial plantea preguntas éticas profundas sobre el futuro del trabajo y la privacidad humana. Es crucial establecer regulaciones que equilibren el progreso tecnológico con los derechos fundamentales de las personas."
  ]
};

/**
 * PHONETIC HELPER
 * A heuristic function to generate simplified phonetic hints for Spanish words.
 * Not perfect IPA, but "Gringo-friendly" hints.
 */
const getPhoneticHint = (word) => {
  let w = word.toLowerCase();
  
  // Basic replacements for pronunciation guidance
  w = w.replace(/ll/g, 'y');
  w = w.replace(/ñ/g, 'ny');
  w = w.replace(/ch/g, 'ch');
  w = w.replace(/j/g, 'h');
  w = w.replace(/ge/g, 'he');
  w = w.replace(/gi/g, 'hi');
  w = w.replace(/ce/g, 'se'); // Latin American style
  w = w.replace(/ci/g, 'si');
  w = w.replace(/gui/g, 'gi');
  w = w.replace(/gue/g, 'ge');
  w = w.replace(/qu/g, 'k');
  w = w.replace(/v/g, 'b'); // Soft b
  w = w.replace(/z/g, 's'); // Latin American style
  w = w.replace(/h/g, ''); // Silent h (unless ch)
  
  // Syllabification heuristic (simplified)
  // Insert dashes after vowels roughly
  w = w.replace(/([aeiouáéíóú])([^aeiouáéíóú\s])/g, '$1-$2');
  
  return w.toUpperCase();
};

/**
 * LEVENSHTEIN DISTANCE
 * Calculates how different two words are.
 */
const levenshteinDistance = (a, b) => {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

const cleanWord = (word) => word.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");

export default function SpanishPronunciationCoach() {
  // State
  const [level, setLevel] = useState('Beginner');
  const [paragraph, setParagraph] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [analyzedWords, setAnalyzedWords] = useState([]); // [{ word, status, cleanWord, phonetic }]
  const [feedbackSummary, setFeedbackSummary] = useState(null);
  const [score, setScore] = useState(0);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [hoveredWordIndex, setHoveredWordIndex] = useState(null);
  const [browserSupported, setBrowserSupported] = useState(true);

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  // Initialize
  useEffect(() => {
    // Load Voices
    const loadVoices = () => {
      const vs = synthRef.current.getVoices();
      // Filter for Spanish voices
      const spanishVoices = vs.filter(v => v.lang.startsWith('es'));
      setVoices(spanishVoices);
      if (spanishVoices.length > 0) {
        // Prefer Google Español or Microsoft Elena if available, otherwise first one
        const preferred = spanishVoices.find(v => v.name.includes('Google') || v.name.includes('Mexico')) || spanishVoices[0];
        setSelectedVoice(preferred);
      }
    };

    loadVoices();
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = loadVoices;
    }

    // Check Speech Recognition Support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'es-ES'; // Default to generic Spanish, can be adjusted
      recognitionRef.current = recognition;
    } else {
      setBrowserSupported(false);
    }

    generateNewParagraph('Beginner');
  }, []);

  const generateNewParagraph = (selectedLevel = level) => {
    const options = PARAGRAPHS[selectedLevel];
    const randomPara = options[Math.floor(Math.random() * options.length)];
    setParagraph(randomPara);
    
    // Reset Analysis
    const words = randomPara.split(' ').map(w => ({
      original: w,
      clean: cleanWord(w),
      status: 'neutral', // neutral, correct, close, poor
      phonetic: getPhoneticHint(cleanWord(w))
    }));
    setAnalyzedWords(words);
    setFeedbackSummary(null);
    setScore(0);
  };

  const handleLevelChange = (e) => {
    const newLevel = e.target.value;
    setLevel(newLevel);
    generateNewParagraph(newLevel);
  };

  const speakText = (text, rate = 0.9) => {
    if (synthRef.current.speaking) {
      synthRef.current.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = rate;
    utterance.lang = 'es-ES';
    synthRef.current.speak(utterance);
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) return;

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      setFeedbackSummary(null); // Clear previous feedback
      
      // Reset word statuses to neutral while recording
      setAnalyzedWords(prev => prev.map(w => ({ ...w, status: 'neutral' })));

      recognitionRef.current.start();
      
      let finalTranscript = '';
      
      recognitionRef.current.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
        analyzePronunciation(finalTranscript);
      };
      
      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };
    }
  };

  const analyzePronunciation = (transcript) => {
    if (!transcript) return;

    const spokenWords = transcript.trim().split(/\s+/).map(cleanWord);
    const targets = [...analyzedWords];
    let correctCount = 0;
    
    // Simple matching algorithm (Greedy match with window)
    // For each target word, look ahead in spoken words to find a match
    
    let spokenIndex = 0;
    
    const newAnalyzedWords = targets.map((target, index) => {
      // Look ahead up to 3 words to find a match
      let bestMatchStatus = 'poor';
      let bestMatchDistance = 100;
      let matchedIndex = -1;

      for (let i = spokenIndex; i < Math.min(spokenIndex + 5, spokenWords.length); i++) {
        const dist = levenshteinDistance(target.clean, spokenWords[i]);
        const len = Math.max(target.clean.length, spokenWords[i].length);
        const similarity = 1 - (dist / len);

        if (similarity > 0.85) { // High similarity
          bestMatchStatus = 'correct';
          matchedIndex = i;
          break; // Found it!
        } else if (similarity > 0.5) { // Medium similarity
          if (bestMatchStatus === 'poor') {
            bestMatchStatus = 'close';
            matchedIndex = i;
          }
        }
      }

      // If we found a match, advance our pointer so we don't reuse the spoken word
      if (matchedIndex !== -1) {
        spokenIndex = matchedIndex + 1;
      }

      if (bestMatchStatus === 'correct') correctCount++;

      return {
        ...target,
        status: bestMatchStatus
      };
    });

    setAnalyzedWords(newAnalyzedWords);

    // Calculate Score
    const finalScore = Math.round((correctCount / targets.length) * 100);
    setScore(finalScore);

    // Generate Summary
    if (finalScore >= 90) {
      setFeedbackSummary({
        text: "¡Excelente! Your pronunciation is very clear.",
        color: "text-green-600"
      });
    } else if (finalScore >= 70) {
      setFeedbackSummary({
        text: "Very Good! You're getting there, just watch a few specific words.",
        color: "text-orange-600"
      });
    } else {
      setFeedbackSummary({
        text: "Good effort. Try to slow down and focus on the red words.",
        color: "text-red-600"
      });
    }
  };

  const getWordColor = (status) => {
    switch (status) {
      case 'correct': return 'text-green-700 bg-green-50 border-b-2 border-green-200';
      case 'close': return 'text-orange-600 bg-orange-50 border-b-2 border-orange-200';
      case 'poor': return 'text-red-600 bg-red-50 border-b-2 border-red-200';
      default: return 'text-gray-700';
    }
  };

  if (!browserSupported) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Browser Not Supported</h2>
          <p className="text-gray-600">
            Sorry! This app requires the <strong>Web Speech API</strong>, which is best supported in Google Chrome, Edge, or Safari. Firefox support is currently limited.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="text-indigo-600 text-4xl">ñ</span>
              Spanish Pronunciation Coach
            </h1>
            <p className="text-slate-500 mt-1">Practice your accent with AI feedback</p>
          </div>
          <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
            <Settings className="w-4 h-4 text-slate-400" />
            <select 
              value={level} 
              onChange={handleLevelChange}
              className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer outline-none"
            >
              <option value="Beginner">Level: Beginner</option>
              <option value="Intermediate">Level: Intermediate</option>
              <option value="Advanced">Level: Advanced</option>
            </select>
          </div>
        </header>

        {/* Instructions */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-sm text-indigo-800 flex items-start gap-3">
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">How it works:</p>
            <ol className="list-decimal ml-4 space-y-1">
              <li>Listen to the native reading first.</li>
              <li>Press the microphone and read the paragraph aloud.</li>
              <li>Stop recording to see your color-coded results.</li>
              <li><strong>Click words</strong> to hear the correct pronunciation and see hints.</li>
            </ol>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          
          {/* Controls */}
          <div className="bg-slate-50 border-b border-slate-100 p-4 flex flex-wrap gap-3 items-center justify-between">
             <div className="flex gap-2">
                <button 
                  onClick={() => speakText(paragraph)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-full text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <Volume2 className="w-4 h-4 text-indigo-600" />
                  Listen to native reading
                </button>
                <button 
                  onClick={() => generateNewParagraph()}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-full text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <RefreshCw className="w-4 h-4 text-indigo-600" />
                  New Paragraph
                </button>
             </div>
             
             {/* Score Badge */}
             {feedbackSummary && (
               <div className={`px-4 py-1 rounded-full font-bold text-lg border ${
                 score > 80 ? 'bg-green-100 text-green-700 border-green-200' :
                 score > 60 ? 'bg-orange-100 text-orange-700 border-orange-200' :
                 'bg-red-100 text-red-700 border-red-200'
               }`}>
                 Score: {score}%
               </div>
             )}
          </div>

          {/* Text Display Area */}
          <div className="p-8 md:p-12 relative min-h-[200px] flex flex-col justify-center">
             <div className="text-xl md:text-2xl leading-relaxed text-center font-serif text-slate-700">
                {analyzedWords.map((item, idx) => (
                  <span key={idx} className="relative inline-block mx-1 my-1 group">
                    {/* The Word */}
                    <span 
                      className={`cursor-pointer px-1 rounded transition-colors duration-200 ${getWordColor(item.status)}`}
                      onMouseEnter={() => setHoveredWordIndex(idx)}
                      onMouseLeave={() => setHoveredWordIndex(null)}
                      onClick={() => speakText(item.original)}
                    >
                      {item.original}
                    </span>

                    {/* Tooltip */}
                    <div 
                      className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-2xl z-20 pointer-events-none transition-all duration-200 transform
                        ${hoveredWordIndex === idx ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
                      `}
                    >
                      <div className="text-center">
                        <p className="text-slate-400 uppercase text-[10px] tracking-wider mb-1">Pronunciation</p>
                        <p className="text-base font-bold text-yellow-300 mb-2 font-mono">"{item.phonetic}"</p>
                        <div className="flex items-center justify-center gap-1 text-[10px] text-slate-300 bg-slate-700 py-1 px-2 rounded-full">
                           <Volume2 className="w-3 h-3" /> Click word to listen
                        </div>
                      </div>
                      {/* Triangle Arrow */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-top-slate-800"></div>
                    </div>
                  </span>
                ))}
             </div>
          </div>

          {/* Action Bar */}
          <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center">
            <button
              onClick={toggleRecording}
              className={`
                group relative flex items-center justify-center w-20 h-20 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105
                ${isRecording 
                  ? 'bg-red-500 hover:bg-red-600 ring-4 ring-red-200 animate-pulse' 
                  : 'bg-indigo-600 hover:bg-indigo-700 ring-4 ring-indigo-200'}
              `}
            >
              {isRecording ? (
                <Square className="w-8 h-8 text-white fill-current" />
              ) : (
                <Mic className="w-8 h-8 text-white" />
              )}
            </button>
          </div>
          
          {/* Recording Status Text */}
          <div className="pb-4 text-center bg-slate-50">
             <p className="text-sm font-medium text-slate-500 animate-pulse h-5">
               {isRecording ? "Listening... Speak clearly..." : ""}
             </p>
          </div>
        </div>

        {/* Feedback Section */}
        {feedbackSummary && (
          <div className="grid md:grid-cols-3 gap-4 animate-fade-in-up">
            
            {/* Summary Card */}
            <div className="col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-2">Analysis</h3>
              <p className={`text-lg font-medium ${feedbackSummary.color}`}>
                {feedbackSummary.text}
              </p>
              
              <div className="mt-4 flex gap-6 text-sm">
                 <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-green-500"></div>
                   <span className="text-slate-600">Good</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                   <span className="text-slate-600">Close</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-red-500"></div>
                   <span className="text-slate-600">Needs Work</span>
                 </div>
              </div>
            </div>

            {/* Practice Chips */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                Practice Words
              </h3>
              <div className="flex flex-wrap gap-2">
                {analyzedWords.filter(w => w.status === 'poor').length === 0 ? (
                  <div className="text-green-600 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" /> All good!
                  </div>
                ) : (
                  analyzedWords
                    .filter(w => w.status === 'poor' || w.status === 'close')
                    .slice(0, 5) // Show top 5 worst
                    .map((item, i) => (
                      <button 
                        key={i}
                        onClick={() => speakText(item.original, 0.7)} // Slow speed
                        className="px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-sm font-medium hover:bg-red-100 transition-colors flex items-center gap-1"
                      >
                        {item.original}
                        <Volume2 className="w-3 h-3" />
                      </button>
                    ))
                )}
              </div>
            </div>
          </div>
        )}

      </div>
      
      {/* Footer */}
      <div className="mt-12 text-center text-slate-400 text-sm">
         <p>Spanish Pronunciation Coach &copy; 2024</p>
      </div>
    </div>
  );
}