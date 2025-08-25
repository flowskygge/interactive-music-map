import { GoogleGenerativeAI, SchemaType, type ObjectSchema } from "@google/generative-ai";
import { type MidiNote, type Analysis, type MapPosition, type Song, TimeSignature, Quantization } from '../types';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;

if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
} else {
  console.error("GEMINI_API_KEY environment variable not set.");
}

function formatMidiForPrompt(notes: MidiNote[]): string {
  if (!notes || notes.length === 0) {
    return 'No notes provided.';
  }
  return notes.map(n => `(p: ${n.pitch}, s: ${n.startTime.toFixed(2)}, d: ${n.duration.toFixed(2)})`).join(', ');
}

const analysisSchema = {
  type: SchemaType.OBJECT,
  properties: {
    key: { type: SchemaType.STRING, description: "The musical key, e.g., 'C Major' or 'A Minor'." },
    mode: { type: SchemaType.STRING, description: "The musical mode, e.g., 'Ionian', 'Dorian'." },
    rhythmicCharacter: { type: SchemaType.STRING, description: "Overall rhythmic feel. One of: 'short-notes', 'long-notes', 'balanced'." },
    intervalCharacter: { type: SchemaType.STRING, description: "Dominant melodic interval type. One of: 'small-intervals', 'large-intervals', 'balanced'." },
    harmonicComplexity: { type: SchemaType.STRING, description: "Complexity of the harmony. One of: 'simple', 'moderate', 'sophisticated'." },
    chordChanges: { type: SchemaType.INTEGER, description: "The number of distinct chord changes." },
    melodicRepetitions: { type: SchemaType.INTEGER, description: "The number of repeated melodic phrases or notes." },
    melodicComplexity: { type: SchemaType.NUMBER, description: "A score from 0 to 100 representing how melodically complex the piece is. Higher is more complex (more interval variation, less repetition)." },
    harmonicRichness: { type: SchemaType.NUMBER, description: "A score from 0 to 100 representing how harmonically rich the piece is, considering chord complexity and the density of chord changes relative to duration. Higher is richer." },
    melodicRichness: { type: SchemaType.NUMBER, description: "A score from 0 to 100 representing how harmonically rich the melody is against the harmony. Higher is richer because more notes are outside the basic chord triad (root, 3rd, 5th), such as 7ths, 9ths, or other color tones." },
  },
  required: ['key', 'mode', 'rhythmicCharacter', 'intervalCharacter', 'harmonicComplexity', 'chordChanges', 'melodicRepetitions', 'melodicComplexity', 'harmonicRichness', 'melodicRichness'],
} satisfies ObjectSchema;

export const analyzeMidi = async (melody: MidiNote[], harmony: MidiNote[], bpm: number, timeSignature: TimeSignature, quantization: Quantization): Promise<Analysis> => {
  if (!genAI) {
    throw new Error("Gemini AI service is not initialized. Please check your API key configuration.");
  }

  const allNotes = [...melody, ...harmony];
  const totalDuration = allNotes.length > 0
    ? allNotes.reduce((max, note) => Math.max(max, note.startTime + note.duration), 0)
    : 0;

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: analysisSchema,
    },
  });

  const prompt = `
    You are an expert musicologist. Analyze the following musical piece, provided as a melody and harmony.
    The piece was performed at a tempo of ${bpm} BPM in ${timeSignature} time. Note timings are provided in seconds, but have been quantized to a rhythmic grid (${quantization === '8T' ? 'eighth-note triplets' : 'sixteenth notes'}), so their relative values are musically precise.
    The piece has a total duration of approximately ${totalDuration.toFixed(2)} seconds.
    Melody notes: ${formatMidiForPrompt(melody)}
    Harmony notes: ${formatMidiForPrompt(harmony)}

    Provide a detailed analysis based on the provided JSON schema. Pay close attention to the following instructions for calculating richness scores:

    - 'harmonicRichness' (score 0-100): This must reflect the DENSITY of harmonic changes and the COMPLEXITY of the chords. A short piece with 2 chord changes is richer than a very long piece with only 2 changes. A piece using 7th or 9th chords is richer than one using only major/minor triads. Your score should be high if there are frequent changes AND/OR complex chords relative to the piece's ${totalDuration.toFixed(2)} second duration.

    - 'melodicRichness' (score 0-100): Analyze each melody note against its underlying harmony. Calculate this score based on the proportion of notes that are 'rich' (e.g., 7ths, 9ths, non-chord tones) versus 'simple' (root, 3rd, 5th). A higher score means more rich notes.
  `;
  
  const response = await model.generateContent(prompt);
  const jsonText = response.response.text();
  const analysisResult = JSON.parse(jsonText) as Analysis;

  // Small correction for edge cases where AI might still return a very low value incorrectly
  if (analysisResult.chordChanges > 1 && totalDuration > 0 && analysisResult.harmonicRichness < 5) {
      analysisResult.harmonicRichness = Math.max(analysisResult.harmonicRichness, 5);
  }

  return analysisResult;
};

const variationSchema = {
    type: SchemaType.OBJECT,
    properties: {
        melody: {
            type: SchemaType.ARRAY,
            description: "The generated melody notes.",
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    pitch: { type: SchemaType.INTEGER, description: "MIDI pitch number (0-127)." },
                    startTime: { type: SchemaType.NUMBER, description: "Start time in seconds from the beginning." },
                    duration: { type: SchemaType.NUMBER, description: "Duration in seconds." },
                },
                required: ["pitch", "startTime", "duration"],
            }
        },
        harmony: {
            type: SchemaType.ARRAY,
            description: "The generated harmony notes (chords).",
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    pitch: { type: SchemaType.INTEGER, description: "MIDI pitch number (0-127)." },
                    startTime: { type: SchemaType.NUMBER, description: "Start time in seconds from the beginning." },
                    duration: { type: SchemaType.NUMBER, description: "Duration in seconds." },
                },
                required: ["pitch", "startTime", "duration"],
            }
        }
    },
    required: ["melody", "harmony"]
} satisfies ObjectSchema;

export const generateMidiVariation = async (
  originalSong: Song,
  targetPosition: MapPosition
): Promise<{ melody: MidiNote[], harmony: MidiNote[] }> => {
  if (!genAI) {
    throw new Error("Gemini AI service is not initialized. Please check your API key configuration.");
  }

  const originalPosition = originalSong.mapPosition!;
  const dx = targetPosition.x - originalPosition.x;
  const dy = targetPosition.y - originalPosition.y;

  let generationStrategy: string;
  if (Math.abs(dx) > Math.abs(dy)) {
    generationStrategy = `The user made a significant HORIZONTAL move. Your primary goal is to change the MELODY to match the new 'Melodic Character' score of ${targetPosition.x.toFixed(0)}. After creating the new melody, generate a new HARMONY that musically supports it and fits the target 'Harmonic Richness' score of ${targetPosition.y.toFixed(0)}. The harmony must adapt to the new melody.`;
  } else {
    generationStrategy = `The user made a significant VERTICAL move. Your primary goal is to change the HARMONY to match the new 'Harmonic Richness' score of ${targetPosition.y.toFixed(0)}. After creating the new chord progression, compose a new MELODY that fits beautifully over it and matches the target 'Melodic Character' score of ${targetPosition.x.toFixed(0)}. The melody must adapt to the new harmony.`;
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: variationSchema,
    },
  });

  const prompt = `
    You are an expert composer and music theorist.
    An original musical piece is provided with separate melody and harmony parts.
    Original Melody: ${formatMidiForPrompt(originalSong.melody)}.
    Original Harmony: ${formatMidiForPrompt(originalSong.harmony)}.

    This piece exists on a musical map which defines its characteristics:
    The X-axis represents "Melodic Character" (a blend of melodic complexity and melodic richness).
    - High X: Complex rhythms, large interval leaps, less repetition, more 'color' notes (7ths, 9ths).
    - Low X: Simple rhythms, small steps, more repetition, notes stick to basic chords.
    The Y-axis represents "Harmonic Richness" (density and complexity of chords).
    - High Y: Frequent and/or complex chords (e.g., jazz chords).
    - Low Y: Infrequent and simple chords (e.g., basic triads).

    Original Position: X=${originalPosition.x.toFixed(0)}, Y=${originalPosition.y.toFixed(0)}
    Target Position: X=${targetPosition.x.toFixed(0)}, Y=${targetPosition.y.toFixed(0)}

    **Your Task:** Generate a new, musically coherent variation that fits the target position.
    
    **Generation Strategy:** ${generationStrategy}

    **Constraints:**
    1.  The new melody and harmony must be musically cohesive. The melody notes must fit the harmony.
    2.  Maintain a similar total duration to the original piece.
    3.  Respect the original key and mode unless the harmonic changes strongly imply a logical modulation.

    Output the new melody and harmony as a JSON object matching the provided schema.
  `;

  const response = await model.generateContent(prompt);
  const jsonText = response.response.text();
  const parsed = JSON.parse(jsonText);
  return { melody: parsed.melody as MidiNote[], harmony: parsed.harmony as MidiNote[] };
};

const globalAnalysisSchema = {
  type: SchemaType.OBJECT,
  properties: {
    positions: {
      type: SchemaType.ARRAY,
      description: "An array of song positions on the 2D map.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING, description: "The unique identifier of the song." },
          x: { type: SchemaType.NUMBER, description: "The x-coordinate (0-100) on the similarity map." },
          y: { type: SchemaType.NUMBER, description: "The y-coordinate (0-100) on the similarity map." },
        },
        required: ['id', 'x', 'y'],
      }
    }
  },
  required: ['positions']
} satisfies ObjectSchema;

export const analyzeCorpusGlobally = async (songs: Song[]): Promise<{id: string, x: number, y: number}[]> => {
    if (!genAI) {
        throw new Error("Gemini AI service is not initialized. Please check your API key configuration.");
    }

    const songsForPrompt = songs
        .filter(s => s.analysis)
        .map(s => ({
            id: s.id,
            name: s.name,
            key: s.analysis!.key,
            mode: s.analysis!.mode,
            harmonicComplexity: s.analysis!.harmonicComplexity,
        }));
    
    if (songsForPrompt.length < 2) {
        return []; // Not enough data to compare
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: globalAnalysisSchema,
      },
    });

    const prompt = `
        You are a sophisticated musicologist specializing in comparative analysis.
        Analyze the following corpus of songs. For each song, I have provided its ID, name, and key musical characteristics.
        Your task is to create a 2D map that clusters these songs based on their shared musical DNA.
        The primary factors for clustering should be:
        1.  **Scale/Mode Similarity:** Group songs that use similar scales (e.g., major keys together, dorian mode songs together). Keys that are close on the circle of fifths (like C Major and G Major) should be closer than distant keys (C Major and F# Major).
        2.  **Harmonic Progression:** Group songs that use similar types of chord progressions. For example, songs with classic pop progressions (like I-V-vi-IV) should be clustered, while songs with complex jazz harmony (like ii-V-I cadences with alterations) should form another cluster.

        The X and Y axes are abstract similarity dimensions. Your goal is to arrange the songs on this 2D plane so that similar songs are close together.
        It is critical that you spread the songs out across the entire 0-100 space on both axes to create a visually useful and uncluttered map. Do not cluster all songs in one small area.

        Here is the corpus data:
        ${JSON.stringify(songsForPrompt, null, 2)}

        Output a JSON object that strictly follows the provided schema, containing an array of objects. Each object must have the song 'id', and its new 'x' and 'y' coordinates (from 0 to 100).
    `;

    const response = await model.generateContent(prompt);
    const jsonText = response.response.text();
    const parsed = JSON.parse(jsonText);
    return parsed.positions;
};

const placementSchema = {
    type: SchemaType.OBJECT,
    properties: {
        x: { type: SchemaType.NUMBER, description: "The x-coordinate (0-100) for the new song on the map." },
        y: { type: SchemaType.NUMBER, description: "The y-coordinate (0-100) for the new song on the map." },
    },
    required: ['x', 'y'],
} satisfies ObjectSchema;

export const placeSongInGlobalMap = async (corpusSongs: Song[], newSong: Song): Promise<MapPosition> => {
    if (!genAI) {
        console.warn("Gemini AI service is not initialized. Using fallback position.");
        return newSong.mapPosition || { x: 50, y: 50 };
    }

    if (!newSong.analysis || corpusSongs.length === 0) {
        // Fallback to the song's single analysis position if context is unavailable.
        return newSong.mapPosition || { x: 50, y: 50 };
    }

    const corpusForPrompt = corpusSongs
        .filter(s => s.analysis && s.globalMapPosition)
        .map(s => ({
            name: s.name,
            key: s.analysis!.key,
            mode: s.analysis!.mode,
            harmonicComplexity: s.analysis!.harmonicComplexity,
            position: s.globalMapPosition,
        }));

    const newSongForPrompt = {
        name: newSong.name,
        key: newSong.analysis.key,
        mode: newSong.analysis.mode,
        harmonicComplexity: newSong.analysis.harmonicComplexity,
    };
    
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: placementSchema,
      },
    });

    const prompt = `
        You are a sophisticated musicologist. I have an existing 2D map of songs, clustered by musical similarity (scale, mode, harmony).
        I need you to place a NEW song onto this map without changing the existing song positions.
        
        Here are the existing songs and their positions on the map:
        ${JSON.stringify(corpusForPrompt, null, 2)}

        Here is the analysis of the NEW song you need to place:
        ${JSON.stringify(newSongForPrompt, null, 2)}

        Based on the new song's musical characteristics (key: ${newSongForPrompt.key}, mode: ${newSongForPrompt.mode}, complexity: ${newSongForPrompt.harmonicComplexity}), determine the most appropriate x and y coordinates (from 0 to 100) for it on the map.
        The coordinates should place it near other musically similar songs.
        Output only a JSON object with 'x' and 'y' keys corresponding to the calculated position.
    `;

    const response = await model.generateContent(prompt);
    const jsonText = response.response.text();
    return JSON.parse(jsonText) as MapPosition;
};
