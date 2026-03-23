import React, { useState, useRef } from "react";
import { motion } from "motion/react";
import { Camera, Trash2, ChevronLeft, Store, ShieldCheck } from "lucide-react";
import { collection, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { UserProfile } from "../types";

export interface PlatformBuyViewProps {
  key?: string;
  onSuccess: () => void;
  onBack: () => void;
  profile: UserProfile | null;
  showAlert: (title: string, message: string) => void;
}

export default function PlatformBuyView({ onSuccess, onBack, profile, showAlert }: PlatformBuyViewProps) {
  const [formData, setFormData] = useState({
    itemName: "",
    expectedPrice: "",
    condition: "Used - Good",
    description: "",
  });
  const [images, setImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile) {
      return showAlert("System Error", "User profile not loaded. Please try again.");
    }
    
    if (images.length === 0) {
      return showAlert("Missing Photos", "Please upload at least one image so we can evaluate your item.");
    }

    setUploading(true);
    try {
      // 1. Upload images to a specific platform-buy folder
      const imageUrls = await Promise.all(
        images.map(async (file) => {
          const storageRef = ref(storage, `platform_buys/${profile.uid}_${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          return await getDownloadURL(storageRef);
        })
      );

      const priceNum = parseFloat(formData.expectedPrice);
      if (isNaN(priceNum)) {
        setUploading(false);
        return showAlert("Invalid Price", "Please enter a valid number for the expected price.");
      }

      // 2. Save the acquisition request to a new collection 'platform_acquisitions'
      const acquisitionPayload = {
        itemName: formData.itemName || "",
        expectedPrice: priceNum,
        condition: formData.condition || "Used - Good",
        description: formData.description || "",
        images: imageUrls,
        sellerId: profile.uid,
        sellerEmail: profile.email || "",
        sellerName: profile.displayName || "Anonymous",
        status: "Pending Evaluation", // Status specifically for platform review
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "platform_acquisitions"), acquisitionPayload);
      
      showAlert("Request Submitted!", "Our team will evaluate your item and contact you via email within 24 hours.");
      onSuccess();
    } catch (error: any) {
      console.error("Submission failed:", error);
      showAlert("Error", "Failed to submit your request. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-6 max-w-2xl mx-auto"
    >
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-2xl font-black text-gray-900">Sell to Relo</h2>
          <p className="text-sm text-gray-500 font-medium">Get instant cash for your high-quality items</p>
        </div>
      </div>

      <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 mb-8 flex gap-4">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-primary flex-shrink-0 shadow-sm">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-gray-900 text-sm">How it works</h4>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            Upload photos of your item. Our team evaluates it and sends an offer within 24 hours. If you accept, we pick it up and pay you instantly.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-600">Item Photos (Required)</label>
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 flex-shrink-0 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-all"
            >
              <Camera className="w-8 h-8 mb-1" />
              <span className="text-[10px] font-bold">Add Photo</span>
            </button>
            {images.map((file, i) => (
              <div key={i} className="w-24 h-24 flex-shrink-0 relative rounded-2xl overflow-hidden group border border-gray-100">
                <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="preview" />
                <button 
                  type="button"
                  onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            multiple 
            accept="image/*"
            onChange={(e) => {
              if (e.target.files) {
                setImages(prev => [...prev, ...Array.from(e.target.files!)]);
              }
            }}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-bold text-gray-600">Item Name</label>
          <input 
            required
            className="input-field" 
            placeholder="e.g. Herman Miller Desk Chair"
            value={formData.itemName}
            onChange={e => setFormData(prev => ({ ...prev, itemName: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-bold text-gray-600">Expected Price ($)</label>
            <input 
              required
              type="number"
              className="input-field" 
              placeholder="How much do you want?"
              value={formData.expectedPrice}
              onChange={e => setFormData(prev => ({ ...prev, expectedPrice: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-bold text-gray-600">Condition</label>
            <select 
              className="input-field appearance-none"
              value={formData.condition}
              onChange={e => setFormData(prev => ({ ...prev, condition: e.target.value }))}
            >
              <option value="Brand New">Brand New</option>
              <option value="Like New">Like New</option>
              <option value="Used - Good">Used - Good</option>
              <option value="Used - Fair">Used - Fair</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-bold text-gray-600">Details & Flaws</label>
          <textarea 
            required
            rows={4}
            className="input-field resize-none" 
            placeholder="Please honestly describe any scratches, missing parts, or flaws to ensure an accurate quote..."
            value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
          />
        </div>

        <button 
          disabled={uploading}
          className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Submitting for Review...
            </>
          ) : (
            <>
              <Store className="w-5 h-5" />
              Submit to Platform
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
}