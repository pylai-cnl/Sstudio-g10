import React from "react";
import { Clock, Truck, CheckCircle } from "lucide-react";
import { cn } from "../utils/classNames";

export default function StatusBadge({ status }: { status: string | undefined }) {
  const configs: Record<string, { color: string; icon: any; text: string }> = {
    "Still on": { color: "bg-green-100 text-green-600", icon: Clock, text: "Available" },
    "Pending": { color: "bg-orange-100 text-orange-600", icon: Clock, text: "Processing" },
    "Delivered": { color: "bg-blue-100 text-blue-600", icon: Truck, text: "Delivered" },
    "Completed": { color: "bg-gray-100 text-gray-500", icon: CheckCircle, text: "Completed" },
    "Sold": { color: "bg-gray-100 text-gray-500", icon: CheckCircle, text: "Sold" }
  };

  const config = (status && configs[status]) ? configs[status] : configs["Still on"];
  const Icon = config.icon || Clock;

  return (
    <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", config.color)}>
      <Icon className="w-3 h-3" />
      {config.text}
    </div>
  );
}