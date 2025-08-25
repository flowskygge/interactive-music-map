

import React from 'react';

export const PlayIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
);

export const StopIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
);

export const RecordIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" /></svg>
);

export const MusicNoteIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V7.5A2.25 2.25 0 0019.5 5.25h-8.25A2.25 2.25 0 009 7.5v3.75" />
  </svg>
);

export const LoadingSpinner = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg className={`${className} animate-spin`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

export const ZoomInIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m-3-3h6" />
  </svg>
);

export const ZoomOutIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
  </svg>
);

export const RefreshIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 4l1.5 1.5A9 9 0 0120.5 15M20 20l-1.5-1.5A9 9 0 013.5 9" />
  </svg>
);

export const MidiIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.25 17.25V9.75a.75.75 0 00-.75-.75H5.5a.75.75 0 00-.75.75v7.5c0 .414.336.75.75.75h13a.75.75 0 00.75-.75z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.75 17.25v-4.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.75 17.25v-4.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.75 17.25v-4.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.75 17.25v-4.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.25 12.75h2M9.25 12.75h2M12.25 12.75h2M15.25 12.75h2" />
    </svg>
);

export const DownloadIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);