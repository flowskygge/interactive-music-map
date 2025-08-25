import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Midi } from '@tonejs/midi';
import fs from 'fs-extra';
import path from 'path';

// Declare process to satisfy TypeScript for Node.js specific properties.
declare const process: any;

// --- Interfaces (must match the main app's types.ts) ---
interface MidiNote {
  pitch: number;
  startTime: number;
  duration: number;
  velocity?: number;
}
interface Analysis {
  key: string; mode: string; rhythmicCharacter: string; intervalCharacter: string;
  harmonicComplexity: string; chordChanges: number; melodicRepetitions: number;
  melodicComplexity: number; harmonicRichness: number; melodicRichness: number;
}
interface Song {
  id: string; name: string; melody: MidiNote[]; harmony: MidiNote[];
  analysis?: Analysis; mapPosition?: { x: number; y: number };
}

// --- Gemini Configuration ---
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set. Please create a .env file.");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

const analysisSchema = {
    type: Type.OBJECT,
    properties: {
        key: { type: Type.STRING, description: "The musical key, e.g., 'C Major' or 'A Minor'." },
        mode: { type: Type.STRING, description: "The musical mode, e.g., 'Ionian', 'Dorian'." },
        rhythmicCharacter: { type: Type.STRING, description: "Overall rhythmic feel. One of: 'short-notes', 'long-notes', 'balanced'." },
        intervalCharacter: { type: Type.STRING, description: "Dominant melodic interval type. One of: 'small-intervals', 'large-intervals', 'balanced'." },
        harmonicComplexity: { type: Type.STRING, description: "Complexity of the harmony. One of: 'simple', 'moderate', 'sophisticated'." },
        chordChanges: { type: Type.INTEGER, description: "The number of distinct chord changes." },
        melodicRepetitions: { type: Type.INTEGER, description: "The number of repeated melodic phrases or notes." },
        melodicComplexity: { type: Type.NUMBER, description: "A score from 0 to 100 representing how melodically complex the piece is. Higher is more complex (more interval variation, less repetition)." },
        harmonicRichness: { type: Type.NUMBER, description: "A score from 0 to 100 representing how harmonically rich the piece is, considering chord complexity and the density of chord changes relative to duration. Higher is richer." },
        melodicRichness: { type: Type.NUMBER, description: "A score from 0 to 100 representing how harmonically rich the melody is against the harmony. Higher is richer because more notes are outside the basic chord triad (root, 3rd, 5th), such as 7ths, 9ths, or other color tones." },
    },
    required: ['key', 'mode', 'rhythmicCharacter', 'intervalCharacter', 'harmonicComplexity', 'chordChanges', 'melodicRepetitions', 'melodicComplexity', 'harmonicRichness', 'melodicRichness'],
};

function formatMidiForPrompt(notes: MidiNote[]): string {
    if (!notes || notes.length === 0) return 'No notes provided.';
    return notes.map(n => `(p: ${n.pitch}, s: ${n.startTime.toFixed(2)}, d: ${n.duration.toFixed(2)})`).join(', ');
}

const analyzeMidiAPI = async (melody: MidiNote[], harmony: MidiNote[]): Promise<Analysis> => {
    const allNotes = [...melody, ...harmony];
    const totalDuration = allNotes.length > 0 ? allNotes.reduce((max, note) => Math.max(max, note.startTime + note.duration), 0) : 0;

    const prompt = `
    You are an expert musicologist. Analyze the following musical piece, provided as a melody and harmony.
    The piece has a total duration of approximately ${totalDuration.toFixed(2)} seconds.
    Melody notes: ${formatMidiForPrompt(melody)}
    Harmony notes: ${formatMidiForPrompt(harmony)}
    Provide a detailed analysis based on the provided JSON schema. Pay close attention to richness scores:
    - 'harmonicRichness' (0-100): Score based on DENSITY of changes and COMPLEXITY of chords relative to the piece's ${totalDuration.toFixed(2)}s duration.
    - 'melodicRichness' (0-100): Score based on the proportion of 'rich' melody notes (7ths, 9ths, etc.) vs. 'simple' notes (root, 3rd, 5th) against the harmony.
  `;
    
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash', contents: prompt,
            config: { responseMimeType: 'application/json', responseSchema: analysisSchema },
        });
        const jsonText = response.text;
        return JSON.parse(jsonText) as Analysis;
    } catch(e) {
        console.error(`\nError analyzing with Gemini: ${e}`);
        throw e;
    }
};

// --- File Processing Logic ---
const CORPUS_NAME = "jazz";
const MIDI_DIR = path.join(process.cwd(), `corpus-midi/${CORPUS_NAME}`);
const OUTPUT_DIR = path.join(process.cwd(), 'public/corpora');
const OUTPUT_FILE = path.join(OUTPUT_DIR, `${CORPUS_NAME}-corpus.json`);

const convertToneJsToMidiNote = (toneNote: any): MidiNote => ({
    pitch: toneNote.midi,
    startTime: toneNote.time,
    duration: toneNote.duration,
    velocity: toneNote.velocity,
});

async function processCorpus() {
    console.log(`Starting preprocessing for corpus: "${CORPUS_NAME}"`);
    console.log(`Input MIDI directory: ${MIDI_DIR}`);
    
    if (!fs.existsSync(MIDI_DIR)) {
        console.error(`Error: MIDI directory not found at ${MIDI_DIR}`);
        console.error("Please create it and place your MIDI files inside.");
        return;
    }

    const files = fs.readdirSync(MIDI_DIR).filter(f => f.endsWith('.mid') || f.endsWith('.midi'));
    if (files.length === 0) {
        console.error(`No MIDI files found in ${MIDI_DIR}.`);
        return;
    }

    console.log(`Found ${files.length} MIDI files to process.`);
    await fs.ensureDir(OUTPUT_DIR);
    
    const analyzedSongs: Song[] = [];
    let processedCount = 0;

    for (const file of files) {
        processedCount++;
        const filePath = path.join(MIDI_DIR, file);
        const fileLogPrefix = `[${processedCount}/${files.length}] Processing ${file}...`;
        
        try {
            const buffer = fs.readFileSync(filePath);
            const midi = new Midi(buffer);
            
            const melodyTrack = midi.tracks.find(t => t.name.toLowerCase().includes('melody:voice'));
            const harmonyTrack = midi.tracks.find(t => t.name.toLowerCase().includes('chord:'));

            if (!melodyTrack) {
                console.log(`${fileLogPrefix} SKIPPED (No 'melody:voice' track)`);
                continue;
            }

            const melody: MidiNote[] = melodyTrack.notes.map(convertToneJsToMidiNote);
            const harmony: MidiNote[] = harmonyTrack ? harmonyTrack.notes.map(convertToneJsToMidiNote) : [];
            
            process.stdout.write(fileLogPrefix); // Write without newline
            const analysis = await analyzeMidiAPI(melody, harmony);
            
            const xPos = (analysis.melodicComplexity / 3) + (analysis.melodicRichness * 2 / 3);

            const song: Song = {
                id: `${CORPUS_NAME}-${path.parse(file).name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
                name: path.parse(file).name.replace(/_/g, ' '),
                melody,
                harmony,
                analysis,
                mapPosition: { x: Math.max(0, Math.min(100, xPos)), y: analysis.harmonicRichness }
            };
            analyzedSongs.push(song);
            console.log(` DONE`);
        } catch (error) {
            console.log(` FAILED`);
            console.error(`Error processing file ${file}:`, error);
        }
    }

    fs.writeJsonSync(OUTPUT_FILE, analyzedSongs, { spaces: 2 });
    console.log(`\nPreprocessing complete!`);
    console.log(`${analyzedSongs.length} songs successfully processed.`);
    console.log(`Output saved to: ${OUTPUT_FILE}`);
}

processCorpus();