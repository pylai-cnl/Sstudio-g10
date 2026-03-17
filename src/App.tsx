import React, { Component, useState, useEffect, useMemo, useRef } from "react";
import { 
  Search, 
  ShoppingCart, 
  PlusCircle, 
  MessageCircle, 
  User, 
  Heart, 
  Settings, 
  Home,
  ChevronLeft, 
  Camera, 
  MapPin, 
  Calendar, 
  ExternalLink,
  LogOut,
  Trash2,
  CheckCircle2,
  Pencil,
  X,
  AlertTriangle,
  Bell,
  Shield,
  HelpCircle,
  Info,
  Heart as HeartIcon,
  MessageSquare,
  Send,
  AlertCircle,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Truck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";
import { 
  collection, 
  query, 
  orderBy, 
  where,
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  getDoc,
  setDoc,
  getDocFromServer,
  increment
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "./firebase";
import { Product, UserProfile, View, ChatRoom, Message } from "./types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CATEGORIES = ["All", "Textbooks", "Furniture", "Electronics", "Lighting", "Kitchen", "Others"];
const CONDITIONS = ["Brand New", "Like New", "Used - Good", "Used - Fair"];

interface HomeViewProps {
  key?: string;
  products: Product[];
  selectedCategory: string;
  onSelectCategory: (c: string) => void;
  onSelectProduct: (p: Product) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
}

interface SellViewProps {
  key?: string;
  onSuccess: () => void;
  profile: UserProfile | null;
  showAlert: (title: string, message: string) => void;
}

interface ProfileViewProps {
  key?: string;
  profile: UserProfile | null;
  products: Product[];
  onLogout: () => void;
  onSelectProduct: (p: Product) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onManageOrders: () => void;
}

interface ProductDetailViewProps {
  key?: string;
  product: Product;
  currentUser: FirebaseUser | null;
  onBack: () => void;
  onStatusChange: (id: string, status: Product["status"]) => void;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, data: Partial<Product>) => Promise<void>;
  onContactSeller: (product: Product) => void;
  onBuyNow: (product: Product) => void;
  isOwner: boolean;
  showAlert: (title: string, message: string) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  sellerTransactionCount: number;
}

interface ManageOrdersViewProps {
  key?: string;
  products: Product[];
  chatRooms: ChatRoom[];
  currentUser: FirebaseUser | null;
  onBack: () => void;
  onSelectProduct: (p: Product) => void;
  showAlert: (title: string, message: string) => void;
}

interface ProductCardProps {
  key?: string;
  product: Product;
  onClick: () => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
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

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
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

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  state: { hasError: boolean, error: Error | null };
  props: { children: React.ReactNode };

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error && parsed.operationType) {
          errorMessage = `Database Error (${parsed.operationType}): ${parsed.error}`;
        }
      } catch {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 text-center">
          <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-red-100">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Oops!</h2>
            <p className="text-gray-500 mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- App Component ---
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
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedChatRoom, setSelectedChatRoom] = useState<ChatRoom | null>(null);
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
    console.log(`Showing alert: [${title}] ${message}`);
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

  // Auth and Profile Initialization
  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;
    let chatRoomsUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Auth state changed:", user?.uid);
      
      // Cleanup previous listeners
      if (profileUnsubscribe) profileUnsubscribe();
      if (chatRoomsUnsubscribe) chatRoomsUnsubscribe();
      
      setUser(user);

      if (user) {
        setLoading(true);
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          
          const email = user.email || "";
          const isStudent = email.toLowerCase().endsWith(".edu") || email.toLowerCase().endsWith(".ca");

          if (!userDoc.exists()) {
            console.log("Creating new profile for:", user.uid);
            const newProfile = {
              displayName: user.displayName || email.split("@")[0] || "Anonymous",
              email: email,
              photoURL: user.photoURL || "",
              isStudent: isStudent,
              dormLocation: "Cornell Tech House",
              transactionCount: 0,
              favorites: []
            };
            await setDoc(userDocRef, newProfile);
            setProfile({ uid: user.uid, ...newProfile } as UserProfile);
          } else {
            console.log("Profile already exists");
            setProfile({ uid: user.uid, ...userDoc.data() } as UserProfile);
          }

          profileUnsubscribe = onSnapshot(userDocRef, (doc) => {
            if (doc.exists()) {
              setProfile({ uid: doc.id, ...doc.data() } as UserProfile);
            }
          }, (error) => {
            console.error("Profile snapshot error:", error);
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
          }, (error) => {
            console.error("Chat rooms snapshot error:", error);
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
      if (profileUnsubscribe) profileUnsubscribe();
      if (chatRoomsUnsubscribe) chatRoomsUnsubscribe();
    };
  }, []);

  // Products Listener
  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
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

  const handleViewChange = (newView: View) => {
    console.log(`View changing from ${view} to ${newView}`);
    setView(newView);
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

  const handleLogout = () => signOut(auth);

  const toggleFavorite = async (productId: string) => {
    if (!user || !profile) return;
    const favorites = profile.favorites || [];
    const newFavorites = favorites.includes(productId)
      ? favorites.filter(id => id !== productId)
      : [...favorites, productId];
    
    try {
      await updateDoc(doc(db, "users", user.uid), { favorites: newFavorites });
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  };

  const startChat = async (product: Product) => {
    if (!user || !profile) return;
    if (product.sellerId === user.uid) {
      showAlert("Cannot Chat", "You cannot start a chat with yourself.");
      return;
    }

    // Check if room already exists
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

    // Create new room
    try {
      const roomData = {
        participants: [user.uid, product.sellerId],
        productId: product.id,
        productTitle: product.title,
        productImage: product.images?.[0] || "",
        lastMessage: "Chat started",
        lastMessageAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, "chatRooms"), roomData);
      setSelectedChatRoom({ id: docRef.id, ...roomData });
      setView("chat_room");
    } catch (error) {
      console.error("Failed to start chat:", error);
      showAlert("Error", "Failed to start conversation.");
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
      {/* Desktop Header */}
      <header className="hidden md:block bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 
              className="text-2xl font-black text-primary cursor-pointer tracking-tighter"
              onClick={() => handleViewChange("home")}
            >
              Dormazon
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
            <button onClick={() => handleViewChange("chat")} className={cn("text-sm font-bold transition-colors", view === "chat" ? "text-primary" : "text-gray-500 hover:text-gray-900")}>Messages</button>
            <button onClick={() => handleViewChange("profile")} className={cn("text-sm font-bold transition-colors", view === "profile" ? "text-primary" : "text-gray-500 hover:text-gray-900")}>Profile</button>
            <button 
              onClick={() => handleViewChange("sell")}
              className="bg-primary text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all"
            >
              Sell Item
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navbar */}
      <nav className="md:hidden bg-white px-4 py-3 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-50">
        <div className="flex-shrink-0 cursor-pointer" onClick={() => handleViewChange("home")}>
          <h1 className="text-primary font-black text-2xl tracking-tighter">Dormazon</h1>
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
        <button className="relative p-2 text-gray-600">
          <ShoppingCart className="w-6 h-6" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full border-2 border-white" />
        </button>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24 md:pb-10 hide-scrollbar">
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
          {view === "home" && (
            <HomeView 
              key="home"
              products={filteredProducts} 
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              onSelectProduct={(p) => {
                setSelectedProduct(p);
                handleViewChange("detail");
              }}
              favorites={profile?.favorites || []}
              onToggleFavorite={toggleFavorite}
            />
          )}
          {view === "sell" && (
            <SellView 
              key="sell"
              onSuccess={() => handleViewChange("home")} 
              profile={profile}
              showAlert={showAlert}
            />
          )}
          {view === "profile" && user && (
            <ProfileView 
              key="profile"
              profile={profile} 
              products={products.filter(p => p.sellerId === user.uid)}
              onLogout={handleLogout}
              onSelectProduct={(p) => {
                setSelectedProduct(p);
                handleViewChange("detail");
              }}
              favorites={profile?.favorites || []}
              onToggleFavorite={toggleFavorite}
              onManageOrders={() => handleViewChange("orders")}
            />
          )}
          {view === "orders" && (
            <ManageOrdersView 
              key="orders"
              products={products}
              chatRooms={chatRooms}
              currentUser={user}
              onBack={() => handleViewChange("profile")}
              onSelectProduct={(p) => {
                setSelectedProduct(p);
                handleViewChange("detail");
              }}
              showAlert={showAlert}
            />
          )}
          {view === "detail" && selectedProduct && (
            <ProductDetailView 
              key={`detail-${selectedProduct.id}`}
              product={selectedProduct} 
              currentUser={user}
              sellerTransactionCount={products.filter(p => p && selectedProduct && p.sellerId === selectedProduct.sellerId && (p.status === "Completed" || p.status === "Sold")).length}
              onBack={() => handleViewChange("home")}
              onStatusChange={async (id, status) => {
                const updates: any = { status };
                if (status === "Completed") {
                  updates.completedAt = new Date().toISOString();
                  // Also increment seller's count
                  await updateDoc(doc(db, "users", selectedProduct.sellerId), {
                    transactionCount: increment(1)
                  });
                }
                await updateDoc(doc(db, "products", id), updates);
                setSelectedProduct(prev => prev ? { ...prev, ...updates } : null);
              }}
              onDelete={async (id) => {
                showConfirm({
                  title: "Delete Item?",
                  message: "Are you sure you want to delete this item? This action cannot be undone.",
                  confirmText: "Delete",
                  type: "danger",
                  onConfirm: async () => {
                    try {
                      console.log("Deleting product:", id);
                      await deleteDoc(doc(db, "products", id));
                      console.log("Product deleted successfully");
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
              onBuyNow={(product) => {
                if (!user || !profile) return;
                showConfirm({
                  title: "Confirm Purchase",
                  message: `Are you sure you want to buy "${product.title}" for $${product.price}? This will notify the seller.`,
                  confirmText: "Buy Now",
                  onConfirm: async () => {
                    try {
                      await updateDoc(doc(db, "products", product.id), { 
                        status: "Pending",
                        buyerId: user.uid,
                        buyerName: profile.displayName
                      });
                      setSelectedProduct(prev => prev ? { ...prev, status: "Pending", buyerId: user.uid, buyerName: profile.displayName } : null);
                      showAlert("Order Placed!", "The seller has been notified. You can track your order in 'Manage Orders'.");
                    } catch (error) {
                      console.error("Purchase failed:", error);
                      showAlert("Error", "Failed to place order. Please try again.");
                    }
                  }
                });
              }}
              isOwner={selectedProduct.sellerId === user?.uid}
              showAlert={showAlert}
              isFavorite={profile?.favorites?.includes(selectedProduct.id) || false}
              onToggleFavorite={toggleFavorite}
            />
          )}
          {view === "chat" && (
            <ChatView 
              key="chat"
              rooms={chatRooms} 
              onSelectRoom={(room) => {
                setSelectedChatRoom(room);
                handleViewChange("chat_room");
              }} 
            />
          )}
          {view === "chat_room" && selectedChatRoom && (
            <ChatRoomView 
              key={`chat_room-${selectedChatRoom.id}`}
              room={selectedChatRoom} 
              onBack={() => handleViewChange("chat")} 
              currentUser={user}
            />
          )}
          {view === "favorites" && (
            <FavoritesView 
              key="favorites"
              products={products.filter(p => profile?.favorites?.includes(p.id))} 
              onSelectProduct={(p) => {
                setSelectedProduct(p);
                handleViewChange("detail");
              }}
              favorites={profile?.favorites || []}
              onToggleFavorite={toggleFavorite}
            />
          )}
          {view === "settings" && (
            <SettingsView profile={profile} onLogout={handleLogout} />
          )}
        </AnimatePresence>
        </div>
      </main>

      {/* Bottom Nav (Mobile Only) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center z-50 md:hidden">
        <NavButton 
          icon={view === "home" ? Settings : Home} 
          active={view === "settings"} 
          onClick={() => handleViewChange(view === "home" ? "settings" : "home")} 
        />
        <NavButton icon={Heart} active={view === "favorites"} onClick={() => handleViewChange("favorites")} />
        <button 
          onClick={() => handleViewChange("sell")}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center -mt-10 shadow-lg transition-all",
            view === "sell" ? "bg-primary-hover scale-110" : "bg-primary hover:scale-105"
          )}
        >
          <PlusCircle className="w-8 h-8 text-white" />
        </button>
        <NavButton icon={MessageCircle} active={view === "chat"} onClick={() => handleViewChange("chat")} />
        <NavButton icon={User} active={view === "profile"} onClick={() => handleViewChange("profile")} />
      </div>

      {/* Custom Modal */}
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
        <h1 className="text-primary text-6xl font-black tracking-tighter mb-2">Dormazon</h1>
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

function HomeView({ 
  products, 
  selectedCategory, 
  onSelectCategory,
  onSelectProduct,
  favorites,
  onToggleFavorite
}: HomeViewProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-4"
    >
      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-4 -mx-4 px-4 cursor-grab active:cursor-grabbing scroll-smooth">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => onSelectCategory(cat)}
            className={cn(
              "px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all",
              selectedCategory === cat 
                ? "bg-primary text-white shadow-md shadow-primary/20" 
                : "bg-white text-gray-500 border border-gray-100 hover:bg-gray-50"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {products.length > 0 ? (
          products.map(product => (
            <ProductCard 
              key={product.id} 
              product={product} 
              onClick={() => onSelectProduct(product)}
              isFavorite={favorites.includes(product.id)}
              onToggleFavorite={onToggleFavorite}
            />
          ))
        ) : (
          <div className="col-span-2 py-20 text-center text-gray-400">
            No items found in this category.
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ProductCard({ product, onClick, isFavorite, onToggleFavorite }: ProductCardProps) {
  return (
    <motion.div 
      whileTap={{ scale: 0.98 }}
      className="card flex flex-col h-full cursor-pointer relative group"
    >
      <div className="aspect-square relative bg-gray-100" onClick={onClick}>
        {product.images?.[0] ? (
          <img src={product.images[0]} className="w-full h-full object-cover" alt={product.title} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Camera className="w-8 h-8" />
          </div>
        )}
        <div className="absolute top-2 left-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-bold text-gray-600 shadow-sm">
          {product.condition}
        </div>
        {product.status !== "Still on" && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
            <span className="bg-white text-black font-black px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest shadow-xl">
              {product.status === "Pending" ? "Pending" : "Sold Out"}
            </span>
          </div>
        )}
      </div>
      
      {/* Favorite Button */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(product.id);
        }}
        className="absolute top-2 right-2 p-2 bg-white/80 backdrop-blur rounded-full shadow-sm hover:bg-white transition-all z-10"
      >
        <HeartIcon className={cn("w-4 h-4 transition-colors", isFavorite ? "fill-red-500 text-red-500" : "text-gray-400")} />
      </button>

      <div className="p-3 flex-1 flex flex-col" onClick={onClick}>
        <h3 className="font-bold text-gray-800 text-sm line-clamp-1 mb-1">{product.title}</h3>
        <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-2">
          <MapPin className="w-3 h-3" />
          {product.dormLocation}
        </div>
        <div className="mt-auto flex items-center justify-between">
          <span className="text-primary font-black text-lg">${product.price}</span>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1 text-[9px] text-orange-600 font-bold mb-1">
              <Calendar className="w-2.5 h-2.5" />
              {product.departureDate}
            </div>
            <div className="w-6 h-6 rounded-full overflow-hidden border border-white shadow-sm relative">
              <img src={product.sellerAvatar || "https://picsum.photos/seed/user/100"} className="w-full h-full object-cover" alt="seller" />
              {product.sellerIsStudent && (
                <div className="absolute bottom-0 right-0 w-2 h-2 bg-primary rounded-full border border-white" title="Verified Student" />
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SellView({ onSuccess, profile, showAlert }: SellViewProps) {
  useEffect(() => {
    console.log("SellView mounted", { hasProfile: !!profile });
  }, [profile]);

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
    console.log("Submit button clicked!");
    
    if (!profile) {
      console.error("Submit failed: No profile found", { user: auth.currentUser?.uid });
      return;
    }
    
    if (images.length === 0) {
      console.warn("Submit failed: No images uploaded");
      return showAlert("Missing Photos", "Please upload at least one image of your item.");
    }

    console.log("Form data:", formData);
    console.log("Number of images:", images.length);

    setUploading(true);
    try {
      console.log("Starting image processing...");
      
      // Helper to compress and convert to base64
      const processImage = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              // Aggressive compression for Firestore limits
              const MAX_WIDTH = 600; 
              const MAX_HEIGHT = 600;
              let width = img.width;
              let height = img.height;

              if (width > height) {
                if (width > MAX_WIDTH) {
                  height *= MAX_WIDTH / width;
                  width = MAX_WIDTH;
                }
              } else {
                if (height > MAX_HEIGHT) {
                  width *= MAX_HEIGHT / height;
                  height = MAX_HEIGHT;
                }
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
              }
              
              // Quality 0.5 to keep it very small (~50-100KB)
              resolve(canvas.toDataURL('image/jpeg', 0.5));
            };
            img.onerror = () => reject(new Error("Failed to load image for processing"));
          };
          reader.onerror = () => reject(new Error("Failed to read file"));
        });
      };

      const imageUrls = await Promise.all(
        images.map(async (file) => {
          const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
          try {
            console.log(`Attempting Storage upload for ${file.name}...`);
            // Set a manual timeout for the upload attempt
            const uploadPromise = uploadBytes(storageRef, file);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Upload timeout")), 8000)
            );
            
            await Promise.race([uploadPromise, timeoutPromise]);
            const url = await getDownloadURL(storageRef);
            console.log(`Storage upload success: ${url}`);
            return url;
          } catch (err) {
            console.warn(`Storage upload failed for ${file.name}, falling back to Base64:`, err);
            const base64 = await processImage(file);
            console.log(`Base64 fallback successful for ${file.name}`);
            return base64;
          }
        })
      );

    const priceNum = parseFloat(formData.price);
    if (isNaN(priceNum)) {
      console.error("Submit failed: Invalid price", formData.price);
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
      sellerTransactionCount: profile.transactionCount || 0,
      dormLocation: profile.dormLocation || "Cornell Tech House",
      status: "Still on",
      createdAt: new Date().toISOString()
    };

    console.log("Final product payload:", productPayload);

    try {
      console.log("Saving product to Firestore...");
      await addDoc(collection(db, "products"), productPayload);
      console.log("Product saved successfully!");
      onSuccess();
    } catch (error: any) {
      console.error("Firestore addDoc failed:", error);
      throw error; // Let the outer catch handle it
    }
  } catch (error: any) {
      console.error("Publishing failed:", error);
      let msg = "Failed to post item. Please try again.";
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
      <h2 className="text-2xl font-black mb-6">Sell an Item</h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Image Upload */}
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
                console.log("Files selected:", newFiles.map(f => f.name));
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

function ProductDetailView({ 
  product, 
  currentUser,
  onBack, 
  onStatusChange,
  onDelete,
  onUpdate,
  onContactSeller,
  onBuyNow,
  isOwner,
  showAlert,
  isFavorite,
  onToggleFavorite,
  sellerTransactionCount
}: ProductDetailViewProps) {
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
      className="bg-white min-h-full"
    >
      {/* Header */}
      <div className="sticky top-0 md:top-16 z-10 bg-white/80 backdrop-blur px-4 py-3 flex items-center justify-between border-b border-gray-100">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-600">
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
            <div className="w-2" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-8">
        {/* Image Gallery */}
        <div className="aspect-square bg-gray-100 relative md:rounded-2xl md:overflow-hidden md:m-6">
          {product.images?.[activeImage] ? (
            <img src={product.images[activeImage]} className="w-full h-full object-cover" alt={product.title} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <Camera className="w-12 h-12" />
            </div>
          )}
          
          {/* Thumbnails */}
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

        {/* Content */}
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
              <div className="flex justify-between items-start">
                <h1 className="text-2xl font-black text-gray-900 leading-tight">{product.title}</h1>
                <span className="text-2xl font-black text-primary">${product.price}</span>
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

        {/* Seller Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-sm">
              <img src={product.sellerAvatar || "https://picsum.photos/seed/user/100"} className="w-full h-full object-cover" alt="seller" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900">{product.sellerName}</h4>
              <p className="text-xs text-gray-400">
                {product.sellerIsStudent ? "Verified Student • Cornell Tech" : "Community Member"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-primary font-black text-lg">{sellerTransactionCount}</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase">Transactions</p>
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
                  onClick={() => onBuyNow(product)}
                  className="bg-black text-white font-bold py-3 px-6 rounded-xl transition-all hover:bg-gray-800 active:scale-95 shadow-lg"
                >
                  Buy Now
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

function ManageOrdersView({ products, chatRooms, currentUser, onBack, onSelectProduct, showAlert }: ManageOrdersViewProps) {
  const [tab, setTab] = useState<"purchases" | "sales">("purchases");
  const [assigningId, setAssigningId] = useState<string | null>(null);

  // Only show items where user is explicitly the buyer
  const myPurchases = products.filter(p => p.buyerId === currentUser?.uid);
  const mySales = products.filter(p => p.sellerId === currentUser?.uid && p.status !== "Still on");

  const handleStatusUpdate = async (product: Product, newStatus: Product["status"]) => {
    try {
      const updates: Partial<Product> = { status: newStatus };
      if (newStatus === "Delivered") updates.deliveredAt = new Date().toISOString();
      if (newStatus === "Completed") {
        updates.completedAt = new Date().toISOString();
        // Increment seller's transaction count in users collection
        await updateDoc(doc(db, "users", product.sellerId), {
          transactionCount: increment(1)
        });
      }
      if (newStatus === "Still on") {
        updates.buyerId = "";
        updates.buyerName = "";
      }
      
      await updateDoc(doc(db, "products", product.id), updates);
      showAlert("Success", `Order status updated to ${newStatus}`);
    } catch (error) {
      console.error("Update failed:", error);
      showAlert("Error", "Failed to update order status.");
    }
  };

  const handleAssignBuyer = async (productId: string, buyerId: string, buyerName: string, sellerId: string) => {
    try {
      await updateDoc(doc(db, "products", productId), { 
        buyerId, 
        buyerName,
        status: "Completed" // Legacy items are usually already completed
      });
      
      // Increment seller's transaction count in users collection
      await updateDoc(doc(db, "users", sellerId), {
        transactionCount: increment(1)
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
                  {product.buyerName && (
                    <p className="text-[10px] text-gray-400 mt-1">Buyer: {product.buyerName}</p>
                  )}
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
                                  // We don't have the other person's name here easily, so we use a placeholder or generic label
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

function StatusBadge({ status }: { status: string | undefined }) {
  const configs: Record<string, { color: string; icon: any; text: string }> = {
    "Still on": { color: "bg-green-100 text-green-600", icon: Clock, text: "Available" },
    "Pending": { color: "bg-orange-100 text-orange-600", icon: Clock, text: "Processing" },
    "Delivered": { color: "bg-blue-100 text-blue-600", icon: Truck, text: "Delivered" },
    "Completed": { color: "bg-gray-100 text-gray-500", icon: CheckCircle, text: "Completed" },
    "Sold": { color: "bg-gray-100 text-gray-500", icon: CheckCircle, text: "Sold" }
  };

  const config = (status && configs[status]) ? configs[status] : configs["Still on"];
  const Icon = config.icon || Clock;

  return (
    <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", config.color)}>
      <Icon className="w-3 h-3" />
      {config.text}
    </div>
  );
}

function ProfileView({ 
  profile, 
  products, 
  onLogout,
  onSelectProduct,
  favorites,
  onToggleFavorite,
  onManageOrders
}: ProfileViewProps) {
  const [tab, setTab] = useState<"Still on" | "Completed">("Still on");

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6"
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-3xl overflow-hidden shadow-md">
            <img src={profile?.photoURL || "https://picsum.photos/seed/user/100"} className="w-full h-full object-cover" alt="profile" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 leading-tight">{profile?.displayName}</h2>
            {profile?.isStudent ? (
              <div className="flex items-center gap-1 text-primary font-bold text-xs mt-1">
                <CheckCircle2 className="w-3 h-3" />
                Verified Student
              </div>
            ) : (
              <div className="text-gray-400 font-bold text-[10px] mt-1 uppercase tracking-wider">
                Unverified Account
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onLogout} className="p-3 bg-gray-100 text-gray-500 rounded-2xl hover:bg-gray-200 transition-all">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <button 
        onClick={onManageOrders}
        className="w-full mb-8 p-5 bg-gradient-to-br from-primary to-primary-hover rounded-3xl flex items-center justify-between group shadow-xl shadow-primary/20 transition-all active:scale-95"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white">
            <Package className="w-8 h-8" />
          </div>
          <div className="text-left">
            <h4 className="text-lg font-black text-white">Manage My Orders</h4>
            <p className="text-xs text-white/70 font-bold uppercase tracking-wider">Track your purchases & sales</p>
          </div>
        </div>
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white group-hover:translate-x-1 transition-transform">
          <ChevronLeft className="w-6 h-6 rotate-180" />
        </div>
      </button>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-black/5 text-center">
          <p className="text-2xl font-black text-primary">
            {products.filter(p => p.status === "Completed" || p.status === "Sold").length}
          </p>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Items Sold</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-black/5 text-center">
          <p className="text-2xl font-black text-primary">
            {products.filter(p => p.status === "Still on").length}
          </p>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Active Listings</p>
        </div>
      </div>

      {!profile?.isStudent && (
        <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl mb-8">
          <h4 className="text-primary font-bold text-sm mb-1">Verify your student status</h4>
          <p className="text-gray-600 text-xs leading-relaxed">
            Please use your university email (.edu or .ca) to unlock the "Verified Student" badge and build trust with buyers.
          </p>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex gap-4 border-b border-gray-100">
          {(["Still on", "Completed"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "pb-3 text-sm font-bold transition-all relative",
                tab === t ? "text-primary" : "text-gray-400"
              )}
            >
              {t === "Still on" ? "Active Listings" : "Sold Items"}
              {tab === t && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {products.filter(p => {
            if (tab === "Still on") return p.status === "Still on";
            return p.status === "Completed" || p.status === "Sold";
          }).length > 0 ? (
            products.filter(p => {
              if (tab === "Still on") return p.status === "Still on";
              return p.status === "Completed" || p.status === "Sold";
            }).map(product => (
              <ProductCard 
                key={product.id} 
                product={product} 
                onClick={() => onSelectProduct(product)}
                isFavorite={favorites.includes(product.id)}
                onToggleFavorite={onToggleFavorite}
              />
            ))
          ) : (
            <div className="col-span-2 py-12 text-center text-gray-400 text-sm">
              No items in this category.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ChatView({ rooms, onSelectRoom }: { key?: string; rooms: ChatRoom[], onSelectRoom: (room: ChatRoom) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6"
    >
      <h2 className="text-2xl font-black mb-6">Messages</h2>
      {rooms.length > 0 ? (
        <div className="space-y-3">
          {rooms.map(room => (
            <button 
              key={room.id}
              onClick={() => onSelectRoom(room)}
              className="w-full bg-white p-4 rounded-3xl flex items-center gap-4 border border-black/5 shadow-sm hover:bg-gray-50 transition-all text-left"
            >
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0">
                <img src={room.productImage || "https://picsum.photos/seed/product/100"} className="w-full h-full object-cover" alt="product" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-900 truncate">{room.productTitle}</h4>
                <p className="text-sm text-gray-500 truncate">{room.lastMessage}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] text-gray-400 font-bold uppercase">
                  {room.lastMessageAt ? new Date(room.lastMessageAt).toLocaleDateString() : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mb-4">
            <MessageSquare className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">No Messages</h2>
          <p className="text-gray-500 text-sm max-w-[200px]">
            Your conversations with sellers and buyers will appear here.
          </p>
        </div>
      )}
    </motion.div>
  );
}

function ChatRoomView({ room, onBack, currentUser }: { key?: string; room: ChatRoom, onBack: () => void, currentUser: FirebaseUser }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, "chatRooms", room.id, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
    });
    return unsubscribe;
  }, [room.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const msgData = {
        senderId: currentUser.uid,
        text: newMessage.trim(),
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, "chatRooms", room.id, "messages"), msgData);
      await updateDoc(doc(db, "chatRooms", room.id), {
        lastMessage: newMessage.trim(),
        lastMessageAt: new Date().toISOString()
      });
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex flex-col h-full bg-white"
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-600">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
          <img src={room.productImage || "https://picsum.photos/seed/product/100"} className="w-full h-full object-cover" alt="product" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-gray-900 truncate text-sm">{room.productTitle}</h4>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Chatting about item</p>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50"
      >
        {messages.map(msg => {
          const isMe = msg.senderId === currentUser.uid;
          return (
            <div 
              key={msg.id}
              className={cn(
                "flex flex-col max-w-[80%]",
                isMe ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div className={cn(
                "px-4 py-2 rounded-2xl text-sm font-medium shadow-sm",
                isMe ? "bg-primary text-white rounded-tr-none" : "bg-white text-gray-800 rounded-tl-none border border-black/5"
              )}>
                {msg.text}
              </div>
              <span className="text-[9px] text-gray-400 mt-1 px-1">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 bg-white border-t border-gray-100 flex gap-2 items-center">
        <input 
          type="text"
          placeholder="Type a message..."
          className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
        />
        <button 
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all disabled:opacity-50 disabled:shadow-none"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </motion.div>
  );
}

function FavoritesView({ 
  products, 
  onSelectProduct,
  favorites,
  onToggleFavorite
}: { 
  key?: string;
  products: Product[], 
  onSelectProduct: (p: Product) => void,
  favorites: string[],
  onToggleFavorite: (id: string) => void
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="p-6"
    >
      <h2 className="text-2xl font-black mb-6">Favorites</h2>
      {products.length > 0 ? (
        <div className="grid grid-cols-2 gap-4">
          {products.map(product => (
            <ProductCard 
              key={product.id} 
              product={product} 
              onClick={() => onSelectProduct(product)}
              isFavorite={favorites.includes(product.id)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-300 mb-4">
            <HeartIcon className="w-8 h-8" />
          </div>
          <p className="text-gray-400 text-sm">No favorite items yet.</p>
        </div>
      )}
    </motion.div>
  );
}

function SettingsView({ profile, onLogout }: { profile: UserProfile | null, onLogout: () => void }) {
  const settingsItems = [
    { icon: Bell, label: "Notifications", color: "text-blue-500", bg: "bg-blue-50" },
    { icon: Shield, label: "Privacy & Security", color: "text-green-500", bg: "bg-green-50" },
    { icon: HelpCircle, label: "Help Center", color: "text-purple-500", bg: "bg-purple-50" },
    { icon: Info, label: "About Dormazon", color: "text-orange-500", bg: "bg-orange-50" },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="p-6"
    >
      <h2 className="text-2xl font-black mb-8">Settings</h2>
      
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Account</p>
          <div className="bg-white rounded-3xl p-4 flex items-center gap-4 border border-black/5 shadow-sm">
            <img src={profile?.photoURL || "https://picsum.photos/seed/user/100"} className="w-12 h-12 rounded-2xl object-cover" alt="profile" />
            <div className="flex-1">
              <h4 className="font-bold text-gray-900">{profile?.displayName}</h4>
              <p className="text-xs text-gray-400">{profile?.email}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">General</p>
          <div className="bg-white rounded-3xl overflow-hidden border border-black/5 shadow-sm divide-y divide-gray-50">
            {settingsItems.map((item, i) => (
              <button key={i} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-all">
                <div className="flex items-center gap-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", item.bg, item.color)}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-gray-700 text-sm">{item.label}</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-gray-300 rotate-180" />
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={onLogout}
          className="w-full p-4 bg-red-50 text-red-500 rounded-3xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-all mt-4"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </motion.div>
  );
}

function NavButton({ icon: Icon, active, onClick }: { icon: any, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-2 transition-all rounded-xl",
        active ? "text-primary bg-primary/5" : "text-gray-400 hover:text-gray-600"
      )}
    >
      <Icon className={cn("w-6 h-6", active && "fill-current")} />
    </button>
  );
}

function ConfirmationModal({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmText = "Confirm",
  type = "primary",
  isAlert = false
}: { 
  isOpen: boolean; 
  title: string; 
  message: string; 
  onConfirm: () => void; 
  onCancel: () => void;
  confirmText?: string;
  type?: "danger" | "primary";
  isAlert?: boolean;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl relative z-10 text-center"
          >
            <div className={cn(
              "w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center",
              type === "danger" ? "bg-red-50 text-red-500" : "bg-primary/10 text-primary"
            )}>
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">{message}</p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={onConfirm}
                className={cn(
                  "w-full py-3 rounded-xl font-bold transition-all",
                  type === "danger" ? "bg-red-500 text-white hover:bg-red-600" : "bg-primary text-white hover:bg-primary-hover"
                )}
              >
                {confirmText}
              </button>
              {!isAlert && (
                <button 
                  onClick={onCancel}
                  className="w-full py-3 rounded-xl font-bold text-gray-400 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
