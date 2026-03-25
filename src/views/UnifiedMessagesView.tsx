import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, ChevronLeft } from "lucide-react";
import { User as FirebaseUser } from "firebase/auth";
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { ChatRoom, Message, Product, UserProfile } from "../types";
import { cn } from "../utils/classNames";

export interface UnifiedMessagesViewProps {
  rooms: ChatRoom[];
  onSelectRoom: (room: ChatRoom | null) => void;
  selectedRoom: ChatRoom | null;
  currentUser: FirebaseUser;
  profile: UserProfile | null;
  users: Record<string, UserProfile>;
  onViewSellerShop: (sellerId: string) => void;
  products: Product[];
  onSelectProduct: (p: Product) => void;
}

export default function UnifiedMessagesView({ 
  rooms, 
  onSelectRoom, 
  selectedRoom,
  currentUser, 
  profile, 
  users, 
  onViewSellerShop,
  products,
  onSelectProduct
}: UnifiedMessagesViewProps) {
  const [chatFilter, setChatFilter] = useState<"all" | "buying" | "selling">("all");
  
  const isMobileDetailOpen = !!selectedRoom;

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6 h-[calc(100vh-80px)] messages-split-container">
      <div className="bg-white rounded-[32px] shadow-xl border border-black/5 flex flex-row h-full overflow-hidden relative">

        <div className={cn(
          "w-full md:w-[30%] md:min-w-[300px] border-r border-[#eee] flex flex-col bg-white transition-all",
          isMobileDetailOpen ? "hidden md:flex" : "flex"
        )}>
          <div className="p-4 border-b border-gray-50 space-y-4">
            <h2 className="text-xl font-black text-gray-900">Messages</h2>
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
                const isActive = selectedRoom?.id === room.id;
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
                      <img 
                        src={otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherParticipantId}`} 
                        className="w-full h-full object-cover" 
                        alt="user" 
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <h4 className={cn("font-bold truncate text-sm", isActive ? "text-gray-900" : "text-gray-700")}>
                          {otherUser?.displayName || "User"}
                        </h4>
                        {room.unreadBy?.includes(currentUser.uid) && (
                          <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                        )}
                      </div>
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
          </div>
        </div>

        {/* Active Chat Pane - 在手機端若未選中房間則隱藏 */}
        <div className={cn(
          "flex-1 flex flex-col bg-gray-50/30 transition-all",
          !isMobileDetailOpen ? "hidden md:flex" : "flex"
        )}>
          {selectedRoom ? (
            <ActiveChatPane 
              room={selectedRoom}
              onBack={() => onSelectRoom(null)}
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
  room, onBack, currentUser, profile, users, onViewSellerShop, products, onSelectProduct 
}: { 
  room: ChatRoom, onBack: () => void, currentUser: FirebaseUser, profile: UserProfile | null, users: Record<string, UserProfile>, onViewSellerShop: (sid: string) => void, products: Product[], onSelectProduct: (p: Product) => void 
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const otherParticipantId = room.participants.find(id => id !== currentUser.uid);
  const otherUser = otherParticipantId ? users[otherParticipantId] : null;
  const product = products.find(p => p.id === room.productId);

  useEffect(() => {
    if (room.unreadBy?.includes(currentUser.uid)) {
      updateDoc(doc(db, "chatRooms", room.id), { 
        unreadBy: room.unreadBy.filter(id => id !== currentUser.uid) 
      }).catch(err => console.error(err));
    }
  }, [room.id, room.unreadBy, currentUser.uid]);

  useEffect(() => {
    const q = query(collection(db, "chatRooms", room.id, "messages"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
    });
  }, [room.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, "chatRooms", room.id, "messages"), {
        senderId: currentUser.uid,
        senderName: profile?.displayName || "Anonymous",
        senderAvatar: profile?.photoURL || "",
        text: newMessage.trim(),
        createdAt: now
      });
      await updateDoc(doc(db, "chatRooms", room.id), {
        lastMessage: newMessage.trim(),
        lastMessageAt: now,
        unreadBy: room.participants.filter(id => id !== currentUser.uid)
      });
      setNewMessage("");
    } catch (error) { console.error(error); } finally { setSending(false); }
  };

  return (
    <div className="flex flex-col h-full relative">
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          {/* 手機端返回按鈕 */}
          <button onClick={onBack} className="md:hidden p-1 -ml-2 text-gray-500">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100">
            <img src={otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherParticipantId}`} className="w-full h-full object-cover" alt="user" />
          </div>
          <div>
            <h4 className="font-bold text-gray-900">{otherUser?.displayName || "User"}</h4>
            <p className="text-[10px] text-green-500 font-bold uppercase tracking-wider">Online</p>
          </div>
        </div>
        <button onClick={() => otherParticipantId && onViewSellerShop(otherParticipantId)} className="text-primary text-sm font-bold hover:underline">View Shop</button>
      </div>

      {product && (
        <div className="px-6 py-3 bg-white border-b border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-black/5">
            <img src={product.images[0]} className="w-full h-full object-cover" alt="product" />
          </div>
          <div className="flex-1 min-w-0">
            <h5 className="text-sm font-bold text-gray-900 truncate">{product.title}</h5>
            <p className="text-sm font-bold text-primary">${product.price}</p>
          </div>
          <button onClick={() => onSelectProduct(product)} className="px-6 py-2 bg-primary text-white text-xs font-bold rounded-full shadow-lg shadow-primary/20">
            {product.sellerId === currentUser.uid ? "View Listing" : "Buy Now"}
          </button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex flex-col max-w-[70%]", msg.senderId === currentUser.uid ? "ml-auto items-end" : "mr-auto items-start")}>
            <div className={cn("px-4 py-2.5 rounded-2xl text-sm font-medium shadow-sm", msg.senderId === currentUser.uid ? "bg-primary text-white rounded-tr-none" : "bg-white text-gray-800 rounded-tl-none border border-black/5")}>
              {msg.text}
            </div>
            <span className="text-[9px] text-gray-400 mt-1 px-1">
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>

      <div className="p-6 bg-white border-t border-gray-100">
        <form onSubmit={handleSend} className="flex gap-3 items-center">
          <input 
            type="text" placeholder="Type a message..."
            className="flex-1 bg-gray-100 rounded-full px-6 py-3.5 text-sm outline-none"
            value={newMessage} onChange={e => setNewMessage(e.target.value)}
          />
          <button type="submit" disabled={!newMessage.trim() || sending} className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/20">
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}