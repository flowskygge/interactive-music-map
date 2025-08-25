import { useRef, useCallback } from 'react';
import { initializeAudioContext, isAudioInitialized, createSynths } from '../src/audioContext';

// Tone.js is loaded from a script tag in index.html
declare const Tone: any;

export const useRecordingSynths = () => {
    const recordingSynth = useRef<any>(null);
    const metronomeSynth = useRef<any>(null);
    const isInitialized = useRef(false);

    const ensureSynthsInitialized = async () => {
        if (!isAudioInitialized()) {
            await initializeAudioContext();
        }
        
        if (!isInitialized.current) {
            const synths = createSynths();
            recordingSynth.current = synths.recordingSynth;
            metronomeSynth.current = synths.metronomeSynth;
            isInitialized.current = true;
        }
    };

    const cleanup = useCallback(() => {
        recordingSynth.current?.dispose();
        metronomeSynth.current?.dispose();
        isInitialized.current = false;
    }, []);

    const triggerRecordingNote = useCallback(async (pitch: number) => {
        await ensureSynthsInitialized();
        if (typeof Tone !== 'undefined' && Tone.context.state !== 'running') {
            await Tone.context.resume();
        }
        recordingSynth.current?.triggerAttack(Tone.Frequency(pitch, 'midi').toFrequency());
    }, []);

    const releaseRecordingNote = useCallback((pitch: number) => {
        if (typeof Tone !== 'undefined' && recordingSynth.current) {
            recordingSynth.current.triggerRelease(Tone.Frequency(pitch, 'midi').toFrequency());
        }
    }, []);

    const triggerMetronome = useCallback((pitch: string, duration: string, time?: number) => {
        if (metronomeSynth.current) {
            metronomeSynth.current.triggerAttackRelease(pitch, duration, time);
        }
    }, []);

    return {
        ensureSynthsInitialized,
        cleanup,
        triggerRecordingNote,
        releaseRecordingNote,
        triggerMetronome,
        metronomeSynth: metronomeSynth.current
    };
};
