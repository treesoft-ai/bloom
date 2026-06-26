import React from 'react';

// Common interface for all standard icons
export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

// The custom hand-drawn Notion-style face logo badge with overlay sparkles
export const BloomLogo: React.FC<{ className?: string; size?: number }> = ({ size = 110 }) => {
  return (
    <div 
      style={{ 
        position: 'relative', 
        width: `${size}px`, 
        height: `${size}px`, 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        margin: '0 auto',
        userSelect: 'none'
      }}
    >
      {/* Sparkles behind/above top right */}
      <svg 
        style={{
          position: 'absolute',
          top: '-8px',
          right: '-8px',
          width: '32px',
          height: '32px',
          zIndex: 2,
          pointerEvents: 'none'
        }}
        viewBox="0 0 24 24"
        fill="none"
      >
        {/* Yellow/Orange Star Sparkle */}
        <path 
          d="M12 2L14.2 8.2L20.5 9L15.6 13.1L17.2 19.2L12 16L6.8 19.2L8.4 13.1L3.5 9L9.8 8.2L12 2Z" 
          fill="#ffb800" 
          stroke="#000" 
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      
      <svg 
        style={{
          position: 'absolute',
          top: '2px',
          right: '-16px',
          width: '18px',
          height: '18px',
          zIndex: 2,
          pointerEvents: 'none'
        }}
        viewBox="0 0 24 24"
        fill="none"
      >
        {/* Blue Star Sparkle */}
        <path 
          d="M12 2L14.2 8.2L20.5 9L15.6 13.1L17.2 19.2L12 16L6.8 19.2L8.4 13.1L3.5 9L9.8 8.2L12 2Z" 
          fill="#00c2ff" 
          stroke="#000" 
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      
      <svg 
        style={{
          position: 'absolute',
          top: '-12px',
          right: '18px',
          width: '12px',
          height: '12px',
          zIndex: 2,
          pointerEvents: 'none'
        }}
        viewBox="0 0 24 24"
        fill="none"
      >
        {/* Purple Sparkle circle */}
        <circle cx="12" cy="12" r="8" fill="#aa3bff" stroke="#000" strokeWidth="1" />
      </svg>

      {/* Main Face Badge Circle */}
      <svg 
        width="100%" 
        height="100%" 
        viewBox="0 0 100 100" 
        fill="none" 
        style={{ zIndex: 1 }}
      >
        {/* White outer circle with outline */}
        <circle cx="50" cy="50" r="44" fill="#ffffff" stroke="#000000" strokeWidth="4.5" />
        
        {/* Eyebrows (hand-drawn curved lines) */}
        <path d="M36 40 C38 35, 44 35, 46 38" stroke="#000" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <path d="M54 38 C56 35, 62 35, 64 40" stroke="#000" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        
        {/* Eyes (dots) */}
        <circle cx="41" cy="47" r="3" fill="#000" />
        <circle cx="59" cy="47" r="3" fill="#000" />
        
        {/* Nose & Glasses Bridge (loop shape) */}
        <path d="M48 48 C49 46, 51 46, 52 48" stroke="#000" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M50 49 L50 56 C50 60, 44 60, 44 57" stroke="#000" strokeWidth="3.5" strokeLinecap="round" fill="none" />

        {/* Highlighter/Pen leaning on the right */}
        <g transform="translate(68, 32) rotate(22)">
          {/* Pen body */}
          <rect x="-4" y="-20" width="10" height="34" rx="2" fill="#ffffff" stroke="#000000" strokeWidth="3" />
          {/* Pen cap details */}
          <line x1="-4" y1="-12" x2="6" y2="-12" stroke="#000000" strokeWidth="3" />
          {/* Sparkly marker/highlight cap top */}
          <path d="M-4 -20 L-4 -24 L1 -27 L6 -24 L6 -20 Z" fill="#aa3bff" stroke="#000000" strokeWidth="3" strokeLinejoin="round" />
          {/* Pen clip */}
          <path d="M6 -10 L10 -10 L10 2 L6 2" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </g>
      </svg>
    </div>
  );
};

// Plus (+) Icon
export const PlusIcon: React.FC<IconProps> = ({ size = 20, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

// Sliders / Controls (Settings) Icon
export const SlidersIcon: React.FC<IconProps> = ({ size = 18, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="4" y1="21" x2="4" y2="14"></line>
    <line x1="4" y1="10" x2="4" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="12"></line>
    <line x1="12" y1="8" x2="12" y2="3"></line>
    <line x1="20" y1="21" x2="20" y2="16"></line>
    <line x1="20" y1="12" x2="20" y2="3"></line>
    <line x1="1" y1="14" x2="7" y2="14"></line>
    <line x1="9" y1="8" x2="15" y2="8"></line>
    <line x1="17" y1="16" x2="23" y2="16"></line>
  </svg>
);

// Microphone (Speech) Icon
export const MicIcon: React.FC<IconProps> = ({ size = 18, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
    <path d="M19 10v1a7 7 0 0 1-14 0v-1"></path>
    <line x1="12" y1="19" x2="12" y2="23"></line>
    <line x1="8" y1="23" x2="16" y2="23"></line>
  </svg>
);

// Send Up-Arrow Icon
export const ArrowUpIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="12" y1="19" x2="12" y2="5"></line>
    <polyline points="5 12 12 5 19 12"></polyline>
  </svg>
);

// Sparkle/Spark Icon
export const SparkleIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707-.707M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
  </svg>
);

// Chevron Down Icon
export const ChevronDownIcon: React.FC<IconProps> = ({ size = 14, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

// Speech Bubble Icon (for chats)
export const ChatBubbleIcon: React.FC<IconProps> = ({ size = 18, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
  </svg>
);

// Magic Wand (for suggestions)
export const MagicWandIcon: React.FC<IconProps> = ({ size = 18, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M18 2a3 3 0 0 0-3 3v12a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" transform="rotate(45 12 12)" />
    <path d="M19 9.5L14.5 5" />
    <path d="M3 21l9-9" />
    <path d="M12 3l.01-.01M19 3l.01-.01M21 6l.01-.01" />
  </svg>
);

// Pencil Icon (write suggestions)
export const PencilIcon: React.FC<IconProps> = ({ size = 18, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 20h9"></path>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
  </svg>
);

// File / PDF Icon
export const FileSearchIcon: React.FC<IconProps> = ({ size = 18, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <circle cx="11.5" cy="14.5" r="2.5"></circle>
    <line x1="16" y1="19" x2="13.25" y2="16.25"></line>
  </svg>
);

// Close (X) Icon
export const XIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

// Copy Icon
export const CopyIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

// Check Icon (for copy success)
export const CheckIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

// Regenerate / Reload Icon
export const RefreshIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
  </svg>
);

// Trash / Delete Icon
export const TrashIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

// Back / Arrow Left Icon
export const ArrowLeftIcon: React.FC<IconProps> = ({ size = 20, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="19" y1="12" x2="5" y2="12"></line>
    <polyline points="12 19 5 12 12 5"></polyline>
  </svg>
);

// Sidebar Panel Toggle Icon
export const SidebarIcon: React.FC<IconProps> = ({ size = 20, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="9" y1="3" x2="9" y2="21"></line>
  </svg>
);

// Voice Waveform Icon
export const WaveformIcon: React.FC<IconProps> = ({ size = 18, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="6" y1="10" x2="6" y2="14" />
    <line x1="10" y1="6" x2="10" y2="18" />
    <line x1="14" y1="8" x2="14" y2="16" />
    <line x1="18" y1="11" x2="18" y2="13" />
  </svg>
);

// 12-spoke Starburst/Asterisk Icon
export const StarburstIcon: React.FC<IconProps> = ({ size = 24, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...props}>
    <line x1="12" y1="3" x2="12" y2="21" />
    <line x1="12" y1="3" x2="12" y2="21" transform="rotate(30 12 12)" />
    <line x1="12" y1="3" x2="12" y2="21" transform="rotate(60 12 12)" />
    <line x1="12" y1="3" x2="12" y2="21" transform="rotate(90 12 12)" />
    <line x1="12" y1="3" x2="12" y2="21" transform="rotate(120 12 12)" />
    <line x1="12" y1="3" x2="12" y2="21" transform="rotate(150 12 12)" />
  </svg>
);

// Paperclip / Attachment Icon
export const PaperclipIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

// Image Icon
export const ImageIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="3" width={size} height={size} rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

// Play Icon
export const PlayIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

// Thumbs Up Icon
export const ThumbsUpIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
  </svg>
);

// Thumbs Down Icon
export const ThumbsDownIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z M17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
  </svg>
);

// Projects / Folder Icon
export const ProjectsIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

// Artifacts / Branch Node Icon
export const ArtifactsIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="18" r="3" />
    <path d="M10.5 8.5l-3 7M13.5 8.5l3 7" />
  </svg>
);

// Customize / Briefcase Icon
export const CustomizeIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

// Download / Arrow Down Tray Icon
export const DownloadIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

// Search / Magnifying Glass Icon
export const SearchIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

// Shield Icon (for admin)
export const ShieldIcon: React.FC<IconProps> = ({ size = 18, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

// Users Icon (for admin panel)
export const UsersIcon: React.FC<IconProps> = ({ size = 18, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

// Star Icon (for admin badge)
export const StarIcon: React.FC<IconProps> = ({ size = 14, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

// Horizontal More/3-dots Icon
export const MoreHorizontalIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="1.5"></circle>
    <circle cx="19" cy="12" r="1.5"></circle>
    <circle cx="5" cy="12" r="1.5"></circle>
  </svg>
);
