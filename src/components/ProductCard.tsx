import React from "react";
import { Camera, MapPin, Calendar, Heart as HeartIcon } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../utils/classNames";
import { Product, UserProfile } from "../types";

export interface ProductCardProps {
  key?: string;
  product: Product;
  users: Record<string, UserProfile>;
  onClick: () => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onViewSellerShop: (sellerId: string) => void;
}

export default function ProductCard({ product, users, onClick, isFavorite, onToggleFavorite, onViewSellerShop }: ProductCardProps) {
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