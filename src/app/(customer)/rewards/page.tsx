"use client";

import { useState, useEffect } from 'react';
import { useLiffContext } from '@/context/LiffProvider';
import { db } from '@/app/lib/firebase';
import { collection, doc, getDocs, onSnapshot, query, orderBy } from 'firebase/firestore';
import { redeemReward } from '@/app/actions/rewardActions';
import { Notification, ConfirmationModal } from '@/app/components/common/NotificationComponent';
import CustomerHeader from '@/app/components/CustomerHeader';
import { useProfile } from '@/context/ProfileProvider';

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

const RewardCard = ({ reward, userPoints, onRedeem, isRedeeming }: { reward: Reward, userPoints: number, onRedeem: (id: string) => void, isRedeeming: boolean }) => {
    const { profile } = useProfile();
    const canRedeem = userPoints >= reward.pointsRequired;
    return (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center transition-all hover:shadow-md">
            <div>
                <h3 className="font-bold text-gray-900 text-lg">{reward.name}</h3>
                <p className="text-sm text-gray-500">{reward.description}</p>
                <div className="text-sm text-[#5D4037] font-medium mt-1 inline-flex items-center gap-1 bg-[#F5F2ED] px-2 py-0.5 rounded-lg">
                    <span>{reward.discountType === 'percentage' ? `ส่วนลด ${reward.discountValue}%` : `ส่วนลด ${profile.currencySymbol || '฿'}${reward.discountValue}`}</span>
                </div>
                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                    ใช้ {reward.pointsRequired} คะแนน
                </p>
            </div>
            <button
                onClick={() => onRedeem(reward.id)}
                disabled={!canRedeem || isRedeeming}
                className={`font-semibold px-5 py-2 rounded-2xl text-sm transition-all ${canRedeem
                    ? 'bg-[#5D4037] text-white hover:bg-[#3E2723] shadow-sm hover:shadow'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
            >
                {isRedeeming ? '...' : 'แลก'}
            </button>
        </div>
    );
};

export default function RewardsPage() {
    const { profile: liffProfile, loading: liffLoading, liff } = useLiffContext();
    const [customer, setCustomer] = useState<CustomerData | null>(null);
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRedeeming, setIsRedeeming] = useState(false);
    const [notification, setNotification] = useState<{ show: boolean, title?: string, message: string, type: 'success' | 'error' | 'warning' }>({ show: false, message: '', type: 'success' });
    const [showModal, setShowModal] = useState(false);
    const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);

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

    const handleRedeemClick = (rewardId: string) => {
        setSelectedRewardId(rewardId);
        setShowModal(true);
    };

    const handleConfirmRedeem = async () => {
        if (!liffProfile?.userId || !selectedRewardId) return;

        setShowModal(false);
        setIsRedeeming(true);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await redeemReward(liffProfile.userId, selectedRewardId, { lineAccessToken });
        if (result.success) {
            setNotification({ show: true, title: "แลกสำเร็จ!", message: "คุณได้รับคูปองใหม่แล้ว", type: 'success' });
        } else {
            setNotification({ show: true, title: "เกิดข้อผิดพลาด", message: result.error || 'Unknown error', type: 'error' });
        }
        setIsRedeeming(false);
        setSelectedRewardId(null);
    };

    const handleCancelRedeem = () => {
        setShowModal(false);
        setSelectedRewardId(null);
    };

    if (loading || liffLoading) return <div className="text-center p-10 text-gray-500">กำลังโหลด...</div>

    return (
        <div>
            <CustomerHeader showBackButton={true} title="แลกของรางวัล" />
            <div className="px-6 pb-6 space-y-6 max-w-md mx-auto pt-6 bg-[#faf9f6] min-h-screen">
                <Notification {...notification} title={notification.title || ''} />
                <ConfirmationModal
                    show={showModal}
                    title="ยืนยันการแลกของรางวัล"
                    message="คุณต้องการใช้คะแนนเพื่อแลกของรางวัลนี้ใช่หรือไม่?"
                    onConfirm={handleConfirmRedeem}
                    onCancel={handleCancelRedeem}
                    isProcessing={isRedeeming}
                />

                {/* Points Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm text-center border border-gray-100 relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-gray-500 text-sm font-medium mb-1">คะแนนสะสมของคุณ</p>
                        <p className="text-5xl font-bold text-[#5D4037] tracking-tight">{customer?.points ?? 0}</p>
                        <p className="text-xs text-[#5D4037]/50 mt-2 font-medium">คะแนนที่ใช้แลกได้</p>
                    </div>
                    {/* Decoration bg */}
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-[#F5F2ED] rounded-full opacity-50 blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-green-50 rounded-full opacity-50 blur-xl"></div>
                </div>

                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <span className="w-1 h-6 bg-[#5D4037] rounded-full"></span>
                        ของรางวัลทั้งหมด
                    </h2>
                    {rewards.length > 0 ? (
                        <div className="space-y-3">
                            {rewards.map(reward => (
                                <RewardCard
                                    key={reward.id}
                                    reward={reward}
                                    userPoints={customer?.points ?? 0}
                                    onRedeem={handleRedeemClick}
                                    isRedeeming={isRedeeming && selectedRewardId === reward.id}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 bg-white/50 rounded-2xl border border-dashed border-gray-300">
                            <p className="text-gray-500">ยังไม่มีของรางวัลให้แลกในขณะนี้</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
