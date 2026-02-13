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
        <div className="bg-[var(--card)] p-4 rounded-2xl shadow-sm border border-[var(--border)] flex justify-between items-center transition-all hover:shadow-md">
            <div>
                <h3 className="font-bold text-[var(--text)] text-lg">{reward.name}</h3>
                <p className="text-sm text-[var(--text-muted)]">{reward.description}</p>
                <div className="text-sm text-[var(--primary)] font-medium mt-1 inline-flex items-center gap-1 bg-[var(--background)] px-2 py-0.5 rounded-lg border border-[var(--border)]">
                    <span>{reward.discountType === 'percentage' ? `ส่วนลด ${reward.discountValue}%` : `ส่วนลด ${profile.currencySymbol || '฿'}${reward.discountValue}`}</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--border)]"></span>
                    ใช้ {reward.pointsRequired} คะแนน
                </p>
            </div>
            <button
                onClick={() => onRedeem(reward.id)}
                disabled={!canRedeem || isRedeeming}
                className={`font-semibold px-5 py-2 rounded-2xl text-sm transition-all ${canRedeem
                    ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] shadow-sm hover:shadow'
                    : 'bg-[var(--border)] text-[var(--text-muted)] cursor-not-allowed'
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

    if (loading || liffLoading) return <div className="text-center p-10 text-[var(--text-muted)]">กำลังโหลด...</div>

    return (
        <div className="min-h-screen bg-[var(--background)]">
            <CustomerHeader />
            <div className="px-6 pb-6 space-y-6 max-w-md mx-auto pt-6 min-h-screen">
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
                <div className="bg-[var(--card)] p-6 rounded-2xl shadow-sm text-center border border-[var(--border)] relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-[var(--text-muted)] text-sm font-medium mb-1">คะแนนสะสมของคุณ</p>
                        <p className="text-5xl font-bold text-[var(--primary)] tracking-tight">{customer?.points ?? 0}</p>
                        <p className="text-xs text-[var(--primary)]/50 mt-2 font-medium">คะแนนที่ใช้แลกได้</p>
                    </div>
                    {/* Decoration bg */}
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-[var(--background)] rounded-full opacity-50 blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-[var(--success)]/10 rounded-full opacity-50 blur-xl"></div>
                </div>

                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-[var(--text)] flex items-center gap-2">
                        <span className="w-1 h-6 bg-[var(--primary)] rounded-full"></span>
                        ของรางวัลทั้งหมด
                    </h2>
                    {rewards.length > 0 ? (
                        <div className="space-y-3">
                            {rewards.map(reward => (
                                <RewardCard
                                    key={reward.id}
                                    reward={reward}
                                    userPoints={customer?.points ?? 0}
                                    onRedeem={() => handleRedeemClick(reward.id)}
                                    // Fix: Passing function to onRedeem
                                    isRedeeming={isRedeeming && selectedRewardId === reward.id}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 bg-[var(--card)]/50 rounded-2xl border border-dashed border-[var(--border)]">
                            <p className="text-[var(--text-muted)]">ยังไม่มีของรางวัลให้แลกในขณะนี้</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
