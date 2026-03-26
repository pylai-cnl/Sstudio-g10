import React, { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { ChevronLeft, Heart, Package } from "lucide-react";
import { Product, UserProfile } from "../types";
import { cn } from "../utils/classNames";

// 修复：明确声明 key 属性
export interface SellerShopViewProps {
  key?: string;
  sellerProfile: UserProfile | null;
  products: Product[];
  onSelectProduct: (p: Product) => void;
  onBack: () => void;
  isOwnShop: boolean;
  onUpdateProfile: (data: Partial<UserProfile>, silent?: boolean) => Promise<void>;
}

export default function SellerShopView({ 
  sellerProfile, 
  products, 
  onSelectProduct, 
  onBack, 
  isOwnShop, 
  onUpdateProfile 
}: SellerShopViewProps) {
  const [tab, setTab] = useState<"active" | "sold">("active");
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    majorInfo: sellerProfile?.majorInfo || "Computer Science, Class of 2026",
    bio: sellerProfile?.bio || "Selling campus essentials to new students. Fast response!"
  });
  const [isSaving, setIsSaving] = useState(false);
  
  useEffect(() => {
    if (sellerProfile) {
      setEditData({
        majorInfo: sellerProfile.majorInfo || "Computer Science, Class of 2026",
        bio: sellerProfile.bio || "Selling campus essentials to new students. Fast response!"
      });
    }
  }, [sellerProfile?.uid, sellerProfile?.majorInfo, sellerProfile?.bio]);

  const activeProducts = products.filter(p => p.status === "Still on");
  const soldProducts = products.filter(p => p.status === "Sold" || p.status === "Completed");

  const syncShopStats = useCallback(() => {
    const soldCount = products.filter(p => p.status === "Sold" || p.status === "Completed").length;
    const el = document.getElementById('shop-stat-sold');
    if (el) {
      el.innerText = soldCount.toString();
    }
  }, [products]);

  useEffect(() => {
    syncShopStats();
  }, [syncShopStats]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdateProfile(editData);
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-white"
    >
      <div className="relative">
        <div className="h-32 bg-gray-100 overflow-hidden">
          <img 
            src="https://picsum.photos/seed/campus/1200/400" 
            className="w-full h-full object-cover opacity-50" 
            alt="cover" 
          />
        </div>
        <button 
          onClick={onBack}
          className="absolute top-4 left-4 w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-gray-800 shadow-sm"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      <div className="px-6 -mt-10 relative z-10">
        <div className="flex items-end mb-6">
          <div className="w-24 h-24 rounded-full border-4 border-white overflow-hidden shadow-lg bg-white">
            <img 
              src={sellerProfile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sellerProfile?.uid}`} 
              className="w-full h-full object-cover" 
              alt="avatar" 
            />
          </div>
        </div>

        <div className="shop-profile-container">
          <div className="shop-left-side">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold text-gray-900">{sellerProfile?.displayName}</h2>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="text-base">🏫</span>
              <span>Cornell Tech · Mathematics '26</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="text-base">🗓️</span>
              <span>Joined Fall 2024</span>
            </div>
            
            <div className="my-2">
              <span className="urgency-tag">✈️ Moving Out: May 2026</span>
            </div>
            
            {isEditing ? (
              <div className="space-y-3 mb-4 w-full max-w-md">
                <input 
                  type="text"
                  value={editData.majorInfo}
                  onChange={(e) => setEditData(prev => ({ ...prev, majorInfo: e.target.value }))}
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/20"
                  placeholder="Major, Class of Year"
                />
                <textarea 
                  value={editData.bio}
                  onChange={(e) => setEditData(prev => ({ ...prev, bio: e.target.value }))}
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 text-sm leading-relaxed focus:ring-2 focus:ring-primary/20 resize-none"
                  rows={2}
                  placeholder="Tell us about yourself..."
                />
              </div>
            ) : (
              <p className="text-sm text-gray-600 leading-relaxed max-w-md">
                {sellerProfile?.bio || "Selling campus essentials to new students. Fast response!"}
              </p>
            )}
          </div>

          <div className="shop-right-side">
            <div className="stats-row mb-6">
              <div className="stat-item">
                <span className="stat-value">{sellerProfile?.followersCount || 0}</span>
                <span className="stat-label">FOLLOWERS</span>
              </div>
              <div className="stat-item">
                <span id="shop-stat-sold" className="stat-value">{soldProducts.length}</span>
                <span className="stat-label">ITEMS SOLD</span>
              </div>
              <div className="stat-item">
                <span className="stat-value text-[#333]">N/A</span>
                <span className="stat-label">REVIEWS</span>
              </div>
            </div>
            
            {!isOwnShop && (
              <button className="follow-btn">
                Follow
              </button>
            )}
            
            {isOwnShop && (
              <button 
                onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                disabled={isSaving}
                className="text-xs font-bold text-primary hover:underline"
              >
                {isSaving ? "Saving..." : isEditing ? "Save" : "Edit Profile"}
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-8 border-b border-gray-100 mb-6">
          <button 
            onClick={() => setTab("active")}
            className={cn(
              "pb-3 text-sm font-bold transition-all relative",
              tab === "active" ? "text-primary" : "text-gray-400"
            )}
          >
            Still On ({activeProducts.length})
            {tab === "active" && (
              <motion.div layoutId="shop-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button 
            onClick={() => setTab("sold")}
            className={cn(
              "pb-3 text-sm font-bold transition-all relative",
              tab === "sold" ? "text-primary" : "text-gray-400"
            )}
          >
            Sold ({soldProducts.length})
            {tab === "sold" && (
              <motion.div layoutId="shop-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>

        <div className="shop-product-grid">
          {(tab === "active" ? activeProducts : soldProducts).map(product => (
            <div 
              key={product.id}
              onClick={() => onSelectProduct(product)}
              className="shop-product-card"
            >
              <div className="card-image-wrapper">
                <img src={product.images[0]} alt={product.title} />
                
                <span className="condition-tag">
                  {product.condition.toLowerCase().includes("brand new") ? "New" : 
                   product.condition.toLowerCase().includes("like new") ? "Like New" : 
                   "Used"}
                </span>

                {!isOwnShop && (
                  <div className="heart-icon-wrapper">
                    <Heart className="w-4 h-4" />
                  </div>
                )}

                {product.status !== "Still on" && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20">
                    <span className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-900">
                      {product.status}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="card-info">
                <h4 className="product-title">{product.title}</h4>
                <span className="price-tag">${product.price}</span>
              </div>
            </div>
          ))}
          {(tab === "active" ? activeProducts : soldProducts).length === 0 && (
            <div className="col-span-full py-20 text-center">
              <Package className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400 font-bold text-sm">No items found in this category</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}