import { useState, useRef, useCallback } from 'react';
import { Song, MidiNote } from '../types';
import { initializeAudioContext, isAudioInitialized, createSynths } from '../src/audioContext';

// Tone.js is loaded from a script tag in index.html
declare const Tone: any;

export const useMidiPlayer = () => {
    const [playingSongId, setPlayingSongId] = useState<string | null>(null);
    const [activePitches, setActivePitches] = useState(new Set<number>());
    const [audioError, setAudioError] = useState<string | null>(null);
    
    const melodySynth = useRef<any>(null);
    const harmonySynth = useRef<any>(null);
    const scheduledEvents = useRef<number[]>([]);
    const isInitialized = useRef(false);

    const ensureAudioInitialized = async () => {
        if (!isAudioInitialized()) {
            await initializeAudioContext();
        }
        
        if (!isInitialized.current) {
            const synths = createSynths();
            melodySynth.current = synths.melodySynth;
            harmonySynth.current = synths.harmonySynth;
            isInitialized.current = true;
        }
    };

    const cleanup = () => {
        if (typeof Tone !== 'undefined' && Tone.Transport.state !== 'stopped') {
            Tone.Transport.stop();
            Tone.Transport.cancel();
        }
        melodySynth.current?.dispose();
        harmonySynth.current?.dispose();
        isInitialized.current = false;
    };

    const stop = useCallback(() => {
        if (Tone.Transport.state !== 'stopped') {
            Tone.Transport.stop();
            Tone.Transport.cancel();
            scheduledEvents.current.forEach(id => Tone.Transport.clear(id));
            scheduledEvents.current = [];
            melodySynth.current?.releaseAll();
            harmonySynth.current?.releaseAll();
        }
        setPlayingSongId(null);
        setActivePitches(new Set());
    }, []);

    const play = useCallback(async (song: Song) => {
        try {
            setAudioError(null);
            
            if (playingSongId === song.id) {
                stop();
                return;
            }

            // Initialize audio context and synthesizers on first user interaction
            await ensureAudioInitialized();

            stop(); // Stop any currently playing song
            setPlayingSongId(song.id);

            const schedulePart = (part: MidiNote[], synth: any) => {
                return new Tone.Part((time: number, note: any) => {
                    synth.triggerAttackRelease(Tone.Frequency(note.pitch, 'midi'), note.duration, time, note.velocity);
                    
                    if (synth === melodySynth.current) {
                        Tone.Draw.schedule(() => {
                            setActivePitches(prev => new Set(prev).add(note.pitch));
                        }, time);
                        Tone.Draw.schedule(() => {
                            setActivePitches(prev => {
                                const next = new Set(prev);
                                next.delete(note.pitch);
                                return next;
                            });
                        }, time + note.duration * 0.95);
                    }
                }, part.map(n => ({ ...n, time: n.startTime }))).start(0);
            };
            
            const melodyPart = schedulePart(song.melody || [], melodySynth.current);
            const harmonyPart = schedulePart(song.harmony || [], harmonySynth.current);

            const allNotes = [...(song.melody || []), ...(song.harmony || [])];
            const totalDuration = allNotes.length > 0 
                ? Math.max(...allNotes.map(n => n.startTime + n.duration)) 
                : 0;
            
            Tone.Transport.start();
            
            const stopEventId = Tone.Transport.scheduleOnce(() => stop(), totalDuration + 0.2);
            scheduledEvents.current = [melodyPart.id, harmonyPart.id, stopEventId];

        } catch (error) {
            console.error('Audio playback failed:', error);
            setAudioError('Audio playback failed. Please try again.');
            setPlayingSongId(null);
        }
    }, [playingSongId, stop]);
    
    return { play, stop, playingSongId, activePitches, audioError, cleanup };
};
