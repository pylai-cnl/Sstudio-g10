import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, ShoppingCart, PlusCircle, MessageCircle, User, Heart, Settings, Home, CheckCircle, Package, Store, Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User as FirebaseUser
} from "firebase/auth";
import { 
  collection, query, orderBy, where, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, getDoc, setDoc, runTransaction, limit
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { Product, UserProfile, View, ChatRoom } from "./types";

import { cn } from "./utils/classNames";
import ErrorBoundary from "./components/ErrorBoundary";
import NavButton from "./components/NavButton";
import ConfirmationModal from "./components/ConfirmationModal";

import AuthView from "./views/AuthView";
import HomeView from "./views/HomeView";
import CartView from "./views/CartView";
import SellView from "./views/SellView";
import ProfileView from "./views/ProfileView";
import ProductDetailView from "./views/ProductDetailView";
import ManageOrdersView from "./views/ManageOrdersView";
import UnifiedMessagesView from "./views/UnifiedMessagesView";
import FavoritesView from "./views/FavoritesView";
import SettingsView from "./views/SettingsView";
import SellerShopView from "./views/SellerShopView";
import PlatformBuyView from "./views/PlatformBuyView";
import MoveInView from "./views/MoveInView";

export enum OperationType { CREATE = 'create', UPDATE = 'update', DELETE = 'delete', LIST = 'list', GET = 'get', WRITE = 'write' }
export interface FirestoreErrorInfo { error: string; operationType: OperationType; path: string | null; authInfo: any; }

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = { error: error instanceof Error ? error.message : String(error), authInfo: { userId: auth.currentUser?.uid, email: auth.currentUser?.email }, operationType, path };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() { return <ErrorBoundary><AppContent /></ErrorBoundary>; }

function AppContent() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<View>("home");
  const [viewHistory, setViewHistory] = useState<View[]>(["home"]);
  const [isDirty, setIsDirty] = useState(false);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [defaultAddrIndex, setDefaultAddrIndex] = useState(0);
  const [payments, setPayments] = useState<any[]>([]);
  const [defaultPayIndex, setDefaultPayIndex] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<Record<string, UserProfile>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedChatRoom, setSelectedChatRoom] = useState<ChatRoom | null>(null);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [showSellOptions, setShowSellOptions] = useState(false);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: "", message: "", onConfirm: () => {}, confirmText: "OK", type: "primary" as "primary" | "danger", isAlert: false });

  const showConfirm = (config: any) => setModalConfig({ ...config, isOpen: true, isAlert: false });
  const showAlert = (title: string, message: string) => setModalConfig({ isOpen: true, title, message, onConfirm: () => {}, confirmText: "OK", type: "primary", isAlert: true });

  const ensurePrivateProfileDoc = async (firebaseUser: FirebaseUser) => {
    const userPrivateDocRef = doc(db, "users_private", firebaseUser.uid);
    const userPrivateDoc = await getDoc(userPrivateDocRef);
    if (!userPrivateDoc.exists()) await setDoc(userPrivateDocRef, { email: firebaseUser.email || "", favorites: [], cart: [] });
    return userPrivateDocRef;
  };

  const updateProductStatusSafely = async (product: Product, nextStatus: Product["status"]) => {
    if (!user) throw new Error("You must be logged in.");
    const isSuperAdmin = user.email === "relo@relo.com";

    await runTransaction(db, async (transaction) => {
      const productRef = doc(db, "products", product.id);
      const productSnap = await transaction.get(productRef);
      if (!productSnap.exists()) throw new Error("Product not found.");
      const latest = { id: product.id, ...productSnap.data() } as Product;
      const updates: Partial<Product> = {};

      if (nextStatus === "Pending") {
        if (latest.status !== "Still on") throw new Error("This item is no longer available.");
        if (latest.sellerId === user.uid && !isSuperAdmin) throw new Error("You cannot purchase your own item.");
        updates.status = "Pending";
        updates.buyerId = user.uid;
        updates.buyerName = profile?.displayName || user.displayName || user.email?.split("@")[0] || "Buyer";
        updates.sellerNotified = false;
      } else if (nextStatus === "Shipped") {
        if (latest.status !== "Pending") throw new Error("Order must be pending to be shipped.");
        if (latest.sellerId !== user.uid && !isSuperAdmin) throw new Error("Only the seller or admin can mark as shipped.");
        updates.status = "Shipped";
        updates.shippedAt = new Date().toISOString();
      } else if (nextStatus === "Delivered") {
        if (!["Pending", "Shipped"].includes(latest.status)) throw new Error("Invalid status transition.");
        if (latest.sellerId !== user.uid && !isSuperAdmin) throw new Error("Only the seller can mark as delivered.");
        updates.status = "Delivered";
        updates.deliveredAt = new Date().toISOString();
      } else if (nextStatus === "Completed") {
        if (!["Delivered", "Shipped"].includes(latest.status)) throw new Error("Order not ready to be completed.");
        if (latest.buyerId !== user.uid && !isSuperAdmin) throw new Error("Only the buyer or admin can complete this order.");
        updates.status = "Completed";
        updates.completedAt = new Date().toISOString();
      } else if (nextStatus === "Still on") {
        if (!["Pending", "Delivered", "Shipped"].includes(latest.status)) throw new Error("This order cannot be reset.");
        if (latest.sellerId !== user.uid && !isSuperAdmin) throw new Error("Only the seller or admin can cancel.");
        updates.status = "Still on";
        updates.buyerId = "";
        updates.buyerName = "";
        updates.deliveredAt = "";
        updates.completedAt = "";
        updates.shippedAt = "";
        updates.sellerNotified = true;
      } else if (nextStatus === "Sold") {
        if (latest.sellerId !== user.uid && !isSuperAdmin) throw new Error("Only the seller can mark as sold.");
        updates.status = "Sold";
      }
      transaction.update(productRef, updates as any);
    });
  };

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;
    let privateUnsubscribe: (() => void) | null = null;
    let chatRoomsUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      profileUnsubscribe?.(); privateUnsubscribe?.(); chatRoomsUnsubscribe?.();
      setUser(user);

      if (user) {
        setLoading(true);
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userPrivateDocRef = await ensurePrivateProfileDoc(user);
          const [userDoc, userPrivateDoc] = await Promise.all([getDoc(userDocRef), getDoc(userPrivateDocRef)]);
          const email = user.email || "";
          const isStudent = email.toLowerCase().endsWith(".edu") || email.toLowerCase().endsWith(".ca");
          const isAdmin = email.toLowerCase() === "relo@relo.com";

          if (!userDoc.exists()) {
            const newProfile = { displayName: user.displayName || email.split("@")[0] || "Anonymous", photoURL: user.photoURL || "", isStudent, isAdmin, dormLocation: "Cornell Tech House" };
            const newPrivateProfile = userPrivateDoc.exists() ? userPrivateDoc.data() : { email, favorites: [], cart: [] };
            await Promise.all([setDoc(userDocRef, newProfile), setDoc(userPrivateDocRef, newPrivateProfile, { merge: true })]);
            setProfile({ uid: user.uid, ...newProfile, ...newPrivateProfile } as UserProfile);
          } else {
            const existingData = userDoc.data();
            const existingPrivateData = userPrivateDoc.data() || { email, favorites: [], cart: [] };
            if (existingData.isAdmin !== isAdmin) await updateDoc(userDocRef, { isAdmin });
            setProfile({ uid: user.uid, ...existingData, ...existingPrivateData, isAdmin, ...(user.photoURL ? { photoURL: user.photoURL } : {}) } as UserProfile);
          }

          profileUnsubscribe = onSnapshot(userDocRef, (doc) => { if (doc.exists()) setProfile(prev => prev ? { ...prev, ...doc.data() } : { uid: doc.id, ...doc.data() } as UserProfile); });
          privateUnsubscribe = onSnapshot(userPrivateDocRef, (doc) => { if (doc.exists()) setProfile(prev => prev ? { ...prev, ...doc.data() } : { uid: doc.id, ...doc.data() } as UserProfile); });

          const chatRoomsQuery = query(collection(db, "chatRooms"), where("participants", "array-contains", user.uid));
          chatRoomsUnsubscribe = onSnapshot(chatRoomsQuery, (snapshot) => {
            const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatRoom)).sort((a, b) => (b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0) - (a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0));
            setChatRooms(rooms);
            setSelectedChatRoom(prev => { if (!prev) return null; return rooms.find(r => r.id === prev.id) || prev; });
          });
        } catch (error) { console.error("Init err:", error); } finally { setLoading(false); }
      } else {
        setProfile(null); setChatRooms([]); setLoading(false);
      }
    });
    return () => { unsubscribe(); profileUnsubscribe?.(); privateUnsubscribe?.(); chatRoomsUnsubscribe?.(); };
  }, []);

  useEffect(() => {
    if (!user) { setUsers({}); return; }
    return onSnapshot(collection(db, "users"), (snapshot) => {
      const usersMap: Record<string, UserProfile> = {};
      snapshot.docs.forEach(doc => { usersMap[doc.id] = { uid: doc.id, ...doc.data() } as UserProfile; });
      setUsers(usersMap);
    });
  }, [user?.uid]);

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(100));
    return onSnapshot(q, (snapshot) => setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product))), (error) => handleFirestoreError(error, OperationType.LIST, "products"));
  }, []);

  const handleViewChange = (newView: View) => {
    if (view === newView) return;
    if (isDirty) {
      showConfirm({ title: "Unsaved Changes", message: "Discard unsaved changes?", confirmText: "Discard & Leave", type: "danger", onConfirm: () => { setIsDirty(false); setViewHistory(prev => [...prev, newView]); setView(newView); setShowSellOptions(false); window.scrollTo(0,0); }});
      return; 
    }
    setViewHistory(prev => prev[prev.length - 1] === newView ? prev : [...prev, newView]);
    setView(newView); setShowSellOptions(false); window.scrollTo(0, 0);
  };

  const goBack = () => {
    const perform = () => {
      setViewHistory(prev => {
        if (prev.length <= 1) { setView("home"); return ["home"]; }
        const newHistory = [...prev]; newHistory.pop(); setView(newHistory[newHistory.length - 1]); return newHistory;
      });
      window.scrollTo(0, 0);
    };
    if (isDirty) {
      showConfirm({ title: "Unsaved Changes", message: "Discard changes and go back?", confirmText: "Discard", type: "danger", onConfirm: () => { setIsDirty(false); perform(); }});
      return;
    }
    perform();
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const search = (searchQuery || "").toLowerCase();
      
      // 【核心修改】：过滤掉 isOfficialClone 标记的克隆商品，确保它们不污染首页
      const isClone = (p as any).isOfficialClone === true;

      return ((p.title || "").toLowerCase().includes(search) || (p.description || "").toLowerCase().includes(search)) &&
             (selectedCategory === "All" || p.category === selectedCategory) &&
             (p.status === "Still on") && 
             (!isClone);
    });
  }, [products, searchQuery, selectedCategory]);

  const handleLogin = async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (error) { console.error("Login failed", error); } };
  const handleLogout = () => signOut(auth);

  const toggleFavorite = async (productId: string) => {
    if (!user || !profile) return;
    const favs = profile.favorites || [];
    await setDoc(doc(db, "users_private", user.uid), { email: user.email || profile.email || "", favorites: favs.includes(productId) ? favs.filter(id => id !== productId) : [...favs, productId] }, { merge: true });
  };

  const addToCart = async (productId: string) => {
    if (!user || !profile) return;
    if ((profile.cart || []).includes(productId)) return showAlert("Already in Cart", "Item is already in cart.");
    await setDoc(doc(db, "users_private", user.uid), { email: user.email || "", cart: [...(profile.cart || []), productId] }, { merge: true });
    setSuccessMessage("Item added to your cart!");
    setShowSuccessModal(true);
  };

  const removeFromCart = async (productId: string) => {
    if (!user || !profile) return;
    await setDoc(doc(db, "users_private", user.uid), { email: user.email || "", cart: (profile.cart || []).filter(id => id !== productId) }, { merge: true });
  };

  const sendSystemMessage = async (productId: string, sellerId: string, buyerId: string, text: string, asAdminConcierge = false) => {
    if (!user) return;
    const product = products.find(p => p.id === productId);
    if (!product) return;
    let room = chatRooms.find(r => r.productId === productId && r.participants.includes(sellerId) && r.participants.includes(buyerId));
    const now = new Date().toISOString();
    let roomId = room?.id;

    if (!room) {
      const docRef = await addDoc(collection(db, "chatRooms"), { 
        participants: [sellerId, buyerId], 
        productId: product.id, 
        productTitle: product.title, 
        productImage: product.images?.[0] || "", 
        lastMessage: text, 
        lastMessageAt: now, 
        unreadBy: [asAdminConcierge ? buyerId : sellerId]
      });
      roomId = docRef.id;
    } else {
      await updateDoc(doc(db, "chatRooms", room.id), { 
        lastMessage: text, 
        lastMessageAt: now, 
        unreadBy: Array.from(new Set([...(room.unreadBy || []), asAdminConcierge ? buyerId : sellerId])) 
      });
    }

    if (roomId) {
      const msgSenderId = asAdminConcierge ? sellerId : user.uid;
      const msgSenderName = asAdminConcierge ? "Relo Concierge" : (profile?.displayName || "System");

      await addDoc(collection(db, "chatRooms", roomId, "messages"), { 
        senderId: msgSenderId, 
        senderName: msgSenderName, 
        text, 
        createdAt: now 
      });
    }
  };

  const checkout = async () => {
    if (!user || !profile || !profile.cart?.length) return;
    const cartProducts = products.filter(p => profile.cart?.includes(p.id) && p.status === "Still on");
    if (!cartProducts.length) return showAlert("Cart Empty", "No available items to checkout.");

    showConfirm({
      title: "Confirm Checkout",
      message: `Checkout ${cartProducts.length} items? Total: $${cartProducts.reduce((sum, p) => sum + p.price, 0)}`,
      confirmText: "Checkout",
      onConfirm: async () => {
        try {
          await Promise.all(cartProducts.map(p => updateProductStatusSafely(p, "Pending")));
          
          for (const p of cartProducts) {
            const isReloOfficial = users[p.sellerId]?.isAdmin;
            
            if (isReloOfficial) {
              await sendSystemMessage(
                p.id, 
                p.sellerId, 
                user.uid, 
                `🎉 Order Confirmed: "${p.title}". As a Relo Official item, this qualifies for Early Delivery! Please reply with your exact arrival date and time so our concierge team can place it in your room before you move in.`, 
                true
              );
            } else {
              await sendSystemMessage(
                p.id, 
                p.sellerId, 
                user.uid, 
                `I just purchased your item "${p.title}". Please let me know when you can deliver it!`, 
                false
              );
            }
          }

          await updateDoc(doc(db, "users_private", user.uid), { cart: [] });
          setSuccessMessage("Orders placed successfully!");
          setShowSuccessModal(true);
          handleViewChange("orders");
        } catch (error: any) { showAlert("Checkout Error", error.message || "Checkout failed."); }
      }
    });
  };

  const updateProfile = async (data: Partial<UserProfile>, silent = false) => {
    if (!user) return;
    const publicFields = ["displayName", "photoURL", "isStudent", "dormLocation", "school", "majorInfo", "gradYear", "departureDate", "bio", "isAdmin"];
    const privateFields = ["email", "favorites", "cart"];
    const publicUpdate: any = {}; const privateUpdate: any = {};
    Object.keys(data).forEach(key => {
      if (publicFields.includes(key)) publicUpdate[key] = (data as any)[key];
      if (privateFields.includes(key)) privateUpdate[key] = (data as any)[key];
    });
    const promises = [];
    if (Object.keys(publicUpdate).length) promises.push(updateDoc(doc(db, "users", user.uid), publicUpdate));
    if (Object.keys(privateUpdate).length) promises.push(setDoc(doc(db, "users_private", user.uid), { email: user.email || "", ...privateUpdate }, { merge: true }));
    await Promise.all(promises);
    if (!silent) { setSuccessMessage("Profile updated!"); setShowSuccessModal(true); }
    setIsDirty(false);
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-white"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <AuthView onLogin={handleLogin} />;

  const unreadChatCount = chatRooms.filter(r => r.unreadBy?.includes(user.uid)).length;
  const unhandledOrderCount = products.filter(p => p.sellerId === user.uid && p.sellerNotified === false).length;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 relative">
      <header className="hidden md:block bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 onClick={() => handleViewChange("home")} className="text-2xl font-black text-primary cursor-pointer tracking-tighter">Relo</h1>
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search..." className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full text-sm outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => handleViewChange("home")} className={cn("text-sm font-bold transition-colors", view === "home" ? "text-primary" : "text-gray-500 hover:text-gray-900")}>Marketplace</button>
            <button onClick={() => handleViewChange("move_in")} className={cn("text-sm font-bold transition-colors flex items-center gap-1", view === "move_in" ? "text-primary" : "text-gray-500 hover:text-gray-900")}><Sparkles className="w-4 h-4" /> Move In</button>
            <button onClick={() => handleViewChange("platform_buy")} className={cn("text-sm font-bold transition-colors flex items-center gap-1", view === "platform_buy" ? "text-orange-500" : "text-gray-500 hover:text-gray-900")}>Sell to Relo</button>
            <button onClick={() => handleViewChange("favorites")} className={cn("text-sm font-bold transition-colors", view === "favorites" ? "text-primary" : "text-gray-500 hover:text-gray-900")}>Favorites</button>
            <button onClick={() => handleViewChange("chat")} className={cn("text-sm font-bold relative transition-colors", view === "chat" || view === "chat_room" ? "text-primary" : "text-gray-500 hover:text-gray-900")}>Chat {unreadChatCount > 0 && <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center px-1">{unreadChatCount}</span>}</button>
            <button onClick={() => handleViewChange("profile")} className={cn("text-sm font-bold relative transition-colors", view === "profile" ? "text-primary" : "text-gray-500 hover:text-gray-900")}>Profile {unhandledOrderCount > 0 && <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center px-1">{unhandledOrderCount}</span>}</button>
            <button onClick={() => handleViewChange("cart")} className="relative p-2 text-gray-500 hover:text-primary"><ShoppingCart className="w-6 h-6" />{profile?.cart?.length ? <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">{profile.cart.length}</span> : null}</button>
            <div className="relative">
              <button onClick={() => setShowSellOptions(!showSellOptions)} className="bg-primary text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg hover:bg-primary-hover">Sell Item</button>
              <AnimatePresence>
                {showSellOptions && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-black/5 overflow-hidden z-[60]">
                    <button onClick={() => handleViewChange("sell")} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3"><PlusCircle className="w-5 h-5 text-primary" /><span className="text-sm font-bold">Add Item</span></button>
                    <button onClick={() => { setSelectedSellerId(null); handleViewChange("seller_shop"); setShowSellOptions(false); }} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-t border-gray-50"><Package className="w-5 h-5 text-primary" /><span className="text-sm font-bold">My Shop</span></button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      <nav className="md:hidden bg-white px-4 py-3 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-50">
        <h1 onClick={() => handleViewChange("home")} className="text-primary font-black text-2xl tracking-tighter cursor-pointer">Relo</h1>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search..." className="w-full bg-gray-100 rounded-full py-2 pl-10 pr-4 text-sm outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <button onClick={() => handleViewChange("cart")} className="relative p-2 text-gray-600">
          <ShoppingCart className="w-6 h-6" />
          {profile?.cart?.length ? <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">{profile.cart.length}</span> : null}
        </button>
      </nav>

      <main className="flex-1 overflow-y-auto pb-24 md:pb-10 hide-scrollbar">
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {view === "home" && <HomeView key="home" products={filteredProducts} users={users} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} onSelectProduct={(p) => { setSelectedProduct(p); handleViewChange("detail"); }} favorites={profile?.favorites || []} onToggleFavorite={toggleFavorite} onViewSellerShop={(sid) => { setSelectedSellerId(sid); handleViewChange("seller_shop"); }} />}
            {view === "move_in" && <MoveInView key="move_in" products={products} users={users} cartItems={profile?.cart || []} onAddToCart={(p) => { addToCart(p.id); }} onProductClick={(p) => { setSelectedProduct(p); handleViewChange("detail"); }} />}
            {view === "cart" && <CartView key="cart" products={products.filter(p => profile?.cart?.includes(p.id))} users={users} onSelectProduct={(p) => { setSelectedProduct(p); handleViewChange("detail"); }} onRemoveFromCart={removeFromCart} onCheckout={checkout} onBack={goBack} />}
            {view === "sell" && <SellView key="sell" onSuccess={() => handleViewChange("home")} onBack={goBack} profile={profile} showAlert={showAlert} />}
            {view === "platform_buy" && <PlatformBuyView key="platform_buy" onSuccess={() => handleViewChange("home")} onBack={goBack} profile={profile} showAlert={showAlert} />}
            {view === "profile" && <ProfileView key="profile" profile={profile} products={products} users={users} onLogout={handleLogout} onSelectProduct={(p) => { setSelectedProduct(p); handleViewChange("detail"); }} favorites={profile?.favorites || []} onToggleFavorite={toggleFavorite} onManageOrders={() => handleViewChange("orders")} onUpdateProfile={updateProfile} setShowSuccessModal={setShowSuccessModal} showAlert={showAlert} onViewSellerShop={(sid) => { setSelectedSellerId(sid); handleViewChange("seller_shop"); }} setIsDirty={setIsDirty} showConfirm={showConfirm} addresses={addresses} setAddresses={setAddresses} defaultAddrIndex={defaultAddrIndex} setDefaultAddrIndex={setDefaultAddrIndex} payments={payments} setPayments={setPayments} defaultPayIndex={defaultPayIndex} setDefaultPayIndex={setDefaultPayIndex} />}
            {view === "orders" && <ManageOrdersView key={`orders-${user?.uid}`} products={products} users={users} chatRooms={chatRooms} currentUser={user} onBack={goBack} onSelectProduct={(p) => { setSelectedProduct(p); handleViewChange("detail"); }} showAlert={showAlert} onSendSystemMessage={sendSystemMessage} onViewSellerShop={(sid) => { setSelectedSellerId(sid); handleViewChange("seller_shop"); }} />}
            {view === "detail" && selectedProduct && <ProductDetailView key={`detail-${selectedProduct.id}`} product={selectedProduct} users={users} currentUser={user} sellerTransactionCount={products.filter(p => p.sellerId === selectedProduct.sellerId && (p.status === "Completed" || p.status === "Sold")).length} onViewSellerShop={(sid) => { setSelectedSellerId(sid); handleViewChange("seller_shop"); }} onBack={goBack} onStatusChange={async (id, status) => { try { await updateProductStatusSafely(selectedProduct, status); setSelectedProduct(prev => prev ? { ...prev, status } : null); } catch (error) { showAlert("Error", "Update failed."); } }} onDelete={async (id) => { showConfirm({ title: "Delete?", message: "Cannot be undone.", type: "danger", onConfirm: async () => { await deleteDoc(doc(db, "products", id)); setSelectedProduct(null); handleViewChange("home"); }}); }} onUpdate={async (id, data) => { await updateDoc(doc(db, "products", id), data); setSelectedProduct(prev => prev ? { ...prev, ...data } : null); }} onContactSeller={(p) => { if (p.sellerId !== user.uid) { const existing = chatRooms.find(r => r.productId === p.id && r.participants.includes(user.uid) && r.participants.includes(p.sellerId)); if (existing) { setSelectedChatRoom(existing); handleViewChange("chat_room"); } else { addDoc(collection(db, "chatRooms"), { participants: [user.uid, p.sellerId], productId: p.id, productTitle: p.title, productImage: p.images?.[0] || "", lastMessage: "Chat started", lastMessageAt: new Date().toISOString(), unreadBy: [p.sellerId] }).then(ref => { setSelectedChatRoom({ id: ref.id, participants: [user.uid, p.sellerId], productId: p.id, productTitle: p.title, productImage: p.images?.[0] || "" }); handleViewChange("chat_room"); }); } } else showAlert("Error", "Can't chat with yourself"); }} onAddToCart={(p) => addToCart(p.id)} isOwner={selectedProduct.sellerId === user.uid} showAlert={showAlert} isFavorite={profile?.favorites?.includes(selectedProduct.id) || false} onToggleFavorite={toggleFavorite} />}
            {view === "chat" && <UnifiedMessagesView key="chat" rooms={chatRooms} onSelectRoom={(r) => setSelectedChatRoom(r)} selectedRoom={selectedChatRoom} currentUser={user} profile={profile} users={users} onViewSellerShop={(sid) => { setSelectedSellerId(sid); handleViewChange("seller_shop"); }} products={products} onSelectProduct={(p) => { setSelectedProduct(p); handleViewChange("detail"); }} />}
            {view === "chat_room" && selectedChatRoom && <UnifiedMessagesView key="chat_room" rooms={chatRooms} onSelectRoom={(r) => setSelectedChatRoom(r)} selectedRoom={selectedChatRoom} currentUser={user} profile={profile} users={users} onViewSellerShop={(sid) => { setSelectedSellerId(sid); handleViewChange("seller_shop"); }} products={products} onSelectProduct={(p) => { setSelectedProduct(p); handleViewChange("detail"); }} />}
            {view === "favorites" && <FavoritesView key="favorites" products={products.filter(p => profile?.favorites?.includes(p.id))} users={users} onSelectProduct={(p) => { setSelectedProduct(p); handleViewChange("detail"); }} favorites={profile?.favorites || []} onToggleFavorite={toggleFavorite} onViewSellerShop={(sid) => { setSelectedSellerId(sid); handleViewChange("seller_shop"); }} />}
            {view === "settings" && <SettingsView key="settings" currentUser={user!} profile={profile} onSave={updateProfile} onBack={goBack} />}
            {view === "seller_shop" && <SellerShopView key={`seller_shop-${selectedSellerId || user.uid}`} sellerProfile={selectedSellerId ? users[selectedSellerId] : profile} products={products.filter(p => p.sellerId === (selectedSellerId || user.uid))} onSelectProduct={(p) => { setSelectedProduct(p); handleViewChange("detail"); }} onBack={goBack} isOwnShop={!selectedSellerId || selectedSellerId === user.uid} onUpdateProfile={updateProfile} />}
          </AnimatePresence>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center z-50 md:hidden">
        <NavButton icon={view === "home" ? Settings : Home} active={view === "settings"} onClick={() => handleViewChange(view === "home" ? "settings" : "home")} />
        <NavButton icon={Heart} active={view === "favorites"} onClick={() => handleViewChange("favorites")} />
        <button onClick={() => setShowSellOptions(!showSellOptions)} className={cn("w-14 h-14 rounded-full flex items-center justify-center -mt-10 shadow-lg transition-all", showSellOptions ? "bg-primary-hover scale-110 rotate-45" : "bg-primary hover:scale-105")}><PlusCircle className="w-8 h-8 text-white" /></button>
        <NavButton icon={MessageCircle} active={view === "chat" || view === "chat_room"} onClick={() => handleViewChange("chat")} badgeCount={unreadChatCount} />
        <NavButton icon={User} active={view === "profile"} onClick={() => handleViewChange("profile")} badgeCount={unhandledOrderCount} />
      </div>

      <AnimatePresence>
        {showSellOptions && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSellOptions(false)} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[55] md:hidden" />
            <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} className="fixed bottom-24 left-6 right-6 bg-white rounded-3xl p-6 z-[60] md:hidden shadow-2xl">
              <h3 className="text-lg font-black mb-4">Explore More</h3>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => handleViewChange("sell")} className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100"><PlusCircle className="w-6 h-6 text-primary" /><span className="text-sm font-bold text-gray-700">Add Item</span></button>
                <button onClick={() => handleViewChange("move_in")} className="flex flex-col items-center gap-3 p-4 bg-purple-50 border border-purple-100 rounded-2xl hover:bg-purple-100"><Sparkles className="w-6 h-6 text-purple-500" /><span className="text-sm font-bold text-purple-700">Smart Move-In</span></button>
                <button onClick={() => handleViewChange("platform_buy")} className="flex flex-col items-center gap-3 p-4 bg-orange-50 border border-orange-100 rounded-2xl hover:bg-orange-100"><Store className="w-6 h-6 text-orange-500" /><span className="text-sm font-bold text-orange-700">Sell to Relo</span></button>
                <button onClick={() => { setSelectedSellerId(null); handleViewChange("seller_shop"); setShowSellOptions(false); }} className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100"><Package className="w-6 h-6 text-primary" /><span className="text-sm font-bold text-gray-700">My Shop</span></button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmationModal isOpen={modalConfig.isOpen} title={modalConfig.title} message={modalConfig.message} confirmText={modalConfig.confirmText} type={modalConfig.type} isAlert={modalConfig.isAlert} onConfirm={() => { modalConfig.onConfirm(); setModalConfig(prev => ({ ...prev, isOpen: false })); }} onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))} />

      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSuccessModal(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle className="w-8 h-8 text-green-500" /></div>
              <h3 className="text-2xl font-bold mb-2">Success</h3>
              {successMessage && <p className="text-sm text-gray-500 mb-2 font-medium">{successMessage}</p>}
              <button onClick={() => setShowSuccessModal(false)} className="w-full py-4 bg-primary text-white font-bold rounded-2xl hover:bg-primary-hover mt-4 transition-colors">OK</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}