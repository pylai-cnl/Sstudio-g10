export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  isStudent?: boolean;
  isAdmin?: boolean;
  dormLocation?: string;
  departureDate?: string;
  salesCount?: number;
  purchasesCount?: number;
  followersCount?: number;
  following?: string[];
  avgResponseTime?: string;
  favorites?: string[];
  cart?: string[];
  bio?: string;
  majorInfo?: string;
  school?: string;
  gradYear?: string;
  meetupLocation?: string;
  willingToDeliver?: boolean;
  address?: {
    street: string;
    city: string;
    zip: string;
  };
  payment?: {
    cardNumber: string;
  };
  paymentMethods?: {
    cardHolder: string;
    cardNumber: string;
    expiry: string;
    cvv: string;
  }[];
  wishlist?: {
    id: string;
    title: string;
    price: number;
  }[];
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
  type?: "text" | "system" | "edit_request";
  proposedEdits?: Partial<Product>;
  requestStatus?: "pending" | "approved" | "rejected";
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
  // NEW: 加入了 Shipped 状态
  status: "Still on" | "Pending" | "Shipped" | "Delivered" | "Completed" | "Sold";
  buyerId?: string;
  buyerName?: string;
  deliveredAt?: string;
  completedAt?: string;
  createdAt: string;
  sellerNotified?: boolean;
  // NEW: 物流跟踪字段
  trackingInfo?: string;
  shippedAt?: string;
}

export type View = "home" | "sell" | "profile" | "favorites" | "chat" | "chat_room" | "detail" | "settings" | "orders" | "cart" | "seller_shop" | "platform_buy" | "admin";