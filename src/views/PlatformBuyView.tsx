import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Camera, Trash2, ChevronLeft, Store, ShieldCheck, MapPin, 
  Calendar, Truck, Plus, Clock, DollarSign, AlertCircle, 
  CheckCircle, Recycle, XCircle, CalendarClock, Pencil
} from "lucide-react";
import { collection, addDoc, query, where, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { UserProfile } from "../types";
import { cn } from "../utils/classNames";

export interface PlatformBuyViewProps {
  key?: string;
  onSuccess: () => void;
  onBack: () => void;
  profile: UserProfile | null;
  showAlert: (title: string, message: string) => void;
}

interface AcquisitionRequest {
  id: string; itemName: string; originalPrice: number; condition: string; moveOutDate: string;
  address: string; logisticsNote: string; description: string; images: string[]; sellerId: string;
  sellerName?: string; sellerEmail?: string;
  status: "Pending Evaluation" | "Offer Made" | "Rejected" | "Accepted" | "Declined" | "Free Recycle" | "Cancelled";
  offerPrice?: number; createdAt: string;
}

export default function PlatformBuyView({ onSuccess, onBack, profile, showAlert }: PlatformBuyViewProps) {
  const [viewMode, setViewMode] = useState<"dashboard" | "form">("dashboard");
  const [requests, setRequests] = useState<AcquisitionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // 【核心拦截】：如果是管理员，切换为上帝视角模式
  const isSuperAdmin = profile?.email === "relo@relo.com" || profile?.isAdmin;
  const [adminOfferPrices, setAdminOfferPrices] = useState<Record<string, string>>({});

  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [progress, setProgress] = useState(0);
  const [isValidDate, setIsValidDate] = useState(true);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [tempDate, setTempDate] = useState("");
  const [savingDate, setSavingDate] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { if (profile?.departureDate) setTempDate(profile.departureDate); }, [profile?.departureDate]);

  useEffect(() => {
    if (!profile?.departureDate) { setIsValidDate(false); return; }
    const testDate = new Date(profile.departureDate).getTime();
    if (isNaN(testDate)) { setIsValidDate(false); return; }
    setIsValidDate(true);

    const timer = setInterval(() => {
      const now = new Date().getTime();
      let targetTime = new Date(profile.departureDate).getTime();
      if (profile.departureDate.includes('-')) {
        const endOfDay = new Date(`${profile.departureDate}T23:59:59`).getTime();
        if (!isNaN(endOfDay)) targetTime = endOfDay;
      }
      const difference = targetTime - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)), hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)), seconds: Math.floor((difference % (1000 * 60)) / 1000)
        });
        setProgress(Math.max(0, Math.min(100, (difference / (180 * 24 * 60 * 60 * 1000)) * 100)));
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 }); setProgress(0);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [profile?.departureDate]);

  const handleSaveInlineDate = async () => {
    if (!profile) return;
    if (!tempDate) return showAlert("Missing Date", "Please select a date first.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tempDate)) return showAlert("Invalid Format", "Please use the calendar selector.");
    setSavingDate(true);
    try { await updateDoc(doc(db, "users", profile.uid), { departureDate: tempDate }); setIsEditingDate(false); setFormData(prev => ({ ...prev, moveOutDate: tempDate })); } 
    catch (error) { showAlert("Error", "Failed to update date."); } finally { setSavingDate(false); }
  };

  useEffect(() => {
    if (!profile) return;
    // 【上帝视角】：管理员拉取全站数据，普通人只看自己
    const q = isSuperAdmin
      ? query(collection(db, "platform_acquisitions"))
      : query(collection(db, "platform_acquisitions"), where("sellerId", "==", profile.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AcquisitionRequest[];
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRequests(data); setLoading(false);
    }, (error) => { console.error(error); setLoading(false); });

    return unsubscribe;
  }, [profile, isSuperAdmin]);

  const handleUpdateStatus = async (id: string, newStatus: AcquisitionRequest["status"]) => {
    try { await updateDoc(doc(db, "platform_acquisitions", id), { status: newStatus }); } 
    catch (error: any) { showAlert("Error", "Failed to update status."); }
  };

  const renderRequestCard = (req: AcquisitionRequest) => {
    return (
      <div key={req.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-4">
        <div className="flex gap-4 mb-4">
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-black/5"><img src={req.images[0]} className="w-full h-full object-cover" alt="item" /></div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 truncate">{req.itemName}</h3>
            <p className="text-xs text-gray-400 mt-1">Purchased for ${req.originalPrice}</p>
            <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">{new Date(req.createdAt).toLocaleDateString()}</p>
            
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
              {req.status === "Pending Evaluation" && <span className="bg-yellow-100 text-yellow-700 flex items-center gap-1 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> Evaluating</span>}
              {req.status === "Offer Made" && <span className="bg-green-100 text-green-700 flex items-center gap-1 px-2 py-0.5 rounded-full"><DollarSign className="w-3 h-3" /> Action Required</span>}
              {req.status === "Rejected" && <span className="bg-red-100 text-red-600 flex items-center gap-1 px-2 py-0.5 rounded-full"><AlertCircle className="w-3 h-3" /> Rejected</span>}
              {req.status === "Accepted" && <span className="bg-blue-100 text-blue-600 flex items-center gap-1 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3" /> Scheduled</span>}
              {req.status === "Free Recycle" && <span className="bg-teal-100 text-teal-700 flex items-center gap-1 px-2 py-0.5 rounded-full"><Recycle className="w-3 h-3" /> Free Recycle</span>}
              {req.status === "Declined" && <span className="bg-gray-100 text-gray-500 flex items-center gap-1 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> Closed</span>}
              {req.status === "Cancelled" && <span className="bg-gray-100 text-gray-500 flex items-center gap-1 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> Cancelled</span>}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-3">
          {/* 【超管指挥面板】：可以查看用户详细信息并操作 */}
          {isSuperAdmin && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-3 shadow-inner">
              <div className="flex items-center gap-2 mb-2 border-b border-orange-200/50 pb-2">
                 <ShieldCheck className="w-4 h-4 text-orange-500" />
                 <span className="text-[10px] font-black text-orange-800 uppercase tracking-widest">Admin Command</span>
              </div>
              <div className="text-xs text-orange-900/80 mb-4 space-y-1">
                <p><strong className="text-orange-900">Seller:</strong> {req.sellerName || "Unknown"} ({req.sellerEmail || "No email"})</p>
                <p><strong className="text-orange-900">Move Out:</strong> {req.moveOutDate}</p>
                <p><strong className="text-orange-900">Logistics:</strong> {req.logisticsNote}</p>
                <p><strong className="text-orange-900">Address:</strong> {req.address}</p>
                <p className="mt-1"><strong className="text-orange-900">Desc:</strong> {req.description}</p>
              </div>
              
              {req.status === "Pending Evaluation" && (
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <div className="relative flex-1 w-full">
                    <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="number" placeholder="Offer Price" className="w-full pl-8 pr-3 py-2 rounded-lg border border-orange-200 text-sm focus:ring-2 focus:ring-orange-500/20" value={adminOfferPrices[req.id] || ""} onChange={e => setAdminOfferPrices(prev => ({...prev, [req.id]: e.target.value}))} />
                  </div>
                  <button onClick={async () => {
                      const price = parseFloat(adminOfferPrices[req.id]);
                      if(isNaN(price)) return showAlert("Invalid", "Please enter a valid number for the price.");
                      try { await updateDoc(doc(db, "platform_acquisitions", req.id), { status: "Offer Made", offerPrice: price }); showAlert("Offer Sent!", `You offered $${price}.`); } 
                      catch(e) { showAlert("Error", "Failed to send offer"); }
                    }} className="w-full sm:w-auto bg-orange-500 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-orange-600 transition-colors shrink-0">
                    Send Offer
                  </button>
                  <button onClick={() => handleUpdateStatus(req.id, "Rejected")} className="w-full sm:w-auto bg-white border border-red-200 text-red-500 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors shrink-0">
                    Reject
                  </button>
                </div>
              )}
              {req.status === "Accepted" && <button onClick={() => handleUpdateStatus(req.id, "Declined")} className="w-full bg-black text-white py-2 rounded-lg text-xs font-bold mt-2 hover:bg-gray-800">Mark Pickup Completed & Close</button>}
              {req.status === "Free Recycle" && <button onClick={() => handleUpdateStatus(req.id, "Declined")} className="w-full bg-teal-600 text-white py-2 rounded-lg text-xs font-bold mt-2 hover:bg-teal-700">Mark Free Recycle Completed</button>}
            </div>
          )}

          {req.status === "Pending Evaluation" && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-gray-500 text-center sm:text-left italic">Our team is reviewing your item. Please check back within 24 hours.</p>
              {!isSuperAdmin && <button onClick={() => { if(window.confirm("Are you sure you want to cancel this request?")) handleUpdateStatus(req.id, "Cancelled"); }} className="text-[10px] uppercase tracking-widest font-bold text-red-500 hover:text-red-600 px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg transition-colors w-full sm:w-auto shrink-0">Cancel Request</button>}
            </div>
          )}
          {req.status === "Offer Made" && !isSuperAdmin && (
            <div className="space-y-3">
              <div className="text-center"><p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Relo Offer</p><p className="text-3xl font-black text-green-500">${req.offerPrice}</p></div>
              <div className="flex gap-2">
                <button onClick={() => handleUpdateStatus(req.id, "Accepted")} className="flex-1 bg-black text-white py-2.5 rounded-xl text-xs font-bold hover:bg-gray-800 transition-all shadow-md">Accept Offer</button>
                <button onClick={() => handleUpdateStatus(req.id, "Declined")} className="flex-1 bg-white border border-gray-200 text-gray-600 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all">Decline</button>
              </div>
            </div>
          )}
          {req.status === "Rejected" && !isSuperAdmin && (
            <div className="space-y-3">
              <p className="text-xs text-red-500 text-center font-medium">Unfortunately, this item does not meet our buyout criteria. However, we can help you dispose of it.</p>
              <div className="flex gap-2">
                <button onClick={() => handleUpdateStatus(req.id, "Free Recycle")} className="flex-1 bg-teal-500 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-teal-600 transition-all shadow-md flex items-center justify-center gap-1.5"><Recycle className="w-4 h-4" /> Recycle for Free</button>
                <button onClick={() => handleUpdateStatus(req.id, "Declined")} className="flex-1 bg-white border border-gray-200 text-gray-600 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all">I'll handle it</button>
              </div>
            </div>
          )}
          {req.status === "Accepted" && !isSuperAdmin && <p className="text-xs text-blue-600 text-center font-bold">Great! Our logistics team will email you to confirm the pickup time.</p>}
          {req.status === "Free Recycle" && !isSuperAdmin && <p className="text-xs text-teal-600 text-center font-bold">Free recycling scheduled. We will email you the pickup details.</p>}
          {req.status === "Declined" && !isSuperAdmin && <p className="text-xs text-gray-400 text-center italic">This request has been closed.</p>}
          {req.status === "Cancelled" && !isSuperAdmin && <p className="text-xs text-gray-400 text-center italic">You have successfully cancelled this request.</p>}
        </div>
      </div>
    );
  };

  const [formData, setFormData] = useState({ itemName: "", originalPrice: "", condition: "Used - Good", moveOutDate: "", address: "", logisticsNote: "Elevator available", description: "" });
  const [images, setImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (profile) setFormData(prev => ({ ...prev, moveOutDate: prev.moveOutDate || profile.departureDate || "", address: prev.address || profile.dormLocation || "" })); }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return showAlert("System Error", "User profile not loaded.");
    if (images.length === 0) return showAlert("Missing Photos", "Please upload photos.");
    setUploading(true);
    try {
      const imageUrls = await Promise.all(images.map(async (file) => { const storageRef = ref(storage, `platform_buys/${profile.uid}_${Date.now()}_${file.name}`); await uploadBytes(storageRef, file); return await getDownloadURL(storageRef); }));
      const originalPriceNum = parseFloat(formData.originalPrice);
      if (isNaN(originalPriceNum)) { setUploading(false); return showAlert("Invalid Price", "Valid number required."); }
      const acquisitionPayload = {
        itemName: formData.itemName || "", originalPrice: originalPriceNum, condition: formData.condition || "Used - Good", moveOutDate: formData.moveOutDate || "",
        address: formData.address || "", logisticsNote: formData.logisticsNote || "", description: formData.description || "", images: imageUrls,
        sellerId: profile.uid, sellerEmail: profile.email || "", sellerName: profile.displayName || "Anonymous", status: "Pending Evaluation", createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, "platform_acquisitions"), acquisitionPayload);
      showAlert("Request Submitted!", "Our team will evaluate your item and send an offer soon.");
      setImages([]); setFormData(prev => ({ ...prev, itemName: "", originalPrice: "", description: "" })); setViewMode("dashboard");
    } catch (error: any) { showAlert("Error", "Failed to submit request."); } finally { setUploading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 pb-24">
      <AnimatePresence mode="wait">
        {viewMode === "dashboard" ? (
          <motion.div key="dashboard" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            {/* 上帝视角下的头部变红警示 */}
            <div className={cn("px-6 pt-12 pb-20 rounded-b-[40px] shadow-sm relative overflow-hidden", isSuperAdmin ? "bg-red-50 border-b border-red-200" : "bg-orange-50 border-b border-orange-100/50")}>
              <div className="absolute right-0 top-0 opacity-[0.03] rotate-12 translate-x-4"><Clock className={cn("w-56 h-56", isSuperAdmin ? "text-red-900" : "text-orange-900")} /></div>
              <div className="relative z-10 max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 -ml-2 text-gray-500 hover:bg-white/50 hover:text-gray-900 rounded-full transition-colors"><ChevronLeft className="w-6 h-6" /></button>
                    <div><h1 className="text-2xl font-black mb-1 text-gray-900 tracking-tight">{isSuperAdmin ? "Relo Admin Command" : "Relo Dashboard"}</h1><p className="text-gray-500 text-xs font-medium">{isSuperAdmin ? "You are reviewing all platform buyout requests" : "Manage your move-out inventory"}</p></div>
                  </div>
                </div>

                {!isSuperAdmin && (
                  <div className="bg-white/70 backdrop-blur-md rounded-3xl p-6 border border-orange-100/50 shadow-sm">
                    {isValidDate && !isEditingDate ? (
                      <><div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><CalendarClock className="w-4 h-4 text-orange-400" /><span className="text-[10px] font-bold uppercase tracking-widest text-orange-900/60">Time until departure</span></div><button onClick={() => setIsEditingDate(true)} className="text-gray-400 hover:text-orange-500 p-1.5 rounded-full hover:bg-orange-50 transition-colors"><Pencil className="w-3.5 h-3.5" /></button></div>
                      <div className="flex justify-between items-end mb-4"><div className="flex gap-4"><div><p className="text-3xl font-black text-gray-900">{timeLeft.days}</p><p className="text-[8px] uppercase text-gray-400 font-bold tracking-widest mt-0.5">Days</p></div><div><p className="text-3xl font-black text-gray-900">{timeLeft.hours}</p><p className="text-[8px] uppercase text-gray-400 font-bold tracking-widest mt-0.5">Hrs</p></div><div><p className="text-3xl font-black text-gray-900">{timeLeft.minutes}</p><p className="text-[8px] uppercase text-gray-400 font-bold tracking-widest mt-0.5">Min</p></div></div><div className="text-right"><p className="text-sm font-bold text-gray-900">{Math.round(progress)}%</p><p className="text-[8px] uppercase text-gray-400 font-bold tracking-widest mt-0.5">Remaining</p></div></div>
                      <div className="w-full bg-orange-100/50 h-2 rounded-full overflow-hidden"><div className="h-full bg-orange-500 rounded-full transition-all duration-1000 shadow-sm" style={{ width: `${progress}%` }} /></div></>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2"><CalendarClock className="w-4 h-4 text-orange-400" /><span className="text-[10px] font-bold uppercase tracking-widest text-orange-900/80">{isValidDate ? "Update Move-out Date" : "Set Move-out Date"}</span></div>
                        <p className="text-xs text-gray-600 leading-relaxed font-medium">Set your official move-out date to activate the countdown and help us coordinate logistics.</p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <input type="date" min={today} value={tempDate} onChange={(e) => setTempDate(e.target.value)} className="flex-1 bg-white border border-orange-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 shadow-sm" />
                          <div className="flex gap-2"><button onClick={handleSaveInlineDate} disabled={savingDate} className="flex-1 sm:flex-none bg-orange-500 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md hover:bg-orange-600 transition-colors disabled:opacity-50">{savingDate ? "Saving..." : "Save"}</button>{isValidDate && <button onClick={() => { setIsEditingDate(false); setTempDate(profile?.departureDate || ""); }} className="px-4 py-3 text-gray-400 hover:text-gray-800 text-sm font-bold transition-colors">Cancel</button>}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 -mt-10 max-w-2xl mx-auto relative z-20">
              {!isSuperAdmin && <button onClick={() => setViewMode("form")} className="w-full bg-white text-orange-500 py-4 rounded-2xl font-black shadow-lg shadow-black/5 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all mb-8 border border-orange-100"><Plus className="w-5 h-5 stroke-[3px]" /> Sell New Item to Relo</button>}
              {loading ? <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" /></div> : requests.length > 0 ? <div className="space-y-4 mt-8">{requests.map(renderRequestCard)}</div> : <div className="text-center py-12 mt-8 bg-white rounded-3xl border-2 border-dashed border-gray-200 shadow-sm"><div className="w-16 h-16 bg-orange-50 text-orange-400 rounded-full flex items-center justify-center mx-auto mb-4"><Store className="w-8 h-8" /></div><h3 className="font-black text-gray-900 mb-2">No Requests Yet</h3><p className="text-xs text-gray-500 max-w-xs mx-auto">Got bulky furniture you can't sell? Let us make you an offer or recycle it for free.</p></div>}
            </div>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="p-6 max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-8 sticky top-0 bg-gray-50/80 backdrop-blur-md py-4 z-10 -mx-6 px-6"><div className="flex items-center gap-4"><button onClick={() => setViewMode("dashboard")} className="p-2 -ml-2 text-gray-600 hover:bg-white rounded-full transition-colors shadow-sm"><ChevronLeft className="w-6 h-6" /></button><div><h2 className="text-xl font-black text-gray-900">Sell to Relo</h2><p className="text-xs text-gray-500 font-medium">Official Buyout & Recycle</p></div></div></div>
            <div className="bg-green-50 border border-green-100 rounded-2xl p-4 mb-8 flex gap-4"><div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-green-500 flex-shrink-0 shadow-sm"><ShieldCheck className="w-5 h-5" /></div><div><h4 className="font-bold text-gray-900 text-sm">Hassle-Free Buyout</h4><p className="text-xs text-gray-600 mt-1 leading-relaxed">We calculate offers based on item condition, original value, and pickup difficulty. If rejected, we offer free recycling.</p></div></div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2"><label className="text-sm font-bold text-gray-600">Item Photos (Required)</label><div className="flex gap-2 overflow-x-auto pb-2"><button type="button" onClick={() => fileInputRef.current?.click()} className="w-24 h-24 flex-shrink-0 bg-white shadow-sm border border-gray-100 rounded-2xl flex flex-col items-center justify-center text-gray-400 hover:border-orange-400 hover:text-orange-400 transition-all"><Camera className="w-8 h-8 mb-1" /><span className="text-[10px] font-bold">Add Photo</span></button>{images.map((file, i) => (<div key={i} className="w-24 h-24 flex-shrink-0 relative rounded-2xl overflow-hidden group border border-gray-100 shadow-sm"><img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="preview" /><button type="button" onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button></div>))}</div><input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={(e) => { if (e.target.files) setImages(prev => [...prev, ...Array.from(e.target.files!)]); }} /></div>
              <div className="space-y-1"><label className="text-sm font-bold text-gray-600">Item Name / Bundle Description</label><input required className="input-field bg-white shadow-sm" placeholder="e.g. IKEA Desk & Office Chair" value={formData.itemName} onChange={e => setFormData(prev => ({ ...prev, itemName: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-sm font-bold text-gray-600">Original Price ($)</label><input required type="number" className="input-field bg-white shadow-sm" placeholder="Purchased for..." value={formData.originalPrice} onChange={e => setFormData(prev => ({ ...prev, originalPrice: e.target.value }))} /></div><div className="space-y-1"><label className="text-sm font-bold text-gray-600">Current Condition</label><select className="input-field bg-white shadow-sm appearance-none" value={formData.condition} onChange={e => setFormData(prev => ({ ...prev, condition: e.target.value }))}><option value="Brand New">Brand New</option><option value="Like New">Like New</option><option value="Used - Good">Used - Good</option><option value="Used - Fair">Used - Fair (Heavy wear)</option></select></div></div>
              <div className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm space-y-4 mt-2"><h4 className="font-bold text-gray-800 flex items-center gap-2 text-sm border-b border-gray-50 pb-2"><Truck className="w-4 h-4 text-orange-400" />Pickup Logistics</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><MapPin className="w-3 h-3" /> Pickup Address</label><input required className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-400/20" placeholder="Apt number, Building" value={formData.address} onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))} /></div><div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Calendar className="w-3 h-3" /> Move-out Date</label><input required type="date" min={today} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-400/20" value={formData.moveOutDate} onChange={e => setFormData(prev => ({ ...prev, moveOutDate: e.target.value }))} /></div></div><div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Building Access (Crucial for Quote)</label><select className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-400/20 appearance-none" value={formData.logisticsNote} onChange={e => setFormData(prev => ({ ...prev, logisticsNote: e.target.value }))}><option value="Elevator available">Elevator available in building</option><option value="Walk-up (1st/2nd Floor)">Walk-up stairs (1st or 2nd Floor)</option><option value="Walk-up (3rd Floor +)">Walk-up stairs (3rd Floor or higher)</option><option value="Item already disassembled">Item is already fully disassembled</option></select></div></div>
              <div className="space-y-1"><label className="text-sm font-bold text-gray-600">Details & Flaws</label><textarea required rows={3} className="input-field bg-white shadow-sm resize-none focus:ring-orange-400/20" placeholder="Please honestly describe any scratches, missing parts, or flaws to ensure an accurate quote..." value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} /></div>
              <button disabled={uploading} className="w-full bg-orange-500 text-white rounded-xl font-bold py-4 text-base mt-2 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-colors">{uploading ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Submitting...</> : <><Store className="w-5 h-5" /> Request Buyout Quote</>}</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}