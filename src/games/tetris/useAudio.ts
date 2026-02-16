import { useRef, useState, useCallback } from 'react';

// 8-bit style melody notes (frequencies in Hz)
const MELODY = [
  { note: 659.25, duration: 0.15 }, // E5
  { note: 493.88, duration: 0.15 }, // B4
  { note: 523.25, duration: 0.15 }, // C5
  { note: 587.33, duration: 0.15 }, // D5
  { note: 523.25, duration: 0.075 }, // C5
  { note: 493.88, duration: 0.075 }, // B4
  { note: 440.00, duration: 0.15 }, // A4
  { note: 440.00, duration: 0.15 }, // A4
  { note: 523.25, duration: 0.15 }, // C5
  { note: 659.25, duration: 0.15 }, // E5
  { note: 587.33, duration: 0.15 }, // D5
  { note: 523.25, duration: 0.15 }, // C5
  { note: 493.88, duration: 0.225 }, // B4
  { note: 523.25, duration: 0.15 }, // C5
  { note: 587.33, duration: 0.15 }, // D5
  { note: 659.25, duration: 0.15 }, // E5
  { note: 523.25, duration: 0.15 }, // C5
  { note: 440.00, duration: 0.15 }, // A4
  { note: 440.00, duration: 0.3 },  // A4
  { note: 0, duration: 0.15 },      // Rest
  { note: 587.33, duration: 0.15 }, // D5
  { note: 698.46, duration: 0.15 }, // F5
  { note: 880.00, duration: 0.15 }, // A5
  { note: 783.99, duration: 0.15 }, // G5
  { note: 698.46, duration: 0.15 }, // F5
  { note: 659.25, duration: 0.225 }, // E5
  { note: 523.25, duration: 0.15 }, // C5
  { note: 659.25, duration: 0.15 }, // E5
  { note: 587.33, duration: 0.15 }, // D5
  { note: 523.25, duration: 0.15 }, // C5
  { note: 493.88, duration: 0.15 }, // B4
  { note: 493.88, duration: 0.15 }, // B4
  { note: 523.25, duration: 0.15 }, // C5
  { note: 587.33, duration: 0.15 }, // D5
  { note: 659.25, duration: 0.15 }, // E5
  { note: 523.25, duration: 0.15 }, // C5
  { note: 440.00, duration: 0.15 }, // A4
  { note: 440.00, duration: 0.3 },  // A4
  { note: 0, duration: 0.3 },       // Rest
];

const BASS = [
  { note: 164.81, duration: 0.3 },  // E3
  { note: 146.83, duration: 0.3 },  // D3
  { note: 130.81, duration: 0.3 },  // C3
  { note: 123.47, duration: 0.3 },  // B2
  { note: 130.81, duration: 0.3 },  // C3
  { note: 146.83, duration: 0.3 },  // D3
  { note: 164.81, duration: 0.6 },  // E3
  { note: 110.00, duration: 0.3 },  // A2
  { note: 110.00, duration: 0.3 },  // A2
  { note: 146.83, duration: 0.3 },  // D3
  { note: 174.61, duration: 0.3 },  // F3
  { note: 164.81, duration: 0.6 },  // E3
  { note: 130.81, duration: 0.3 },  // C3
  { note: 164.81, duration: 0.3 },  // E3
  { note: 110.00, duration: 0.6 },  // A2
];

export const useAudio = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const isPlayingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMuted, setIsMuted] = useState(true);

  const createOscillator = useCallback((
    ctx: AudioContext,
    gainNode: GainNode,
    frequency: number,
    startTime: number,
    duration: number,
    type: OscillatorType = 'square'
  ) => {
    if (frequency === 0) return;
    
    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();
    
    osc.type = type;
    osc.frequency.value = frequency;
    
    noteGain.gain.setValueAtTime(0, startTime);
    noteGain.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
    noteGain.gain.linearRampToValueAtTime(0.2, startTime + duration * 0.3);
    noteGain.gain.linearRampToValueAtTime(0, startTime + duration);
    
    osc.connect(noteGain);
    noteGain.connect(gainNode);
    
    osc.start(startTime);
    osc.stop(startTime + duration);
  }, []);

  const scheduleLoop = useCallback(() => {
    if (!isPlayingRef.current || !audioContextRef.current || !gainNodeRef.current) return;
    
    const ctx = audioContextRef.current;
    const gainNode = gainNodeRef.current;

    let melodyTime = ctx.currentTime + 0.05;
    let bassTime = ctx.currentTime + 0.05;

    MELODY.forEach(({ note, duration }) => {
      createOscillator(ctx, gainNode, note, melodyTime, duration * 2, 'square');
      melodyTime += duration * 2;
    });

    BASS.forEach(({ note, duration }) => {
      createOscillator(ctx, gainNode, note, bassTime, duration * 2, 'triangle');
      bassTime += duration * 2;
    });

    const totalDuration = MELODY.reduce((acc, { duration }) => acc + duration * 2, 0);
    
    timeoutRef.current = setTimeout(() => {
      scheduleLoop();
    }, (totalDuration - 0.1) * 1000);
  }, [createOscillator]);

  const toggleMusic = useCallback(async () => {
    // If currently playing, stop it
    if (!isMuted && isPlayingRef.current) {
      isPlayingRef.current = false;
      setIsMuted(true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = 0;
      }
      return;
    }

    // Start playing - must happen in user gesture context
    try {
      // Create or get AudioContext
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }

      // Resume if suspended (required for iOS)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // Create gain node if needed
      if (!gainNodeRef.current) {
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.connect(audioContextRef.current.destination);
      }
      
      gainNodeRef.current.gain.value = 0.15;
      isPlayingRef.current = true;
      setIsMuted(false);
      
      // Start the loop
      scheduleLoop();
    } catch (error) {
      console.error('Audio initialization failed:', error);
    }
  }, [isMuted, scheduleLoop]);

  return {
    isMuted,
    toggleMusic,
  };
};
