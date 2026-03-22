import React, { Component, useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  Truck,
  Store,
  ShieldCheck,
  ChevronRight,
  CreditCard,
  List,
  ArrowLeft,
  Plus
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
  increment,
  arrayUnion
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "./firebase";
import { Product, UserProfile, View, ChatRoom, Message } from "./types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const compressImage = async (file: File, maxWidth = 600, maxHeight = 600, quality = 0.5): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
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
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error("Failed to load image for processing"));
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
  });
};

const CATEGORIES = ["All", "Textbooks", "Furniture", "Electronics", "Lighting", "Kitchen", "Others"];
const CONDITIONS = ["Brand New", "Like New", "Used - Good", "Used - Fair"];

interface HomeViewProps {
  key?: string;
  products: Product[];
  users: Record<string, UserProfile>;
  selectedCategory: string;
  onSelectCategory: (c: string) => void;
  onSelectProduct: (p: Product) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onViewSellerShop: (sellerId: string) => void;
}

interface SellViewProps {
  key?: string;
  onSuccess: () => void;
  onBack: () => void;
  profile: UserProfile | null;
  showAlert: (title: string, message: string) => void;
}

interface ProfileViewProps {
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
  // PERSISTENT DATA PROPS
  addresses?: any[];
  setAddresses?: (data: any[]) => void;
  defaultAddrIndex?: number;
  setDefaultAddrIndex?: (idx: number) => void;
  payments?: any[];
  setPayments?: (data: any[]) => void;
  defaultPayIndex?: number;
  setDefaultPayIndex?: (idx: number) => void;
}

interface ProductDetailViewProps {
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

interface ManageOrdersViewProps {
  key?: string;
  products: Product[];
  users: Record<string, UserProfile>;
  chatRooms: ChatRoom[];
  currentUser: FirebaseUser | null;
  onBack: () => void;
  onSelectProduct: (p: Product) => void;
  showAlert: (title: string, message: string) => void;
  onSendSystemMessage: (productId: string, sellerId: string, buyerId: string, text: string) => Promise<void>;
  onViewSellerShop: (sellerId: string) => void;
}

interface ProductCardProps {
  key?: string;
  product: Product;
  users: Record<string, UserProfile>;
  onClick: () => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onViewSellerShop: (sellerId: string) => void;
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
  const [viewHistory, setViewHistory] = useState<View[]>(["home"]);
  const [isDirty, setIsDirty] = useState(false);
  // Elevated states for persistence
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
          const userPrivateDocRef = doc(db, "users_private", user.uid);
          
          const [userDoc, userPrivateDoc] = await Promise.all([
            getDoc(userDocRef),
            getDoc(userPrivateDocRef)
          ]);
          
          const email = user.email || "";
          const isStudent = email.toLowerCase().endsWith(".edu") || email.toLowerCase().endsWith(".ca");

          if (!userDoc.exists()) {
            console.log("Creating new profile for:", user.uid);
            const newProfile = {
              displayName: user.displayName || email.split("@")[0] || "Anonymous",
              photoURL: user.photoURL || "",
              isStudent: isStudent,
              dormLocation: "Cornell Tech House",
              salesCount: 0,
              purchasesCount: 0
            };
            const newPrivateProfile = {
              email: email,
              favorites: [],
              cart: []
            };
            await Promise.all([
              setDoc(userDocRef, newProfile),
              setDoc(userPrivateDocRef, newPrivateProfile)
            ]);
            setProfile({ uid: user.uid, ...newProfile, ...newPrivateProfile } as UserProfile);
          } else {
            console.log("Profile already exists");
            const existingData = userDoc.data();
            const existingPrivateData = userPrivateDoc.data() || {};
            // Keep photoURL in sync with Google if available
            if (user.photoURL && existingData.photoURL !== user.photoURL) {
              console.log("Updating photoURL from Google");
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

          // Also listen to private data
          const privateUnsubscribe = onSnapshot(userPrivateDocRef, (doc) => {
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
            
            // Update selected chat room if it exists
            setSelectedChatRoom(prev => {
              if (!prev) return null;
              const updated = rooms.find(r => r.id === prev.id);
              return updated || prev;
            });
          }, (error) => {
            console.error("Chat rooms snapshot error:", error);
          });

          return () => {
            if (profileUnsubscribe) profileUnsubscribe();
            if (privateUnsubscribe) privateUnsubscribe();
            if (chatRoomsUnsubscribe) chatRoomsUnsubscribe();
          };

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

  // Users Listener
  useEffect(() => {
    if (!user) {
      setUsers({});
      return;
    }
    const q = collection(db, "users");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`Users snapshot received: ${snapshot.size} users`);
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
      await updateDoc(doc(db, "users_private", user.uid), { favorites: newFavorites });
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
      await updateDoc(doc(db, "users_private", user.uid), { cart: newCart });
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
      await updateDoc(doc(db, "users_private", user.uid), { cart: newCart });
    } catch (error) {
      console.error("Failed to remove from cart:", error);
    }
  };

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
          // Update each product status to Pending
          const promises = cartProducts.map(p => 
            updateDoc(doc(db, "products", p.id), {
              status: "Pending",
              buyerId: user.uid,
              buyerName: profile.displayName,
              sellerNotified: false
            })
          );
          await Promise.all(promises);
          
          // Send system messages to sellers
          for (const p of cartProducts) {
            await sendSystemMessage(
              p.id, 
              p.sellerId, 
              user.uid, 
              `Your item "${p.title}" has been purchased by ${profile.displayName}. Please check your orders.`
            );
          }
          
          // Clear cart
          await updateDoc(doc(db, "users_private", user.uid), { cart: [] });
          
          showAlert("Success!", "Your orders have been placed. Sellers will be notified.");
          handleViewChange("orders");
        } catch (error) {
          console.error("Checkout failed:", error);
          showAlert("Error", "Failed to complete checkout. Please try again.");
        }
      }
    });
  };

  const sendSystemMessage = async (productId: string, sellerId: string, buyerId: string, text: string) => {
    try {
      const product = products.find(p => p.id === productId);
      if (!product) return;

      // Check if room already exists
      let room = chatRooms.find(r => 
        r.productId === productId && 
        r.participants.includes(sellerId) && 
        r.participants.includes(buyerId)
      );

      let roomId = room?.id;

      if (!room) {
        // Create new room
        const roomData = {
          participants: [sellerId, buyerId],
          productId: productId,
          productTitle: product.title,
          productImage: product.images?.[0] || "",
          lastMessage: text,
          lastMessageAt: new Date().toISOString(),
          unreadBy: [sellerId, buyerId] // Both might need to see it
        };
        const docRef = await addDoc(collection(db, "chatRooms"), roomData);
        roomId = docRef.id;
      } else {
        // Update existing room
        await updateDoc(doc(db, "chatRooms", room.id), {
          lastMessage: text,
          lastMessageAt: new Date().toISOString(),
          unreadBy: arrayUnion(sellerId, buyerId)
        });
      }

      if (roomId) {
        await addDoc(collection(db, "chatRooms", roomId, "messages"), {
          senderId: "system",
          senderName: "Relo System",
          text: text,
          createdAt: new Date().toISOString()
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
        lastMessageAt: new Date().toISOString(),
        unreadBy: [product.sellerId] // New chat started, notify the seller
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
      const publicFields = ["displayName", "photoURL", "isStudent", "dormLocation", "salesCount", "purchasesCount", "school", "majorInfo", "gradYear", "departureDate"];
      const privateFields = ["email", "favorites", "cart"];
      
      const publicUpdate: any = {};
      const privateUpdate: any = {};
      
      Object.keys(data).forEach(key => {
        if (publicFields.includes(key)) publicUpdate[key] = (data as any)[key];
        if (privateFields.includes(key)) privateUpdate[key] = (data as any)[key];
      });

      const promises = [];
      if (Object.keys(publicUpdate).length > 0) promises.push(updateDoc(doc(db, "users", user.uid), publicUpdate));
      if (Object.keys(privateUpdate).length > 0) promises.push(updateDoc(doc(db, "users_private", user.uid), privateUpdate));
      
      await Promise.all(promises);
      
      // TRIGGER MODAL ONLY IF NOT SILENT
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
      {/* Desktop Header */}
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

      {/* Mobile Navbar */}
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

      {/* Main Content */}
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
              onBack={goBack} // <--- 换成智能返回！
              profile={profile}
              showAlert={showAlert}
            />
          )}
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
              // NEW PERSISTENT STATES
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
                  const updates: any = { status };
                  if (status === "Completed") {
                    updates.completedAt = new Date().toISOString();
                    // Increment seller's sales count
                    await updateDoc(doc(db, "users", selectedProduct.sellerId), {
                      salesCount: increment(1)
                    });
                    // Increment buyer's purchases count if exists
                    if (selectedProduct.buyerId) {
                      await updateDoc(doc(db, "users", selectedProduct.buyerId), {
                        purchasesCount: increment(1)
                      });
                    }
                  }
                  await updateDoc(doc(db, "products", id), updates);
                  setSelectedProduct(prev => prev ? { ...prev, ...updates } : null);
                  
                  // Immediate UI Sync for Shop Stats
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

      {/* Sell Options Overlay (Mobile) */}
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

      {/* Bottom Nav (Mobile Only) */}
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

      {/* Success Modal */}
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

function HomeView({ 
  products, 
  users,
  selectedCategory, 
  onSelectCategory,
  onSelectProduct,
  favorites,
  onToggleFavorite,
  onViewSellerShop
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
              users={users}
              onClick={() => onSelectProduct(product)}
              isFavorite={favorites.includes(product.id)}
              onToggleFavorite={onToggleFavorite}
              onViewSellerShop={onViewSellerShop}
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

function ProductCard({ product, users, onClick, isFavorite, onToggleFavorite, onViewSellerShop }: ProductCardProps) {
  const seller = users[product.sellerId];
  const sellerAvatar = seller?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${product.sellerId}`;
  const sellerIsStudent = seller?.isStudent ?? product.sellerIsStudent;

  return (
    <motion.div 
      whileTap={{ scale: 0.98 }}
      className="product-card card flex flex-col h-full cursor-pointer relative group"
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
            <div 
              onClick={(e) => {
                e.stopPropagation();
                onViewSellerShop(product.sellerId);
              }}
              className="w-6 h-6 rounded-full overflow-hidden border border-white shadow-sm relative hover:scale-110 transition-transform cursor-pointer"
            >
              <img src={sellerAvatar} className="w-full h-full object-cover" alt="seller" />
              {sellerIsStudent && (
                <div className="absolute bottom-0 right-0 w-2 h-2 bg-primary rounded-full border border-white" title="Verified Student" />
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SellView({ onSuccess, onBack, profile, showAlert }: SellViewProps) {
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
            const base64 = await compressImage(file);
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
      sellerSalesCount: profile.salesCount || 0,
      sellerPurchasesCount: profile.purchasesCount || 0,
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
      <div className="view-header">
        <h2 className="text-2xl font-black">Sell an Item</h2>
        <button 
          className="close-view-btn" 
          aria-label="Close" 
          onClick={onBack}
        >
          &times;
        </button>
      </div>
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
      {/* Header */}
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

        {/* Seller Info */}
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

function CartView({ 
  products, 
  onSelectProduct, 
  onRemoveFromCart, 
  onCheckout, 
  onBack 
}: { 
  key?: string,
  products: Product[], 
  onSelectProduct: (p: Product) => void, 
  onRemoveFromCart: (id: string) => void, 
  onCheckout: () => void, 
  onBack: () => void 
}) {
  const total = products.reduce((sum, p) => sum + p.price, 0);

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
        <h2 className="text-xl font-black text-gray-900">Shopping Cart</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center text-gray-300 mb-4">
              <ShoppingCart className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Your cart is empty</h3>
            <p className="text-gray-500 text-sm max-w-[200px] mx-auto mt-2">
              Looks like you haven't added any items to your cart yet.
            </p>
            <button 
              onClick={onBack}
              className="mt-6 text-primary font-bold hover:underline"
            >
              Go Shopping
            </button>
          </div>
        ) : (
          products.map(product => (
            <div 
              key={product.id}
              className="flex gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 group"
            >
              <div 
                className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer"
                onClick={() => onSelectProduct(product)}
              >
                <img src={product.images?.[0] || "https://picsum.photos/seed/item/200"} className="w-full h-full object-cover" alt={product.title} />
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <h4 
                      className="font-bold text-gray-900 truncate cursor-pointer hover:text-primary transition-colors"
                      onClick={() => onSelectProduct(product)}
                    >
                      {product.title}
                    </h4>
                    <button 
                      onClick={() => onRemoveFromCart(product.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{product.category}</p>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-lg font-black text-primary">${product.price}</span>
                  {product.status !== "Still on" && (
                    <span className="text-[10px] font-bold text-red-500 uppercase bg-red-50 px-2 py-1 rounded">No longer available</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {products.length > 0 && (
        <div className="p-6 border-t border-gray-100 bg-white space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 font-bold">Total</span>
            <span className="text-2xl font-black text-gray-900">${total}</span>
          </div>
          <button 
            onClick={onCheckout}
            className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            Checkout Now
          </button>
        </div>
      )}
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

  // Only show items where user is explicitly the buyer
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
      const updates: Partial<Product> = { status: newStatus };
      if (newStatus === "Delivered") {
        updates.deliveredAt = new Date().toISOString();
        if (product.buyerId) {
          await onSendSystemMessage(
            product.id, 
            product.sellerId, 
            product.buyerId, 
            `The seller has delivered your item "${product.title}". Please check it.`
          );
        }
      }
      if (newStatus === "Completed") {
        updates.completedAt = new Date().toISOString();
        // Increment seller's sales count
        await updateDoc(doc(db, "users", product.sellerId), {
          salesCount: increment(1)
        });
        // Increment buyer's purchases count if exists
        if (product.buyerId) {
          await updateDoc(doc(db, "users", product.buyerId), {
            purchasesCount: increment(1)
          });
        }
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
      
      // Increment seller's sales count
      await updateDoc(doc(db, "users", sellerId), {
        salesCount: increment(1)
      });
      // Increment buyer's purchases count
      await updateDoc(doc(db, "users", buyerId), {
        purchasesCount: increment(1)
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

interface SellerShopViewProps {
  sellerProfile: UserProfile | null;
  products: Product[];
  onSelectProduct: (p: Product) => void;
  onBack: () => void;
  isOwnShop: boolean;
  onUpdateProfile: (data: Partial<UserProfile>, silent?: boolean) => Promise<void>;
}

function SellerShopView({ sellerProfile, products, onSelectProduct, onBack, isOwnShop, onUpdateProfile }: SellerShopViewProps) {
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

  // PART 1: THE SYNCHRONIZATION FUNCTION
  const syncShopStats = useCallback(() => {
    console.log("Syncing shop stats...");
    // Determine actual number of sold items from the products prop
    const soldCount = products.filter(p => p.status === "Sold" || p.status === "Completed").length;
    
    // Locate the DOM element for the Items Sold stat
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
      {/* Header */}
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
        {/* Avatar Section */}
        <div className="flex items-end mb-6">
          <div className="w-24 h-24 rounded-full border-4 border-white overflow-hidden shadow-lg bg-white">
            <img 
              src={sellerProfile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sellerProfile?.uid}`} 
              className="w-full h-full object-cover" 
              alt="avatar" 
            />
          </div>
        </div>

        {/* Main Info Area */}
        <div className="shop-profile-container">
          {/* Left Side: Identity, Education & Urgency */}
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

          {/* Right Side: Trust Metrics */}
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

        {/* Tabs */}
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

        {/* PART 1: THE PRODUCT GRID CONTAINER */}
        <div className="shop-product-grid">
          {(tab === "active" ? activeProducts : soldProducts).map(product => (
            /* PART 1: THE PRODUCT CARD LAYOUT REFINEMENT */
            <div 
              key={product.id}
              onClick={() => onSelectProduct(product)}
              className="shop-product-card"
            >
              {/* Image Block (Top) - 1:1 square aspect ratio */}
              <div className="card-image-wrapper">
                <img src={product.images[0]} alt={product.title} />
                
                {/* PART 2: TOP-CORNER OVERLAYS */}
                {/* Top-Left Corner (Condition) */}
                <span className="condition-tag">
                  {product.condition.toLowerCase().includes("brand new") ? "New" : 
                   product.condition.toLowerCase().includes("like new") ? "Like New" : 
                   "Used"}
                </span>

                {/* Top-Right Corner (Favorites Heart) - PART 4: Contextual Logic */}
                {/* Logic: if (currentUser.id === shopUser.id) { hide heart } */}
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
              
              {/* PART 3: THE TEXT BLOCK (Formatting Below Image) */}
              <div className="card-info">
                {/* 1. Title (Top of text block): Medium dark text, font-weight: 600, 2 lines max */}
                <h4 className="product-title">{product.title}</h4>
                
                {/* 2. Price (Below Title): Large, bold text colored with var(--primary-color) */}
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

function ProfileView({ 
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
  const [uploading, setUploading] = useState(false);

  // Array states (Max 3) and Index Trackers (-1 = new, null = list mode, >=0 = editing)
  const [editingAddrIndex, setEditingAddrIndex] = useState<number | null>(null);
  const [draftAddress, setDraftAddress] = useState({ street: "", city: "", zip: "" });

  const [editingPayIndex, setEditingPayIndex] = useState<number | null>(null);
  const [draftPayment, setDraftPayment] = useState({ cardNumber: "" });

  useEffect(() => {
    if (setIsDirty) {
      setIsDirty(editingAddrIndex !== null || editingPayIndex !== null || showEditModal);
    }
  }, [editingAddrIndex, editingPayIndex, showEditModal, setIsDirty]);

  // Wishlist state (manual list)
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [newWishlistItem, setNewWishlistItem] = useState("");

  const addWishlistItem = () => {
    if (newWishlistItem.trim()) {
      setWishlist([...wishlist, newWishlistItem.trim()]);
      setNewWishlistItem("");
    }
  };

  // Edit Profile Form State
  const [editForm, setEditForm] = useState({
    displayName: profile?.displayName || "",
    school: profile?.school || "Cornell Tech",
    majorInfo: profile?.majorInfo || "Computer Science",
    gradYear: profile?.gradYear || "2026",
    departureDate: profile?.departureDate || "May 2026"
  });

  // Sync editForm when profile or modal visibility changes
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
      const base64 = await compressImage(file, 400, 400, 0.6);
      await onUpdateProfile({ photoURL: base64 });
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

  const campusTransactions = (profile?.salesCount || 0) + (profile?.purchasesCount || 0);

  // Sub-view: Manage My Orders
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

  // Sub-view: My Wishlist
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

  // Sub-view: Favorites
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
                    
                    // If it's the primary address, sync to profile (which triggers modal). Otherwise, trigger modal manually.
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
                        {/* ABSOLUTE TRASH ICON */}
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
                          {/* SILENT UPDATE ON CLICK */}
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
                    
                    // Always trigger success modal when manually saving a card
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
                        {/* ABSOLUTE TRASH ICON */}
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
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-center">
        <h1 className="text-lg font-bold text-text-dark">My Profile</h1>
      </header>

      <div className="max-w-[650px] mx-auto px-4 py-6 space-y-6">
        {/* Profile Identity Card */}
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
            {profile?.isStudent && (
              <div className="flex items-center gap-1 text-primary font-semibold text-xs mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Student
              </div>
            )}
            <div className="text-gray-400 text-xs mt-2 font-medium">
              {profile?.school || "Cornell Tech"} · {profile?.majorInfo || "Computer Science"} · Class of {profile?.gradYear || "2026"}
            </div>
          </div>
        </div>

        {/* Manage My Orders Banner */}
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

        {/* Relocation & Trust Metrics Row */}
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

        {/* Action Menu Cards */}
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
        </div>

        {/* Verification Notification */}
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

        {/* Logout Button */}
        <button 
          onClick={() => setShowLogoutModal(true)}
          className="w-full py-4 bg-red-50 text-red-500 rounded-2xl font-bold text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Log Out
        </button>
      </div>

      {/* Edit Profile Modal */}
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

      {/* Logout Modal */}
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

function UnifiedMessagesView({ 
  rooms, 
  onSelectRoom, 
  selectedRoom,
  currentUser, 
  profile, 
  users, 
  onViewSellerShop,
  products,
  onSelectProduct
}: { 
  key?: string;
  rooms: ChatRoom[], 
  onSelectRoom: (room: ChatRoom) => void, 
  selectedRoom: ChatRoom | null,
  currentUser: FirebaseUser, 
  profile: UserProfile | null, 
  users: Record<string, UserProfile>, 
  onViewSellerShop: (sellerId: string) => void,
  products: Product[],
  onSelectProduct: (p: Product) => void
}) {
  const [chatFilter, setChatFilter] = useState<"all" | "buying" | "selling">("all");
  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6 h-[calc(100vh-80px)] messages-split-container">
      <div className="bg-white rounded-[32px] shadow-xl border border-black/5 flex flex-row h-full overflow-hidden">
        {/* Left Pane: Chat List */}
        <div className="w-[30%] min-w-[300px] border-r border-[#eee] flex flex-col bg-white">
          <div className="p-4 border-b border-gray-50 space-y-4">
            <h2 className="text-xl font-black text-gray-900">Messages</h2>
            {/* NEW FILTER TABS */}
            <div className="flex bg-gray-100 p-1 rounded-xl">
              {(["all", "buying", "selling"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setChatFilter(f)}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-bold rounded-lg capitalize transition-all",
                    chatFilter === f ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {rooms
              .filter(room => {
                const isSeller = products.find(p => p.id === room.productId)?.sellerId === currentUser.uid;
                if (chatFilter === "selling") return isSeller;
                if (chatFilter === "buying") return !isSeller;
                return true;
              })
              .map(room => {
                const otherParticipantId = room.participants.find(id => id !== currentUser.uid);
                const otherUser = otherParticipantId ? users[otherParticipantId] : null;
                const otherUserName = otherUser?.displayName || "User";
                const otherUserAvatar = otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherParticipantId}`;
                const isActive = selectedRoom?.id === room.id;
                
                // Determine Identity
                const isSeller = products.find(p => p.id === room.productId)?.sellerId === currentUser.uid;

                return (
                  <button 
                    key={room.id}
                    onClick={() => onSelectRoom(room)}
                    className={cn(
                      "w-full p-3 rounded-2xl flex items-center gap-3 transition-all text-left group",
                      isActive ? "bg-gray-100" : "hover:bg-gray-50"
                    )}
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 border-2 border-white shadow-sm">
                      <img src={otherUserAvatar} className="w-full h-full object-cover" alt="user" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <h4 className={cn("font-bold truncate text-sm", isActive ? "text-gray-900" : "text-gray-700")}>{otherUserName}</h4>
                        {room.unreadBy?.includes(currentUser.uid) && (
                          <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                        )}
                      </div>
                      {/* IDENTITY BADGE & PRODUCT TITLE */}
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={cn(
                          "text-[8px] font-black uppercase px-1.5 py-0.5 rounded-sm tracking-wider",
                          isSeller ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"
                        )}>
                          {isSeller ? "Selling" : "Buying"}
                        </span>
                        <span className="text-xs text-gray-500 font-medium truncate">{room.productTitle}</span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{room.lastMessage || "No messages yet"}</p>
                    </div>
                  </button>
                );
            })}
            {rooms.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <p className="text-gray-400 text-sm">No conversations yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Active Chat */}
        <div className="flex-1 flex flex-col bg-gray-50/30">
          {selectedRoom ? (
            <ActiveChatPane 
              room={selectedRoom}
              currentUser={currentUser}
              profile={profile}
              users={users}
              onViewSellerShop={onViewSellerShop}
              products={products}
              onSelectProduct={onSelectProduct}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-300 mb-4">
                <MessageSquare className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Select a conversation</h3>
              <p className="text-gray-400 text-sm max-w-[250px]">Choose a chat from the list on the left to start messaging.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActiveChatPane({ 
  room, 
  currentUser, 
  profile, 
  users, 
  onViewSellerShop,
  products,
  onSelectProduct
}: { 
  room: ChatRoom, 
  currentUser: FirebaseUser, 
  profile: UserProfile | null, 
  users: Record<string, UserProfile>, 
  onViewSellerShop: (sellerId: string) => void,
  products: Product[],
  onSelectProduct: (p: Product) => void
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const otherParticipantId = room.participants.find(id => id !== currentUser.uid);
  const otherUser = otherParticipantId ? users[otherParticipantId] : null;
  const otherUserName = otherUser?.displayName || "User";
  const otherUserAvatar = otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherParticipantId}`;

  const product = products.find(p => p.id === room.productId);

  useEffect(() => {
    if (room.unreadBy?.includes(currentUser.uid)) {
      const newUnreadBy = room.unreadBy.filter(id => id !== currentUser.uid);
      updateDoc(doc(db, "chatRooms", room.id), { unreadBy: newUnreadBy })
        .catch(err => console.error("Failed to clear unread status:", err));
    }
  }, [room.id, room.unreadBy, currentUser.uid]);

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
        senderName: profile?.displayName || "Anonymous",
        senderAvatar: profile?.photoURL || "",
        text: newMessage.trim(),
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, "chatRooms", room.id, "messages"), msgData);
      
      const otherParticipants = room.participants.filter(id => id !== currentUser.uid);
      await updateDoc(doc(db, "chatRooms", room.id), {
        lastMessage: newMessage.trim(),
        lastMessageAt: new Date().toISOString(),
        unreadBy: otherParticipants
      });
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100">
            <img src={otherUserAvatar} className="w-full h-full object-cover" alt="user" />
          </div>
          <div>
            <h4 className="font-bold text-gray-900">{otherUserName}</h4>
            <p className="text-[10px] text-green-500 font-bold uppercase tracking-wider">Online</p>
          </div>
        </div>
        <button 
          onClick={() => otherParticipantId && onViewSellerShop(otherParticipantId)}
          className="text-primary text-sm font-bold hover:underline"
        >
          View Shop
        </button>
      </div>

      {/* Product Context Card */}
      {product && (
        <div className="px-6 py-3 bg-white border-b border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-black/5">
            <img src={product.images[0] || "https://picsum.photos/seed/product/100"} className="w-full h-full object-cover" alt="product" />
          </div>
          <div className="flex-1 min-w-0">
            <h5 className="text-sm font-bold text-gray-900 truncate">{product.title}</h5>
            <p className="text-sm font-bold text-primary">${product.price}</p>
          </div>
          <button 
            onClick={() => onSelectProduct(product)}
            className="px-6 py-2 bg-primary text-white text-xs font-bold rounded-full hover:bg-primary-hover transition-all shadow-lg shadow-primary/20"
          >
            {product.sellerId === currentUser.uid ? "View Listing" : "Buy Now"}
          </button>
        </div>
      )}

      {/* Chat History Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-4"
      >
        {messages.map((msg, idx) => {
          const isSystem = msg.senderId === "system";
          const isMe = msg.senderId === currentUser.uid;
          
          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center py-2">
                <span className="bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                  {msg.text}
                </span>
              </div>
            );
          }

          return (
            <div 
              key={msg.id}
              className={cn(
                "flex flex-col max-w-[70%]",
                isMe ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div className={cn(
                "px-4 py-2.5 rounded-2xl text-sm font-medium shadow-sm",
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

      {/* Bottom Input Area */}
      <div className="p-6 bg-white border-t border-gray-100">
        <form onSubmit={handleSend} className="flex gap-3 items-center">
          <input 
            type="text"
            placeholder="Type a message..."
            className="flex-1 bg-gray-100 rounded-full px-6 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
          />
          <button 
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all disabled:opacity-50 disabled:shadow-none"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}

function ChatView({ rooms, onSelectRoom, currentUserId, users }: { key?: string; rooms: ChatRoom[], onSelectRoom: (room: ChatRoom) => void, currentUserId: string, users: Record<string, UserProfile> }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6"
    >
      <h2 className="text-2xl font-black mb-6">Messages</h2>
      {rooms.length > 0 ? (
        <div className="space-y-3">
          {rooms.map(room => {
            const otherParticipantId = room.participants.find(id => id !== currentUserId);
            const otherUser = otherParticipantId ? users[otherParticipantId] : null;
            const otherUserName = otherUser?.displayName || "User";
            const otherUserAvatar = otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherParticipantId}`;

            return (
              <button 
                key={room.id}
                onClick={() => onSelectRoom(room)}
                className="w-full bg-white p-4 rounded-3xl flex items-center gap-4 border border-black/5 shadow-sm hover:bg-gray-50 transition-all text-left relative overflow-hidden"
              >
                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0 relative">
                  <img src={room.productImage || "https://picsum.photos/seed/product/100"} className="w-full h-full object-cover" alt="product" />
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-2 border-white overflow-hidden shadow-sm">
                    <img src={otherUserAvatar} className="w-full h-full object-cover" alt="user" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-gray-900 truncate">{room.productTitle}</h4>
                    {room.unreadBy?.includes(currentUserId) && (
                      <span className="w-2 h-2 bg-yellow-400 rounded-full flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Chatting with {otherUserName}</p>
                  <p className={cn(
                    "text-sm truncate",
                    room.unreadBy?.includes(currentUserId) ? "text-gray-900 font-bold" : "text-gray-500"
                  )}>{room.lastMessage}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">
                    {room.lastMessageAt ? new Date(room.lastMessageAt).toLocaleDateString() : ""}
                  </p>
                </div>
              </button>
            );
          })}
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

function ChatRoomView({ 
  room, 
  onBack, 
  currentUser, 
  profile, 
  users, 
  onViewSellerShop,
  products,
  onSelectProduct
}: { 
  key?: string; 
  room: ChatRoom, 
  onBack: () => void, 
  currentUser: FirebaseUser, 
  profile: UserProfile | null, 
  users: Record<string, UserProfile>, 
  onViewSellerShop: (sellerId: string) => void,
  products: Product[],
  onSelectProduct: (p: Product) => void
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const otherParticipantId = room.participants.find(id => id !== currentUser.uid);
  const otherUser = otherParticipantId ? users[otherParticipantId] : null;
  const otherUserName = otherUser?.displayName || "User";
  const otherUserAvatar = otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherParticipantId}`;

  const product = products.find(p => p.id === room.productId);

  // Clear unread status when room is opened
  useEffect(() => {
    if (room.unreadBy?.includes(currentUser.uid)) {
      const newUnreadBy = room.unreadBy.filter(id => id !== currentUser.uid);
      updateDoc(doc(db, "chatRooms", room.id), { unreadBy: newUnreadBy })
        .catch(err => console.error("Failed to clear unread status:", err));
    }
  }, [room.id, room.unreadBy, currentUser.uid]);

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
        senderName: profile?.displayName || "Anonymous",
        senderAvatar: profile?.photoURL || "",
        text: newMessage.trim(),
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, "chatRooms", room.id, "messages"), msgData);
      
      // Update room with last message and notify other participants
      const otherParticipants = room.participants.filter(id => id !== currentUser.uid);
      await updateDoc(doc(db, "chatRooms", room.id), {
        lastMessage: newMessage.trim(),
        lastMessageAt: new Date().toISOString(),
        unreadBy: otherParticipants
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
      <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100 bg-white sticky top-0 z-40">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-600">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div 
          onClick={() => otherParticipantId && onViewSellerShop(otherParticipantId)}
          className="flex-1 min-w-0 cursor-pointer group"
        >
          <h4 className="font-bold text-gray-900 truncate text-base">{otherUserName}</h4>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Active now</p>
        </div>
        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
          <img src={otherUserAvatar} className="w-full h-full object-cover" alt="user" />
        </div>
      </div>

      {/* Product Context Card */}
      {product && (
        <div className="px-4 py-3 bg-white border-b border-gray-100 shadow-sm flex items-center gap-3 sticky top-[61px] z-30">
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
            <img src={product.images[0] || "https://picsum.photos/seed/product/100"} className="w-full h-full object-cover" alt="product" />
          </div>
          <div className="flex-1 min-w-0">
            <h5 className="text-sm font-bold text-gray-900 truncate">{product.title}</h5>
            <p className="text-sm font-bold text-primary">${product.price}</p>
          </div>
          <button 
            onClick={() => onSelectProduct(product)}
            className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-full hover:bg-primary-hover transition-colors"
          >
            {product.sellerId === currentUser.uid ? "View Listing" : "Make Offer"}
          </button>
        </div>
      )}

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/50 pb-24"
      >
        {messages.map((msg, idx) => {
          const isSystem = msg.senderId === "system";
          const isMe = msg.senderId === currentUser.uid;
          const isFirstInGroup = idx === 0 || messages[idx-1].senderId !== msg.senderId;
          const showName = !isMe && !isSystem && isFirstInGroup;
          
          const sender = users[msg.senderId];
          const senderName = isSystem ? "System" : (sender?.displayName || msg.senderName);
          const senderAvatar = isSystem 
            ? "https://api.dicebear.com/7.x/bottts/svg?seed=system" 
            : (sender?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderId}`);

          if (isSystem) {
            return (
              <div key={msg.id} className="flex flex-col items-center justify-center space-y-2 py-4">
                <div className="bg-yellow-50 border border-yellow-100 rounded-2xl px-6 py-3 max-w-[90%] text-center shadow-sm">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center text-white">
                      <Bell className="w-3 h-3" />
                    </div>
                    <span className="text-[10px] font-black text-yellow-600 uppercase tracking-widest">System Notification</span>
                  </div>
                  <p className="text-sm font-bold text-gray-800 leading-relaxed">{msg.text}</p>
                </div>
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          }

          return (
            <div 
              key={msg.id}
              className={cn(
                "flex gap-3 max-w-[85%]",
                isMe ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 mt-1">
                <img src={senderAvatar} className="w-full h-full object-cover" alt="avatar" />
              </div>
              
              <div className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                {showName && (
                  <span className="text-[10px] font-bold text-gray-500 mb-1 ml-1">
                    {senderName}
                  </span>
                )}
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
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 z-40 max-w-[650px] mx-auto">
        <form onSubmit={handleSend} className="flex gap-2 items-center">
          <input 
            type="text"
            placeholder="Type a message..."
            className="flex-1 bg-gray-100 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
          />
          <button 
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all disabled:opacity-50 disabled:shadow-none"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </motion.div>
  );
}

function FavoritesView({ 
  products, 
  users,
  onSelectProduct,
  favorites,
  onToggleFavorite,
  onViewSellerShop
}: { 
  key?: string;
  products: Product[], 
  users: Record<string, UserProfile>,
  onSelectProduct: (p: Product) => void,
  favorites: string[],
  onToggleFavorite: (id: string) => void,
  onViewSellerShop: (sellerId: string) => void
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
              users={users}
              onClick={() => onSelectProduct(product)}
              isFavorite={favorites.includes(product.id)}
              onToggleFavorite={onToggleFavorite}
              onViewSellerShop={onViewSellerShop}
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
    { icon: Info, label: "About Relo", color: "text-orange-500", bg: "bg-orange-50" },
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
            <img src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.uid}`} className="w-12 h-12 rounded-2xl object-cover" alt="profile" />
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

function NavButton({ icon: Icon, active, onClick, badgeCount }: { icon: any, active: boolean, onClick: () => void, badgeCount?: number }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-2 transition-all rounded-xl relative",
        active ? "text-primary bg-primary/5" : "text-gray-400 hover:text-gray-600"
      )}
    >
      <Icon className={cn("w-6 h-6", active && "fill-current")} />
      {badgeCount !== undefined && badgeCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white px-1">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
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
