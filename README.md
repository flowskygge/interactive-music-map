# 🎵 Interactive Music Map

An AI-powered interactive musical map that analyzes MIDI melodies, places them on a 2D visualization based on their musical characteristics, and allows real-time composition and exploration.

## 🚀 Live Demo

**Latest Deployment:** https://interactivemusic-mdmu6chfx-benoit-carres-projects.vercel.app

## ✨ Features

### 🎹 Interactive MIDI Recording
- Real-time MIDI input with Web MIDI API
- Virtual piano interface for mouse/touch input
- Metronome with customizable tempo and time signatures
- Quantization options (16th notes, 8th note triplets)

### 🧠 AI-Powered Analysis
- **Individual Analysis**: Evaluates melodic complexity, harmonic richness, and musical characteristics
- **Global Similarity**: Clusters songs based on scale, mode, and harmonic progression similarity
- **Synthesis Mode**: Generates melodic variations by dragging your melody around the map

### 🗺️ Musical Universe Visualization
- **3 Analysis Modes**:
  - **Individual**: Songs positioned by their intrinsic musical characteristics
  - **Similarity**: Songs clustered by shared musical DNA (scales, harmony)
  - **Synthesis**: Interactive mode for melody generation and variation
- Pan and zoom controls for detailed exploration
- Color-coded nodes (corpus songs vs. user creations)

### 🎼 Comprehensive Music Analysis
- Key and mode detection
- Rhythmic character analysis
- Interval pattern recognition
- Harmonic complexity scoring
- Melodic richness evaluation

### 🎵 Advanced Playback
- Multi-synth audio engine with Tone.js
- Separate melody and harmony playback
- Visual feedback during playback
- MIDI file export for user compositions

### 📂 Multi-Corpus Support
- Built-in corpora: Default, Jazz Standards, Lilicub
- Custom corpus upload (.json format)
- Local storage persistence

## 🛠️ Technology Stack

- **Frontend**: React + TypeScript
- **Styling**: Tailwind CSS
- **Audio**: Tone.js for Web Audio API
- **MIDI**: @tonejs/midi for file processing
- **AI**: Google Gemini API for musical analysis
- **Visualization**: Recharts for 2D mapping
- **Build**: Vite
- **Deployment**: Vercel

## 🚦 Getting Started

### Prerequisites
- Node.js 16+
- A Google Gemini API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/flowskygge/interactive-music-map.git
   cd interactive-music-map
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Create .env.local and add your API key
   echo "VITE_GEMINI_API_KEY=your_api_key_here" > .env.local
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

### Building for Production

```bash
npm run build
npm run preview
```

## 🎯 How to Use

### Recording Your Melody
1. **Set Parameters**: Choose tempo (40-200 BPM), time signature (4/4 or 3/4), and quantization
2. **Connect MIDI**: Use a MIDI keyboard or the virtual piano
3. **Record**: Click "Start Recording" for a metronome countdown, then play your melody
4. **Analysis**: The AI automatically analyzes your creation and places it on the map

### Exploring the Map
- **Individual Mode**: See songs positioned by their musical characteristics
- **Similarity Mode**: View clustering based on musical relationships
- **Synthesis Mode**: Drag your melody to generate variations

### Advanced Features
- **Upload MIDI Files**: Import existing MIDI files for analysis
- **Custom Corpora**: Upload JSON collections of analyzed songs
- **Export**: Download your creations as MIDI files
- **History**: Access previous melody variations

## 🧪 Musical Analysis Details

### Melodic Complexity (X-Axis)
Combines melodic complexity and richness:
- **High values**: Complex rhythms, large intervals, rich harmonies
- **Low values**: Simple patterns, stepwise motion, basic chords

### Harmonic Richness (Y-Axis)
Evaluates harmonic density and complexity:
- **High values**: Frequent chord changes, complex harmonies (7ths, 9ths)
- **Low values**: Simple triads, infrequent changes

### Global Similarity Analysis
Uses AI to cluster songs by:
- Scale and mode relationships
- Circle of fifths proximity
- Harmonic progression patterns
- Chord complexity levels

---

**Created by Benoit Carré** | [GitHub](https://github.com/flowskygge) | [Live Demo](https://interactivemusic-mdmu6chfx-benoit-carres-projects.vercel.app)
