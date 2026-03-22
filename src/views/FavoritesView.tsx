import React from "react";
import { motion } from "motion/react";
import { Heart as HeartIcon } from "lucide-react";
import { Product, UserProfile } from "../types";
import ProductCard from "../components/ProductCard";

export interface FavoritesViewProps {
  key?: string;
  products: Product[];
  users: Record<string, UserProfile>;
  onSelectProduct: (p: Product) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onViewSellerShop: (sellerId: string) => void;
}

export default function FavoritesView({ 
  products, 
  users,
  onSelectProduct,
  favorites,
  onToggleFavorite,
  onViewSellerShop
}: FavoritesViewProps) {
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