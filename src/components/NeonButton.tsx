import { cn } from "@/lib/utils";

interface NeonButtonProps {
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

const NeonButton = ({ onClick, className, children }: NeonButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-[100px] h-[100px] rounded-full flex items-center justify-center group cursor-pointer",
        "transition-transform duration-300 hover:scale-105",
        className
      )}
    >
      {/* Background circle with subtle border */}
      <div className="absolute inset-0 rounded-full bg-[#1a1d24] shadow-[inset_0_2px_10px_rgba(0,0,0,0.8),0_4px_20px_rgba(0,0,0,0.5)]">
        <div className="absolute inset-[1px] rounded-full border border-[#2a2d34]"></div>
      </div>
      
      {/* Rotating neon arc glow */}
      <div className="absolute inset-0 rounded-full animate-spin-slow overflow-hidden">
        <div className="absolute inset-0 rounded-full" style={{
          background: 'conic-gradient(from 0deg, transparent 0deg, transparent 240deg, rgba(0, 186, 255, 0.8) 270deg, rgba(0, 128, 255, 1) 300deg, rgba(0, 64, 255, 0.8) 330deg, transparent 360deg)',
          filter: 'blur(8px)'
        }}></div>
      </div>
      
      {/* Outer glow */}
      <div className="absolute inset-[-4px] rounded-full animate-spin-slow opacity-60">
        <div className="absolute inset-0 rounded-full" style={{
          background: 'conic-gradient(from 0deg, transparent 0deg, transparent 250deg, rgba(0, 186, 255, 0.3) 280deg, rgba(0, 128, 255, 0.5) 300deg, rgba(0, 64, 255, 0.3) 320deg, transparent 360deg)',
          filter: 'blur(12px)'
        }}></div>
      </div>
      
      {/* Inner button surface */}
      <div className="relative z-10 w-[92px] h-[92px] rounded-full bg-gradient-to-br from-[#1f2229] to-[#16181d] flex items-center justify-center shadow-[inset_0_2px_6px_rgba(0,0,0,0.7),inset_0_-2px_6px_rgba(0,0,0,0.5)]">
        <div className="w-[86px] h-[86px] rounded-full bg-[#1a1d24] flex items-center justify-center shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]">
          {children}
        </div>
      </div>
      
      {/* Subtle top highlight */}
      <div className="absolute top-[8%] left-[25%] w-[50%] h-[15%] bg-gradient-to-b from-white/5 to-transparent rounded-full blur-sm pointer-events-none z-20"></div>
    </button>
  );
};

export default NeonButton;
