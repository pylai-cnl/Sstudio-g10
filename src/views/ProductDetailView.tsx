import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  ChevronLeft, X, Pencil, Trash2, Camera, 
  MapPin, Calendar, ExternalLink, MessageCircle, CheckCircle,
  Heart as HeartIcon
} from "lucide-react";
import { User as FirebaseUser } from "firebase/auth";
import { Product, UserProfile } from "../types";
import { cn } from "../utils/classNames";
import StatusBadge from "../components/StatusBadge";

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
  product, 
  users,
  currentUser,
  onBack, 
  onStatusChange,
  onDelete,
  onUpdate,
  onContactSeller,
  onAddToCart,
  isOwner,
  showAlert,
  isFavorite,
  onToggleFavorite,
  sellerTransactionCount,
  onViewSellerShop
}: ProductDetailViewProps) {
  const seller = users[product.sellerId];
  const sellerAvatar = seller?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${product.sellerId}`;
  const sellerName = seller?.displayName || product.sellerName;
  const sellerIsStudent = seller?.isStudent ?? product.sellerIsStudent;

  const [activeImage, setActiveImage] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    dormLocation: product.dormLocation || "",
    departureDate: product.departureDate || "",
    price: (product.price || 0).toString(),
    description: product.description || ""
  });
  const [isSaving, setIsSaving] = useState(false);

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
      console.error("Update failed", error);
      showAlert("Update Error", "Failed to update item details.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    onDelete(product.id);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-white min-h-full relative"
    >
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-gray-800">Item Details</h2>
        <div className="flex items-center gap-1">
          {!isOwner && (
            <button 
              onClick={() => onToggleFavorite(product.id)}
              className="p-2 text-gray-600 hover:text-red-500 transition-colors"
            >
              <HeartIcon className={cn("w-5 h-5", isFavorite ? "fill-red-500 text-red-500" : "")} />
            </button>
          )}
          {isOwner ? (
            <>
              <button 
                onClick={() => setIsEditing(!isEditing)} 
                className="p-2 text-gray-600 hover:text-primary transition-colors"
              >
                {isEditing ? <X className="w-5 h-5" /> : <Pencil className="w-5 h-5" />}
              </button>
              <button 
                onClick={handleDelete}
                className="p-2 text-red-500 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </>
          ) : (
            <div className="w-10" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-8 pt-2">
        <div className="aspect-square bg-gray-100 relative md:rounded-2xl md:overflow-hidden md:m-6">
          {product.images?.[activeImage] ? (
            <img src={product.images[activeImage]} className="w-full h-full object-cover" alt={product.title} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <Camera className="w-12 h-12" />
            </div>
          )}
          
          {product.images?.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
              {product.images.map((_, i) => (
                <button 
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    activeImage === i ? "bg-primary w-4" : "bg-white/50"
                  )}
                />
              ))}
            </div>
          )}
        </div>

        <div className="p-6 space-y-6 pb-32 md:pb-6">
        {isEditing ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Price ($)</label>
              <input 
                type="number"
                className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20"
                value={editData.price}
                onChange={e => setEditData(prev => ({ ...prev, price: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Location</label>
                <input 
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20"
                  value={editData.dormLocation}
                  onChange={e => setEditData(prev => ({ ...prev, dormLocation: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Departure</label>
                <input 
                  type="date"
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20"
                  value={editData.departureDate}
                  onChange={e => setEditData(prev => ({ ...prev, departureDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Description</label>
              <textarea 
                rows={3}
                className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 resize-none"
                value={editData.description}
                onChange={e => setEditData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <button 
              onClick={handleUpdate}
              disabled={isSaving}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2"
            >
              {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Save Changes"}
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex justify-between items-start gap-4">
                <h1 className="text-2xl font-black text-gray-900 leading-tight flex-1">{product.title}</h1>
                <span className="text-2xl font-black text-primary whitespace-nowrap flex-shrink-0">${product.price}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">{product.category}</span>
                <span className="bg-orange-50 text-primary px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">{product.condition}</span>
                {product.status === "Sold" && (
                  <span className="bg-black text-white px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">Sold</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Location</p>
                  <p className="text-xs font-bold text-gray-700">{product.dormLocation}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Departure</p>
                  <p className="text-xs font-bold text-gray-700">{product.departureDate}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-gray-900">Description</h3>
              <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{product.description}</p>
            </div>

            {product.referenceLink && (
              <a 
                href={product.referenceLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-500 font-bold hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                Reference Link
              </a>
            )}
          </>
        )}

        <hr className="border-gray-100" />

        <div 
          onClick={() => onViewSellerShop(product.sellerId)}
          className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded-2xl transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-sm">
              <img src={sellerAvatar} className="w-full h-full object-cover" alt="seller" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900">{sellerName}</h4>
              <p className="text-xs text-gray-400">
                {sellerIsStudent ? "Verified Student • Cornell" : "Community Member"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-primary font-black text-lg">{sellerTransactionCount}</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase">Sales</p>
          </div>
        </div>

        {isOwner ? (
          <div className="pt-4">
            {product.status === "Still on" ? (
              <button 
                onClick={() => onStatusChange(product.id, "Sold")}
                className="w-full py-4 rounded-2xl font-bold transition-all shadow-lg bg-black text-white hover:bg-gray-800"
              >
                Mark as Sold
              </button>
            ) : (
              <div className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col items-center justify-center gap-3">
                <StatusBadge status={product.status} />
                <p className="text-sm font-bold text-gray-500">You are the seller of this item.</p>
                {product.status !== "Completed" && product.status !== "Sold" && (
                  <button 
                    onClick={() => onStatusChange(product.id, "Still on")}
                    className="text-primary font-bold text-xs hover:underline"
                  >
                    Cancel transaction and mark as available?
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="pt-4">
            {product.status === "Still on" ? (
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => onContactSeller(product)}
                  className="btn-primary flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  <MessageCircle className="w-5 h-5" />
                  Contact
                </button>
                <button 
                  onClick={() => onAddToCart(product)}
                  className="bg-black text-white font-bold py-3 px-6 rounded-xl transition-all hover:bg-gray-800 active:scale-95 shadow-lg"
                >
                  Add to Cart
                </button>
              </div>
            ) : product.buyerId === currentUser?.uid ? (
              <div className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col items-center justify-center gap-4">
                <div className="flex items-center gap-3">
                  <StatusBadge status={product.status} />
                  <p className="text-sm font-bold text-gray-900">You purchased this item</p>
                </div>
                
                {product.status === "Delivered" && (
                  <button 
                    onClick={() => onStatusChange(product.id, "Completed")}
                    className="w-full btn-primary py-3 flex items-center justify-center gap-2 shadow-lg"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Confirm Received
                  </button>
                )}

                {product.status === "Pending" && (
                  <p className="text-xs text-gray-500 text-center italic">
                    Waiting for the seller to deliver the item...
                  </p>
                )}

                {(product.status === "Completed" || product.status === "Sold") && (
                  <p className="text-xs text-green-600 font-bold flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Transaction Completed
                  </p>
                )}
              </div>
            ) : (
              <div className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col items-center justify-center gap-3">
                <StatusBadge status={product.status} />
                <p className="text-sm font-bold text-gray-500">This item is no longer available for purchase.</p>
                <button 
                  onClick={() => onContactSeller(product)}
                  className="text-primary font-bold text-xs hover:underline"
                >
                  Still want to contact the seller?
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </motion.div>
  );
}