

import React, { useState, useRef, useEffect } from 'react';
import type { Chat } from '@google/genai';
import { geminiChatModel, generateIllustration, textToSpeech, getStoryAmbiance } from './services/geminiService';
import type { ChatMessage } from './types';
import { MessageAuthor } from './types';
import { decode, decodeAudioData } from './utils/audio';
import IllustrationDisplay from './components/IllustrationDisplay';
import ChatInterface from './components/ChatInterface';

export type FontSize = 'sm' | 'base' | 'lg';

// Arrays for generating dynamic, descriptive image prompts
const imageAdjectives = [
  'whimsical', 'charming', 'vibrant', 'dreamy', 'enchanting', 'playful', 
  'cozy', 'magical', 'delightful', 'colorful', 'gentle', 'sweet'
];
const imageStyles = [
  'storybook illustration', 'watercolor painting', 'crayon drawing', 
  'colored pencil art', 'digital painting', 'charming cartoon style', 
  'gouache painting', 'delightful sketch'
];
const imageDetails = [
  'with soft, warm lighting', 'in a friendly, inviting world', 'featuring cute and lovable characters',
  'set in a beautiful, serene landscape', 'with a touch of sparkle and wonder', 
  'in a simple and clear style for kids', 'full of happy details'
];

const SAVE_KEY = 'storyTimeAIAdventureSave';

const FADE_TIME = 1.5; // 1.5 seconds for audio crossfade
const AMBIANCE_VOLUME = 0.3;

const ambianceAudioMap: Record<string, string> = {
  forest: 'https://upload.wikimedia.org/wikipedia/commons/4/41/Forest_sounds.ogg',
  cave: 'https://upload.wikimedia.org/wikipedia/commons/0/0d/Sound_of_a_cave.ogg',
  celebration: 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Crowd_Cheering_Sound_Effect.ogg',
  mystery: 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Creepy_Music_Box.ogg',
  ocean: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Ocean_waves_sound_effect.ogg',
  calm: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Peaceful_sound_of_a_small_stream.ogg',
};

const availableVoices = ['Puck', 'Charon', 'Fenrir', 'Zephyr'];
const narratorVoice = 'Kore';

interface StoryState {
  chatHistory: ChatMessage[];
  imageUrl: string | null;
  choices: string[];
}

/**
 * Selects a random element from an array.
 * @param arr The array to select from.
 * @returns A random element from the array.
 */
function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const welcomeMessage: ChatMessage = {
  author: MessageAuthor.MODEL,
  text: "Hello! I can tell you a story. What should our adventure be about today?",
};

const initialStoryState: StoryState = {
  chatHistory: [welcomeMessage],
  imageUrl: "https://picsum.photos/seed/welcome/1024/1024",
  choices: [],
};


const App: React.FC = () => {
  // App state
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(initialStoryState.chatHistory);
  const [imageUrl, setImageUrl] = useState<string | null>(initialStoryState.imageUrl);
  const [isLoading, setIsLoading] = useState(true);
  const [choices, setChoices] = useState<string[]>(initialStoryState.choices);
  const [fontSize, setFontSize] = useState<FontSize>('base');
  const [fontFamily, setFontFamily] = useState<string>("'Nunito', sans-serif");
  const [isSaveAvailable, setIsSaveAvailable] = useState(false);
  const [isShareable, setIsShareable] = useState(false);
  const [isAmbianceMuted, setIsAmbianceMuted] = useState(false);
  const [characterVoices, setCharacterVoices] = useState<Record<string, string>>({ NARRATOR: narratorVoice });

  // Undo/Redo state
  const [history, setHistory] = useState<StoryState[]>([initialStoryState]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  
  // Refs
  const chatSession = useRef<Chat | null>(null);
  const welcomeAudioHandled = useRef(false);
  const narrationAudioContext = useRef<AudioContext | null>(null);
  const currentNarrationSource = useRef<AudioBufferSourceNode | null>(null);
  const narrationQueue = useRef<string[]>([]);
  const isPlayingNarration = useRef(false);
  const narrationVersion = useRef(0);
  
  const ambianceAudioContext = useRef<AudioContext | null>(null);
  const ambianceGainNode = useRef<GainNode | null>(null);
  const currentAmbianceSource = useRef<AudioBufferSourceNode | null>(null);
  const currentAmbianceUrl = useRef<string | null>(null);

  useEffect(() => {
    const initializeApp = () => {
      const savedData = localStorage.getItem(SAVE_KEY);
      setIsSaveAvailable(!!savedData);

      chatSession.current = geminiChatModel;
      
      // Play welcome audio in the background without blocking the UI
      textToSpeech(welcomeMessage.text, narratorVoice)
        .then(audioData => {
            if (!welcomeAudioHandled.current) {
              welcomeAudioHandled.current = true;
              playNarration(audioData);
            }
        })
        .catch(error => {
            console.warn("Could not play welcome message audio:", error);
            welcomeAudioHandled.current = true;
        });

      setIsLoading(false);
    };
    initializeApp();
  }, []);

  // Sync component state with history for undo/redo
  useEffect(() => {
    if (history[historyIndex]) {
      const { chatHistory, imageUrl, choices } = history[historyIndex];
      setChatHistory(chatHistory);
      setImageUrl(imageUrl);
      setChoices(choices);
    }
  }, [history, historyIndex]);

  useEffect(() => {
    const storyHasBegun = chatHistory.length > 1 && imageUrl && !imageUrl.includes('picsum.photos/seed/welcome');
    setIsShareable(storyHasBegun);
  }, [chatHistory, imageUrl]);

  const stopNarration = () => {
    narrationVersion.current++;
    narrationQueue.current = [];
    if (currentNarrationSource.current) {
        try {
            currentNarrationSource.current.stop();
            currentNarrationSource.current.disconnect();
        } catch(e) { /* Ignore error if source is already stopped */ }
        currentNarrationSource.current = null;
    }
    isPlayingNarration.current = false;
  };

  const playNarration = async (base64Audio: string) => {
    stopNarration();
    narrationQueue.current = [base64Audio];
    await processNarrationQueue();
  }
  
  const playNarrationSequence = async (audioDataArray: string[]) => {
    stopNarration();
    narrationQueue.current = audioDataArray;
    await processNarrationQueue();
  };
  
  const processNarrationQueue = async () => {
    const currentVersion = narrationVersion.current;

    if (isPlayingNarration.current || narrationQueue.current.length === 0) {
      return;
    }
    isPlayingNarration.current = true;
  
    const audioData = narrationQueue.current.shift();
    if (!audioData) {
      isPlayingNarration.current = false;
      return;
    }
  
    if (!narrationAudioContext.current) {
      try {
        narrationAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      } catch (e) {
        console.error("Failed to create Narration AudioContext:", e);
        isPlayingNarration.current = false;
        return;
      }
    }
  
    if (narrationAudioContext.current.state === 'suspended') {
      try {
        await narrationAudioContext.current.resume();
      } catch (e) {
        console.error("Failed to resume Narration AudioContext:", e);
        isPlayingNarration.current = false;
        return;
      }
    }

    if (currentVersion !== narrationVersion.current) {
        isPlayingNarration.current = false;
        return;
    }
  
    try {
      const decodedAudio = decode(audioData);
      const audioBuffer = await decodeAudioData(decodedAudio, narrationAudioContext.current, 24000, 1);
      
      if (currentVersion !== narrationVersion.current) {
        isPlayingNarration.current = false;
        return;
      }

      const source = narrationAudioContext.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(narrationAudioContext.current.destination);
      source.start();
      currentNarrationSource.current = source;
  
      source.onended = () => {
        isPlayingNarration.current = false;
        if (currentNarrationSource.current === source) {
          currentNarrationSource.current = null;
        }
        if (currentVersion === narrationVersion.current) {
            processNarrationQueue(); // Play next in queue
        }
      };
    } catch (e) {
      console.error("Failed to play narration chunk", e);
      isPlayingNarration.current = false;
      if (currentVersion === narrationVersion.current) {
        processNarrationQueue(); // Try next item
      }
    }
  };


  const playAmbiance = async (url: string) => {
    if (url === currentAmbianceUrl.current) return;
    currentAmbianceUrl.current = url;

    if (!ambianceAudioContext.current) {
      try {
        ambianceAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        ambianceGainNode.current = ambianceAudioContext.current.createGain();
        ambianceGainNode.current.connect(ambianceAudioContext.current.destination);
        ambianceGainNode.current.gain.value = isAmbianceMuted ? 0 : AMBIANCE_VOLUME;
      } catch (e) {
        console.error("Failed to create Ambiance AudioContext. Web Audio API may not be supported.", e);
        return;
      }
    }
    const audioCtx = ambianceAudioContext.current;

    if (audioCtx.state === 'suspended') {
      try {
        await audioCtx.resume();
      } catch (e) {
        console.error("Failed to resume Ambiance AudioContext.", e);
        return;
      }
    }

    const gainNode = ambianceGainNode.current!;

    if (currentAmbianceSource.current) {
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + FADE_TIME);
      const oldSource = currentAmbianceSource.current;
      setTimeout(() => {
        try {
          oldSource.stop();
          oldSource.disconnect();
        } catch(e) { /* ignore */ }
      }, FADE_TIME * 1000);
      currentAmbianceSource.current = null;
    }
    
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch audio: HTTP ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.startsWith('audio/')) {
        console.warn(`Expected an audio file, but received content-type: ${contentType}. Attempting to decode anyway.`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength < 1024) { // Check for a reasonably sized file
        throw new Error(`Received an empty or suspiciously small audio file (${arrayBuffer.byteLength} bytes).`);
      }
      
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      
      const newSource = audioCtx.createBufferSource();
      newSource.buffer = audioBuffer;
      newSource.loop = true;
      newSource.connect(gainNode);
      newSource.start(audioCtx.currentTime + FADE_TIME);
      currentAmbianceSource.current = newSource;
      
      gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
      if (!isAmbianceMuted) {
        const rampStartTime = audioCtx.currentTime + FADE_TIME - 0.1;
        gainNode.gain.setValueAtTime(0, rampStartTime > 0 ? rampStartTime : 0);
        gainNode.gain.linearRampToValueAtTime(AMBIANCE_VOLUME, audioCtx.currentTime + FADE_TIME * 2);
      } else {
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      }
    } catch (error) {
      console.error("Could not play ambiance audio:", error);
      currentAmbianceUrl.current = null;
    }
  };


  const handleSendMessage = async (userInput: string) => {
    if (!userInput.trim() || isLoading || !chatSession.current) return;

    welcomeAudioHandled.current = true;
    stopNarration();
    
    setIsLoading(true);
    setChoices([]);
    
    const userMessage: ChatMessage = { author: MessageAuthor.USER, text: userInput };
    const currentChatHistory = history[historyIndex]?.chatHistory || [];
    const newChatHistory = [...currentChatHistory, userMessage];

    // Optimistically update UI
    setChatHistory(newChatHistory);
    
    try {
      const response = await chatSession.current.sendMessage({ message: userInput });
      let storyText: string;
      let newChoices: string[] = [];
      
      try {
        const parsedResponse = JSON.parse(response.text);
        storyText = parsedResponse.story;
        newChoices = parsedResponse.choices;
        if (typeof storyText !== 'string' || !Array.isArray(newChoices)) throw new Error("Invalid JSON structure");
      } catch (error) {
          console.warn("Could not parse model response as JSON. Treating as plain text.", error);
          storyText = response.text;
      }
      
      const modelMessage: ChatMessage = { author: MessageAuthor.MODEL, text: storyText };
      const finalChatHistory = [...newChatHistory, modelMessage];
      
      const imagePrompt = `A ${getRandomElement(imageAdjectives)} ${getRandomElement(imageStyles)}, ${getRandomElement(imageDetails)}, of: ${storyText.replace(/{[^}]+}/g, '').substring(0, 300)}`;
      const newImageUrlPromise = generateIllustration(imagePrompt);
      const ambianceKeywordPromise = getStoryAmbiance(storyText);

      // --- Character Voice Logic ---
      const dialogueParts: { speaker: string, text: string }[] = [];
      const newCharacterVoices = { ...characterVoices };
      const unassignedChars = new Set<string>();
      
      const matches = storyText.matchAll(/\[([A-Z\s]+)\]([^\[]*)/g);
      for (const match of matches) {
          const speaker = match[1].trim();
          const text = match[2].replace(/{[^}]+}/g, (match) => match.split('|')[0].substring(1)).trim();
          if (!text) continue;
          dialogueParts.push({ speaker, text });
          if (!newCharacterVoices[speaker]) {
            unassignedChars.add(speaker);
          }
      }

      if (dialogueParts.length === 0 && storyText.trim()) { // Handle un-tagged text
        dialogueParts.push({ speaker: 'NARRATOR', text: storyText });
      }
      
      const assignedVoices = new Set(Object.values(newCharacterVoices));
      const availableVoicePool = availableVoices.filter(v => !assignedVoices.has(v));
      
      unassignedChars.forEach(char => {
          if (availableVoicePool.length > 0) {
              newCharacterVoices[char] = availableVoicePool.shift()!;
          } else {
              console.warn("All unique voices are assigned. Reusing a random voice for new characters.");
              newCharacterVoices[char] = getRandomElement(availableVoices);
          }
      });
      setCharacterVoices(newCharacterVoices);
      
      const audioPromises = dialogueParts.map(part => textToSpeech(part.text, newCharacterVoices[part.speaker] || narratorVoice));
      
      const [newImageUrl, ambianceKeyword, ...audioData] = await Promise.all([newImageUrlPromise, ambianceKeywordPromise, ...audioPromises]);

      // --- Final State Update ---
      const newState: StoryState = {
        chatHistory: finalChatHistory,
        imageUrl: newImageUrl,
        choices: newChoices
      };
      
      const newHistory = history.slice(0, historyIndex + 1);
      setHistory([...newHistory, newState]);
      setHistoryIndex(newHistory.length);

      playAmbiance(ambianceAudioMap[ambianceKeyword] || ambianceAudioMap.calm);
      await playNarrationSequence(audioData);

    } catch (error) {
      console.error("An error occurred:", error);
      const errorMessage: ChatMessage = { author: MessageAuthor.MODEL, text: "Oh dear! My imagination got stuck. Let's try telling a different story." };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFontSizeChange = (size: FontSize) => setFontSize(size);
  const handleFontFamilyChange = (family: string) => setFontFamily(family);

  const handleSaveStory = () => {
    const saveData = {
      history,
      historyIndex,
      fontSize,
      fontFamily,
      characterVoices
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    setIsSaveAvailable(true);
    alert("Story Saved!");
  };

  const handleLoadStory = () => {
    const savedData = localStorage.getItem(SAVE_KEY);
    if (savedData) {
      stopNarration();
      if (currentAmbianceSource.current) {
        try {
          currentAmbianceSource.current.stop();
        } catch (e) { /* ignore */ }
        currentAmbianceUrl.current = null;
      }
      const parsedData = JSON.parse(savedData);
      setHistory(parsedData.history);
      setHistoryIndex(parsedData.historyIndex);
      setFontSize(parsedData.fontSize);
      setFontFamily(parsedData.fontFamily);
      setCharacterVoices(parsedData.characterVoices || { NARRATOR: narratorVoice });
      setIsLoading(false);
    }
  };

  const handleShareStory = () => {
    if (!isShareable) return;
    const storyText = chatHistory
      .filter(msg => msg.author === MessageAuthor.MODEL)
      .slice(1) // Exclude welcome message
      .map(msg => `<p>${msg.text.replace(/{[^}]+}/g, (match) => match.split('|')[0].substring(1)).replace(/\[.*?\]/g, '').trim()}</p>`)
      .join('');

    const htmlContent = `
      <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>My StoryTime Adventure</title><style>
      @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700&display=swap');
      body{font-family:'Nunito',sans-serif;line-height:1.6;color:#333;max-width:800px;margin:2rem auto;padding:2rem;background-color:#fdfcff;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,0.05);}
      h1{color:#6d28d9;text-align:center;}img{max-width:100%;height:auto;display:block;margin:2rem auto;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);}
      </style></head><body><h1>My StoryTime Adventure</h1><img src="${imageUrl}" alt="Story Illustration">${storyText}</body></html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'story-time-adventure.html';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };
  
  const handleToggleAmbianceMute = () => {
    const newMutedState = !isAmbianceMuted;
    setIsAmbianceMuted(newMutedState);
    if (ambianceGainNode.current && ambianceAudioContext.current) {
      const targetVolume = newMutedState ? 0 : AMBIANCE_VOLUME;
      ambianceGainNode.current.gain.linearRampToValueAtTime(targetVolume, ambianceAudioContext.current.currentTime + 0.5);
    }
  };

  const handleUndo = () => canUndo && setHistoryIndex(historyIndex - 1);
  const handleRedo = () => canRedo && setHistoryIndex(historyIndex + 1);

  return (
    <main className="h-screen w-screen bg-gradient-to-br from-yellow-100 via-blue-100 to-purple-200 overflow-hidden">
      <div className="container mx-auto h-full p-4">
        <div className="h-full flex flex-col lg:flex-row bg-white/30 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/50">
          <IllustrationDisplay imageUrl={imageUrl} isLoading={isLoading} />
          <ChatInterface 
            messages={chatHistory} 
            onSendMessage={handleSendMessage} 
            isLoading={isLoading}
            choices={choices}
            fontSize={fontSize}
            fontFamily={fontFamily}
            onFontSizeChange={handleFontSizeChange}
            onFontFamilyChange={handleFontFamilyChange}
            onSaveStory={handleSaveStory}
            onLoadStory={handleLoadStory}
            isSaveAvailable={isSaveAvailable}
            onShareStory={handleShareStory}
            isShareable={isShareable}
            isAmbianceMuted={isAmbianceMuted}
            onToggleAmbianceMute={handleToggleAmbianceMute}
            onUndo={handleUndo}
            onRedo={handleRedo}
            isUndoDisabled={!canUndo}
            isRedoDisabled={!canRedo}
          />
        </div>
      </div>
    </main>
  );
};

export default App;
