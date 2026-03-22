import React, { useState, useRef } from "react";
import { motion } from "motion/react";
import { Camera, Trash2 } from "lucide-react";
import { collection, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { UserProfile } from "../types";
import { CATEGORIES, CONDITIONS } from "../utils/constants";

export interface SellViewProps {
  key?: string;
  onSuccess: () => void;
  onBack: () => void;
  profile: UserProfile | null;
  showAlert: (title: string, message: string) => void;
}

export default function SellView({ onSuccess, onBack, profile, showAlert }: SellViewProps) {
  const [formData, setFormData] = useState({
    title: "",
    price: "",
    category: "Others",
    condition: "Used - Good",
    description: "",
    departureDate: "",
    referenceLink: ""
  });
  const [images, setImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile) return;
    
    if (images.length === 0) {
      return showAlert("Missing Photos", "Please upload at least one image of your item.");
    }

    setUploading(true);
    try {
      // 修复后的纯净上传逻辑：移除了超时打断和 Base64 降级，信任 SDK
      const imageUrls = await Promise.all(
        images.map(async (file) => {
          const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          return url;
        })
      );

      const priceNum = parseFloat(formData.price);
      if (isNaN(priceNum)) {
        setUploading(false);
        return showAlert("Invalid Price", "Please enter a valid number for the price.");
      }

      const productPayload = {
        ...formData,
        price: priceNum,
        images: imageUrls,
        sellerId: profile.uid,
        sellerName: profile.displayName,
        sellerAvatar: profile.photoURL,
        sellerIsStudent: profile.isStudent,
        sellerSalesCount: profile.salesCount || 0,
        sellerPurchasesCount: profile.purchasesCount || 0,
        dormLocation: profile.dormLocation || "Cornell Tech House",
        status: "Still on",
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "products"), productPayload);
      onSuccess();
    } catch (error: any) {
      console.error("Publishing failed:", error);
      let msg = "Failed to post item. Please check your network and try again.";
      if (error?.message?.includes("permission-denied")) {
        msg = "Permission denied. Please check your login status.";
      }
      showAlert("Publishing Error", msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-6"
    >
      <div className="view-header">
        <h2 className="text-2xl font-black">Sell an Item</h2>
        <button 
          className="close-view-btn" 
          aria-label="Close" 
          onClick={onBack}
        >
          &times;
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-600">Photos</label>
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 flex-shrink-0 bg-gray-100 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-all"
            >
              <Camera className="w-8 h-8 mb-1" />
              <span className="text-[10px] font-bold">Add Photo</span>
            </button>
            {images.map((file, i) => (
              <div key={i} className="w-24 h-24 flex-shrink-0 relative rounded-2xl overflow-hidden group">
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
              const files = e.target.files;
              if (files) {
                const newFiles: File[] = Array.from(files);
                setImages(prev => [...prev, ...newFiles]);
              }
            }}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-bold text-gray-600">Title</label>
          <input 
            required
            className="input-field" 
            placeholder="What are you selling?"
            value={formData.title}
            onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-bold text-gray-600">Price ($)</label>
            <input 
              required
              type="number"
              className="input-field" 
              placeholder="0.00"
              value={formData.price}
              onChange={e => setFormData(prev => ({ ...prev, price: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-bold text-gray-600">Category</label>
            <select 
              className="input-field appearance-none"
              value={formData.category}
              onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
            >
              {CATEGORIES.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-bold text-gray-600">Condition</label>
            <select 
              className="input-field appearance-none"
              value={formData.condition}
              onChange={e => setFormData(prev => ({ ...prev, condition: e.target.value }))}
            >
              {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-bold text-gray-600">Departure Date</label>
            <input 
              required
              type="date"
              className="input-field" 
              value={formData.departureDate}
              onChange={e => setFormData(prev => ({ ...prev, departureDate: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-bold text-gray-600">Description</label>
          <textarea 
            required
            rows={3}
            className="input-field resize-none" 
            placeholder="Tell us more about the item..."
            value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-bold text-gray-600">Reference Link (Optional)</label>
          <input 
            className="input-field" 
            placeholder="Amazon/IKEA link for price ref"
            value={formData.referenceLink}
            onChange={e => setFormData(prev => ({ ...prev, referenceLink: e.target.value }))}
          />
        </div>

        <button 
          disabled={uploading}
          className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Publishing...
            </>
          ) : "Publish Item"}
        </button>
      </form>
    </motion.div>
  );
}