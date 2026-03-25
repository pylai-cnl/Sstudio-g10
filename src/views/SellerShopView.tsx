import React, { useState } from "react";
import { ChevronLeft, Edit2, Check, X, MapPin, Calendar, BookOpen, GraduationCap } from "lucide-react";
import { Product, UserProfile } from "../types";
import ProductCard from "../components/ProductCard";

interface SellerShopViewProps {
  sellerProfile: UserProfile | null;
  products: Product[];
  onSelectProduct: (p: Product) => void;
  onBack: () => void;
  isOwnShop: boolean;
  onUpdateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

export default function SellerShopView({
  sellerProfile,
  products,
  onSelectProduct,
  onBack,
  isOwnShop,
  onUpdateProfile
}: SellerShopViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<UserProfile>>({});

  if (!sellerProfile) return null;

  const handleStartEdit = () => {
    setEditData({
      majorInfo: sellerProfile.majorInfo || "",
      gradYear: sellerProfile.gradYear || "",
      departureDate: sellerProfile.departureDate || "",
      bio: (sellerProfile as any).bio || ""
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    await onUpdateProfile(editData);
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 px-4 py-4 flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-black">{isOwnShop ? "My Shop" : `${sellerProfile.displayName}'s Shop`}</h2>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {/* Profile Card */}
        <div className="bg-white rounded-[32px] p-8 shadow-sm border border-black/5 mb-8 relative overflow-hidden">
          <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
            <div className="w-32 h-32 rounded-3xl overflow-hidden bg-gray-100 border-4 border-white shadow-xl flex-shrink-0">
              <img src={sellerProfile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sellerProfile.uid}`} className="w-full h-full object-cover" alt="avatar" />
            </div>

            <div className="flex-1 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-black text-gray-900">{sellerProfile.displayName}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="bg-green-100 text-green-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Verified Student</span>
                    <span className="text-gray-400 text-sm flex items-center gap-1"><MapPin className="w-3 h-3" /> {sellerProfile.dormLocation || "Cornell Tech"}</span>
                  </div>
                </div>
                {isOwnShop && !isEditing && (
                  <button onClick={handleStartEdit} className="p-3 bg-gray-50 text-gray-400 hover:text-primary hover:bg-orange-50 rounded-2xl transition-all">
                    <Edit2 className="w-5 h-5" />
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-6 rounded-3xl border border-dashed border-gray-200">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Major Info</label>
                    <input className="w-full bg-white border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20" value={editData.majorInfo} onChange={e => setEditData({...editData, majorInfo: e.target.value})} placeholder="e.g. Master in CS" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Join Year / Class of</label>
                    <input className="w-full bg-white border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20" value={editData.gradYear} onChange={e => setEditData({...editData, gradYear: e.target.value})} placeholder="e.g. 2025" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Moving Out Date</label>
                    <input type="date" className="w-full bg-white border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20" value={editData.departureDate} onChange={e => setEditData({...editData, departureDate: e.target.value})} />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">About Me</label>
                    <textarea className="w-full bg-white border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 min-h-[80px]" value={(editData as any).bio} onChange={e => setEditData({...editData, bio: e.target.value} as any)} placeholder="Tell others about yourself..." />
                  </div>
                  <div className="flex gap-2 md:col-span-2 pt-2">
                    <button onClick={handleSave} className="flex-1 bg-primary text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20"><Check className="w-4 h-4" /> Save Changes</button>
                    <button onClick={() => setIsEditing(false)} className="px-6 bg-white text-gray-500 font-bold py-3 rounded-xl border border-gray-200"><X className="w-4 h-4" /></button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 p-3 rounded-2xl">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-1 flex items-center gap-1"><BookOpen className="w-3 h-3" /> Major</p>
                      <p className="text-sm font-bold text-gray-700">{sellerProfile.majorInfo || "Not specified"}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-2xl">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-1 flex items-center gap-1"><GraduationCap className="w-3 h-3" /> Join</p>
                      <p className="text-sm font-bold text-gray-700">{sellerProfile.gradYear || "Not specified"}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-2xl">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Moving Out</p>
                      <p className="text-sm font-bold text-gray-700">{sellerProfile.departureDate || "Not specified"}</p>
                    </div>
                  </div>
                  <p className="text-gray-500 text-sm leading-relaxed italic">
                    {(sellerProfile as any).bio || "No description provided."}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <h3 className="text-xl font-black mb-6 flex items-center gap-2">
          Listings <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">{products.length}</span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {products.map(product => (
            <ProductCard key={product.id} product={product} onClick={() => onSelectProduct(product)}
              users={Object.keys(sellerProfile).length > 0 ? { [sellerProfile.uid]: sellerProfile } : {}} 
              isFavorite={false} // 在 Shop View 暫時預設為 false，或傳入真正的 favorites 狀態
              onToggleFavorite={() => {}} // 若 Shop View 不需收藏功能，傳入空函式
              onViewSellerShop={() => {}} // 已經在 Shop 了，傳入空函式即可
            />
          ))}
        </div>
      </div>
    </div>
  );
}