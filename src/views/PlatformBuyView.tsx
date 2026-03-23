import React, { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { Camera, Trash2, ChevronLeft, Store, ShieldCheck, MapPin, Calendar, Truck } from "lucide-react";
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
    originalPrice: "",
    condition: "Used - Good",
    moveOutDate: "",
    address: "",
    logisticsNote: "Elevator available", // 预设几个物流选项
    description: "",
  });

  const [images, setImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 自动从用户资料中读取地址和离开时间，减少输入负担
  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        moveOutDate: prev.moveOutDate || profile.departureDate || "",
        address: prev.address || profile.dormLocation || ""
      }));
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile) {
      return showAlert("System Error", "User profile not loaded. Please try again.");
    }
    
    if (images.length === 0) {
      return showAlert("Missing Photos", "Please upload photos showing the current condition of your items.");
    }

    setUploading(true);
    try {
      const imageUrls = await Promise.all(
        images.map(async (file) => {
          const storageRef = ref(storage, `platform_buys/${profile.uid}_${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          return await getDownloadURL(storageRef);
        })
      );

      const originalPriceNum = parseFloat(formData.originalPrice);
      if (isNaN(originalPriceNum)) {
        setUploading(false);
        return showAlert("Invalid Price", "Please enter a valid number for the original price.");
      }

      // Payload 更新为符合平台回收算法所需的数据
      const acquisitionPayload = {
        itemName: formData.itemName || "",
        originalPrice: originalPriceNum,
        condition: formData.condition || "Used - Good",
        moveOutDate: formData.moveOutDate || "",
        address: formData.address || "",
        logisticsNote: formData.logisticsNote || "",
        description: formData.description || "",
        images: imageUrls,
        sellerId: profile.uid,
        sellerEmail: profile.email || "",
        sellerName: profile.displayName || "Anonymous",
        status: "Pending Evaluation",
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "platform_acquisitions"), acquisitionPayload);
      
      showAlert("Request Submitted!", "Our team will evaluate your item's condition, original value, and pickup logistics. You will receive an official quote via email within 24 hours.");
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
          <p className="text-sm text-gray-500 font-medium">Moving out? Let us handle your bulky items.</p>
        </div>
      </div>

      <div className="bg-green-50 border border-green-100 rounded-2xl p-4 mb-8 flex gap-4">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-green-500 flex-shrink-0 shadow-sm">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-gray-900 text-sm">Hassle-Free Buyout</h4>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            We calculate offers based on item condition, original value, and pickup difficulty. Accept our quote, and we handle the heavy lifting before you move out.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 照片上传部分保持不变，因为需要多角度图来评估成色 */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-600">Item Photos (Required)</label>
          <p className="text-[10px] text-gray-400">Please provide clear photos of the item, including any flaws or damages.</p>
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
          <label className="text-sm font-bold text-gray-600">Item Name / Bundle Description</label>
          <input 
            required
            className="input-field" 
            placeholder="e.g. IKEA Desk & Office Chair"
            value={formData.itemName}
            onChange={e => setFormData(prev => ({ ...prev, itemName: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-bold text-gray-600">Original Price ($)</label>
            <input 
              required
              type="number"
              className="input-field" 
              placeholder="Purchased for..."
              value={formData.originalPrice}
              onChange={e => setFormData(prev => ({ ...prev, originalPrice: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-bold text-gray-600">Current Condition</label>
            <select 
              className="input-field appearance-none"
              value={formData.condition}
              onChange={e => setFormData(prev => ({ ...prev, condition: e.target.value }))}
            >
              <option value="Brand New">Brand New</option>
              <option value="Like New">Like New</option>
              <option value="Used - Good">Used - Good</option>
              <option value="Used - Fair">Used - Fair (Heavy wear)</option>
            </select>
          </div>
        </div>

        {/* 物流与搬出信息区块 */}
        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4 mt-2">
          <h4 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
            <Truck className="w-4 h-4 text-primary" />
            Pickup Logistics
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> Pickup Address</label>
              <input 
                required
                className="w-full bg-white border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 shadow-sm" 
                placeholder="Apt number, Building"
                value={formData.address}
                onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Move-out Date</label>
              <input 
                required
                type="date"
                className="w-full bg-white border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 shadow-sm" 
                value={formData.moveOutDate}
                onChange={e => setFormData(prev => ({ ...prev, moveOutDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500">Building Access (Crucial for Quote)</label>
            <select 
              className="w-full bg-white border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 shadow-sm appearance-none"
              value={formData.logisticsNote}
              onChange={e => setFormData(prev => ({ ...prev, logisticsNote: e.target.value }))}
            >
              <option value="Elevator available">Elevator available in building</option>
              <option value="Walk-up (1st/2nd Floor)">Walk-up stairs (1st or 2nd Floor)</option>
              <option value="Walk-up (3rd Floor +)">Walk-up stairs (3rd Floor or higher)</option>
              <option value="Item already disassembled">Item is already fully disassembled</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-bold text-gray-600">Additional Details</label>
          <textarea 
            required
            rows={3}
            className="input-field resize-none" 
            placeholder="Are there any missing parts? Is it extremely heavy? Let us know..."
            value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
          />
        </div>

        <button 
          disabled={uploading}
          className="btn-primary w-full mt-2 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
        >
          {uploading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Submitting for Review...
            </>
          ) : (
            <>
              <Store className="w-5 h-5" />
              Request Buyout Quote
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
}