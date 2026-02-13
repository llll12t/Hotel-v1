"use client";

import { useState, useEffect } from 'react';
import { useLiffContext } from '@/context/LiffProvider';
import { db } from '@/app/lib/firebase';
import { collection, doc, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { redeemReward } from '@/app/actions/rewardActions';
import { Notification } from '@/app/components/common/NotificationComponent';
import { useProfile } from '@/context/ProfileProvider';
import SpaFlowerIcon from '@/app/components/common/SpaFlowerIcon';

// Icons
const StarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-amber-400">
        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006Z" clipRule="evenodd" />
    </svg>
);

const CoinIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-amber-500">
        <path d="M10.464 8.746c.227-.18.497-.311.786-.394v2.795a2.252 2.252 0 0 1-.786-.393c-.394-.313-.546-.681-.546-1.004 0-.324.152-.691.546-1.004ZM12.75 15.662v-2.824c.347.085.664.228.921.421.427.32.579.686.579.991 0 .305-.152.671-.579.991a2.534 2.534 0 0 1-.921.42Z" />
        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v.816a3.836 3.836 0 0 0-1.72.756c-.712.566-1.112 1.35-1.112 2.178 0 .829.4 1.612 1.113 2.178.502.4 1.102.647 1.719.756v2.978a2.532 2.532 0 0 1-.921-.421l-.879-.66a.75.75 0 0 0-.9 1.2l.879.66c.533.4 1.169.645 1.821.75V18a.75.75 0 0 0 1.5 0v-.81c.644-.095 1.248-.32 1.768-.641.791-.49 1.29-1.311 1.29-2.299 0-.988-.499-1.809-1.29-2.299a4.642 4.642 0 0 0-1.768-.642v-2.905a3.353 3.353 0 0 1 1.053.497l.65.488a.75.75 0 0 0 .9-1.2l-.65-.488a4.854 4.854 0 0 0-1.879-.654V6Z" clipRule="evenodd" />
    </svg>
);

interface Reward {
    id: string;
    name: string;
    description?: string;
    pointsRequired: number;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
}

interface CustomerData {
    points: number;
}

// Compact Reward Card
const RewardCard = ({ reward, userPoints, onRedeem, isRedeeming }: { reward: Reward, userPoints: number, onRedeem: () => void, isRedeeming: boolean }) => {
    const { profile } = useProfile();
    const canRedeem = userPoints >= reward.pointsRequired;

    return (
        <div className="bg-white rounded-2xl p-4 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.05)] border border-gray-100 flex justify-between items-center group hover:border-gray-200 transition-all">
            <div className="flex-1 pr-3">
                <h3 className="font-bold text-gray-900 text-base leading-tight mb-1">{reward.name}</h3>
                <p className="text-xs text-gray-500 line-clamp-1 mb-2">{reward.description || 'ส่วนลดพิเศษสำหรับคุณ'}</p>

                <div className="flex items-center gap-2">
                    <div className="inline-flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100/50">
                        <CoinIcon />
                        <span className={`text-xs font-bold ${canRedeem ? 'text-amber-600' : 'text-gray-400'}`}>
                            {reward.pointsRequired} Pts
                        </span>
                    </div>
                    <span className="text-[10px] text-gray-400">
                        ({reward.discountType === 'percentage' ? `-${reward.discountValue}%` : `-${reward.discountValue}฿`})
                    </span>
                </div>
            </div>

            <button
                onClick={onRedeem}
                disabled={!canRedeem || isRedeeming}
                className={`min-w-[70px] py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 ${canRedeem
                    ? 'bg-black text-white hover:bg-gray-800 hover:shadow-md'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
            >
                {isRedeeming ? (
                    <span className="animate-pulse">...</span>
                ) : 'แลกเลย'}
            </button>
        </div>
    );
};

export default function RewardsPage() {
    const { profile: liffProfile, loading: liffLoading, liff } = useLiffContext();
    const { profile: storeProfile } = useProfile();
    const [customer, setCustomer] = useState<CustomerData | null>(null);
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);
    const [isRedeeming, setIsRedeeming] = useState(false);

    // Notification & Modal State
    const [notification, setNotification] = useState<{ show: boolean, title?: string, message: string, type: 'success' | 'error' | 'warning' }>({ show: false, message: '', type: 'success' });
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [rewardToRedeem, setRewardToRedeem] = useState<Reward | null>(null);

    useEffect(() => {
        let unsubCustomer = () => { };
        if (liffProfile?.userId) {
            const customerRef = doc(db, "customers", liffProfile.userId);
            unsubCustomer = onSnapshot(customerRef, (doc) => {
                if (doc.exists()) setCustomer(doc.data() as CustomerData);
            });
        }
        return () => unsubCustomer();
    }, [liffProfile]);

    useEffect(() => {
        const fetchRewards = async () => {
            setLoading(true);
            const q = query(collection(db, 'rewards'), orderBy('pointsRequired'));
            const snapshot = await getDocs(q);
            setRewards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reward)));
            setLoading(false);
        };
        fetchRewards();
    }, []);

    const initiateRedeem = (reward: Reward) => {
        setRewardToRedeem(reward);
        setShowConfirmModal(true);
    };

    const confirmRedeem = async () => {
        if (!liffProfile?.userId || !rewardToRedeem) return;

        setShowConfirmModal(false);
        setSelectedRewardId(rewardToRedeem.id);
        setIsRedeeming(true);

        const lineAccessToken = liff?.getAccessToken?.();
        const result = await redeemReward(liffProfile.userId, rewardToRedeem.id, { lineAccessToken });

        if (result.success) {
            setNotification({ show: true, title: "แลกสำเร็จ!", message: `คุณได้รับ ${rewardToRedeem.name} เรียบร้อยแล้ว`, type: 'success' });
        } else {
            setNotification({ show: true, title: "เกิดข้อผิดพลาด", message: result.error || 'Unknown error', type: 'error' });
        }

        setIsRedeeming(false);
        setSelectedRewardId(null);
        setRewardToRedeem(null);
    };

    if (loading || liffLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <SpaFlowerIcon className="w-16 h-16 animate-spin text-gray-900" style={{ animationDuration: '3s' }} />
            </div>
        );
    }

    // Header Background Image (Consistent)
    const headerBgUrl = storeProfile?.headerImage;

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-[#1A1A1A]">
            <Notification {...notification} title={notification.title || ''} />

            {/* Custom Confirmation Modal (Inline for simplicity or import) */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-scale-in">
                        <div className="text-center mb-5">
                            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-500">
                                <GiftIcon />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">ยืนยันการแลกรางวัล</h3>
                            <p className="text-sm text-gray-500">
                                ใช้ <span className="font-bold text-black">{rewardToRedeem?.pointsRequired} คะแนน</span><br />
                                เพื่อแลก "{rewardToRedeem?.name}"
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200 transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={confirmRedeem}
                                className="flex-1 py-3 rounded-xl bg-black text-white font-bold text-sm hover:bg-gray-800 transition-colors shadow-lg"
                            >
                                ยืนยัน
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Custom Header --- */}
            <div className="relative h-[200px] w-full overflow-hidden">
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${headerBgUrl})` }}
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/60"></div>
                </div>

                <div className="relative z-10 px-5 pt-8 flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-white/90 shadow-lg">
                            {liffProfile?.pictureUrl ? (
                                <img src={liffProfile.pictureUrl} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-white/20 flex items-center justify-center">
                                    <span className="text-white text-[10px]">User</span>
                                </div>
                            )}
                        </div>
                        <div className="text-white">
                            <p className="text-[11px] text-white/80 font-medium tracking-wide">Goodmorning</p>
                            <h1 className="text-lg font-bold leading-none tracking-tight mt-0.5">{liffProfile?.displayName || 'Guest'}</h1>
                        </div>
                    </div>

                    <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl flex flex-col items-center justify-center shadow-lg min-w-[80px]">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Status</span>
                        <span className="text-xs font-bold text-emerald-600">VIP Member</span>
                    </div>
                </div>
            </div>

            {/* --- Main Content Sheet --- */}
            <div className="bg-white rounded-t-[32px] -mt-12 relative z-20 min-h-[calc(100vh-160px)] pb-12 shadow-[0_-5px_20px_rgba(0,0,0,0.1)]">

                {/* Points Card (Floating Over Sheet) */}
                <div className="px-5 -mt-8 relative z-30 mb-6">
                    <div className="bg-gradient-to-r from-gray-900 to-black text-white p-5 rounded-2xl shadow-xl flex justify-between items-center relative overflow-hidden">
                        <div>
                            <p className="text-white/60 text-xs font-medium mb-1 uppercase tracking-wider">คะแนนของคุณ</p>
                            <h2 className="text-4xl font-bold tracking-tight">{customer?.points ?? 0}</h2>
                        </div>
                        <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border border-white/20 backdrop-blur-md">
                            <StarIcon />
                        </div>

                        {/* Decor */}
                        <div className="absolute -right-4 -bottom-8 w-24 h-24 bg-white/5 rounded-full blur-2xl"></div>
                    </div>
                </div>

                {/* Content */}
                <div className="px-5">
                    <h2 className="text-gray-900 font-bold text-sm mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-black rounded-full"></span>
                        แลกของรางวัล
                    </h2>

                    {rewards.length > 0 ? (
                        <div className="space-y-3">
                            {rewards.map(reward => (
                                <RewardCard
                                    key={reward.id}
                                    reward={reward}
                                    userPoints={customer?.points ?? 0}
                                    onRedeem={() => initiateRedeem(reward)}
                                    isRedeeming={isRedeeming && selectedRewardId === reward.id}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-gray-300">
                                <GiftIcon />
                            </div>
                            <p className="text-gray-400 text-sm">ยังไม่มีของรางวัลในขณะนี้</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Helper Icon for Modal
const GiftIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H4.5a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125H3.375Z" />
    </svg>
);
