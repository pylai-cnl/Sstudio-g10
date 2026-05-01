import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  ChevronLeft, X, Pencil, Trash2, Camera, 
  MapPin, ExternalLink, MessageCircle, CheckCircle,
  Heart as HeartIcon, ShieldCheck, Truck, Clock, Sparkles
} from "lucide-react";
import { User as FirebaseUser } from "firebase/auth";
import { Product, UserProfile } from "../types";
import { cn } from "../utils/classNames";
import StatusBadge from "../components/StatusBadge";
import { updateDoc, doc, addDoc, collection } from "firebase/firestore";
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

// 【新增】：定义 Bundle 可选配件及其价格
const BUNDLE_ADDONS = [
  { id: "notebook", name: "Premium Notebook x2", price: 5 },
  { id: "highlighter", name: "Highlighter Set (5 colors)", price: 4 },
  { id: "stapler", name: "Mini Stapler + Staples", price: 3 },
  { id: "calc", name: "Scientific Calculator", price: 15 },
];

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
  const isOfficialSeller = users[product.sellerId]?.isAdmin;
  
  const canEdit = (isOwner || isSuperAdmin) && product.status === "Still on";

  // 【智能识别】：如果是管方发的包含"Stationary Bundle"字样的商品，激活定制页面
  const isStationaryBundle = product.title.toLowerCase().includes("stationary") && product.title.toLowerCase().includes("bundle");

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

  // 【新增】：存放用户选中的配件状态
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [addingToCart, setAddingToCart] = useState(false);

  // 动态计算显示的总价（基础价 + 配件价）
  const displayPrice = isStationaryBundle 
    ? product.price + selectedAddons.reduce((sum, id) => sum + BUNDLE_ADDONS.find(a => a.id === id)!.price, 0)
    : product.price;

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

  // 【核心克隆引擎】：处理加入购物车逻辑
  const handleAddToCartAction = async () => {
    // 如果是官方账号（包括你）买/测试这个商品，我们触发克隆保护机制
    if (isOfficialSeller) {
      setAddingToCart(true);
      try {
        let addonText = "";
        if (isStationaryBundle && selectedAddons.length > 0) {
          const names = selectedAddons.map(id => BUNDLE_ADDONS.find(a => a.id === id)?.name);
          addonText = ` (+ ${names.join(", ")})`;
        }
        
        // 静默生成一个只属于该用户的"克隆专属订单商品"
        const cloneData = {
          ...product,
          title: product.title + addonText,
          price: displayPrice,
          isOfficialClone: true, // 核心标记：打上隐身标签
          createdAt: new Date().toISOString()
        };
        
        const docRef = await addDoc(collection(db, "products"), cloneData);
        // 把克隆出来的这个新商品交给购物车
        onAddToCart({ ...cloneData, id: docRef.id } as Product);
      } catch (e) { 
        console.error(e);
        showAlert("Error", "Failed to add to cart.");
      } finally { 
        setAddingToCart(false); 
      }
    } else {
      // 如果不是官方商品，走正常的 C2C 原样进购物车流程
      onAddToCart(product);
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
        <div className="w-full relative pt-[100%] bg-gray-100 md:rounded-2xl overflow-hidden md:m-6">
          {product.images?.[activeImage] ? (
            <img src={product.images[activeImage]} className="absolute inset-0 w-full h-full object-cover" alt="item" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-300">
              <Camera className="w-12 h-12" />
            </div>
          )}
          {product.images?.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
              {product.images.map((_, i) => (
                <button key={i} onClick={() => setActiveImage(i)} className={cn("w-2 h-2 rounded-full transition-all shadow-sm", activeImage === i ? "bg-primary w-4" : "bg-white/70 hover:bg-white")} />
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
                    {isOfficialSeller && <span className="bg-orange-500 text-white px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shadow-sm"><ShieldCheck className="w-3 h-3" /> Official Relo</span>}
                  </h1>
                  <span className="text-2xl font-black text-primary">${displayPrice}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">{product.category}</span>
                  <span className="bg-orange-50 text-primary px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">{product.condition}</span>
                </div>
              </div>

              {/* 【特色功能面板】：如果是官方 Bundle 且当前用户不是拥有者，开放定制面板 */}
              {isStationaryBundle && !isOwner && product.status === "Still on" && (
                <div className="bg-orange-50 border border-orange-100 rounded-3xl p-5 space-y-4">
                  <h4 className="font-black text-orange-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-orange-500" />
                    Customize Your Bundle
                  </h4>
                  <p className="text-xs text-orange-800/70 leading-relaxed font-medium">
                    The base bundle includes an eraser, a mechanical pencil, two notebooks, and a gel pen. Select additional items below to add to your package!
                  </p>
                  <div className="space-y-2">
                    {BUNDLE_ADDONS.map(addon => (
                      <label key={addon.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-orange-100 cursor-pointer hover:border-orange-300 transition-colors shadow-sm select-none">
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500"
                            checked={selectedAddons.includes(addon.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedAddons(prev => [...prev, addon.id]);
                              else setSelectedAddons(prev => prev.filter(id => id !== addon.id));
                            }}
                          />
                          <span className="text-sm font-bold text-gray-700">{addon.name}</span>
                        </div>
                        <span className="text-sm font-black text-orange-500">+${addon.price}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm"><MapPin className="w-5 h-5" /></div>
                <div><p className="text-[10px] text-gray-400 font-bold uppercase">Location</p><p className="text-xs font-bold text-gray-700">{product.dormLocation}</p></div>
              </div>

              <div className="space-y-2"><h3 className="font-bold text-gray-900">Description</h3><p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{product.description}</p></div>
            </>
          )}

          <hr className="border-gray-100" />

          <div onClick={() => onViewSellerShop(product.sellerId)} className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded-2xl transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-sm"><img src={sellerAvatar} className="w-full h-full object-cover" alt="seller" /></div>
              <div>
                <h4 className="font-bold text-gray-900 flex items-center gap-2">{sellerName}{isOfficialSeller && <span className="bg-black text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest shadow-sm">Relo Moderator</span>}</h4>
                <p className="text-xs text-gray-400">{isOfficialSeller ? "Platform Administrator" : (sellerIsStudent ? "Verified Student • Cornell" : "Community Member")}</p>
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

          {!isOwner && (
            <div className="pt-4">
              {product.status === "Still on" ? (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => onContactSeller(product)} className="btn-primary flex items-center justify-center gap-2"><MessageCircle className="w-5 h-5" />Contact</button>
                  {/* 【克隆下单入口】：使用新的 handleAddToCartAction 替代直接 onAddToCart */}
                  <button 
                    onClick={handleAddToCartAction} 
                    disabled={addingToCart}
                    className="bg-black text-white font-bold py-3 px-6 rounded-xl hover:bg-gray-800 flex items-center justify-center gap-2"
                  >
                    {addingToCart && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    Add to Cart
                  </button>
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