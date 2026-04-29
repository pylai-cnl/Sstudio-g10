import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  ChevronLeft, Save, User as UserIcon, MapPin, 
  Calendar, Book, GraduationCap, ShieldCheck
} from "lucide-react";
import { User as FirebaseUser } from "firebase/auth";
import { UserProfile } from "../types";

export interface SettingsViewProps {
  key?: string; // 【修复点】：在这里显式声明 key 属性
  currentUser: FirebaseUser;
  profile: UserProfile | null;
  onSave: (data: Partial<UserProfile>) => Promise<void>;
  onBack: () => void;
}

export default function SettingsView({ currentUser, profile, onSave, onBack }: SettingsViewProps) {
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [formData, setFormData] = useState({
    displayName: profile?.displayName || currentUser.displayName || "",
    dormLocation: profile?.dormLocation || "",
    departureDate: profile?.departureDate && !isNaN(new Date(profile.departureDate).getTime()) 
      ? profile.departureDate 
      : "",
    majorInfo: profile?.majorInfo || "",
    school: profile?.school || "Cornell Tech",
    gradYear: profile?.gradYear || "",
  });

  const today = new Date().toISOString().split('T')[0];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (formData.departureDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(formData.departureDate)) {
        setErrorMsg("Invalid Date Format. Please click the calendar icon to select a proper date.");
        return;
      }
      
      const parsedDate = new Date(formData.departureDate).getTime();
      if (isNaN(parsedDate)) {
        setErrorMsg("The selected date is invalid.");
        return;
      }
    }

    setSaving(true);
    try {
      await onSave(formData);
      onBack();
    } catch (error) {
      console.error("Failed to save profile", error);
      setErrorMsg("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-6 max-w-xl mx-auto pb-24 min-h-screen bg-gray-50/50"
    >
      <div className="flex items-center justify-between mb-8 sticky top-0 bg-gray-50/80 backdrop-blur-md py-4 z-10 -mx-6 px-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 -ml-2 text-gray-600 hover:bg-white rounded-full transition-colors shadow-sm"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-xl font-black text-gray-900">Edit Profile</h2>
            <p className="text-xs text-gray-500 font-medium">Manage your public information</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center mb-8">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-lg mb-4">
          <img 
            src={profile?.photoURL || currentUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.uid}`} 
            alt="avatar" 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">
          <ShieldCheck className="w-4 h-4" />
          {profile?.isStudent ? "Verified Student" : "Community Member"}
        </div>
        <p className="text-xs text-gray-400 mt-2 font-medium">{currentUser.email}</p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-bold text-center">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-5">
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <UserIcon className="w-3 h-3" /> Display Name
            </label>
            <input 
              required
              type="text"
              className="input-field"
              value={formData.displayName}
              onChange={e => setFormData({...formData, displayName: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Book className="w-3 h-3" /> Major / Program
              </label>
              <input 
                type="text"
                placeholder="e.g. ORIE"
                className="input-field"
                value={formData.majorInfo}
                onChange={e => setFormData({...formData, majorInfo: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <GraduationCap className="w-3 h-3" /> Grad Year
              </label>
              <input 
                type="text"
                placeholder="e.g. 2026"
                className="input-field"
                value={formData.gradYear}
                onChange={e => setFormData({...formData, gradYear: e.target.value})}
              />
            </div>
          </div>

          <div className="h-px bg-gray-50 w-full my-2"></div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3 h-3" /> Dorm / Apartment Location
            </label>
            <input 
              type="text"
              placeholder="e.g. The House Room 402"
              className="input-field"
              value={formData.dormLocation}
              onChange={e => setFormData({...formData, dormLocation: e.target.value})}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-orange-500 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> Departure Date (Crucial for Relo)
            </label>
            <input 
              type="date"
              required
              min={today}
              className="w-full bg-orange-50/50 border border-orange-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500/20 text-gray-900 font-medium cursor-pointer"
              value={formData.departureDate}
              onChange={e => setFormData({...formData, departureDate: e.target.value})}
            />
            <p className="text-[10px] text-gray-400 mt-1">This date activates your move-out countdown on the Platform Buyout page.</p>
          </div>

        </div>

        <button 
          type="submit"
          disabled={saving}
          className="w-full bg-primary text-white rounded-xl font-bold py-4 shadow-xl shadow-primary/20 flex items-center justify-center gap-2 hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-5 h-5" /> Save Changes
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
}