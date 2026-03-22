import React from "react";
import { motion } from "motion/react";
import { Bell, Shield, HelpCircle, Info, ChevronLeft, LogOut } from "lucide-react";
import { UserProfile } from "../types";
import { cn } from "../utils/classNames";

export interface SettingsViewProps {
  key?: string;
  profile: UserProfile | null;
  onLogout: () => void;
}

export default function SettingsView({ profile, onLogout }: SettingsViewProps) {
  const settingsItems = [
    { icon: Bell, label: "Notifications", color: "text-blue-500", bg: "bg-blue-50" },
    { icon: Shield, label: "Privacy & Security", color: "text-green-500", bg: "bg-green-50" },
    { icon: HelpCircle, label: "Help Center", color: "text-purple-500", bg: "bg-purple-50" },
    { icon: Info, label: "About Relo", color: "text-orange-500", bg: "bg-orange-50" },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="p-6"
    >
      <h2 className="text-2xl font-black mb-8">Settings</h2>
      
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Account</p>
          <div className="bg-white rounded-3xl p-4 flex items-center gap-4 border border-black/5 shadow-sm">
            <img src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.uid}`} className="w-12 h-12 rounded-2xl object-cover" alt="profile" />
            <div className="flex-1">
              <h4 className="font-bold text-gray-900">{profile?.displayName}</h4>
              <p className="text-xs text-gray-400">{profile?.email}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">General</p>
          <div className="bg-white rounded-3xl overflow-hidden border border-black/5 shadow-sm divide-y divide-gray-50">
            {settingsItems.map((item, i) => (
              <button key={i} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-all">
                <div className="flex items-center gap-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", item.bg, item.color)}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-gray-700 text-sm">{item.label}</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-gray-300 rotate-180" />
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={onLogout}
          className="w-full p-4 bg-red-50 text-red-500 rounded-3xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-all mt-4"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </motion.div>
  );
}