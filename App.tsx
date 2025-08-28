import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Song, MidiNote, MapPosition, RecordingState, UploadedCorpus, MidiStatus, TimeSignature, Quantization } from './types';
import * as geminiService from './services/geminiService';
import * as dbService from './services/dbService';
import { useMidiRecorder } from './hooks/useMidiRecorder';
import { useMidiPlayer } from './hooks/useMidiPlayer';
import { MusicMap } from './components/MusicMap';
import { VirtualPiano } from './components/VirtualPiano';
import { PlayIcon, StopIcon, RecordIcon, LoadingSpinner, MusicNoteIcon, MidiIcon, DownloadIcon } from './components/icons';
import { defaultCorpus } from './data/corpus';
import { Midi } from '@tonejs/midi';

// Tone.js is loaded from a script tag in index.html
declare const Tone: any;

const MidiStatusIndicator: React.FC<{ status: MidiStatus, deviceName?: string }> = ({ status, deviceName }) => {
    const getStatusInfo = () => {
        switch (status) {
            case MidiStatus.Connected:
                return {
                    iconColor: 'text-green-400',
                    tooltip: `Connected: ${deviceName || 'MIDI Device'}`
                };
            case MidiStatus.NoDevices:
                 return {
                    iconColor: 'text-yellow-400',
                    tooltip: 'No MIDI device detected. Connect a keyboard.'
                };
            case MidiStatus.PermissionDenied:
                return {
                    iconColor: 'text-red-400',
                    tooltip: 'MIDI access denied. Check browser permissions.'
                };
            case MidiStatus.Unsupported:
                return {
                    iconColor: 'text-red-500',
                    tooltip: 'Web MIDI is not supported in this browser.'
                };
            case MidiStatus.Initializing:
            default:
                return {
                    iconColor: 'text-gray-500',
                    tooltip: 'Initializing MIDI...'
                };
        }
    };

    const { iconColor, tooltip } = getStatusInfo();

    return (
        <div className="relative group flex items-center">
            <MidiIcon className={`w-5 h-5 ${iconColor}`} />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {tooltip}
            </div>
        </div>
    );
};

// Helper function to separate a performance into melody and harmony
const classifyNotes = (notes: MidiNote[]): { melody: MidiNote[], harmony: MidiNote[] } => {
    if (!notes || notes.length === 0) {
        return { melody: [], harmony: [] };
    }

    const melody: MidiNote[] = [];
    const harmony: MidiNote[] = [];
    const timeThreshold = 0.02; // 20ms threshold for simultaneous notes

    const sortedNotes = [...notes].sort((a, b) => a.startTime - b.startTime);

    let i = 0;
    while (i < sortedNotes.length) {
        const currentNote = sortedNotes[i];
        const simultaneousNotes = [currentNote];

        let j = i + 1;
        while (j < sortedNotes.length && sortedNotes[j].startTime - currentNote.startTime < timeThreshold) {
            simultaneousNotes.push(sortedNotes[j]);
            j++;
        }

        if (simultaneousNotes.length === 1) {
            melody.push(currentNote);
        } else {
            let topNote = simultaneousNotes.reduce((highest, note) => note.pitch > highest.pitch ? note : highest, simultaneousNotes[0]);
            melody.push(topNote);
            harmony.push(...simultaneousNotes.filter(note => note !== topNote));
        }
        i = j;
    }
    return { melody, harmony };
};


const App: React.FC = () => {
    const [songs, setSongs] = useState<Song[]>([]);
    const [corpusName, setCorpusName] = useState('default');
    const [uploadedCorpusNames, setUploadedCorpusNames] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState('Loading corpus...');
    const [error, setError] = useState<string | null>(null);

    const [selectedSong, setSelectedSong] = useState<Song | null>(null);
    const [userMelody, setUserMelody] = useState<Song | null>(null);
    const [userMelodyHistory, setUserMelodyHistory] = useState<Song[]>([]);

    const { play, stop, playingSongId, activePitches } = useMidiPlayer();
    
    const [bpm, setBpm] = useState(120);
    const [timeSignature, setTimeSignature] = useState<TimeSignature>('4/4');
    const [quantization, setQuantization] = useState<Quantization>('16');

    const [isGeneratingVariation, setIsGeneratingVariation] = useState(false);
    const [mapMode, setMapMode] = useState<'individual' | 'global' | 'synthesis'>('individual');
    const [globalAnalysisRun, setGlobalAnalysisRun] = useState(false);

    const recordingSynth = useRef<any>(null);
    const metronomeSynth = useRef<any>(null);
    const midiFileInputRef = useRef<HTMLInputElement>(null);
    const jsonFileInputRef = useRef<HTMLInputElement>(null);
    
    const [appRecordingState, setAppRecordingState] = useState<RecordingState>(RecordingState.Idle);

    useEffect(() => {
        metronomeSynth.current = new Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 10, oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.2, sustain: 0.01, release: 0.1 } }).toDestination();
        recordingSynth.current = new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 3,
            modulationIndex: 10,
            envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.5 },
            modulation: { type: 'sine' },
            modulationEnvelope: { attack: 0.1, decay: 0.3, sustain: 0.1, release: 0.5 }
        }).toDestination();
        
        dbService.getAllCorpusNames().then(names => setUploadedCorpusNames(names));
        return () => stop();
    }, [stop]);

    const loadCorpus = useCallback(async (name: string) => {
        setIsLoading(true);
        setLoadingMessage(`Loading "${name}" corpus...`);
        setError(null);
        setGlobalAnalysisRun(false);
        setMapMode('individual');

        try {
            let corpusSongs: Song[] = [];
            if (name === 'default') {
                corpusSongs = defaultCorpus;
            } else if (['jazz', 'lilicub'].includes(name)) {
                const response = await fetch(`/corpora/${name}-corpus.json`);
                if (!response.ok) throw new Error(`Failed to fetch ${name} corpus.`);
                corpusSongs = await response.json();
            } else {
                const uploadedCorpus = await dbService.getCorpus(name);
                if (uploadedCorpus) {
                    corpusSongs = uploadedCorpus.songs;
                } else {
                    throw new Error(`Corpus "${name}" not found.`);
                }
            }
            
            setSongs(corpusSongs);
            const firstSong = corpusSongs[0] || null;

            setSongs(corpusSongs);
            setSelectedSong(prevSelected => {
                if (prevSelected && (prevSelected.id === 'user-melody' || prevSelected.id.startsWith('user-melody-history-'))) {
                    return prevSelected;
                }
                return firstSong;
            });
             setUserMelody(prev => {
                if (!prev) return null;
                // Keep user melody but clear its global position as it's corpus-dependent
                const { globalMapPosition, ...rest } = prev;
                return rest;
            });
            setUserMelodyHistory(prev => prev.map(song => {
                 const { globalMapPosition, ...rest } = song;
                 return rest;
            }));

        } catch (e: any) {
            setError(e.message);
            setSongs(defaultCorpus);
            setCorpusName('default');
            setSelectedSong(defaultCorpus[0] || null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { loadCorpus(corpusName) }, [corpusName, loadCorpus]);

    const quantizeNotes = (notes: MidiNote[], bpm: number, quantizeGrid: Quantization): MidiNote[] => {
        const secondsPerBeat = 60 / bpm;
        const secondsPerGridUnit = quantizeGrid === '8T' ? secondsPerBeat / 3 : secondsPerBeat / 4;
        return notes.map(note => ({
            ...note,
            startTime: Math.round(note.startTime / secondsPerGridUnit) * secondsPerGridUnit,
            duration: Math.max(secondsPerGridUnit, Math.round(note.duration / secondsPerGridUnit) * secondsPerGridUnit),
        }));
    };

    const analyzeAndCreateSong = useCallback(async (rawNotes: MidiNote[], isVariation: boolean = false) => {
        if (!isVariation) {
            setAppRecordingState(RecordingState.Processing);
        }
        
        const quantizedNotes = quantizeNotes(rawNotes, bpm, quantization);
        const { melody, harmony } = classifyNotes(quantizedNotes);

        setLoadingMessage('Analyzing your creation...');
        setIsLoading(true);
        setError(null);
        try {
            const analysis = await geminiService.analyzeMidi(melody, harmony, bpm, timeSignature, quantization);
            const mapPosition = {
                x: (analysis.melodicComplexity / 3) + (analysis.melodicRichness * 2 / 3),
                y: analysis.harmonicRichness
            };

            const newSong: Song = {
                id: 'user-melody',
                name: 'Your Melody',
                melody,
                harmony,
                analysis,
                mapPosition
            };

            if (globalAnalysisRun) {
                setLoadingMessage('Placing your melody on the map...');
                const globalMapPosition = await geminiService.placeSongInGlobalMap(songs, newSong);
                newSong.globalMapPosition = globalMapPosition;
            }

            if (userMelody) {
                const historySong = { ...userMelody, id: `user-melody-history-${Date.now()}`, name: `Variation ${userMelodyHistory.length + 1}`};
                setUserMelodyHistory(prev => [...prev, historySong]);
            }
            setUserMelody(newSong);
            setSelectedSong(newSong);
            
            if (globalAnalysisRun) {
                setMapMode('synthesis');
            }

        } catch (e: any) {
            setError(`Analysis failed: ${e.message}`);
        } finally {
            setIsLoading(false);
            if (!isVariation) {
              setAppRecordingState(RecordingState.Idle);
            }
        }
    }, [globalAnalysisRun, songs, userMelody, userMelodyHistory.length, bpm, timeSignature, quantization]);

    const { startRecording, stopRecording, error: recorderError, midiInputName, manualNoteOn, manualNoteOff, midiStatus } = useMidiRecorder({
        onRecordingComplete: (notes) => analyzeAndCreateSong(notes, false),
        onNoteOn: async (pitch) => {
            if (Tone.context.state !== 'running') await Tone.context.resume();
            recordingSynth.current?.triggerAttack(Tone.Frequency(pitch, 'midi').toFrequency());
        },
        onNoteOff: (pitch) => {
            recordingSynth.current?.triggerRelease(Tone.Frequency(pitch, 'midi').toFrequency());
        }
    });

    const startRecordingSequence = useCallback(async () => {
        if (appRecordingState !== RecordingState.Idle) return;
        if (Tone.context.state !== 'running') await Tone.context.resume();

        stop();
        setAppRecordingState(RecordingState.Precount);
        
        const beatsPerMeasure = timeSignature === '4/4' ? 4 : 3;
        const secondsPerBeat = 60 / bpm;
        const now = Tone.now() + 0.1;

        for (let i = 0; i < beatsPerMeasure; i++) {
            metronomeSynth.current.triggerAttackRelease(i === 0 ? 'C4' : 'C3', '8n', now + i * secondsPerBeat);
        }
        
        Tone.Transport.scheduleOnce(() => {
            setAppRecordingState(RecordingState.Recording);
            startRecording();
        }, now + (beatsPerMeasure * secondsPerBeat));

        let beatCount = 0;
        const metronomeLoop = new Tone.Loop(time => {
            metronomeSynth.current.triggerAttackRelease(beatCount++ % beatsPerMeasure === 0 ? 'C4' : 'C3', '8n', time);
        }, '4n').start(beatsPerMeasure * secondsPerBeat);
        
        Tone.Transport.bpm.value = bpm;
        Tone.Transport.start(now);

    }, [appRecordingState, bpm, timeSignature, startRecording, stop]);

    const handleStopRecording = useCallback(() => {
        stopRecording();
        stop();
        setAppRecordingState(RecordingState.Processing);
    }, [stopRecording, stop]);

    const generateVariation = useCallback(async (targetPosition: MapPosition) => {
        if (!userMelody || !userMelody.mapPosition) return;

        setIsGeneratingVariation(true);
        setError(null);
        try {
            const { melody, harmony } = await geminiService.generateMidiVariation(userMelody, targetPosition);
            
            setLoadingMessage('Analyzing variation...');
            const analysis = await geminiService.analyzeMidi(melody, harmony, bpm, timeSignature, quantization);
            
            const newSong: Song = {
                id: 'user-melody',
                name: 'Your Melody',
                melody,
                harmony,
                analysis,
                mapPosition: {
                    x: (analysis.melodicComplexity / 3) + (analysis.melodicRichness * 2 / 3),
                    y: analysis.harmonicRichness
                }
            };
            
            if (globalAnalysisRun) {
                setLoadingMessage('Placing variation on the map...');
                newSong.globalMapPosition = await geminiService.placeSongInGlobalMap(songs, newSong);
            }
            
            if (userMelody) {
                const historySong = { ...userMelody, id: `user-melody-history-${Date.now()}`, name: `Variation ${userMelodyHistory.length + 1}`};
                setUserMelodyHistory(prev => [...prev, historySong]);
            }
            setUserMelody(newSong);
            setSelectedSong(newSong);

        } catch (e: any) {
            setError(`Variation generation failed: ${e.message}`);
        } finally {
            setIsGeneratingVariation(false);
            setLoadingMessage('Loading corpus...'); // Reset default message
        }
    }, [userMelody, bpm, timeSignature, quantization, globalAnalysisRun, songs, userMelodyHistory.length]);
    
    const handleMapModeChange = useCallback(async (newMode: 'individual' | 'global' | 'synthesis') => {
        if ((newMode === 'global' || newMode === 'synthesis') && !globalAnalysisRun) {
            setIsLoading(true);
            setLoadingMessage('Running global analysis...');
            try {
                const positions = await geminiService.analyzeCorpusGlobally(songs);
                const updatedSongs = songs.map(song => {
                    const pos = positions.find(p => p.id === song.id);
                    return pos ? { ...song, globalMapPosition: { x: pos.x, y: pos.y } } : song;
                });
                
                setSongs(updatedSongs);
                setGlobalAnalysisRun(true);

                if (userMelody) {
                    setLoadingMessage('Placing your melody on the map...');
                    const globalMapPosition = await geminiService.placeSongInGlobalMap(updatedSongs, userMelody);
                    setUserMelody(prev => prev ? { ...prev, globalMapPosition } : null);
                }
            } catch (e: any) {
                setError(`Global analysis failed: ${e.message}`);
            } finally {
                 setIsLoading(false);
            }
        }
        setMapMode(newMode);
    }, [songs, globalAnalysisRun, userMelody]);

    const handleNodeClick = (id: string) => {
        const clickedSong = [...songs, ...userMelodyHistory, userMelody].find(s => s?.id === id);
        if (clickedSong) {
            setSelectedSong(clickedSong);
            play(clickedSong);
        }
    };

    const handleMidiFileSelect = () => midiFileInputRef.current?.click();
    const handleJsonCorpusSelect = () => jsonFileInputRef.current?.click();

    const handleMidiUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setLoadingMessage(`Processing MIDI file "${file.name}"...`);
        setError(null);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const midi = new Midi(arrayBuffer);
            
            let allNotes: MidiNote[] = [];
            midi.tracks.forEach(track => {
                const trackNotes = track.notes.map(n => ({
                    pitch: n.midi,
                    startTime: n.time,
                    duration: n.duration,
                    velocity: n.velocity
                }));
                allNotes.push(...trackNotes);
            });

            if (allNotes.length === 0) throw new Error("No notes found in the MIDI file.");
            
            await analyzeAndCreateSong(allNotes, false);

        } catch (e: any) {
            setError(`Failed to process MIDI file: ${e.message}`);
        } finally {
            setIsLoading(false);
            if (midiFileInputRef.current) midiFileInputRef.current.value = "";
        }
    };
    
    const handleJsonUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setLoadingMessage(`Loading corpus from "${file.name}"...`);
        setError(null);

        try {
            const text = await file.text();
            const parsedData = JSON.parse(text);
            let newCorpus: UploadedCorpus;

            if (Array.isArray(parsedData)) {
                newCorpus = { name: file.name.replace(/\.json$/i, ''), songs: parsedData as Song[] };
            } else if (parsedData.name && Array.isArray(parsedData.songs)) {
                newCorpus = { name: parsedData.name, songs: parsedData.songs as Song[] };
            } else {
                throw new Error("Invalid corpus file format. Must have 'name' (string) and 'songs' (array) properties.");
            }
            
            await dbService.saveCorpus(newCorpus);
            const allNames = await dbService.getAllCorpusNames();
            setUploadedCorpusNames(allNames);
            setCorpusName(newCorpus.name);

        } catch (e: any) {
            setError(`Failed to load corpus file: ${e.message}`);
        } finally {
            setIsLoading(false);
            if (jsonFileInputRef.current) jsonFileInputRef.current.value = "";
        }
    };

    const handleClearUserMelody = () => {
        stop();
        setUserMelody(null);
        setUserMelodyHistory([]);
        setMapMode('individual');
        setSelectedSong(songs[0] || null);
    };
    
    const handleDownloadMidi = async () => {
        if (!selectedSong || !(selectedSong.id === 'user-melody' || selectedSong.id.startsWith('user-melody-history-'))) return;

        try {
            const midi = new Midi();
            midi.header.setTempo(bpm);
            midi.header.timeSignatures.push({
                ticks: 0,
                timeSignature: timeSignature.split('/').map(Number) as [number, number],
            });

            const melodyTrack = midi.addTrack();
            melodyTrack.name = 'Melody';
            melodyTrack.instrument.name = 'acoustic grand piano';
            selectedSong.melody.forEach(note => {
                melodyTrack.addNote({
                    midi: note.pitch,
                    time: note.startTime,
                    duration: note.duration,
                    velocity: note.velocity || 0.8
                });
            });

            if (selectedSong.harmony && selectedSong.harmony.length > 0) {
              const harmonyTrack = midi.addTrack();
              harmonyTrack.name = 'Harmony';
              harmonyTrack.instrument.name = 'electric piano 1';
              selectedSong.harmony.forEach(note => {
                  harmonyTrack.addNote({
                      midi: note.pitch,
                      time: note.startTime,
                      duration: note.duration,
                      velocity: note.velocity || 0.6
                  });
              });
            }

            const midiBytes = midi.toArray();
            const blob = new Blob([new Uint8Array(midiBytes)], { type: 'audio/midi' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${selectedSong.name.replace(/\s+/g, '_')}.mid`;
            document.body.appendChild(a);
a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (e: any) {
            setError(`Failed to generate MIDI file: ${e.message}`);
        }
    };

    let songsForMap: Song[] = [];
    let userMelodyForMap: Song | undefined = undefined;

    const allCorpusAndHistorySongs = [...songs, ...userMelodyHistory];

    if (mapMode === 'individual') {
        songsForMap = allCorpusAndHistorySongs;
        userMelodyForMap = userMelody ?? undefined;
    } else if (mapMode === 'global') {
        songsForMap = allCorpusAndHistorySongs
            .filter(s => s.globalMapPosition)
            .map(s => ({ ...s, mapPosition: s.globalMapPosition! }));
    } else if (mapMode === 'synthesis') {
        songsForMap = allCorpusAndHistorySongs
            .filter(s => s.globalMapPosition)
            .map(s => ({ ...s, mapPosition: s.globalMapPosition! }));
        if (userMelody?.globalMapPosition) {
            userMelodyForMap = { ...userMelody, mapPosition: userMelody.globalMapPosition };
        }
    }
    
    return (
        <div className="bg-gray-900 text-gray-300 font-sans flex flex-col h-screen overflow-hidden">
            {isLoading && (
                <div className="absolute inset-0 bg-gray-900 bg-opacity-80 flex flex-col items-center justify-center z-50">
                    <LoadingSpinner className="w-12 h-12 text-indigo-400" />
                    <p className="mt-4 text-lg text-white">{loadingMessage}</p>
                </div>
            )}
            
            <header className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700 shadow-md">
                <h1 className="text-xl font-bold text-white flex items-center">
                    <MusicNoteIcon className="w-6 h-6 mr-2 text-indigo-400"/> Gemini Musical Map
                </h1>
                <div className="flex items-center space-x-4">
                     <div className="flex items-center space-x-2">
                        <button onClick={handleMidiFileSelect} className="px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-500 transition-colors text-sm font-semibold">
                            Upload MIDI
                        </button>
                         <button onClick={handleJsonCorpusSelect} className="px-3 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors text-sm font-semibold">
                            Upload Corpus (.json)
                        </button>
                    </div>
                    <input type="file" ref={midiFileInputRef} onChange={handleMidiUpload} accept=".mid,.midi" className="hidden" />
                    <input type="file" ref={jsonFileInputRef} onChange={handleJsonUpload} accept=".json" className="hidden" />
                    <select value={corpusName} onChange={e => setCorpusName(e.target.value)} className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                        <option value="default">Default</option>
                        <option value="jazz">Jazz Standards</option>
                        <option value="lilicub">Lilicub</option>
                        {uploadedCorpusNames.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col p-3">
                    <MusicMap
                        songs={songsForMap}
                        activeUserMelody={userMelodyForMap}
                        selectedSongId={selectedSong?.id}
                        isGeneratingVariation={isGeneratingVariation}
                        isDraggable={(mapMode === 'synthesis' || mapMode === 'individual') && !!userMelody}
                        onNodeClick={handleNodeClick}
                        onUserMelodyMove={generateVariation}
                        xAxisLabel={mapMode === 'individual' ? "Melodic Character" : "Harmonic/Scale Similarity"}
                        yAxisLabel={mapMode === 'individual' ? "Harmonic Richness" : "Harmonic/Scale Similarity"}
                    />
                </div>
                
                <aside className="w-[380px] bg-gray-800 p-4 flex flex-col overflow-y-auto border-l border-gray-700">
                    <div className="flex-1">
                        <h2 className="text-lg font-bold text-white mb-3">Controls & Analysis</h2>
                        <div className="space-y-3 mb-4">
                             <div className="flex bg-gray-900 p-1 rounded-md w-full text-sm">
                                <button
                                    onClick={() => handleMapModeChange('individual')}
                                    className={`flex-1 px-2 py-1.5 font-semibold rounded transition-colors ${mapMode === 'individual' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                                >
                                    Individual
                                </button>
                                <button
                                    onClick={() => handleMapModeChange('global')}
                                    className={`flex-1 px-2 py-1.5 font-semibold rounded transition-colors ${mapMode === 'global' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                                >
                                    Similarity
                                </button>
                                <button
                                    onClick={() => handleMapModeChange('synthesis')}
                                    disabled={!userMelody}
                                    className={`flex-1 px-2 py-1.5 font-semibold rounded transition-colors ${mapMode === 'synthesis' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'} disabled:text-gray-500 disabled:bg-transparent disabled:cursor-not-allowed`}
                                >
                                    Synthesis
                                </button>
                            </div>
                            {error && <p className="text-red-400 text-sm bg-red-900/50 p-2 rounded-md">{error}</p>}
                            {recorderError && <p className="text-amber-400 text-sm bg-amber-900/50 p-2 rounded-md">{recorderError}</p>}
                        </div>
                        
                        {selectedSong ? (
                            <div className="bg-gray-700 p-3 rounded-lg">
                                <div className="flex justify-between items-start">
                                    <h3 className="text-base font-bold text-white mb-2">{selectedSong.name}</h3>
                                    <div className="flex items-center">
                                        {(selectedSong.id === 'user-melody' || selectedSong.id.startsWith('user-melody-history-')) && (
                                            <button onClick={handleDownloadMidi} title="Download MIDI" className="p-2 rounded-full hover:bg-gray-600 transition-colors mr-1">
                                                <DownloadIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                        <button onClick={() => play(selectedSong)} className="p-2 rounded-full hover:bg-gray-600 transition-colors">
                                            {playingSongId === selectedSong.id ? <StopIcon /> : <PlayIcon />}
                                        </button>
                                    </div>
                                </div>
                                {selectedSong.analysis && (
                                     <div className="text-xs space-y-1 text-gray-300">
                                         <p><strong>Key:</strong> {selectedSong.analysis.key} ({selectedSong.analysis.mode})</p>
                                         <p><strong>Rhythm:</strong> {selectedSong.analysis.rhythmicCharacter}</p>
                                         <p><strong>Intervals:</strong> {selectedSong.analysis.intervalCharacter}</p>
                                         <p><strong>Harmony:</strong> {selectedSong.analysis.harmonicComplexity}</p>
                                         <div className="pt-2">
                                             <label className="font-semibold">Melodic Complexity: {Math.round(selectedSong.analysis.melodicComplexity)}</label>
                                             <div className="w-full bg-gray-600 rounded-full h-1.5"><div className="bg-teal-400 h-1.5 rounded-full" style={{width: `${selectedSong.analysis.melodicComplexity}%`}}></div></div>
                                         </div>
                                         <div>
                                             <label className="font-semibold">Harmonic Richness: {Math.round(selectedSong.analysis.harmonicRichness)}</label>
                                             <div className="w-full bg-gray-600 rounded-full h-1.5"><div className="bg-indigo-400 h-1.5 rounded-full" style={{width: `${selectedSong.analysis.harmonicRichness}%`}}></div></div>
                                         </div>
                                          <div>
                                             <label className="font-semibold">Melodic Richness: {Math.round(selectedSong.analysis.melodicRichness)}</label>
                                             <div className="w-full bg-gray-600 rounded-full h-1.5"><div className="bg-pink-400 h-1.5 rounded-full" style={{width: `${selectedSong.analysis.melodicRichness}%`}}></div></div>
                                         </div>
                                     </div>
                                )}
                            </div>
                        ) : <p>Select a song on the map to see details.</p>}
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-base font-bold text-white">Record Your Melody</h3>
                            <div className="flex items-center space-x-3">
                                {userMelody && (
                                    <button onClick={handleClearUserMelody} className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-2 py-1 rounded-md transition-colors">Clear</button>
                                )}
                                <MidiStatusIndicator status={midiStatus} deviceName={midiInputName} />
                            </div>
                        </div>
                        <div className="bg-gray-700 p-3 rounded-lg mb-3">
                             <label htmlFor="tempo" className="block text-sm font-medium text-gray-300">Tempo (BPM): <span className="font-bold text-white">{bpm}</span></label>
                             <input
                                id="tempo"
                                type="range"
                                min="40"
                                max="200"
                                value={bpm}
                                onChange={(e) => setBpm(Number(e.target.value))}
                                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                                disabled={appRecordingState !== RecordingState.Idle}
                            />
                            <div className="grid grid-cols-2 gap-3 mt-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Time Signature</label>
                                    <div className="flex bg-gray-600 p-1 rounded-md">
                                        <button onClick={() => setTimeSignature('4/4')} disabled={appRecordingState !== RecordingState.Idle} className={`flex-1 text-xs py-1 rounded transition-colors ${timeSignature === '4/4' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-500'}`}>4/4</button>
                                        <button onClick={() => setTimeSignature('3/4')} disabled={appRecordingState !== RecordingState.Idle} className={`flex-1 text-xs py-1 rounded transition-colors ${timeSignature === '3/4' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-500'}`}>3/4</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Quantize Grid</label>
                                    <div className="flex bg-gray-600 p-1 rounded-md">
                                        <button onClick={() => setQuantization('16')} disabled={appRecordingState !== RecordingState.Idle} className={`flex-1 text-xs py-1 rounded transition-colors ${quantization === '16' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-500'}`}>16th</button>
                                        <button onClick={() => setQuantization('8T')} disabled={appRecordingState !== RecordingState.Idle} className={`flex-1 text-xs py-1 rounded transition-colors ${quantization === '8T' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-500'}`}>8T</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                         <button
                            onClick={appRecordingState === RecordingState.Recording ? handleStopRecording : startRecordingSequence}
                            className={`w-full flex items-center justify-center py-2 px-4 rounded-md transition-all font-semibold text-white ${appRecordingState === RecordingState.Recording ? 'bg-red-600 hover:bg-red-500 animate-pulse' : 'bg-gray-600 hover:bg-gray-500'}`}
                            disabled={appRecordingState === RecordingState.Processing || appRecordingState === RecordingState.Precount}
                        >
                            {appRecordingState === RecordingState.Recording ? (
                                <> <StopIcon className="w-5 h-5 mr-2"/> Stop Recording </>
                            ) : appRecordingState === RecordingState.Processing ? (
                                <> <LoadingSpinner className="w-5 h-5 mr-2"/> Processing... </>
                            ) : appRecordingState === RecordingState.Precount ? (
                                <> <LoadingSpinner className="w-5 h-5 mr-2"/> Get Ready... </>
                            ) : (
                                <> <RecordIcon className="w-5 h-5 mr-2"/> Start Recording </>
                            )}
                        </button>
                        <div className="mt-3">
                            <VirtualPiano onNoteOn={manualNoteOn} onNoteOff={manualNoteOff} activePitches={activePitches} disabled={appRecordingState === RecordingState.Processing} />
                        </div>
                    </div>
                </aside>
            </main>
        </div>
    );
}

export default App;
