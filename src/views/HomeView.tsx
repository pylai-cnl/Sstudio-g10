import React from "react";
import { motion } from "motion/react";
import { cn } from "../utils/classNames";
import ProductCard from "../components/ProductCard";
import { Product, UserProfile } from "../types";
import { CATEGORIES } from "../utils/constants";
import { ShieldCheck } from "lucide-react"; // 【新增】：引入管理员金标图标

export interface HomeViewProps {
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

export default function HomeView({ 
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
      <div className="flex gap-2 overflow-x-auto pb-4 mb-4 -mx-4 px-4 cursor-grab active:cursor-grabbing scroll-smooth hide-scrollbar">
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

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {products.length > 0 ? (
          products.map(product => (
            <div key={product.id} className="relative group">
              <ProductCard 
                product={product} 
                users={users}
                onClick={() => onSelectProduct(product)}
                isFavorite={favorites.includes(product.id)}
                onToggleFavorite={onToggleFavorite}
                onViewSellerShop={onViewSellerShop}
              />
              {/* 【核心注入】：如果卖家是 Admin，直接在卡片上悬浮官方认证金标 */}
              {users[product.sellerId]?.isAdmin && (
                <div className="absolute top-2 left-2 bg-orange-500 text-white px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1 z-10 shadow-md pointer-events-none">
                  <ShieldCheck className="w-3 h-3" /> Official Relo
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="col-span-2 py-20 text-center text-gray-400 font-medium">
            No items found in this category.
          </div>
        )}
      </div>
    </motion.div>
  );
}