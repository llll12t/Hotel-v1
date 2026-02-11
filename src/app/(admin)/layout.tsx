"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/app/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import AdminNavbar from '@/app/components/AdminNavbar';
import { useToast } from '@/app/components/Toast';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { ProfileProvider } from '@/context/ProfileProvider';
import { markAllNotificationsAsRead, clearAllNotifications } from '@/app/actions/notificationActions';
import { Notification } from '@/types/notification';

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const router = useRouter();
    const { showToast } = useToast();

    useEffect(() => {
        let mounted = true;

        const checkAuth = async () => {
            const lineAdminSession = localStorage.getItem('lineAdminSession');
            if (lineAdminSession) {
                try {
                    const session = JSON.parse(lineAdminSession);
                    if (session.lineUserId && session.timestamp && (Date.now() - session.timestamp < 24 * 60 * 60 * 1000)) {
                        const adminDocRef = doc(db, 'admins', session.adminId);
                        const adminDocSnap = await getDoc(adminDocRef);
                        if (adminDocSnap.exists() && adminDocSnap.data().lineUserId === session.lineUserId) {
                            if (mounted) {
                                setIsAuthorized(true);
                                setLoading(false);
                            }
                            return;
                        }
                    }
                    localStorage.removeItem('lineAdminSession');
                } catch (e) {
                    console.error('LINE session check error:', e);
                    localStorage.removeItem('lineAdminSession');
                }
            }

            const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
                if (!mounted) return;

                if (user) {
                    try {
                        const adminDocRef = doc(db, 'admins', user.uid);
                        const adminDocSnap = await getDoc(adminDocRef);

                        if (!mounted) return;

                        if (adminDocSnap.exists()) {
                            setIsAuthorized(true);
                        } else {
                            setIsAuthorized(false);
                            router.push('/');
                        }
                    } catch (error) {
                        console.error('Error checking admin status:', error);
                        if (mounted) {
                            setIsAuthorized(false);
                            router.push('/');
                        }
                    }
                } else {
                    if (mounted) {
                        setIsAuthorized(false);
                        router.push('/');
                    }
                }

                if (mounted) {
                    setLoading(false);
                }
            });

            return unsubscribeAuth;
        };

        let unsubAuth: any;
        checkAuth().then(unsub => { unsubAuth = unsub; });

        const notifQuery = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
        const unsubscribeNotifs = onSnapshot(notifQuery, (querySnapshot) => {
            if (!mounted) return;
            const notifsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
            setNotifications(notifsData);
            const unread = notifsData.filter((n) => !n.isRead).length;
            setUnreadCount(unread);
        });

        return () => {
            mounted = false;
            if (unsubAuth && typeof unsubAuth === 'function') unsubAuth();
            unsubscribeNotifs();
        };
    }, [router]);

    const handleMarkAsRead = async () => {
        if (unreadCount > 0) {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                showToast("à¹„à¸¡à¹ˆà¸žà¸šà¸à¸²à¸£à¸¢à¸·à¸™à¸¢à¸±à¸™à¸•à¸±à¸§à¸•à¸™", "error");
                return;
            }
            const result = await markAllNotificationsAsRead({ adminToken: token });
            if (!result.success) showToast("เกิดข้อผิดพลาดในการอัปเดต", "error");
        }
    };

    const handleClearAllClick = () => {
        if (notifications.length > 0) {
            setShowClearConfirm(true);
        } else {
            showToast("ไม่มีการแจ้งเตือนให้ลบ", "info");
        }
    };

    const handleClearAll = async () => {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
            showToast("à¹„à¸¡à¹ˆà¸žà¸šà¸à¸²à¸£à¸¢à¸·à¸™à¸¢à¸±à¸™à¸•à¸±à¸§à¸•à¸™", "error");
            return;
        }
        const result = await clearAllNotifications({ adminToken: token });
        if (result.success) {
            showToast("ลบการแจ้งเตือนทั้งหมดแล้ว", "success");
        } else {
            showToast("เกิดข้อผิดพลาดในการลบ", "error");
        }
        setShowClearConfirm(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="text-center">
                    <p>Verifying admin access...</p>
                </div>
            </div>
        );
    }

    if (isAuthorized) {
        return (
            <div className="min-h-screen bg-[var(--primary-light)] admin-theme">
                <ConfirmationModal
                    show={showClearConfirm}
                    title="ยืนยันการลบ"
                    message="คุณแน่ใจหรือไม่ว่าต้องการลบการแจ้งเตือนทั้งหมด?"
                    onConfirm={handleClearAll}
                    onCancel={() => setShowClearConfirm(false)}
                    isProcessing={false}
                />
                <AdminNavbar
                    notifications={notifications}
                    unreadCount={unreadCount}
                    onMarkAsRead={handleMarkAsRead}
                    onClearAll={handleClearAllClick}
                />
                <main>{children}</main>
            </div>
        );
    }

    return null;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <ProfileProvider>
            <AdminLayoutContent>{children}</AdminLayoutContent>
        </ProfileProvider>
    )
}
