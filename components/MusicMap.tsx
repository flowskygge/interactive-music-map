import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { type Song, type MapPosition } from '../types';
import { LoadingSpinner, ZoomInIcon, ZoomOutIcon, RefreshIcon } from './icons';

interface MusicMapProps {
  songs: Song[];
  activeUserMelody?: Song;
  selectedSongId?: string;
  isGeneratingVariation: boolean;
  isDraggable: boolean;
  xAxisLabel: string;
  yAxisLabel: string;
  onNodeClick: (id: string) => void;
  onUserMelodyMove: (newPosition: MapPosition) => void;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 p-2 border border-gray-600 rounded shadow-lg">
        <p className="text-white font-bold">{`${payload[0].payload.name}`}</p>
      </div>
    );
  }
  return null;
};

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(val, max));

export const MusicMap: React.FC<MusicMapProps> = ({ songs, activeUserMelody, selectedSongId, onNodeClick, onUserMelodyMove, isGeneratingVariation, isDraggable, xAxisLabel, yAxisLabel }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [transientPosition, setTransientPosition] = useState<MapPosition | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const didDragRef = useRef(false);

  const [domain, setDomain] = useState({ x: [0, 100], y: [0, 100] });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{x: number, y: number, domainX: number[], domainY: number[] } | null>(null);

  useEffect(() => { if (!isGeneratingVariation) setTransientPosition(null); }, [isGeneratingVariation]);

  const data = (activeUserMelody ? [...songs, activeUserMelody] : songs)
    .filter(s => s.mapPosition)
    .map(s => {
      if (s.id === 'user-melody' && transientPosition) return { ...transientPosition, name: s.name, id: s.id, z: 1.5 };
      return { ...s.mapPosition, name: s.name, id: s.id, z: 1 };
    });
    
  const handleMouseDownOnUserMelody = useCallback(() => {
    if (activeUserMelody?.mapPosition && isDraggable) {
        didDragRef.current = false;
        setIsDragging(true);
        setTransientPosition(activeUserMelody.mapPosition);
    }
  }, [activeUserMelody, isDraggable]);

  useEffect(() => {
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 };
    const handleMouseMove = (event: MouseEvent) => {
        if (!isDragging || !chartContainerRef.current) return;
        didDragRef.current = true;
        const rect = chartContainerRef.current.getBoundingClientRect();
        const plotAreaX = rect.left + chartMargins.left;
        const plotAreaY = rect.top + chartMargins.top;
        const plotAreaWidth = rect.width - chartMargins.left - chartMargins.right;
        const plotAreaHeight = rect.height - chartMargins.top - chartMargins.bottom;
        const [xMin, xMax] = domain.x;
        const [yMin, yMax] = domain.y;
        const mouseX = event.clientX - plotAreaX;
        const mouseY = event.clientY - plotAreaY;
        let xValue = (mouseX / plotAreaWidth) * (xMax - xMin) + xMin;
        let yValue = ((plotAreaHeight - mouseY) / plotAreaHeight) * (yMax - yMin) + yMin;
        setTransientPosition({ x: clamp(xValue, 0, 100), y: clamp(yValue, 0, 100) });
    };
    const handleMouseUp = () => {
        if (isDragging && transientPosition && didDragRef.current) onUserMelodyMove(transientPosition);
        setIsDragging(false);
    };
    if (isDragging) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp, { once: true });
    }
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, transientPosition, onUserMelodyMove, domain]);
  
  // Panning logic
  useEffect(() => {
    const handlePanMove = (e: MouseEvent) => {
      if (!isPanning || !panStartRef.current || !chartContainerRef.current) return;
      e.preventDefault();
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      const { clientWidth, clientHeight } = chartContainerRef.current;
      const { domainX, domainY } = panStartRef.current;
      const xRange = domainX[1] - domainX[0];
      const yRange = domainY[1] - domainY[0];
      const xPerPixel = xRange / clientWidth;
      const yPerPixel = yRange / clientHeight;

      const newXMin = clamp(domainX[0] - dx * xPerPixel, 0, 100 - xRange);
      const newYMin = clamp(domainY[0] + dy * yPerPixel, 0, 100 - yRange);
      
      setDomain({ x: [newXMin, newXMin + xRange], y: [newYMin, newYMin + yRange] });
    };
    const handlePanUp = () => { setIsPanning(false); panStartRef.current = null; };
    if (isPanning) {
      window.addEventListener('mousemove', handlePanMove);
      window.addEventListener('mouseup', handlePanUp, { once: true });
    }
    return () => {
      window.removeEventListener('mousemove', handlePanMove);
      window.removeEventListener('mouseup', handlePanUp);
    };
  }, [isPanning]);

  const handleZoom = (factor: number) => {
      setDomain(prev => {
          const xRange = (prev.x[1] - prev.x[0]) * factor;
          const yRange = (prev.y[1] - prev.y[0]) * factor;
          const xCenter = (prev.x[0] + prev.x[1]) / 2;
          const yCenter = (prev.y[0] + prev.y[1]) / 2;
          const newX = [xCenter - xRange/2, xCenter + xRange/2];
          const newY = [yCenter - yRange/2, yCenter + yRange/2];
          if (newX[0] < 0) { newX[1] -= newX[0]; newX[0] = 0; }
          if (newY[0] < 0) { newY[1] -= newY[0]; newY[0] = 0; }
          if (newX[1] > 100) { newX[0] -= (newX[1] - 100); newX[1] = 100; }
          if (newY[1] > 100) { newY[0] -= (newY[1] - 100); newY[1] = 100; }
          return { x: [clamp(newX[0],0,100), clamp(newX[1],0,100)], y: [clamp(newY[0],0,100), clamp(newY[1],0,100)] };
      });
  };
  const handleResetZoom = () => setDomain({ x: [0, 100], y: [0, 100] });
  
  return (
    <div className="w-full h-full bg-gray-800 rounded-lg p-4 flex flex-col">
       <div className="flex justify-between items-start mb-2">
          <div>
            <h2 className="text-lg font-bold text-white">Musical Universe</h2>
            <p className="text-sm">X: {xAxisLabel}, Y: {yAxisLabel}</p>
          </div>
          <div className="flex items-center space-x-1">
             <button onClick={() => handleZoom(0.8)} title="Zoom In" className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-full text-gray-300 transition-colors"><ZoomInIcon /></button>
             <button onClick={() => handleZoom(1.25)} title="Zoom Out" className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-full text-gray-300 transition-colors"><ZoomOutIcon /></button>
             <button onClick={handleResetZoom} title="Reset Zoom" className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-full text-gray-300 transition-colors"><RefreshIcon /></button>
          </div>
       </div>
       <div
          className="flex-1 w-full h-full relative" ref={chartContainerRef}
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest('.recharts-surface') && !(e.target as HTMLElement).closest('.recharts-cell')) {
              setIsPanning(true);
              panStartRef.current = { x: e.clientX, y: e.clientY, domainX: domain.x, domainY: domain.y };
            }
          }}
        >
        {isGeneratingVariation && (
            <div className="absolute inset-0 bg-gray-900 bg-opacity-75 flex flex-col items-center justify-center z-20 rounded-lg">
                <LoadingSpinner className="w-10 h-10 text-indigo-400"/>
                <p className="text-white text-lg mt-3 font-semibold">Generating variation...</p>
            </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }} className={isPanning ? 'cursor-grabbing' : 'cursor-grab'}>
            <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
            <XAxis type="number" dataKey="x" name={xAxisLabel} domain={domain.x} stroke="#A0AEC0" allowDataOverflow/>
            <YAxis type="number" dataKey="y" name={yAxisLabel} domain={domain.y} stroke="#A0AEC0" allowDataOverflow/>
            <ZAxis type="number" dataKey="z" range={[60, 500]} name="size" />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} wrapperStyle={{ zIndex: 10 }} />
            <Scatter name="Songs" data={data} fill="#8884d8">
              {data.map((entry, index) => {
                  const isUserMelody = entry.id === 'user-melody';
                  const isHistory = entry.id.startsWith('user-melody-history-');
                  const isSelected = entry.id === selectedSongId;
                  let fill = isSelected ? '#F59E0B' : (isUserMelody ? '#34D399' : (isHistory ? '#4ADE80' : '#6366F1'));
                  if (isUserMelody && isDragging) fill = '#10B981';
                  
                  return (
                      <Cell key={`cell-${index}`} fill={fill}
                          className={isUserMelody && isDraggable ? 'cursor-grab' : 'cursor-pointer'}
                          onMouseDown={isUserMelody ? handleMouseDownOnUserMelody : undefined}
                          onClick={() => {
                            if (didDragRef.current) return;
                            onNodeClick(entry.id);
                          }}
                      />
                  );
              })}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};