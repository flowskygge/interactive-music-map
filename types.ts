

export interface MidiNote {
  pitch: number;
  startTime: number;
  duration: number;
  velocity?: number;
}

export interface Song {
  id: string;
  name: string;
  melody: MidiNote[];
  harmony: MidiNote[];
  analysis?: Analysis;
  mapPosition?: MapPosition;
  globalMapPosition?: MapPosition;
}

export interface Analysis {
  key: string;
  mode: string;
  rhythmicCharacter: string;
  intervalCharacter: string;
  harmonicComplexity: string;
  chordChanges: number;
  melodicRepetitions: number;
  melodicComplexity: number; 
  harmonicRichness: number;
  melodicRichness: number;
}

export interface MapPosition {
  x: number; // Represents a composite of melodic complexity (1/3) and melodic richness (2/3)
  y: number;
}

export enum RecordingState {
  Idle,
  Precount,
  Recording,
  Processing,
}

export interface UploadedCorpus {
  name: string;
  songs: Song[];
}

export enum MidiStatus {
  Initializing,
  Unsupported,
  PermissionDenied,
  NoDevices,
  Connected,
}

export type TimeSignature = '4/4' | '3/4';
export type Quantization = '16' | '8T';
