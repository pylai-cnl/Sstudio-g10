import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, PenTool, CheckCircle, XCircle } from "lucide-react";
import { User as FirebaseUser } from "firebase/auth";
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { ChatRoom, Message, Product, UserProfile } from "../types";
import { cn } from "../utils/classNames";

export interface UnifiedMessagesViewProps {
  key?: string;
  rooms: ChatRoom[];
  onSelectRoom: (room: ChatRoom) => void;
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
  
  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6 h-[calc(100vh-80px)] messages-split-container">
      <div className="bg-white rounded-[32px] shadow-xl border border-black/5 flex flex-row h-full overflow-hidden">
        {/* Sidebar */}
        <div className="w-[30%] min-w-[300px] border-r border-[#eee] flex flex-col bg-white">
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
                const otherUserName = otherUser?.displayName || "User";
                const otherUserAvatar = otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherParticipantId}`;
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
                      <img src={otherUserAvatar} className="w-full h-full object-cover" alt="user" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <h4 className={cn("font-bold truncate text-sm", isActive ? "text-gray-900" : "text-gray-700")}>{otherUserName}</h4>
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
            {rooms.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <p className="text-gray-400 text-sm">No conversations yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Active Chat Pane */}
        <div className="flex-1 flex flex-col bg-gray-50/30 relative">
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

  // Edit Proposal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', price: '', description: '' });

  const otherParticipantId = room.participants.find(id => id !== currentUser.uid);
  const otherUser = otherParticipantId ? users[otherParticipantId] : null;
  const otherUserName = otherUser?.displayName || "User";
  const otherUserAvatar = otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherParticipantId}`;

  const product = products.find(p => p.id === room.productId);
  const isSeller = product?.sellerId === currentUser.uid;
  const isPending = product?.status === "Pending";

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

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const msgData: Partial<Message> = {
        senderId: currentUser.uid,
        senderName: profile?.displayName || "Anonymous",
        senderAvatar: profile?.photoURL || "",
        text: newMessage.trim(),
        type: "text",
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

  const openEditModal = () => {
    if (product) {
      setEditForm({ title: product.title, price: product.price.toString(), description: product.description });
      setShowEditModal(true);
    }
  };

  const handleProposeEdit = async () => {
    if (!editForm.title || !editForm.price || !editForm.description) return;
    setSending(true);
    try {
      const msgData: Partial<Message> = {
        senderId: currentUser.uid,
        senderName: profile?.displayName || "Seller",
        text: "I proposed a modification to the order details. Please review.",
        type: "edit_request",
        proposedEdits: {
          title: editForm.title,
          price: parseFloat(editForm.price),
          description: editForm.description
        },
        requestStatus: "pending",
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, "chatRooms", room.id, "messages"), msgData);
      
      const otherParticipants = room.participants.filter(id => id !== currentUser.uid);
      await updateDoc(doc(db, "chatRooms", room.id), {
        lastMessage: "Modification requested",
        lastMessageAt: new Date().toISOString(),
        unreadBy: otherParticipants
      });
      setShowEditModal(false);
    } catch (error) {
      console.error("Failed to send edit proposal:", error);
    } finally {
      setSending(false);
    }
  };

  const handleAcceptEdit = async (msg: Message) => {
    if (!product || !msg.proposedEdits) return;
    try {
      // 买家同意，由于我们在 Rules 里加了放行，这里可以直接修改商品主表
      await updateDoc(doc(db, "products", product.id), msg.proposedEdits);
      // 更新该条聊天记录状态为通过
      await updateDoc(doc(db, "chatRooms", room.id, "messages", msg.id), { requestStatus: "approved" });
      
      // 发送系统通知
      await addDoc(collection(db, "chatRooms", room.id, "messages"), {
        senderId: "system",
        text: "Buyer approved the product modifications. Order details updated.",
        type: "system",
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to accept edit", err);
    }
  };

  const handleRejectEdit = async (msg: Message) => {
    try {
      await updateDoc(doc(db, "chatRooms", room.id, "messages", msg.id), { requestStatus: "rejected" });
      await addDoc(collection(db, "chatRooms", room.id, "messages"), {
        senderId: "system",
        text: "Buyer rejected the proposed modifications.",
        type: "system",
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to reject edit", err);
    }
  };

  return (
    <div className="flex flex-col h-full relative">
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

      {product && (
        <div className="px-6 py-3 bg-white border-b border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-black/5">
            <img src={product.images[0] || "https://picsum.photos/seed/product/100"} className="w-full h-full object-cover" alt="product" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h5 className="text-sm font-bold text-gray-900 truncate">{product.title}</h5>
              {isPending && <span className="bg-yellow-100 text-yellow-700 text-[10px] px-2 py-0.5 rounded-full font-black uppercase">Pending</span>}
            </div>
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

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-4"
      >
        {messages.map((msg) => {
          const isSystem = msg.senderId === "system" || msg.type === "system";
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

          // 渲染编辑请求的特殊卡片
          if (msg.type === "edit_request") {
            return (
              <div key={msg.id} className={cn("flex w-full", isMe ? "justify-end" : "justify-start")}>
                <div className={cn("bg-orange-50 border border-orange-200 rounded-2xl p-4 w-[85%] max-w-[320px] shadow-sm", isMe ? "rounded-tr-none" : "rounded-tl-none")}>
                  <div className="flex items-center gap-1.5 mb-3">
                    <PenTool className="w-4 h-4 text-orange-600" />
                    <h4 className="font-bold text-orange-800 text-sm">Modification Request</h4>
                  </div>
                  <div className="bg-white/60 rounded-xl p-3 text-xs text-gray-700 space-y-1.5 mb-3 border border-orange-100">
                    {msg.proposedEdits?.title && <p><span className="text-gray-400 font-bold">Title:</span> {msg.proposedEdits.title}</p>}
                    {msg.proposedEdits?.price && <p><span className="text-gray-400 font-bold">Price:</span> ${msg.proposedEdits.price}</p>}
                    {msg.proposedEdits?.description && <p className="line-clamp-2"><span className="text-gray-400 font-bold">Desc:</span> {msg.proposedEdits.description}</p>}
                  </div>
                  
                  {msg.requestStatus === "pending" && !isMe && (
                     <div className="flex gap-2">
                       <button onClick={() => handleAcceptEdit(msg)} className="flex-1 bg-orange-500 text-white rounded-lg py-2 text-xs font-bold shadow-md hover:bg-orange-600 transition-colors flex items-center justify-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Accept</button>
                       <button onClick={() => handleRejectEdit(msg)} className="flex-1 bg-white border border-orange-200 text-orange-600 rounded-lg py-2 text-xs font-bold hover:bg-orange-100 transition-colors flex items-center justify-center gap-1"><XCircle className="w-3.5 h-3.5" /> Reject</button>
                     </div>
                  )}
                  {msg.requestStatus === "pending" && isMe && (
                     <p className="text-xs text-orange-500 font-bold text-center italic">Waiting for buyer to review...</p>
                  )}
                  {msg.requestStatus === "approved" && <p className="text-xs text-green-600 font-bold text-center bg-green-100 py-1.5 rounded-lg">✅ Approved and Applied</p>}
                  {msg.requestStatus === "rejected" && <p className="text-xs text-red-500 font-bold text-center bg-red-100 py-1.5 rounded-lg">❌ Rejected by Buyer</p>}
                </div>
              </div>
            );
          }

          // 普通文本消息
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

      <div className="p-4 bg-white border-t border-gray-100 flex flex-col gap-2">
        <form onSubmit={handleSendText} className="flex gap-3 items-center">
          <input 
            type="text"
            placeholder="Type a message..."
            className="flex-1 bg-gray-100 rounded-full px-6 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
          />
          <button 
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all disabled:opacity-50 disabled:shadow-none"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        
        {isSeller && isPending && (
          <div className="flex justify-start pl-2">
             <button type="button" onClick={openEditModal} className="text-[10px] font-bold text-orange-500 hover:bg-orange-50 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 border border-orange-200">
               <PenTool className="w-3 h-3" /> Propose Edit to Buyer
             </button>
          </div>
        )}
      </div>

      {/* 提议修改弹窗 */}
      {showEditModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
           <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl">
             <h3 className="text-lg font-black text-gray-900 mb-1">Propose Edit</h3>
             <p className="text-xs text-gray-500 mb-4">Send a request to the buyer to modify order details.</p>
             
             <div className="space-y-3">
               <div>
                 <label className="text-[10px] font-bold text-gray-400 uppercase">Title</label>
                 <input className="input-field py-2" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
               </div>
               <div>
                 <label className="text-[10px] font-bold text-gray-400 uppercase">Price ($)</label>
                 <input type="number" className="input-field py-2" value={editForm.price} onChange={e => setEditForm({...editForm, price: e.target.value})} />
               </div>
               <div>
                 <label className="text-[10px] font-bold text-gray-400 uppercase">Description</label>
                 <textarea rows={3} className="input-field py-2 resize-none" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
               </div>
             </div>

             <div className="flex gap-2 mt-6">
               <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 bg-gray-50 text-gray-500 rounded-xl font-bold text-xs hover:bg-gray-100">Cancel</button>
               <button onClick={handleProposeEdit} disabled={sending} className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-bold text-xs shadow-md shadow-orange-500/20 hover:bg-orange-600 disabled:opacity-50">
                 {sending ? "Sending..." : "Send Request"}
               </button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
}