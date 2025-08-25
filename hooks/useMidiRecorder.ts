import { useState, useEffect, useCallback, useRef } from 'react';
import { type MidiNote, RecordingState, MidiStatus } from '../types';

// Define a minimal interface for the Web MIDI API's MIDIInput to provide type safety.
interface MIDIInput {
  id: string;
  name?: string;
  onmidimessage: ((event: any) => void) | null;
}

interface MidiRecorderProps {
  onRecordingComplete: (notes: MidiNote[]) => void;
  onNoteOn?: (pitch: number) => void;
  onNoteOff?: (pitch: number) => void;
}

export const useMidiRecorder = ({ onRecordingComplete, onNoteOn, onNoteOff }: MidiRecorderProps) => {
  const [recordingState, setRecordingState] = useState<RecordingState>(RecordingState.Idle);
  const [midiStatus, setMidiStatus] = useState<MidiStatus>(MidiStatus.Initializing);
  const midiAccessRef = useRef<any>(null);
  const [midiInput, setMidiInput] = useState<MIDIInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recordedNotes = useRef<MidiNote[]>([]);
  const activeNotes = useRef<Map<number, { startTime: number; velocity: number }>>(new Map());
  const recordingStartTime = useRef<number>(0);

  // --- Shared Note Handling Logic ---
  const noteOn = useCallback((pitch: number, velocity: number) => {
    onNoteOn?.(pitch); // Always provide feedback
    if (recordingState !== RecordingState.Recording) return; // Guard only the recording logic
    activeNotes.current.set(pitch, { startTime: performance.now(), velocity });
  }, [recordingState, onNoteOn]);

  const noteOff = useCallback((pitch: number) => {
    onNoteOff?.(pitch); // Always provide feedback
    if (recordingState !== RecordingState.Recording) return; // Guard only the recording logic
    const noteOnData = activeNotes.current.get(pitch);
    if (noteOnData) {
      const noteOffTime = performance.now();
      const startTimeInSeconds = (noteOnData.startTime - recordingStartTime.current) / 1000;
      const durationInSeconds = (noteOffTime - noteOnData.startTime) / 1000;
      
      recordedNotes.current.push({
        pitch,
        startTime: startTimeInSeconds,
        duration: durationInSeconds,
        velocity: noteOnData.velocity,
      });
      activeNotes.current.delete(pitch);
    }
  }, [recordingState, onNoteOff]);

  // --- Web MIDI API Specific Logic ---
  const scanForMidiInputs = useCallback((access: any) => {
    if (!access) return;
    const inputs = Array.from(access.inputs.values()) as MIDIInput[];
    if (inputs.length > 0) {
      // If the current input is disconnected or no input is selected, select the first available one.
      const currentInputStillConnected = midiInput && inputs.some(i => i.id === midiInput.id);
      if (!currentInputStillConnected) {
         setMidiInput(inputs[0]);
      }
      setMidiStatus(MidiStatus.Connected);
      setError(null);
    } else {
      setMidiInput(null);
      setMidiStatus(MidiStatus.NoDevices);
    }
  }, [midiInput]);

  useEffect(() => {
    const onMIDISuccess = (access: any) => {
      midiAccessRef.current = access;
      scanForMidiInputs(access);
      access.onstatechange = () => scanForMidiInputs(access);
    };

    const onMIDIFailure = (msg: string) => {
      setError(`Failed to get MIDI access - ${msg}. You can still use the virtual piano.`);
      setMidiStatus(MidiStatus.PermissionDenied);
    };

    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess({ sysex: false })
        .then(onMIDISuccess, onMIDIFailure)
        .catch(err => {
            console.error("MIDI Access Error:", err);
            onMIDIFailure(err.message);
        });
    } else {
      setError("Web MIDI API not supported. Please use the virtual piano.");
      setMidiStatus(MidiStatus.Unsupported);
    }
    
    return () => {
      if (midiAccessRef.current) {
        midiAccessRef.current.onstatechange = null;
        midiAccessRef.current.inputs.forEach((input: any) => {
          input.onmidimessage = null;
        });
      }
    };
  }, [scanForMidiInputs]);

  const handleMidiMessage = useCallback((event: any) => {
    const command = event.data[0] >> 4;
    const pitch = event.data[1];
    const velocity = event.data.length > 2 ? event.data[2] : 1;
    
    if (command === 9 && velocity > 0) {
      noteOn(pitch, velocity / 127);
    }
    else if (command === 8 || (command === 9 && velocity === 0)) {
      noteOff(pitch);
    }
  }, [noteOn, noteOff]);
  
  useEffect(() => {
      if (midiInput) {
        // Always listen for messages to provide real-time feedback
        midiInput.onmidimessage = handleMidiMessage;
      }
      return () => {
          if (midiInput) {
              midiInput.onmidimessage = null;
          }
      }
  }, [midiInput, handleMidiMessage]);

  // --- Exposed functions for manual/virtual piano input ---
  const manualNoteOn = useCallback((pitch: number) => noteOn(pitch, 0.9), [noteOn]);
  const manualNoteOff = useCallback((pitch: number) => noteOff(pitch), [noteOff]);

  // --- Recording Controls ---
  const startRecording = useCallback(() => {
    recordedNotes.current = [];
    activeNotes.current.clear();
    recordingStartTime.current = performance.now();
    setRecordingState(RecordingState.Recording);
    setError(null);
  }, []);

  const stopRecording = useCallback(() => {
    setRecordingState(RecordingState.Processing);
    // Finalize any notes that are still "on"
    activeNotes.current.forEach((noteOnData, pitch) => {
       const noteOffTime = performance.now();
       const startTimeInSeconds = (noteOnData.startTime - recordingStartTime.current) / 1000;
       const durationInSeconds = (noteOffTime - noteOnData.startTime) / 1000;
       recordedNotes.current.push({
          pitch,
          startTime: startTimeInSeconds,
          duration: durationInSeconds,
          velocity: noteOnData.velocity,
        });
        onNoteOff?.(pitch); // Ensure visual/audio feedback stops for lingering notes
    });
    activeNotes.current.clear();
    onRecordingComplete(recordedNotes.current);
    setTimeout(() => setRecordingState(RecordingState.Idle), 500); // Give time for processing state to show
  }, [onRecordingComplete, onNoteOff]);

  return { recordingState, startRecording, stopRecording, error, midiInputName: midiInput?.name, manualNoteOn, manualNoteOff, midiStatus };
};