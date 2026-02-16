import { useEffect, useRef, useState, useCallback } from 'react';

// 8-bit style melody notes (frequencies in Hz)
// Classic Tetris-inspired melody pattern
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

// Bass line
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
  const [isMuted, setIsMuted] = useState(true); // Start muted, user must enable
  const [isPlaying, setIsPlaying] = useState(false);
  const animationFrameRef = useRef<number | null>(null);

  const createOscillator = useCallback((
    ctx: AudioContext,
    gainNode: GainNode,
    frequency: number,
    startTime: number,
    duration: number,
    type: OscillatorType = 'square'
  ) => {
    if (frequency === 0) return; // Rest note
    
    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();
    
    osc.type = type;
    osc.frequency.value = frequency;
    
    // 8-bit style envelope
    noteGain.gain.setValueAtTime(0, startTime);
    noteGain.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
    noteGain.gain.linearRampToValueAtTime(0.2, startTime + duration * 0.3);
    noteGain.gain.linearRampToValueAtTime(0, startTime + duration);
    
    osc.connect(noteGain);
    noteGain.connect(gainNode);
    
    osc.start(startTime);
    osc.stop(startTime + duration);
  }, []);

  const playMelody = useCallback(async () => {
    if (!audioContextRef.current || !gainNodeRef.current) return;
    
    const ctx = audioContextRef.current;
    const gainNode = gainNodeRef.current;
    
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const playLoop = () => {
      if (!isPlayingRef.current) return;
      
      const currentCtx = audioContextRef.current;
      const currentGain = gainNodeRef.current;
      if (!currentCtx || !currentGain) return;

      let melodyTime = currentCtx.currentTime + 0.1;
      let bassTime = currentCtx.currentTime + 0.1;

      // Schedule melody
      MELODY.forEach(({ note, duration }) => {
        createOscillator(currentCtx, currentGain, note, melodyTime, duration * 2, 'square');
        melodyTime += duration * 2;
      });

      // Schedule bass
      BASS.forEach(({ note, duration }) => {
        createOscillator(currentCtx, currentGain, note, bassTime, duration * 2, 'triangle');
        bassTime += duration * 2;
      });

      // Calculate total duration and schedule next loop
      const totalDuration = MELODY.reduce((acc, { duration }) => acc + duration * 2, 0);
      
      setTimeout(() => {
        if (isPlayingRef.current) {
          playLoop();
        }
      }, totalDuration * 1000);
    };

    playLoop();
  }, [createOscillator]);

  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
      gainNodeRef.current.gain.value = 0.15; // Lower volume for background music
    }
  }, []);

  const startMusic = useCallback(() => {
    initAudio();
    if (!isPlayingRef.current) {
      isPlayingRef.current = true;
      setIsPlaying(true);
      setIsMuted(false);
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = 0.15;
      }
      playMelody();
    }
  }, [initAudio, playMelody]);

  const stopMusic = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  const toggleMusic = useCallback(() => {
    if (isMuted || !isPlaying) {
      startMusic();
    } else {
      setIsMuted(true);
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = 0;
      }
    }
  }, [isMuted, isPlaying, startMusic]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMusic();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stopMusic]);

  return {
    isMuted,
    isPlaying,
    toggleMusic,
    startMusic,
    stopMusic,
  };
};
