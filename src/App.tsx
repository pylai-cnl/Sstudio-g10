import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { 
  Search, ShoppingCart, PlusCircle, MessageCircle, User, Heart, Settings, Home,
  ChevronLeft, Camera, MapPin, Calendar, ExternalLink, LogOut, Trash2,
  CheckCircle2, Pencil, X, Bell, Shield, HelpCircle, Info,
  Heart as HeartIcon, MessageSquare, Send, Package, CheckCircle, Truck, 
  ShieldCheck, ChevronRight, CreditCard, List, ArrowLeft, Plus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut,
  User as FirebaseUser, createUserWithEmailAndPassword, signInWithEmailAndPassword
} from "firebase/auth";
import { 
  collection, query, orderBy, where, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, getDoc, setDoc, runTransaction, limit
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "./firebase";
import { Product, UserProfile, View, ChatRoom, Message } from "./types";

// --- Imported Utilities & Shared Components ---
import { cn } from "./utils/classNames";
import ErrorBoundary from "./components/ErrorBoundary";
import ProductCard from "./components/ProductCard";
import StatusBadge from "./components/StatusBadge";
import NavButton from "./components/NavButton";
import ConfirmationModal from "./components/ConfirmationModal";

// --- Imported Views ---
import HomeView from "./views/HomeView";
import CartView from "./views/CartView";
import SellView from "./views/SellView";

// --- Error Handling Logic ---
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

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
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    type?: "danger" | "primary";
    isAlert?: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const showConfirm = (config: {
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    type?: "danger" | "primary";
  }) => {
    setModalConfig({ ...config, isOpen: true, isAlert: false });
  };

  const showAlert = (title: string, message: string) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      onConfirm: () => {},
      confirmText: "OK",
      type: "primary",
      isAlert: true
    });
  };

  const ensurePrivateProfileDoc = async (firebaseUser: FirebaseUser) => {
    const userPrivateDocRef = doc(db, "users_private", firebaseUser.uid);
    const userPrivateDoc = await getDoc(userPrivateDocRef);

    if (!userPrivateDoc.exists()) {
      await setDoc(userPrivateDocRef, {
        email: firebaseUser.email || "",
        favorites: [],
        cart: []
      });
    }

    return userPrivateDocRef;
  };

  const updateProductStatusSafely = async (product: Product, nextStatus: Product["status"]) => {
    if (!user) throw new Error("You must be logged in.");

    await runTransaction(db, async (transaction) => {
      const productRef = doc(db, "products", product.id);
      const productSnap = await transaction.get(productRef);

      if (!productSnap.exists()) {
        throw new Error("Product not found.");
      }

      const latest = { id: product.id, ...productSnap.data() } as Product;
      const updates: Partial<Product> = {};

      if (nextStatus === "Pending") {
        if (latest.status !== "Still on") {
          throw new Error("This item is no longer available.");
        }
        if (latest.sellerId === user.uid) {
          throw new Error("You cannot purchase your own item.");
        }
        updates.status = "Pending";
        updates.buyerId = user.uid;
        updates.buyerName = profile?.displayName || user.displayName || user.email?.split("@")[0] || "Buyer";
        updates.sellerNotified = false;
      } else if (nextStatus === "Delivered") {
        if (latest.status !== "Pending") {
          throw new Error("Only pending orders can be marked as delivered.");
        }
        if (latest.sellerId !== user.uid) {
          throw new Error("Only the seller can mark an item as delivered.");
        }
        updates.status = "Delivered";
        updates.deliveredAt = new Date().toISOString();
      } else if (nextStatus === "Completed") {
        if (latest.status !== "Delivered") {
          throw new Error("Only delivered orders can be completed.");
        }
        if (latest.buyerId !== user.uid) {
          throw new Error("Only the buyer can complete this order.");
        }
        updates.status = "Completed";
        updates.completedAt = new Date().toISOString();
      } else if (nextStatus === "Still on") {
        if (!["Pending", "Delivered"].includes(latest.status)) {
          throw new Error("This order cannot be reset to available.");
        }
        if (latest.sellerId !== user.uid) {
          throw new Error("Only the seller can cancel this transaction.");
        }
        updates.status = "Still on";
        updates.buyerId = "";
        updates.buyerName = "";
        updates.deliveredAt = "";
        updates.completedAt = "";
        updates.sellerNotified = true;
      } else if (nextStatus === "Sold") {
        if (latest.sellerId !== user.uid) {
          throw new Error("Only the seller can mark this item as sold.");
        }
        updates.status = "Sold";
      } else {
        throw new Error("Unsupported status transition.");
      }

      transaction.update(productRef, updates as any);
    });
  };

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;
    let privateUnsubscribe: (() => void) | null = null;
    let chatRoomsUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      profileUnsubscribe?.();
      privateUnsubscribe?.();
      chatRoomsUnsubscribe?.();
      profileUnsubscribe = null;
      privateUnsubscribe = null;
      chatRoomsUnsubscribe = null;

      setUser(user);

      if (user) {
        setLoading(true);
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userPrivateDocRef = await ensurePrivateProfileDoc(user);

          const [userDoc, userPrivateDoc] = await Promise.all([
            getDoc(userDocRef),
            getDoc(userPrivateDocRef)
          ]);

          const email = user.email || "";
          const isStudent = email.toLowerCase().endsWith(".edu") || email.toLowerCase().endsWith(".ca");

          if (!userDoc.exists()) {
            const newProfile = {
              displayName: user.displayName || email.split("@")[0] || "Anonymous",
              photoURL: user.photoURL || "",
              isStudent,
              dormLocation: "Cornell Tech House"
            };
            const newPrivateProfile = userPrivateDoc.exists()
              ? userPrivateDoc.data()
              : { email, favorites: [], cart: [] };

            await Promise.all([
              setDoc(userDocRef, newProfile),
              setDoc(userPrivateDocRef, newPrivateProfile, { merge: true })
            ]);

            setProfile({ uid: user.uid, ...newProfile, ...newPrivateProfile } as UserProfile);
          } else {
            const existingData = userDoc.data();
            const existingPrivateData = userPrivateDoc.data() || { email, favorites: [], cart: [] };

            if (user.photoURL && existingData.photoURL !== user.photoURL) {
              await updateDoc(userDocRef, { photoURL: user.photoURL });
            }

            setProfile({
              uid: user.uid,
              ...existingData,
              ...existingPrivateData,
              ...(user.photoURL ? { photoURL: user.photoURL } : {})
            } as UserProfile);
          }

          profileUnsubscribe = onSnapshot(userDocRef, (doc) => {
            if (doc.exists()) {
              setProfile(prev => prev ? { ...prev, ...doc.data() } : { uid: doc.id, ...doc.data() } as UserProfile);
            }
          }, (error) => {
            console.error("Profile snapshot error:", error);
          });

          privateUnsubscribe = onSnapshot(userPrivateDocRef, (doc) => {
            if (doc.exists()) {
              setProfile(prev => prev ? { ...prev, ...doc.data() } : { uid: doc.id, ...doc.data() } as UserProfile);
            }
          }, (error) => {
            console.error("Private profile snapshot error:", error);
          });

          const chatRoomsQuery = query(
            collection(db, "chatRooms"),
            where("participants", "array-contains", user.uid)
          );
          chatRoomsUnsubscribe = onSnapshot(chatRoomsQuery, (snapshot) => {
            const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatRoom));
            rooms.sort((a, b) => {
              const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
              const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
              return dateB - dateA;
            });
            setChatRooms(rooms);

            setSelectedChatRoom(prev => {
              if (!prev) return null;
              const updated = rooms.find(r => r.id === prev.id);
              return updated || prev;
            });
          });
        } catch (error) {
          console.error("Initialization error:", error);
        } finally {
          setLoading(false);
        }
      } else {
        setProfile(null);
        setChatRooms([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      profileUnsubscribe?.();
      privateUnsubscribe?.();
      chatRoomsUnsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setUsers({});
      return;
    }
    const q = collection(db, "users");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersMap: Record<string, UserProfile> = {};
      snapshot.docs.forEach(doc => {
        usersMap[doc.id] = { uid: doc.id, ...doc.data() } as UserProfile;
      });
      setUsers(usersMap);
    }, (error) => {
      console.error("Users snapshot error:", error);
    });
    return unsubscribe;
  }, [user?.uid]);

  // Performance Fix: App.tsx now properly uses limit() for the initial product load
  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "products");
    });
    return unsubscribe;
  }, []);

  const executeViewChange = (newView: View) => {
    setViewHistory(prev => {
      if (prev[prev.length - 1] === newView) return prev;
      return [...prev, newView];
    });
    setView(newView);
    setShowSellOptions(false);
    window.scrollTo(0, 0);
  };

  const handleViewChange = (newView: View) => {
    if (view === newView) return;
    if (isDirty) {
      if (typeof showConfirm !== 'undefined') {
        showConfirm({ title: "Unsaved Changes", message: "Discard unsaved changes and leave?", confirmText: "Discard & Leave", type: "danger", onConfirm: () => { setIsDirty(false); executeViewChange(newView); }});
      } else if (window.confirm("Discard unsaved changes?")) {
        setIsDirty(false); executeViewChange(newView);
      }
      return; 
    }
    executeViewChange(newView);
  };

  const performGoBack = () => {
    setViewHistory(prev => {
      if (prev.length <= 1) { setView("home"); return ["home"]; }
      const newHistory = [...prev];
      newHistory.pop();
      setView(newHistory[newHistory.length - 1]);
      return newHistory;
    });
    setShowSellOptions(false);
    window.scrollTo(0, 0);
  };

  const goBack = () => {
    if (isDirty) {
      if (typeof showConfirm !== 'undefined') {
        showConfirm({ title: "Unsaved Changes", message: "Discard unsaved changes and go back?", confirmText: "Discard & Leave", type: "danger", onConfirm: () => { setIsDirty(false); performGoBack(); }});
      } else if (window.confirm("Discard unsaved changes?")) {
        setIsDirty(false); performGoBack();
      }
      return;
    }
    performGoBack();
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const title = (p.title || "").toLowerCase();
      const description = (p.description || "").toLowerCase();
      const search = (searchQuery || "").toLowerCase();
      
      const matchesSearch = title.includes(search) || description.includes(search);
      const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
      const isAvailable = p.status === "Still on";
      return matchesSearch && matchesCategory && isAvailable;
    });
  }, [products, searchQuery, selectedCategory]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const unreadChatCount = useMemo(() => 
    chatRooms.filter(room => room.unreadBy?.includes(user?.uid)).length,
  [chatRooms, user?.uid]);

  const unhandledOrderCount = useMemo(() => 
    products.filter(p => p.sellerId === user?.uid && p.sellerNotified === false).length,
  [products, user?.uid]);

  const handleLogout = () => signOut(auth);

  const toggleFavorite = async (productId: string) => {
    if (!user || !profile) return;
    const favorites = profile.favorites || [];
    const newFavorites = favorites.includes(productId)
      ? favorites.filter(id => id !== productId)
      : [...favorites, productId];
    
    try {
      await setDoc(doc(db, "users_private", user.uid), {
        email: user.email || profile.email || "",
        favorites: newFavorites
      }, { merge: true });
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  };

  const addToCart = async (productId: string) => {
    if (!user || !profile) return;
    const cart = profile.cart || [];
    if (cart.includes(productId)) {
      showAlert("Already in Cart", "This item is already in your shopping cart.");
      return;
    }
    const newCart = [...cart, productId];
    try {
      await setDoc(doc(db, "users_private", user.uid), {
        email: user.email || profile.email || "",
        cart: newCart
      }, { merge: true });
      showAlert("Added to Cart", "Item has been added to your shopping cart.");
    } catch (error) {
      console.error("Failed to add to cart:", error);
    }
  };

  const removeFromCart = async (productId: string) => {
    if (!user || !profile) return;
    const cart = profile.cart || [];
    const newCart = cart.filter(id => id !== productId);
    try {
      await setDoc(doc(db, "users_private", user.uid), {
        email: user.email || profile.email || "",
        cart: newCart
      }, { merge: true });
    } catch (error) {
      console.error("Failed to remove from cart:", error);
    }
  };

  // Transaction Race Condition Fix applied here
  const checkout = async () => {
    if (!user || !profile || !profile.cart || profile.cart.length === 0) return;
    
    const cartProducts = products.filter(p => profile.cart?.includes(p.id) && p.status === "Still on");
    
    if (cartProducts.length === 0) {
      showAlert("Cart Empty", "No available items in your cart to checkout.");
      return;
    }

    showConfirm({
      title: "Confirm Checkout",
      message: `Are you sure you want to checkout ${cartProducts.length} items? Total: $${cartProducts.reduce((sum, p) => sum + p.price, 0)}`,
      confirmText: "Checkout",
      onConfirm: async () => {
        try {
          const promises = cartProducts.map(p => 
            updateProductStatusSafely(p, "Pending")
          );
          await Promise.all(promises);
          
          for (const p of cartProducts) {
            await sendSystemMessage(
              p.id, 
              p.sellerId, 
              user.uid, 
              `Your item "${p.title}" has been purchased by ${profile.displayName}. Please check your orders.`
            );
          }
          
          await updateDoc(doc(db, "users_private", user.uid), { cart: [] });
          
          showAlert("Success!", "Your orders have been placed. Sellers will be notified.");
          handleViewChange("orders");
        } catch (error: any) {
          console.error("Checkout failed:", error);
          showAlert("Checkout Error", error.message || "Failed to complete checkout. An item might have already been sold.");
        }
      }
    });
  };

  const sendSystemMessage = async (productId: string, sellerId: string, buyerId: string, text: string) => {
    try {
      if (!user) return;
      const product = products.find(p => p.id === productId);
      if (!product) return;

      let room = chatRooms.find(r => 
        r.productId === productId && 
        r.participants.includes(sellerId) && 
        r.participants.includes(buyerId)
      );

      let roomId = room?.id;
      const now = new Date().toISOString();

      if (!room) {
        const roomData = {
          participants: [sellerId, buyerId],
          productId,
          productTitle: product.title,
          productImage: product.images?.[0] || "",
          lastMessage: text,
          lastMessageAt: now,
          unreadBy: [sellerId]
        };
        const docRef = await addDoc(collection(db, "chatRooms"), roomData);
        roomId = docRef.id;
      } else {
        const unreadBy = Array.from(new Set([...(room.unreadBy || []), sellerId]));
        await updateDoc(doc(db, "chatRooms", room.id), {
          lastMessage: text,
          lastMessageAt: now,
          unreadBy
        });
      }

      if (roomId) {
        await addDoc(collection(db, "chatRooms", roomId, "messages"), {
          senderId: user.uid,
          senderName: profile?.displayName || user.displayName || "User",
          text,
          createdAt: now
        });
      }
    } catch (error) {
      console.error("Failed to send system message:", error);
    }
  };

  const startChat = async (product: Product) => {
    if (!user || !profile) return;
    if (product.sellerId === user.uid) {
      showAlert("Cannot Chat", "You cannot start a chat with yourself.");
      return;
    }

    const existingRoom = chatRooms.find(r => 
      r.productId === product.id && 
      r.participants.includes(user.uid) && 
      r.participants.includes(product.sellerId)
    );

    if (existingRoom) {
      setSelectedChatRoom(existingRoom);
      setView("chat_room");
      return;
    }

    try {
      const roomData = {
        participants: [user.uid, product.sellerId],
        productId: product.id,
        productTitle: product.title,
        productImage: product.images?.[0] || "",
        lastMessage: "Chat started",
        lastMessageAt: new Date().toISOString(),
        unreadBy: [product.sellerId]
      };
      const docRef = await addDoc(collection(db, "chatRooms"), roomData);
      setSelectedChatRoom({ id: docRef.id, ...roomData });
      setView("chat_room");
    } catch (error) {
      console.error("Failed to start chat:", error);
      showAlert("Error", "Failed to start conversation.");
    }
  };

  const updateProfile = async (data: Partial<UserProfile>, silent = false) => {
    if (!user) return;
    try {
      const publicFields = ["displayName", "photoURL", "isStudent", "dormLocation", "school", "majorInfo", "gradYear", "departureDate"];
      const privateFields = ["email", "favorites", "cart"];
      
      const publicUpdate: any = {};
      const privateUpdate: any = {};
      
      Object.keys(data).forEach(key => {
        if (publicFields.includes(key)) publicUpdate[key] = (data as any)[key];
        if (privateFields.includes(key)) privateUpdate[key] = (data as any)[key];
      });

      const promises = [];
      if (Object.keys(publicUpdate).length > 0) promises.push(updateDoc(doc(db, "users", user.uid), publicUpdate));
      if (Object.keys(privateUpdate).length > 0) {
        promises.push(setDoc(doc(db, "users_private", user.uid), {
          email: user.email || profile?.email || "",
          ...privateUpdate
        }, { merge: true }));
      }
      
      await Promise.all(promises);
      
      if (!silent) {
        setShowSuccessModal(true);
      }
      setIsDirty(false);
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthView onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 relative">
      <header className="hidden md:block bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 
              className="text-2xl font-black text-primary cursor-pointer tracking-tighter"
              onClick={() => handleViewChange("home")}
            >
              Relo
            </h1>
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search campus items..." 
                className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => handleViewChange("home")} className={cn("text-sm font-bold transition-colors", view === "home" ? "text-primary" : "text-gray-500 hover:text-gray-900")}>Home</button>
            <button onClick={() => handleViewChange("favorites")} className={cn("text-sm font-bold transition-colors", view === "favorites" ? "text-primary" : "text-gray-500 hover:text-gray-900")}>Favorites</button>
            <button 
              onClick={() => handleViewChange("chat")} 
              className={cn("text-sm font-bold transition-colors relative", view === "chat" ? "text-primary" : "text-gray-500 hover:text-gray-900")}
            >
              Messages
              {unreadChatCount > 0 && (
                <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white px-1">
                  {unreadChatCount > 99 ? "99+" : unreadChatCount}
                </span>
              )}
            </button>
            <button 
              onClick={() => handleViewChange("profile")} 
              className={cn("text-sm font-bold transition-colors relative", view === "profile" ? "text-primary" : "text-gray-500 hover:text-gray-900")}
            >
              Profile
              {unhandledOrderCount > 0 && (
                <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white px-1">
                  {unhandledOrderCount > 99 ? "99+" : unhandledOrderCount}
                </span>
              )}
            </button>
            <button 
              onClick={() => handleViewChange("cart")}
              className="relative p-2 text-gray-500 hover:text-primary transition-colors"
            >
              <ShoppingCart className="w-6 h-6" />
              {profile?.cart && profile.cart.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                  {profile.cart.length}
                </span>
              )}
            </button>
            <div className="relative">
              <button 
                onClick={() => setShowSellOptions(!showSellOptions)}
                className="bg-primary text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all"
              >
                Sell Item
              </button>
              
              <AnimatePresence>
                {showSellOptions && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-black/5 overflow-hidden z-[60]"
                  >
                    <button 
                      onClick={() => handleViewChange("sell")}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 transition-colors"
                    >
                      <PlusCircle className="w-5 h-5 text-primary" />
                      <span className="text-sm font-bold text-gray-700">Add Item</span>
                    </button>
                    <button 
                      onClick={() => handleViewChange("seller_shop")}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 transition-colors border-t border-gray-50"
                    >
                      <Package className="w-5 h-5 text-primary" />
                      <span className="text-sm font-bold text-gray-700">My Shop</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      <nav className="md:hidden bg-white px-4 py-3 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-50">
        <div className="flex-shrink-0 cursor-pointer" onClick={() => handleViewChange("home")}>
          <h1 className="text-primary font-black text-2xl tracking-tighter">Relo</h1>
        </div>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search items..." 
            className="w-full bg-gray-100 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button 
          onClick={() => handleViewChange("cart")}
          className="relative p-2 text-gray-600"
        >
          <ShoppingCart className="w-6 h-6" />
          {profile?.cart && profile.cart.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
              {profile.cart.length}
            </span>
          )}
        </button>
      </nav>

      <main className="flex-1 overflow-y-auto pb-24 md:pb-10 hide-scrollbar">
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
          {view === "home" && (
            <HomeView 
              key="home"
              products={filteredProducts} 
              users={users}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              onSelectProduct={(p) => {
                setSelectedProduct(p);
                handleViewChange("detail");
              }}
              favorites={profile?.favorites || []}
              onToggleFavorite={toggleFavorite}
              onViewSellerShop={(sellerId) => {
                setSelectedSellerId(sellerId);
                handleViewChange("seller_shop");
              }}
            />
          )}
          {view === "cart" && (
            <CartView 
              key="cart"
              products={products.filter(p => profile?.cart?.includes(p.id))}
              onSelectProduct={(p) => {
                setSelectedProduct(p);
                handleViewChange("detail");
              }}
              onRemoveFromCart={removeFromCart}
              onCheckout={checkout}
              onBack={goBack}
            />
          )}
          {view === "sell" && (
            <SellView 
              key="sell"
              onSuccess={() => handleViewChange("home")} 
              onBack={goBack}
              profile={profile}
              showAlert={showAlert}
            />
          )}

          {/* ----- The following views are preserved for the next extraction phase ----- */}

          {view === "profile" && user && (
            <ProfileView 
              key="profile"
              profile={profile} 
              products={products}
              users={users}
              onLogout={handleLogout}
              onSelectProduct={(p) => {
                setSelectedProduct(p);
                handleViewChange("detail");
              }}
              favorites={profile?.favorites || []}
              onToggleFavorite={toggleFavorite}
              onManageOrders={() => handleViewChange("orders")}
              onUpdateProfile={updateProfile}
              setShowSuccessModal={setShowSuccessModal}
              showAlert={showAlert}
              onViewSellerShop={(sellerId) => {
                setSelectedSellerId(sellerId);
                handleViewChange("seller_shop");
              }}
              setIsDirty={setIsDirty}
              showConfirm={showConfirm}
              addresses={addresses}
              setAddresses={setAddresses}
              defaultAddrIndex={defaultAddrIndex}
              setDefaultAddrIndex={setDefaultAddrIndex}
              payments={payments}
              setPayments={setPayments}
              defaultPayIndex={defaultPayIndex}
              setDefaultPayIndex={setDefaultPayIndex}
            />
          )}
          {view === "orders" && (
            <ManageOrdersView 
              key="orders"
              products={products}
              users={users}
              chatRooms={chatRooms}
              currentUser={user}
              onBack={goBack}
              onSelectProduct={(p) => {
                setSelectedProduct(p);
                handleViewChange("detail");
              }}
              showAlert={showAlert}
              onSendSystemMessage={sendSystemMessage}
              onViewSellerShop={(sellerId) => {
                setSelectedSellerId(sellerId);
                handleViewChange("seller_shop");
              }}
            />
          )}
          {view === "detail" && selectedProduct && (
            <ProductDetailView 
              key={`detail-${selectedProduct.id}`}
              product={selectedProduct} 
              users={users}
              currentUser={user}
              sellerTransactionCount={products.filter(p => p && selectedProduct && p.sellerId === selectedProduct.sellerId && (p.status === "Completed" || p.status === "Sold")).length}
              onViewSellerShop={(sellerId) => {
                setSelectedSellerId(sellerId);
                handleViewChange("seller_shop");
              }}
              onBack={goBack}
              onStatusChange={async (id, status) => {
                try {
                  await updateProductStatusSafely(selectedProduct, status);
                  const updates: any = { status };
                  if (status === "Completed") updates.completedAt = new Date().toISOString();
                  if (status === "Delivered") updates.deliveredAt = new Date().toISOString();
                  if (status === "Still on") {
                    updates.buyerId = "";
                    updates.buyerName = "";
                    updates.deliveredAt = "";
                    updates.completedAt = "";
                  }
                  setSelectedProduct(prev => prev ? { ...prev, ...updates } : null);
                  
                  if (status === "Sold" || status === "Completed") {
                    const el = document.getElementById('shop-stat-sold');
                    if (el) {
                      const current = parseInt(el.innerText) || 0;
                      el.innerText = (current + 1).toString();
                    }
                  }
                  
                  showAlert("Success", `Status updated to ${status}`);
                } catch (error) {
                  console.error("Status update failed:", error);
                  showAlert("Error", "Failed to update status. Please try again.");
                }
              }}
              onDelete={async (id) => {
                showConfirm({
                  title: "Delete Item?",
                  message: "Are you sure you want to delete this item? This action cannot be undone.",
                  confirmText: "Delete",
                  type: "danger",
                  onConfirm: async () => {
                    try {
                      await deleteDoc(doc(db, "products", id));
                      setSelectedProduct(null);
                      handleViewChange("home");
                    } catch (error) {
                      console.error("Delete failed:", error);
                      showAlert("Error", "Failed to delete item. Please try again.");
                    }
                  }
                });
              }}
              onUpdate={async (id, data) => {
                await updateDoc(doc(db, "products", id), data);
                setSelectedProduct(prev => prev ? { ...prev, ...data } : null);
              }}
              onContactSeller={(product) => {
                startChat(product);
              }}
              onAddToCart={(product) => {
                addToCart(product.id);
              }}
              isOwner={selectedProduct.sellerId === user?.uid}
              showAlert={showAlert}
              isFavorite={profile?.favorites?.includes(selectedProduct.id) || false}
              onToggleFavorite={toggleFavorite}
            />
          )}
          {view === "chat" && (
            <UnifiedMessagesView 
              key="chat"
              rooms={chatRooms} 
              onSelectRoom={(room) => setSelectedChatRoom(room)}
              selectedRoom={selectedChatRoom}
              currentUser={user}
              profile={profile}
              users={users}
              onViewSellerShop={(sellerId) => {
                setSelectedSellerId(sellerId);
                handleViewChange("seller_shop");
              }}
              products={products}
              onSelectProduct={(p) => {
                setSelectedProduct(p);
                handleViewChange("detail");
              }}
            />
          )}
          {view === "chat_room" && selectedChatRoom && (
            <UnifiedMessagesView 
              key="chat_room_unified"
              rooms={chatRooms} 
              onSelectRoom={(room) => setSelectedChatRoom(room)}
              selectedRoom={selectedChatRoom}
              currentUser={user}
              profile={profile}
              users={users}
              onViewSellerShop={(sellerId) => {
                setSelectedSellerId(sellerId);
                handleViewChange("seller_shop");
              }}
              products={products}
              onSelectProduct={(p) => {
                setSelectedProduct(p);
                handleViewChange("detail");
              }}
            />
          )}
          {view === "favorites" && (
            <FavoritesView 
              key="favorites"
              products={products.filter(p => profile?.favorites?.includes(p.id))} 
              users={users}
              onSelectProduct={(p) => {
                setSelectedProduct(p);
                handleViewChange("detail");
              }}
              favorites={profile?.favorites || []}
              onToggleFavorite={toggleFavorite}
              onViewSellerShop={(sellerId) => {
                setSelectedSellerId(sellerId);
                handleViewChange("seller_shop");
              }}
            />
          )}
          {view === "settings" && (
            <SettingsView profile={profile} onLogout={handleLogout} />
          )}
          {view === "seller_shop" && (
            <SellerShopView 
              sellerProfile={selectedSellerId ? users[selectedSellerId] : profile}
              products={products.filter(p => p.sellerId === (selectedSellerId || user?.uid))}
              onSelectProduct={(p) => {
                setSelectedProduct(p);
                handleViewChange("detail");
              }}
              onBack={goBack}
              isOwnShop={!selectedSellerId || selectedSellerId === user?.uid}
              onUpdateProfile={updateProfile}
            />
          )}
        </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {showSellOptions && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSellOptions(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[55] md:hidden"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-24 left-6 right-6 bg-white rounded-3xl p-6 z-[60] md:hidden shadow-2xl"
            >
              <h3 className="text-lg font-black text-gray-900 mb-4">Sell Something</h3>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => handleViewChange("sell")}
                  className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-2xl hover:bg-primary/5 transition-colors group"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <PlusCircle className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-gray-700">Add Item</span>
                </button>
                <button 
                  onClick={() => handleViewChange("seller_shop")}
                  className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-2xl hover:bg-primary/5 transition-colors group"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <Package className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-gray-700">My Shop</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center z-50 md:hidden">
        <NavButton 
          icon={view === "home" ? Settings : Home} 
          active={view === "settings"} 
          onClick={() => handleViewChange(view === "home" ? "settings" : "home")} 
        />
        <NavButton icon={Heart} active={view === "favorites"} onClick={() => handleViewChange("favorites")} />
        <button 
          onClick={() => setShowSellOptions(!showSellOptions)}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center -mt-10 shadow-lg transition-all",
            showSellOptions ? "bg-primary-hover scale-110 rotate-45" : "bg-primary hover:scale-105"
          )}
        >
          <PlusCircle className="w-8 h-8 text-white" />
        </button>
        <NavButton 
          icon={MessageCircle} 
          active={view === "chat"} 
          onClick={() => handleViewChange("chat")} 
          badgeCount={unreadChatCount}
        />
        <NavButton 
          icon={User} 
          active={view === "profile"} 
          onClick={() => handleViewChange("profile")} 
          badgeCount={unhandledOrderCount}
        />
      </div>

      <ConfirmationModal 
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        type={modalConfig.type}
        isAlert={modalConfig.isAlert}
        onConfirm={() => {
          modalConfig.onConfirm();
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
      />

      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSuccessModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-200">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Success</h3>
              <p className="text-gray-500 mb-8 font-medium">Profile updated successfully!</p>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-4 bg-primary text-white font-bold rounded-2xl hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 active:scale-[0.98]"
              >
                OK
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AuthView({ onLogin }: { onLogin: () => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      if (err.code === "auth/operation-not-allowed") {
        setError("Email/Password login is not enabled in Firebase Console. Please enable it in Authentication > Sign-in method.");
      } else if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered. Please login instead.");
      } else if (err.code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-white px-8 text-center overflow-y-auto py-10">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-primary text-6xl font-black tracking-tighter mb-2">Relo</h1>
        <p className="text-gray-500 font-medium">Cornell Tech Campus Marketplace</p>
      </motion.div>
      
      <div className="w-full max-w-xs space-y-4">
        <form onSubmit={handleEmailAuth} className="space-y-3">
          <div className="text-left">
            <label className="text-[10px] font-bold text-gray-400 uppercase px-2 mb-1 block">University Email</label>
            <input 
              type="email" 
              placeholder="name@cornell.edu" 
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <p className="text-[9px] text-gray-400 px-2 mt-1 italic">Use .edu or .ca for student verification</p>
          </div>
          <div className="text-left">
            <label className="text-[10px] font-bold text-gray-400 uppercase px-2 mb-1 block">Password</label>
            <input 
              type="password" 
              placeholder="Min. 6 characters" 
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-red-500 text-xs text-left px-2">{error}</p>}
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all disabled:opacity-50"
          >
            {loading ? "Processing..." : (isSignUp ? "Sign Up" : "Login")}
          </button>
        </form>

        <div className="flex items-center gap-2 py-2">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-gray-400 text-xs font-bold uppercase">OR</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        <button 
          onClick={onLogin}
          className="w-full bg-white text-gray-700 border border-gray-200 font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-50 transition-all"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5 bg-white rounded-full p-0.5" alt="Google" />
          Continue with Google
        </button>

        <button 
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-primary font-bold text-sm hover:underline"
        >
          {isSignUp ? "Already have an account? Login" : "Don't have an account? Sign Up"}
        </button>

        <p className="text-xs text-gray-400 px-6 pt-4">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

function ProductDetailView({ 
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

function ManageOrdersView({ 
  products, 
  users,
  chatRooms, 
  currentUser, 
  onBack, 
  onSelectProduct, 
  showAlert, 
  onSendSystemMessage,
  onViewSellerShop 
}: ManageOrdersViewProps) {
  const [tab, setTab] = useState<"purchases" | "sales">("purchases");
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const myPurchases = products.filter(p => p.buyerId === currentUser?.uid);
  const mySales = products.filter(p => p.sellerId === currentUser?.uid && p.status !== "Still on");

  useEffect(() => {
    const unnotifiedSales = mySales.filter(p => p.sellerNotified === false);
    if (unnotifiedSales.length > 0) {
      unnotifiedSales.forEach(p => {
        updateDoc(doc(db, "products", p.id), { sellerNotified: true });
      });
    }
  }, [mySales.length]);

  const handleStatusUpdate = async (product: Product, newStatus: Product["status"]) => {
    try {
      if (!currentUser) throw new Error("You must be logged in.");

      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, "products", product.id);
        const productSnap = await transaction.get(productRef);

        if (!productSnap.exists()) {
          throw new Error("Product not found.");
        }

        const latest = { id: product.id, ...productSnap.data() } as Product;
        const updates: Partial<Product> = {};

        if (newStatus === "Delivered") {
          if (latest.status !== "Pending" || latest.sellerId !== currentUser.uid) {
            throw new Error("Only the seller can mark a pending order as delivered.");
          }
          updates.status = "Delivered";
          updates.deliveredAt = new Date().toISOString();
        } else if (newStatus === "Completed") {
          if (latest.status !== "Delivered" || latest.buyerId !== currentUser.uid) {
            throw new Error("Only the buyer can complete a delivered order.");
          }
          updates.status = "Completed";
          updates.completedAt = new Date().toISOString();
        } else if (newStatus === "Still on") {
          if (!["Pending", "Delivered"].includes(latest.status) || latest.sellerId !== currentUser.uid) {
            throw new Error("Only the seller can cancel this transaction.");
          }
          updates.status = "Still on";
          updates.buyerId = "";
          updates.buyerName = "";
          updates.deliveredAt = "";
          updates.completedAt = "";
        } else {
          throw new Error("Unsupported status transition.");
        }

        transaction.update(productRef, updates as any);
      });

      if (newStatus === "Delivered" && product.buyerId) {
        await onSendSystemMessage(
          product.id,
          product.sellerId,
          product.buyerId,
          `The seller has delivered your item "${product.title}". Please check it.`
        );
      }

      showAlert("Success", `Order status updated to ${newStatus}`);
    } catch (error: any) {
      console.error("Update failed:", error);
      showAlert("Error", error?.message || "Failed to update order status.");
    }
  };

  const handleAssignBuyer = async (productId: string, buyerId: string, buyerName: string, sellerId: string) => {
    try {
      await updateDoc(doc(db, "products", productId), { 
        buyerId, 
        buyerName,
        status: "Completed"
      });

      setAssigningId(null);
      showAlert("Success", "Buyer assigned successfully. They can now see this in their purchases.");
    } catch (error) {
      showAlert("Error", "Failed to assign buyer.");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-white"
    >
      <div className="p-4 border-b border-gray-100 flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-black text-gray-900">Manage Orders</h2>
      </div>

      <div className="flex border-b border-gray-100">
        <button 
          onClick={() => setTab("purchases")}
          className={cn(
            "flex-1 py-4 text-sm font-bold transition-all relative",
            tab === "purchases" ? "text-primary" : "text-gray-400"
          )}
        >
          My Purchases
          {tab === "purchases" && <motion.div layoutId="orderTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
        <button 
          onClick={() => setTab("sales")}
          className={cn(
            "flex-1 py-4 text-sm font-bold transition-all relative",
            tab === "sales" ? "text-primary" : "text-gray-400"
          )}
        >
          My Sales
          {tab === "sales" && <motion.div layoutId="orderTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === "purchases" && myPurchases.length === 0 && (
          <div className="bg-blue-50 p-4 rounded-2xl mb-4">
            <p className="text-xs text-blue-600 leading-relaxed">
              <Info className="w-3 h-3 inline mr-1" />
              Note: Orders placed before the system update may not appear here. Please contact the seller to "Assign" the order to you.
            </p>
          </div>
        )}

        {(tab === "purchases" ? myPurchases : mySales).length > 0 ? (
          (tab === "purchases" ? myPurchases : mySales).map(product => (
            <div key={product.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="flex gap-4 mb-4 cursor-pointer" onClick={() => onSelectProduct(product)}>
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                  {product.images?.[0] ? (
                    <img src={product.images[0]} className="w-full h-full object-cover" alt={product.title} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <Camera className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 line-clamp-1">{product.title}</h3>
                  <p className="text-primary font-black text-lg">${product.price}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={product.status} />
                  </div>
                  {tab === "purchases" ? (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewSellerShop(product.sellerId);
                      }}
                      className="flex items-center gap-2 mt-2 cursor-pointer group"
                    >
                      <div className="w-5 h-5 rounded-full overflow-hidden border border-gray-100">
                        <img 
                          src={users[product.sellerId]?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${product.sellerId}`} 
                          className="w-full h-full object-cover" 
                          alt="seller" 
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 group-hover:text-primary transition-colors">Seller: {product.sellerName}</p>
                    </div>
                  ) : product.buyerId ? (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewSellerShop(product.buyerId!);
                      }}
                      className="flex items-center gap-2 mt-2 cursor-pointer group"
                    >
                      <div className="w-5 h-5 rounded-full overflow-hidden border border-gray-100">
                        <img 
                          src={users[product.buyerId]?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${product.buyerId}`} 
                          className="w-full h-full object-cover" 
                          alt="buyer" 
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 group-hover:text-primary transition-colors">Buyer: {product.buyerName}</p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {tab === "purchases" && (
                  <>
                    {product.status === "Delivered" && (
                      <button 
                        onClick={() => handleStatusUpdate(product, "Completed")}
                        className="w-full btn-primary py-2 text-xs flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Confirm Received
                      </button>
                    )}
                    {product.status === "Pending" && (
                      <p className="text-xs text-gray-400 italic py-2">Waiting for seller to deliver...</p>
                    )}
                    {(product.status === "Completed" || product.status === "Sold") && (
                      <p className="text-xs text-green-500 font-bold py-2 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Order Completed
                      </p>
                    )}
                  </>
                )}

                {tab === "sales" && (
                  <>
                    {product.status === "Pending" && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleStatusUpdate(product, "Delivered")}
                          className="flex-1 btn-primary py-2 text-xs flex items-center justify-center gap-2"
                        >
                          <Truck className="w-4 h-4" />
                          Mark Delivered
                        </button>
                        <button 
                          onClick={() => handleStatusUpdate(product, "Still on")}
                          className="px-4 py-2 border border-red-100 text-red-500 rounded-xl text-xs hover:bg-red-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {product.status === "Delivered" && (
                      <p className="text-xs text-gray-400 italic py-2">Waiting for buyer to confirm...</p>
                    )}
                    {(product.status === "Completed" || product.status === "Sold") && !product.buyerId && (
                      <div className="space-y-2 pt-2 border-t border-gray-50">
                        <p className="text-[10px] text-orange-500 font-bold uppercase">Legacy Order: No Buyer Assigned</p>
                        {assigningId === product.id ? (
                          <div className="space-y-2">
                            <p className="text-[10px] text-gray-400">Select the buyer from your chats:</p>
                            <div className="flex flex-wrap gap-2">
                              {chatRooms
                                .filter(room => room.productId === product.id)
                                .map(room => {
                                  const otherParticipantId = room.participants.find(id => id !== currentUser?.uid);
                                  return (
                                    <button
                                      key={room.id}
                                      onClick={() => handleAssignBuyer(product.id, otherParticipantId!, "Chat Participant", product.sellerId)}
                                      className="px-3 py-1 bg-gray-100 hover:bg-primary hover:text-white rounded-full text-[10px] font-bold transition-all"
                                    >
                                      Assign to Chat Partner
                                    </button>
                                  );
                                })}
                              <button onClick={() => setAssigningId(null)} className="text-[10px] text-gray-400 underline">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setAssigningId(product.id)}
                            className="w-full py-2 bg-orange-50 text-orange-600 rounded-xl text-xs font-bold hover:bg-orange-100 transition-colors"
                          >
                            Assign Buyer to show in their list
                          </button>
                        )}
                      </div>
                    )}
                    {(product.status === "Completed" || product.status === "Sold") && product.buyerId && (
                      <p className="text-xs text-green-500 font-bold py-2 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Sale Completed
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
            <Package className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">No orders found in this category.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ... （ProfileView、SellerShopView、UnifiedMessagesView 等由于篇幅和分阶段策略暂时保留在这里）...