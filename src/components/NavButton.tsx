import React from "react";
import { cn } from "../utils/classNames";

export default function NavButton({ icon: Icon, active, onClick, badgeCount }: { icon: any, active: boolean, onClick: () => void, badgeCount?: number }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-2 transition-all rounded-xl relative",
        active ? "text-primary bg-primary/5" : "text-gray-400 hover:text-gray-600"
      )}
    >
      <Icon className={cn("w-6 h-6", active && "fill-current")} />
      {badgeCount !== undefined && badgeCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white px-1">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
    </button>
  );
}