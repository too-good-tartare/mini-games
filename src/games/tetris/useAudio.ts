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
  const sfxGainRef = useRef<GainNode | null>(null);
  const isPlayingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMuted, setIsMuted] = useState(true);

  const getAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    if (!sfxGainRef.current) {
      sfxGainRef.current = audioContextRef.current.createGain();
      sfxGainRef.current.connect(audioContextRef.current.destination);
      sfxGainRef.current.gain.value = 0.3;
    }
    return audioContextRef.current;
  }, []);

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

  // Line clear sound effect - 8-bit celebration sound
  const playLineClear = useCallback(async (lineCount: number = 1) => {
    try {
      const ctx = await getAudioContext();
      if (!sfxGainRef.current) return;

      const now = ctx.currentTime;
      
      // Different sounds based on line count
      if (lineCount >= 4) {
        // TETRIS! - Epic arpeggio
        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1046.50, 783.99, 659.25];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.4, now + i * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.15);
          osc.connect(gain);
          gain.connect(sfxGainRef.current!);
          osc.start(now + i * 0.05);
          osc.stop(now + i * 0.05 + 0.15);
        });
      } else {
        // Normal line clear - quick ascending beeps
        const baseNotes = [440, 554.37, 659.25];
        for (let line = 0; line < lineCount; line++) {
          baseNotes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = freq * (1 + line * 0.2);
            const startTime = now + line * 0.12 + i * 0.04;
            gain.gain.setValueAtTime(0.3, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.1);
            osc.connect(gain);
            gain.connect(sfxGainRef.current!);
            osc.start(startTime);
            osc.stop(startTime + 0.1);
          });
        }
      }
    } catch (error) {
      console.error('SFX error:', error);
    }
  }, [getAudioContext]);

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

    try {
      const ctx = await getAudioContext();

      if (!gainNodeRef.current) {
        gainNodeRef.current = ctx.createGain();
        gainNodeRef.current.connect(ctx.destination);
      }
      
      gainNodeRef.current.gain.value = 0.15;
      isPlayingRef.current = true;
      setIsMuted(false);
      
      scheduleLoop();
    } catch (error) {
      console.error('Audio initialization failed:', error);
    }
  }, [isMuted, getAudioContext, scheduleLoop]);

  return {
    isMuted,
    toggleMusic,
    playLineClear,
  };
};
