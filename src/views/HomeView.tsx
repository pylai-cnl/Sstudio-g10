import React from "react";
import { motion } from "motion/react";
import { cn } from "../utils/classNames";
import ProductCard from "../components/ProductCard";
import { Product, UserProfile } from "../types";
import { CATEGORIES } from "../utils/constants";

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