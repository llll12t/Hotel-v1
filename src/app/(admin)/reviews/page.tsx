"use client";

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, limit, startAfter, where, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

const ITEMS_PER_PAGE = 20;

// --- Icons ---
const Icons = {
    Star: ({ filled }: { filled: boolean }) => (
        <svg className={`w-4 h-4 ${filled ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.16c.969 0 1.371 1.24.588 1.81l-3.363 2.44a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.539 1.118l-3.362-2.44a1 1 0 00-1.176 0l-3.362-2.44c-.783.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.07 9.39c-.783-.57-.38-1.81.588-1.81h4.16a1 1 0 00.95-.69L9.049 2.927z" />
        </svg>
    ),
    Search: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    User: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    Message: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
    Loader: () => <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
};

// --- Components ---
const StarRating = ({ rating }: { rating: number }) => (
    <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => <Icons.Star key={star} filled={rating >= star} />)}
    </div>
);

const ReviewSummary = ({ stats }: { stats: any }) => {
    if (!stats) return null;
    return (
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">ภาพรวมความพึงพอใจ</h2>
            <div className="flex flex-col md:flex-row gap-6 items-center">
                <div className="flex flex-col items-center justify-center min-w-[120px]">
                    <div className="text-4xl font-semibold text-gray-900">{stats.average}</div>
                    <div className="flex my-2"><StarRating rating={Math.round(stats.average)} /></div>
                    <div className="text-xs text-gray-500">{stats.total} รีวิว</div>
                </div>
                <div className="flex-1 w-full space-y-2">
                    {stats.distribution.map((item: any) => (
                        <div key={item.star} className="flex items-center gap-3 text-sm">
                            <div className="w-6 font-medium text-gray-600 flex items-center gap-1">{item.star} <span className="text-yellow-400">★</span></div>
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${item.percentage}%` }}></div>
                            </div>
                            <div className="w-8 text-right text-gray-400 text-xs">{item.count}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default function ReviewsPage() {
    const [reviews, setReviews] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [ratingFilter, setRatingFilter] = useState<string | number>('all');
    const [search, setSearch] = useState('');

    // Fetch stats (summary) - only once
    const fetchStats = useCallback(async () => {
        try {
            const snap = await getDocs(collection(db, 'reviews'));
            const allReviews = snap.docs.map(d => d.data());
            const total = allReviews.length;
            const average = total > 0 ? (allReviews.reduce((acc, r: any) => acc + (r.rating || 0), 0) / total).toFixed(1) : 0;
            const distribution = [5, 4, 3, 2, 1].map(star => {
                const count = allReviews.filter((r: any) => r.rating === star).length;
                return { star, count, percentage: total > 0 ? (count / total) * 100 : 0 };
            });
            setStats({ total, average, distribution });
        } catch (err) { console.error("Error fetching stats:", err); }
    }, []);

    // Fetch reviews with pagination
    const fetchReviews = useCallback(async (isLoadMore = false) => {
        if (isLoadMore) setLoadingMore(true);
        else setLoading(true);

        try {
            let q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(ITEMS_PER_PAGE));

            // Server-side rating filter
            if (ratingFilter !== 'all') {
                q = query(collection(db, 'reviews'), where('rating', '==', Number(ratingFilter)), orderBy('createdAt', 'desc'), limit(ITEMS_PER_PAGE));
            }

            // Pagination
            if (isLoadMore && lastDoc) {
                if (ratingFilter !== 'all') {
                    q = query(collection(db, 'reviews'), where('rating', '==', Number(ratingFilter)), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(ITEMS_PER_PAGE));
                } else {
                    q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(ITEMS_PER_PAGE));
                }
            }

            const snap = await getDocs(q);
            const newReviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            if (isLoadMore) {
                setReviews(prev => [...prev, ...newReviews]);
            } else {
                setReviews(newReviews);
            }

            setLastDoc(snap.docs[snap.docs.length - 1] || null);
            setHasMore(snap.docs.length === ITEMS_PER_PAGE);
        } catch (err) { console.error("Error fetching reviews:", err); }
        finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [ratingFilter, lastDoc]);

    // Initial load
    useEffect(() => { fetchStats(); }, [fetchStats]);

    // Reset and fetch when filter changes
    useEffect(() => {
        setLastDoc(null);
        setHasMore(true);
        fetchReviews(false);
    }, [ratingFilter]);

    // Client-side search filter (on already loaded data)
    const filteredReviews = search
        ? reviews.filter(r =>
            (r.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
            (r.comment || '').toLowerCase().includes(search.toLowerCase()) ||
            (r.serviceName || '').toLowerCase().includes(search.toLowerCase())
        )
        : reviews;

    const handleLoadMore = () => {
        if (!loadingMore && hasMore) fetchReviews(true);
    };

    if (loading) return <div className="flex justify-center items-center min-h-[400px]"><div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div></div>;

    return (
        <div className="max-w-7xl mx-auto p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-gray-900">รีวิวจากลูกค้า</h1>
                <p className="text-sm text-gray-500">ความคิดเห็นและคะแนนความพึงพอใจ</p>
            </div>

            {/* Summary Section */}
            <ReviewSummary stats={stats} />

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white border border-gray-200 rounded-lg p-4 mb-6">
                <div className="relative w-full md:w-80">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Icons.Search /></div>
                    <input type="text" placeholder="ค้นหาในรายการที่โหลดแล้ว..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto">
                    <button onClick={() => setRatingFilter('all')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${ratingFilter === 'all' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>ทั้งหมด</button>
                    {[5, 4, 3, 2, 1].map(star => (
                        <button key={star} onClick={() => setRatingFilter(star)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${ratingFilter === star ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'text-gray-600 hover:bg-gray-100'}`}>
                            {star} <span className="text-yellow-400">★</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Reviews Grid */}
            {filteredReviews.length > 0 ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredReviews.map(review => (
                            <div key={review.id} className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-medium text-sm">
                                            {review.customerName ? review.customerName.charAt(0).toUpperCase() : <Icons.User />}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900 text-sm">{review.customerName || 'ไม่ระบุชื่อ'}</p>
                                            <p className="text-xs text-gray-400">
                                                {review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="bg-yellow-50 px-2 py-1 rounded border border-yellow-100">
                                        <StarRating rating={review.rating} />
                                    </div>
                                </div>

                                <div className="flex-grow mb-3">
                                    <p className="text-gray-600 text-sm leading-relaxed">"{review.comment || 'ไม่มีความคิดเห็นเพิ่มเติม'}"</p>
                                </div>

                                <div className="border-t pt-3 mt-auto space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">บริการ:</span>
                                        <span className="font-medium text-gray-900 truncate max-w-[150px]">{review.serviceName || '-'}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">ช่าง:</span>
                                        <span className="font-medium text-gray-900">{review.technicianName || '-'}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Load More Button */}
                    {hasMore && !search && (
                        <div className="flex justify-center mt-6">
                            <button onClick={handleLoadMore} disabled={loadingMore} className="flex items-center gap-2 px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50">
                                {loadingMore ? <><Icons.Loader /> กำลังโหลด...</> : `โหลดเพิ่มเติม (${ITEMS_PER_PAGE} รายการ)`}
                            </button>
                        </div>
                    )}

                    {/* Showing count */}
                    <div className="text-center text-sm text-gray-400 mt-4">
                        แสดง {filteredReviews.length} รายการ {stats?.total ? `จากทั้งหมด ${stats.total} รีวิว` : ''}
                    </div>
                </>
            ) : (
                <div className="text-center py-16 bg-white border border-gray-200 rounded-lg">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 text-gray-400"><Icons.Message /></div>
                    <p className="text-gray-600 font-medium">ไม่พบรีวิว</p>
                    <p className="text-sm text-gray-400 mt-1">ลองปรับตัวกรองหรือคำค้นหา</p>
                </div>
            )}
        </div>
    );
}
