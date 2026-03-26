import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowLeft, Trash2, Plus, List, Heart, MapPin, 
  CreditCard, Camera, Pencil, ShieldCheck, ChevronRight, LogOut, Gift, Key
} from "lucide-react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
// NEW: 引入调用云函数的包
import { httpsCallable } from "firebase/functions";
import { storage, functions } from "../firebase";
import { Product, UserProfile } from "../types";
import { cn } from "../utils/classNames";
import ProductCard from "../components/ProductCard";

export interface ProfileViewProps {
  key?: string;
  profile: UserProfile | null;
  products: Product[];
  users: Record<string, UserProfile>;
  onLogout: () => void;
  onSelectProduct: (p: Product) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onManageOrders: () => void;
  onUpdateProfile: (data: Partial<UserProfile>, silent?: boolean) => Promise<void>;
  setShowSuccessModal?: (show: boolean) => void;
  showAlert: (title: string, message: string) => void;
  onViewSellerShop: (sellerId: string) => void;
  setIsDirty?: (dirty: boolean) => void;
  showConfirm?: (config: any) => void;
  addresses?: any[];
  setAddresses?: (data: any[]) => void;
  defaultAddrIndex?: number;
  setDefaultAddrIndex?: (idx: number) => void;
  payments?: any[];
  setPayments?: (data: any[]) => void;
  defaultPayIndex?: number;
  setDefaultPayIndex?: (idx: number) => void;
}

export default function ProfileView({ 
  profile, 
  products, 
  users,
  onLogout,
  onSelectProduct,
  favorites,
  onToggleFavorite,
  onManageOrders,
  onUpdateProfile,
  setShowSuccessModal,
  showAlert,
  onViewSellerShop,
  setIsDirty,
  showConfirm,
  addresses = [],
  setAddresses = () => {},
  defaultAddrIndex = 0,
  setDefaultAddrIndex = () => {},
  payments = [],
  setPayments = () => {},
  defaultPayIndex = 0,
  setDefaultPayIndex = () => {}
}: ProfileViewProps) {
  const [activeSubView, setActiveSubView] = useState<"main" | "orders" | "wishlist" | "favorites" | "address" | "payment">("main");
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Promo Code Modal States
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);

  const [uploading, setUploading] = useState(false);

  const [editingAddrIndex, setEditingAddrIndex] = useState<number | null>(null);
  const [draftAddress, setDraftAddress] = useState({ street: "", city: "", zip: "" });

  const [editingPayIndex, setEditingPayIndex] = useState<number | null>(null);
  const [draftPayment, setDraftPayment] = useState({ cardNumber: "" });

  useEffect(() => {
    if (setIsDirty) {
      setIsDirty(editingAddrIndex !== null || editingPayIndex !== null || showEditModal || showPromoModal);
    }
  }, [editingAddrIndex, editingPayIndex, showEditModal, showPromoModal, setIsDirty]);

  const [wishlist, setWishlist] = useState<string[]>([]);
  const [newWishlistItem, setNewWishlistItem] = useState("");

  const addWishlistItem = () => {
    if (newWishlistItem.trim()) {
      setWishlist([...wishlist, newWishlistItem.trim()]);
      setNewWishlistItem("");
    }
  };

  const [editForm, setEditForm] = useState({
    displayName: profile?.displayName || "",
    school: profile?.school || "Cornell Tech",
    majorInfo: profile?.majorInfo || "Computer Science",
    gradYear: profile?.gradYear || "2026",
    departureDate: profile?.departureDate || "May 2026"
  });

  useEffect(() => {
    if (showEditModal && profile) {
      setEditForm({
        displayName: profile.displayName || "",
        school: profile.school || "Cornell Tech",
        majorInfo: profile.majorInfo || "Computer Science",
        gradYear: profile.gradYear || "2026",
        departureDate: profile.departureDate || "May 2026"
      });
    }
  }, [showEditModal, profile]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    try {
      setUploading(true);
      const avatarRef = ref(storage, `avatars/${profile.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(avatarRef, file);
      const url = await getDownloadURL(avatarRef);
      await onUpdateProfile({ photoURL: url });
    } catch (error) {
      console.error("Error uploading avatar:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    await onUpdateProfile(editForm);
    setShowEditModal(false);
  };

  // 【核心修改】：现在完全通过后端云函数来验证 Promo Code
  const handleRedeemPromo = async () => {
    setPromoError("");
    setIsRedeeming(true);

    try {
      // 1. 声明我们要调用的后端函数名称 "redeemPromoCode"
      const redeemPromoCodeFn = httpsCallable(functions, 'redeemPromoCode');
      
      // 2. 将输入的兑换码发送给后端，剩下的全交给后端处理
      const result = await redeemPromoCodeFn({ code: promoCode.trim().toUpperCase() });
      
      // 3. 如果后端没有报错，说明提权成功，更新 UI
      setShowPromoModal(false);
      setPromoCode("");
      showAlert("Admin Activated 🚀", "Backend verified your code. You now have Enterprise Admin privileges.");
    } catch (error: any) {
      console.error("Promo code error:", error);
      // 捕获后端的报错信息并显示给用户
      setPromoError(error.message || "Invalid or expired promo code.");
    } finally {
      setIsRedeeming(false);
    }
  };

  const campusTransactions = (profile?.salesCount || 0) + (profile?.purchasesCount || 0);

  if (activeSubView === "orders") {
    const mySales = products.filter(p => p.sellerId === profile?.uid);
    const myPurchases = products.filter(p => p.buyerId === profile?.uid);
    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="min-h-screen bg-bg-light"
        id="ordersView"
      >
        <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
          <button onClick={() => setActiveSubView("main")} className="p-2 -ml-2 text-gray-400 hover:text-text-dark transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-text-dark">Manage My Orders</h1>
        </header>
        <div className="max-w-[650px] mx-auto p-4 space-y-8">
          <section>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">My Sales</h2>
            <div className="grid grid-cols-2 gap-4">
              {mySales.map(product => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  users={users}
                  onClick={() => onSelectProduct(product)}
                  isFavorite={favorites.includes(product.id)}
                  onToggleFavorite={onToggleFavorite}
                  onViewSellerShop={onViewSellerShop}
                />
              ))}
              {mySales.length === 0 && <p className="col-span-2 text-center text-gray-400 py-8">No active sales.</p>}
            </div>
          </section>
          <section>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">My Purchases</h2>
            <div className="grid grid-cols-2 gap-4">
              {myPurchases.map(product => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  users={users}
                  onClick={() => onSelectProduct(product)}
                  isFavorite={favorites.includes(product.id)}
                  onToggleFavorite={onToggleFavorite}
                  onViewSellerShop={onViewSellerShop}
                />
              ))}
              {myPurchases.length === 0 && <p className="col-span-2 text-center text-gray-400 py-8">No purchase history.</p>}
            </div>
          </section>
        </div>
      </motion.div>
    );
  }

  if (activeSubView === "wishlist") {
    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="min-h-screen bg-bg-light"
        id="wishlistView"
      >
        <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
          <button onClick={() => setActiveSubView("main")} className="p-2 -ml-2 text-gray-400 hover:text-text-dark transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-text-dark">Wishlist</h1>
        </header>
        <div className="max-w-[650px] mx-auto p-4">
          <div className="card p-6">
            <div className="flex gap-2 mb-6">
              <input 
                type="text" 
                value={newWishlistItem}
                onChange={(e) => setNewWishlistItem(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addWishlistItem()}
                placeholder="Add item you're seeking..."
                className="input-field flex-1"
              />
              <button 
                onClick={addWishlistItem}
                className="w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
            <ul className="space-y-3">
              {wishlist.map((item, index) => (
                <li key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-sm font-medium text-text-dark">{item}</span>
                  <button 
                    onClick={() => setWishlist(wishlist.filter((_, i) => i !== index))}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
              {wishlist.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <List className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-gray-400 text-sm">Your wishlist is empty</p>
                </div>
              )}
            </ul>
          </div>
        </div>
      </motion.div>
    );
  }

  if (activeSubView === "favorites") {
    const favoriteProducts = products.filter(p => favorites.includes(p.id));
    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="min-h-screen bg-bg-light"
        id="favoritesView"
      >
        <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
          <button onClick={() => setActiveSubView("main")} className="p-2 -ml-2 text-gray-400 hover:text-text-dark transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-text-dark">Favorites</h1>
        </header>
        <div className="max-w-[650px] mx-auto p-4">
          <div className="grid grid-cols-2 gap-4">
            {favoriteProducts.map(product => (
              <ProductCard 
                key={product.id} 
                product={product} 
                users={users}
                onClick={() => onSelectProduct(product)}
                isFavorite={true}
                onToggleFavorite={onToggleFavorite}
                onViewSellerShop={onViewSellerShop}
              />
            ))}
            {favoriteProducts.length === 0 && (
              <div className="col-span-2 text-center py-20">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-400 font-medium">No favorites yet</p>
                <p className="text-gray-400 text-sm mt-1">Tap the heart on items you love to save them here.</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  if (activeSubView === "address") {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="min-h-screen bg-bg-light">
        <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
          <button 
            onClick={() => {
              if (editingAddrIndex !== null && showConfirm) {
                showConfirm({ title: "Discard Changes?", message: "Discard unsaved address?", confirmText: "Discard", type: "danger", onConfirm: () => setEditingAddrIndex(null) });
              } else setActiveSubView("main");
            }} 
            className="p-2 -ml-2 text-gray-400 hover:text-text-dark"
          ><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-lg font-bold text-text-dark">Address Book</h1>
        </header>
        <div className="max-w-[650px] mx-auto p-4">
          {editingAddrIndex !== null ? (
            <div className="card p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Street</label>
                <input type="text" value={draftAddress.street} onChange={e => setDraftAddress({...draftAddress, street: e.target.value})} className="input-field" placeholder="Street address" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">City</label>
                  <input type="text" value={draftAddress.city} onChange={e => setDraftAddress({...draftAddress, city: e.target.value})} className="input-field" placeholder="City" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Zip</label>
                  <input type="text" value={draftAddress.zip} onChange={e => setDraftAddress({...draftAddress, zip: e.target.value})} className="input-field" placeholder="Zip" />
                </div>
              </div>
              <div className="flex gap-4 mt-6">
                <button onClick={() => {
                  if (showConfirm) showConfirm({ title: "Discard?", message: "Discard unsaved edits?", confirmText: "Discard", type: "danger", onConfirm: () => setEditingAddrIndex(null) });
                }} className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold text-sm hover:bg-gray-200 active:scale-95 transition-all shadow-sm">Cancel</button>
                <button 
                  disabled={!draftAddress.street.trim() || !draftAddress.city.trim() || !draftAddress.zip.trim()}
                  onClick={() => {
                    const newArr = [...addresses];
                    if (editingAddrIndex === -1) newArr.push(draftAddress); else newArr[editingAddrIndex] = draftAddress;
                    setAddresses(newArr);
                    setEditingAddrIndex(null);
                    if (setIsDirty) setIsDirty(false);
                    
                    if (newArr.length === 1 || defaultAddrIndex === editingAddrIndex) {
                      onUpdateProfile({ dormLocation: draftAddress.city }); 
                    } else {
                      if (setShowSuccessModal) setShowSuccessModal(true);
                    }
                  }}
                  className="btn-primary flex-1 py-4 disabled:opacity-40 disabled:cursor-default disabled:active:scale-100 disabled:hover:bg-primary transition-all"
                >Save</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {addresses.length === 0 ? (
                <div className="card p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 mx-auto mb-4"><MapPin className="w-8 h-8" /></div>
                  <p className="text-gray-400 font-bold text-sm mb-6">No addresses saved.</p>
                  <button onClick={() => { setDraftAddress({street:"", city:"", zip:""}); setEditingAddrIndex(-1); }} className="btn-primary px-8 py-3">Add New Address</button>
                </div>
              ) : (
                <>
                  {addresses.map((addr, idx) => (
                    <div key={idx} className={cn("card p-6 relative border-2 transition-all", defaultAddrIndex === idx ? "border-primary bg-primary/5" : "border-transparent")}>
                        <button 
                          onClick={() => {
                            const newArr = addresses.filter((_, i) => i !== idx);
                            setAddresses(newArr);
                            if (defaultAddrIndex === idx) setDefaultAddrIndex(0);
                            else if (defaultAddrIndex > idx) setDefaultAddrIndex(defaultAddrIndex - 1);
                          }} 
                          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-all"
                          title="Delete Address"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>

                        <div className="flex items-start gap-4">
                          <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer mt-1", defaultAddrIndex === idx ? "border-primary" : "border-gray-300")} 
                               onClick={() => { setDefaultAddrIndex(idx); onUpdateProfile({ dormLocation: addr.city }, true); }}>
                            {defaultAddrIndex === idx && <div className="w-3 h-3 bg-primary rounded-full" />}
                          </div>
                          <div className="flex-1 pr-8">
                            <h3 className="font-bold text-text-dark">{defaultAddrIndex === idx ? "Primary Address" : `Address ${idx + 1}`}</h3>
                            <p className="text-sm text-gray-500 mt-1">{addr.street}</p>
                            <p className="text-sm text-gray-500">{addr.city}, {addr.zip}</p>
                            <div className="flex gap-4 mt-4">
                              <button onClick={() => { setDraftAddress(addr); setEditingAddrIndex(idx); }} className="text-xs font-bold text-primary hover:underline">Edit</button>
                            </div>
                          </div>
                        </div>
                      </div>
                  ))}
                  {addresses.length < 3 && (
                    <button onClick={() => { setDraftAddress({street:"", city:"", zip:""}); setEditingAddrIndex(-1); }} className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 font-bold hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
                      <Plus className="w-5 h-5" /> Add Another Address
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  if (activeSubView === "payment") {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="min-h-screen bg-bg-light">
        <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
          <button 
            onClick={() => {
              if (editingPayIndex !== null && showConfirm) {
                showConfirm({ title: "Discard Changes?", message: "Discard unsaved payment?", confirmText: "Discard", type: "danger", onConfirm: () => setEditingPayIndex(null) });
              } else setActiveSubView("main");
            }} 
            className="p-2 -ml-2 text-gray-400 hover:text-text-dark"
          ><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-lg font-bold text-text-dark">Payment Methods</h1>
        </header>
        <div className="max-w-[650px] mx-auto p-4">
          {editingPayIndex !== null ? (
            <div className="card p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Card Number</label>
                <input type="text" value={draftPayment.cardNumber} onChange={e => setDraftPayment({...draftPayment, cardNumber: e.target.value})} className="input-field" placeholder="Last 4 digits" maxLength={4} />
              </div>
              <div className="flex gap-4 mt-6">
                <button onClick={() => {
                  if (showConfirm) showConfirm({ title: "Discard?", message: "Discard unsaved edits?", confirmText: "Discard", type: "danger", onConfirm: () => setEditingPayIndex(null) });
                }} className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold text-sm hover:bg-gray-200 active:scale-95 transition-all shadow-sm">Cancel</button>
                <button 
                  disabled={draftPayment.cardNumber.trim().length < 4}
                  onClick={() => {
                    const newArr = [...payments];
                    if (editingPayIndex === -1) newArr.push(draftPayment); else newArr[editingPayIndex] = draftPayment;
                    setPayments(newArr);
                    setEditingPayIndex(null);
                    if (setIsDirty) setIsDirty(false);
                    if (newArr.length === 1) setDefaultPayIndex(0);
                    
                    if (setShowSuccessModal) setShowSuccessModal(true);
                  }}
                  className="btn-primary flex-1 py-4 disabled:opacity-40 disabled:cursor-default disabled:active:scale-100 disabled:hover:bg-primary transition-all"
                >Save</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {payments.length === 0 ? (
                <div className="card p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 mx-auto mb-4"><CreditCard className="w-8 h-8" /></div>
                  <p className="text-gray-400 font-bold text-sm mb-6">No payments saved.</p>
                  <button onClick={() => { setDraftPayment({cardNumber:""}); setEditingPayIndex(-1); }} className="btn-primary px-8 py-3">Add Payment Method</button>
                </div>
              ) : (
                <>
                  {payments.map((pay, idx) => (
                    <div key={idx} className={cn("card p-6 relative border-2 transition-all", defaultPayIndex === idx ? "border-primary bg-primary/5" : "border-transparent")}>
                        <button 
                          onClick={() => {
                            const newArr = payments.filter((_, i) => i !== idx);
                            setPayments(newArr);
                            if (defaultPayIndex === idx) setDefaultPayIndex(0);
                            else if (defaultPayIndex > idx) setDefaultPayIndex(defaultPayIndex - 1);
                          }} 
                          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-all"
                          title="Delete Card"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-4">
                          <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer", defaultPayIndex === idx ? "border-primary" : "border-gray-300")} onClick={() => setDefaultPayIndex(idx)}>
                            {defaultPayIndex === idx && <div className="w-3 h-3 bg-primary rounded-full" />}
                          </div>
                          <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-green-500"><CreditCard className="w-6 h-6" /></div>
                          <div className="flex-1 pr-8">
                            <h3 className="font-bold text-text-dark">•••• {pay.cardNumber}</h3>
                            <p className="text-xs text-gray-400 font-medium uppercase mt-0.5">{defaultPayIndex === idx ? "Default Card" : `Card ${idx + 1}`}</p>
                            <div className="flex gap-4 mt-2">
                              <button onClick={() => { setDraftPayment(pay); setEditingPayIndex(idx); }} className="text-xs font-bold text-primary hover:underline">Edit</button>
                            </div>
                          </div>
                        </div>
                      </div>
                  ))}
                  {payments.length < 3 && (
                    <button onClick={() => { setDraftPayment({cardNumber:""}); setEditingPayIndex(-1); }} className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 font-bold hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
                      <Plus className="w-5 h-5" /> Add Another Card
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-bg-light"
      id="profileView"
    >
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-center">
        <h1 className="text-lg font-bold text-text-dark">My Profile</h1>
      </header>

      <div className="max-w-[650px] mx-auto px-4 py-6 space-y-6">
        <div className="card p-6 flex items-center gap-5 relative">
          <div className="relative group">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-primary flex items-center justify-center border-4 border-white shadow-sm">
              <img 
                src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.uid}`} 
                className={cn("w-full h-full object-cover transition-opacity", uploading && "opacity-50")} 
                alt="profile" 
              />
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <label className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md cursor-pointer hover:bg-gray-50 transition-colors">
              <Camera className="w-4 h-4 text-gray-600" />
              <input 
                type="file" 
                className="hidden" 
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </label>
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-text-dark">{profile?.displayName}</h2>
                {!profile?.isStudent && (
                  <p className="text-xs text-gray-400 font-medium">Unverified Account</p>
                )}
              </div>
              <button 
                onClick={() => setShowEditModal(true)}
                className="p-2 text-primary hover:bg-orange-50 rounded-full transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {profile?.isStudent && (
                <div className="flex items-center gap-1 text-primary font-semibold text-xs">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verified Student
                </div>
              )}
              {profile?.isAdmin && (
                <div className="flex items-center gap-1 bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-black text-[10px] uppercase tracking-widest">
                  Admin
                </div>
              )}
            </div>
            <div className="text-gray-400 text-xs mt-2 font-medium">
              {profile?.school || "Cornell Tech"} · {profile?.majorInfo || "Computer Science"} · Class of {profile?.gradYear || "2026"}
            </div>
          </div>
        </div>

        <button 
          onClick={() => setActiveSubView("orders")}
          className="w-full bg-primary p-6 rounded-3xl flex items-center justify-between group hover:bg-primary-hover transition-all shadow-lg shadow-primary/20"
        >
          <div className="text-left">
            <h3 className="text-white text-xl font-bold">Manage My Orders</h3>
            <p className="text-white/80 text-sm mt-1">Track your sales and purchases</p>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white group-hover:translate-x-1 transition-transform">
            <ChevronRight className="w-6 h-6" />
          </div>
        </button>

        <div className="flex gap-4">
          <div className="card flex-1 p-4 flex flex-col items-start">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Departure Date</span>
            <p className="text-sm font-bold text-text-dark">{profile?.departureDate || "May 2026"}</p>
          </div>
          <div className="card flex-1 p-4 flex flex-col items-start">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Campus Transactions</span>
            <p className="text-sm font-bold text-text-dark">{campusTransactions} Exchanges</p>
          </div>
        </div>

        <div className="card divide-y divide-gray-50 overflow-hidden">
          <button 
            onClick={() => setActiveSubView("wishlist")}
            className="profile-menu-item w-full px-5 py-4 flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-primary">
                <List className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold text-text-dark">My Wishlist</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <button 
            onClick={() => setActiveSubView("favorites")}
            className="profile-menu-item w-full px-5 py-4 flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center text-pink-500">
                <Heart className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold text-text-dark">Favorites</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <button 
            onClick={() => setActiveSubView("address")}
            className="profile-menu-item w-full px-5 py-4 flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                <MapPin className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold text-text-dark">Address Book</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <button 
            onClick={() => setActiveSubView("payment")}
            className="profile-menu-item w-full px-5 py-4 flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-500">
                <CreditCard className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold text-text-dark">Payment Methods</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:translate-x-0.5 transition-transform" />
          </button>
          
          <button 
            onClick={() => setShowPromoModal(true)}
            className="profile-menu-item w-full px-5 py-4 flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500">
                <Gift className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold text-text-dark">Redeem Promo Code</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {!profile?.isStudent && (
          <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-primary shadow-sm shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-text-dark">Verify your .edu email</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Get the "Verified Student" badge and build trust with campus buyers.</p>
              <button className="text-[10px] font-bold text-primary mt-2 hover:underline">Verify Now</button>
            </div>
          </div>
        )}

        <button 
          onClick={() => setShowLogoutModal(true)}
          className="w-full py-4 bg-red-50 text-red-500 rounded-2xl font-bold text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Log Out
        </button>
      </div>

      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-[450px] bg-white rounded-3xl p-8 shadow-2xl"
            >
              <h3 className="text-xl font-bold text-text-dark mb-6">Edit Profile</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Full Name</label>
                  <input 
                    type="text" 
                    value={editForm.displayName}
                    onChange={(e) => setEditForm({...editForm, displayName: e.target.value})}
                    className="input-field"
                    placeholder="Enter your name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">School</label>
                    <input 
                      type="text" 
                      value={editForm.school}
                      onChange={(e) => setEditForm({...editForm, school: e.target.value})}
                      className="input-field"
                      placeholder="School"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Major</label>
                    <input 
                      type="text" 
                      value={editForm.majorInfo}
                      onChange={(e) => setEditForm({...editForm, majorInfo: e.target.value})}
                      className="input-field"
                      placeholder="Major"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Grad Year</label>
                    <input 
                      type="text" 
                      value={editForm.gradYear}
                      onChange={(e) => setEditForm({...editForm, gradYear: e.target.value})}
                      className="input-field"
                      placeholder="YYYY"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Departure</label>
                    <input 
                      type="text" 
                      value={editForm.departureDate}
                      onChange={(e) => setEditForm({...editForm, departureDate: e.target.value})}
                      className="input-field"
                      placeholder="Month YYYY"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold text-sm hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveProfile}
                  className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPromoModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowPromoModal(false); setPromoError(""); }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-[400px] bg-white rounded-3xl p-8 shadow-2xl"
            >
              <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center text-purple-500 mx-auto mb-6">
                <Key className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-center text-text-dark mb-2">Redeem Promo Code</h3>
              <p className="text-gray-500 text-sm text-center mb-6">Enter your special code to unlock exclusive features or perks.</p>
              
              <div className="space-y-2 mb-6">
                <input 
                  type="text" 
                  value={promoCode}
                  onChange={(e) => { setPromoCode(e.target.value); setPromoError(""); }}
                  className={cn(
                    "input-field text-center font-black tracking-widest uppercase",
                    promoError ? "border-red-500 focus:ring-red-500/20" : ""
                  )}
                  placeholder="ENTER CODE HERE"
                  maxLength={15}
                />
                {promoError && (
                  <p className="text-xs text-red-500 text-center font-bold">{promoError}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => { setShowPromoModal(false); setPromoError(""); }}
                  className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold text-sm hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleRedeemPromo}
                  disabled={isRedeeming || !promoCode.trim()}
                  className="flex-1 py-4 bg-purple-600 text-white rounded-2xl font-bold text-sm hover:bg-purple-700 transition-colors shadow-lg shadow-purple-600/20 disabled:opacity-50"
                >
                  {isRedeeming ? "Verifying..." : "Redeem"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLogoutModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-[400px] bg-white rounded-[32px] p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mx-auto mb-6">
                <LogOut className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-text-dark mb-2">Log Out</h3>
              <p className="text-gray-500 mb-8">Are you sure you want to log out of your account?</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold text-sm hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setShowLogoutModal(false);
                    onLogout();
                  }}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold text-sm hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                >
                  Log Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}