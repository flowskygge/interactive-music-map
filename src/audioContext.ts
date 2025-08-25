// Audio Context Manager
// This handles the browser's Web Audio API autoplay policy

declare const Tone: any;

let audioInitialized = false;

export const initializeAudioContext = async (): Promise<void> => {
  if (!audioInitialized) {
    try {
      await Tone.start();
      audioInitialized = true;
    } catch (error) {
      console.warn('Failed to initialize audio context:', error);
      throw error;
    }
  }
};

export const isAudioInitialized = (): boolean => {
  return audioInitialized;
};

// Create synthesizers only after audio context is initialized
export const createSynths = () => {
  if (!audioInitialized) {
    throw new Error('Audio context not initialized. Call initializeAudioContext() first.');
  }

  return {
    melodySynth: new Tone.PolySynth(Tone.Synth, { 
      oscillator: { type: 'fmsine' }, 
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 } 
    }).toDestination(),
    
    harmonySynth: new Tone.PolySynth(Tone.Synth, { 
      oscillator: { type: 'amtriangle' }, 
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 }, 
      volume: -8 
    }).toDestination(),
    
    metronomeSynth: new Tone.MembraneSynth({ 
      pitchDecay: 0.01, 
      octaves: 10, 
      oscillator: { type: 'sine' }, 
      envelope: { attack: 0.001, decay: 0.2, sustain: 0.01, release: 0.1 } 
    }).toDestination(),
    
    recordingSynth: new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 10,
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.5 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.1, decay: 0.3, sustain: 0.1, release: 0.5 }
    }).toDestination()
  };
};

// Reset audio state
export const resetAudioContext = (): void => {
  audioInitialized = false;
};
