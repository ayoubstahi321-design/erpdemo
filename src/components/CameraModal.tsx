
import React from 'react';
import { X } from 'lucide-react';

interface CameraModalProps {
  isOpen: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  onClose: () => void;
  onSimulateScan: () => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({ isOpen, videoRef, onClose, onSimulateScan }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-black bg-opacity-95 flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-md aspect-3/4 bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
        <video
          ref={videoRef as React.LegacyRef<HTMLVideoElement>}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Overlay UI */}
        <div className="absolute inset-0 flex flex-col items-center justify-between p-6 pointer-events-none">
          <div className="bg-black/50 px-4 py-2 rounded-full text-white text-sm font-medium backdrop-blur-sm">
            Scan Product Barcode
          </div>
          
          {/* Scanner Guide Frame */}
          <div className="relative w-64 h-64 border-2 border-white/30 rounded-lg">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg"></div>
            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg"></div>
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg"></div>
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-500 rounded-br-lg"></div>
            
            {/* Animated Scan Line */}
            <div className="absolute left-0 right-0 h-0.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-[scan_2s_ease-in-out_infinite] top-1/2"></div>
            
            {/* Click to simulate */}
            <button 
              onClick={onSimulateScan}
              className="absolute inset-0 w-full h-full pointer-events-auto flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-white/10"
              title="Click to Simulate Scan"
            >
            </button>
          </div>

          <div className="text-center">
            <p className="text-white/70 text-xs mb-4">Point camera at code. <br/>(Tap screen to simulate scan in demo mode)</p>
            <button 
              onClick={onClose}
              className="pointer-events-auto bg-white text-slate-900 rounded-full p-3 hover:bg-slate-200 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes scan {
          0% { top: 10%; opacity: 0; }
          50% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};
