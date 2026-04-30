import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  ChevronLeft, X, Pencil, Trash2, Camera, 
  MapPin, ExternalLink, MessageCircle, CheckCircle,
  Heart as HeartIcon, ShieldCheck, Truck, Clock
} from "lucide-react";
import { User as FirebaseUser } from "firebase/auth";
import { Product, UserProfile } from "../types";
import { cn } from "../utils/classNames";
import StatusBadge from "../components/StatusBadge";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

export interface ProductDetailViewProps {
  key?: string;
  product: Product;
  users: Record<string, UserProfile>;
  currentUser: FirebaseUser | null;
  onBack: () => void;
  onStatusChange: (id: string, status: Product["status"]) => void;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, data: Partial<Product>) => Promise<void>;
  onContactSeller: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  isOwner: boolean;
  showAlert: (title: string, message: string) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  sellerTransactionCount: number;
  onViewSellerShop: (sellerId: string) => void;
}

export default function ProductDetailView({ 
  product, users, currentUser, onBack, onStatusChange, onDelete, onUpdate,
  onContactSeller, onAddToCart, isOwner, showAlert, isFavorite, onToggleFavorite,
  sellerTransactionCount, onViewSellerShop
}: ProductDetailViewProps) {
  
  const seller = users[product.sellerId];
  const sellerAvatar = seller?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${product.sellerId}`;
  const sellerName = seller?.displayName || product.sellerName;
  const sellerIsStudent = seller?.isStudent ?? product.sellerIsStudent;

  const currUserProfile = currentUser ? users[currentUser.uid] : null;
  const isSuperAdmin = currentUser?.email === "relo@relo.com" || currUserProfile?.isAdmin;
  
  const canEdit = (isOwner || isSuperAdmin) && product.status === "Still on";

  const [activeImage, setActiveImage] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ 
    dormLocation: product.dormLocation || "", 
    departureDate: product.departureDate || "", 
    price: (product.price || 0).toString(), 
    description: product.description || "" 
  });
  const [isSaving, setIsSaving] = useState(false);

  const [showShippingModal, setShowShippingModal] = useState(false);
  const [trackingInfo, setTrackingInfo] = useState("");

  const handleUpdate = async () => {
    setIsSaving(true);
    try {
      await onUpdate(product.id, { 
        dormLocation: editData.dormLocation, 
        departureDate: editData.departureDate, 
        price: parseFloat(editData.price), 
        description: editData.description 
      });
      setIsEditing(false);
    } catch (error) { 
      showAlert("Update Error", "Failed to update item details."); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleMarkShipped = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "products", product.id), {
        status: "Shipped",
        trackingInfo: trackingInfo || "Hand-delivered",
        shippedAt: new Date().toISOString()
      });
      setShowShippingModal(false);
      showAlert("Success", "Item marked as sent.");
    } catch (err) {
      showAlert("Error", "Failed to update status.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-white min-h-full relative pb-32">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"><ChevronLeft className="w-6 h-6" /></button>
        <h2 className="font-bold text-gray-800">Item Details</h2>
        <div className="flex items-center gap-1">
          {!isOwner && <button onClick={() => onToggleFavorite(product.id)} className="p-2 text-gray-600 hover:text-red-500 transition-colors"><HeartIcon className={cn("w-5 h-5", isFavorite ? "fill-red-500 text-red-500" : "")} /></button>}
          {canEdit ? (
            <><button onClick={() => setIsEditing(!isEditing)} className="p-2 text-gray-600 hover:text-primary transition-colors">{isEditing ? <X className="w-5 h-5" /> : <Pencil className="w-5 h-5" />}</button>
            <button onClick={() => onDelete(product.id)} className="p-2 text-red-500 hover:text-red-600 transition-colors"><Trash2 className="w-5 h-5" /></button></>
          ) : ( isOwner && <div className="w-10" /> )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
        {/* 【核心修复】：使用 w-full pt-[100%] 和 absolute inset-0 彻底封死图片的拉伸 */}
        <div className="w-full relative pt-[100%] bg-gray-100 md:rounded-2xl overflow-hidden md:m-6">
          {product.images?.[activeImage] ? (
            <img 
              src={product.images[activeImage]} 
              className="absolute inset-0 w-full h-full object-cover" 
              alt="item" 
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-300">
              <Camera className="w-12 h-12" />
            </div>
          )}
          {product.images?.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
              {product.images.map((_, i) => (
                <button 
                  key={i} 
                  onClick={() => setActiveImage(i)} 
                  className={cn("w-2 h-2 rounded-full transition-all shadow-sm", activeImage === i ? "bg-primary w-4" : "bg-white/70 hover:bg-white")} 
                />
              ))}
            </div>
          )}
        </div>

        <div className="p-6 space-y-6">
          {isEditing && canEdit ? (
            <div className="space-y-4">
              <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase">Price ($)</label><input type="number" className="input-field" value={editData.price} onChange={e => setEditData(prev => ({ ...prev, price: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase">Location</label><input className="input-field" value={editData.dormLocation} onChange={e => setEditData(prev => ({ ...prev, dormLocation: e.target.value }))} /></div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase">Sell by</label><input type="date" className="input-field" value={editData.departureDate} onChange={e => setEditData(prev => ({ ...prev, departureDate: e.target.value }))} /></div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Description</label>
                <textarea rows={3} className="input-field resize-none" value={editData.description} onChange={e => setEditData(prev => ({ ...prev, description: e.target.value }))} />
              </div>
              <button onClick={handleUpdate} disabled={isSaving} className="btn-primary w-full py-3">Save Changes</button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-4">
                  <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                    {product.title}
                    {seller?.isAdmin && <span className="bg-orange-500 text-white px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shadow-sm"><ShieldCheck className="w-3 h-3" /> Official Relo</span>}
                  </h1>
                  <span className="text-2xl font-black text-primary">${product.price}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">{product.category}</span>
                  <span className="bg-orange-50 text-primary px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">{product.condition}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm"><MapPin className="w-5 h-5" /></div>
                <div><p className="text-[10px] text-gray-400 font-bold uppercase">Location</p><p className="text-xs font-bold text-gray-700">{product.dormLocation}</p></div>
              </div>

              <div className="space-y-2"><h3 className="font-bold text-gray-900">Description</h3><p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{product.description}</p></div>

              {product.referenceLink && (
                <a href={product.referenceLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-500 font-bold hover:underline">
                  <ExternalLink className="w-4 h-4" /> Reference Link
                </a>
              )}
            </>
          )}

          <hr className="border-gray-100" />

          <div onClick={() => onViewSellerShop(product.sellerId)} className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded-2xl transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-sm"><img src={sellerAvatar} className="w-full h-full object-cover" alt="seller" /></div>
              <div>
                <h4 className="font-bold text-gray-900 flex items-center gap-2">{sellerName}{seller?.isAdmin && <span className="bg-black text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest shadow-sm">Relo Moderator</span>}</h4>
                <p className="text-xs text-gray-400">{seller?.isAdmin ? "Platform Administrator" : (sellerIsStudent ? "Verified Student • Cornell" : "Community Member")}</p>
              </div>
            </div>
            <div className="text-right"><p className="text-primary font-black text-lg">{sellerTransactionCount}</p><p className="text-[10px] text-gray-400 font-bold uppercase">Sales</p></div>
          </div>

          {(isOwner || isSuperAdmin) && (
            <div className="pt-6 space-y-3">
              {product.status === "Still on" && (
                <button onClick={() => onStatusChange(product.id, "Sold")} className="w-full py-4 rounded-2xl font-bold bg-black text-white hover:bg-gray-800 transition-all">Mark as Sold</button>
              )}
              
              {product.status === "Pending" && (
                <div className="bg-yellow-50 border border-yellow-100 rounded-3xl p-5 space-y-4">
                  <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-yellow-600" /><h4 className="font-bold text-yellow-800">Order Pending</h4></div>
                  <p className="text-xs text-yellow-700 leading-relaxed">This item was purchased. You need to deliver it to the buyer and mark it as sent.</p>
                  
                  <button 
                    onClick={() => setShowShippingModal(true)} 
                    className="w-full bg-yellow-500 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-yellow-600 shadow-lg shadow-yellow-500/20"
                  >
                    <Truck className="w-5 h-5" /> Mark as Sent
                  </button>

                  <button onClick={() => onStatusChange(product.id, "Still on")} className="w-full text-xs font-bold text-yellow-600/60 hover:text-yellow-700 underline">Cancel Transaction?</button>
                </div>
              )}

              {product.status === "Shipped" && (
                <div className="bg-blue-50 border border-blue-100 rounded-3xl p-5 flex flex-col items-center gap-2">
                  <StatusBadge status="Shipped" />
                  <p className="text-xs text-blue-600 font-bold">Waiting for buyer to confirm receipt.</p>
                </div>
              )}
            </div>
          )}

          {!isOwner && !isSuperAdmin && (
            <div className="pt-4">
              {product.status === "Still on" ? (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => onContactSeller(product)} className="btn-primary flex items-center justify-center gap-2"><MessageCircle className="w-5 h-5" />Contact</button>
                  <button onClick={() => onAddToCart(product)} className="bg-black text-white font-bold py-3 px-6 rounded-xl hover:bg-gray-800">Add to Cart</button>
                </div>
              ) : product.buyerId === currentUser?.uid ? (
                <div className="w-full p-4 bg-gray-50 border border-gray-100 rounded-3xl flex flex-col items-center gap-4 text-center">
                  <StatusBadge status={product.status} />
                  <p className="text-sm font-bold text-gray-900">You purchased this item</p>
                  {product.status === "Shipped" && <button onClick={() => onStatusChange(product.id, "Completed")} className="w-full btn-primary py-3 flex items-center justify-center gap-2"><CheckCircle className="w-5 h-5" />Confirm Received</button>}
                  <button onClick={() => onContactSeller(product)} className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><MessageCircle className="w-5 h-5" />View Order Chat</button>
                </div>
              ) : (
                <div className="w-full p-6 bg-gray-50 border border-gray-100 rounded-3xl text-center"><StatusBadge status={product.status} /><p className="text-sm font-bold text-gray-500 mt-2">This item is no longer available.</p></div>
              )}
            </div>
          )}
        </div>
      </div>

      {showShippingModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowShippingModal(false)} />
           <div className="relative w-full max-w-sm bg-white rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95">
             <div className="w-16 h-16 bg-yellow-50 text-yellow-600 flex items-center justify-center rounded-full mb-6 mx-auto"><Truck className="w-8 h-8" /></div>
             <h3 className="text-xl font-black text-gray-900 text-center mb-2">Confirm Shipping</h3>
             <p className="text-xs text-gray-500 text-center mb-6">Enter tracking info or a simple meetup note for the buyer.</p>
             <input className="w-full bg-gray-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-yellow-500/20 mb-6" placeholder="e.g. Left at your door, or Tracking #" value={trackingInfo} onChange={e => setTrackingInfo(e.target.value)} />
             <div className="flex gap-3">
               <button onClick={() => setShowShippingModal(false)} className="flex-1 py-3.5 bg-gray-50 text-gray-500 rounded-xl font-bold text-sm">Cancel</button>
               <button onClick={handleMarkShipped} disabled={isSaving} className="flex-1 py-3.5 bg-yellow-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-yellow-500/20">Confirm Sent</button>
             </div>
           </div>
        </div>
      )}
    </motion.div>
  );
}