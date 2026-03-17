export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  isStudent?: boolean;
  dormLocation?: string;
  transactionCount?: number;
  favorites?: string[];
}

export interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: string;
  productId: string;
  productTitle: string;
  productImage: string;
}

export interface Message {
  id: string;
  senderId: string;
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
  sellerTransactionCount?: number;
  dormLocation: string;
  departureDate: string;
  referenceLink?: string;
  status: "Still on" | "Pending" | "Delivered" | "Completed" | "Sold";
  buyerId?: string;
  buyerName?: string;
  deliveredAt?: string;
  completedAt?: string;
  createdAt: string;
}

export type View = "home" | "sell" | "profile" | "favorites" | "chat" | "chat_room" | "detail" | "settings" | "orders";
