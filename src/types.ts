export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  isStudent?: boolean;
  dormLocation?: string;
  salesCount?: number;
  purchasesCount?: number;
  followersCount?: number;
  avgResponseTime?: string;
  favorites?: string[];
  cart?: string[];
  bio?: string;
  majorInfo?: string;
}

export interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: string;
  productId: string;
  productTitle: string;
  productImage: string;
  unreadBy?: string[];
}

export interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  text: string;
  createdAt: string;
}

export interface Product {
  id: string;
  title: string;
  price: number;
  category: string;
  condition: string;
  description: string;
  images: string[];
  sellerId: string;
  sellerName: string;
  sellerAvatar?: string;
  sellerIsStudent?: boolean;
  sellerSalesCount?: number;
  sellerPurchasesCount?: number;
  dormLocation: string;
  departureDate: string;
  referenceLink?: string;
  status: "Still on" | "Pending" | "Delivered" | "Completed" | "Sold";
  buyerId?: string;
  buyerName?: string;
  deliveredAt?: string;
  completedAt?: string;
  createdAt: string;
  sellerNotified?: boolean;
}

export type View = "home" | "sell" | "profile" | "favorites" | "chat" | "chat_room" | "detail" | "settings" | "orders" | "cart" | "seller_shop";
