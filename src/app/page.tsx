import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#F5F2ED] to-[#fff]">
      <div className="w-full max-w-md text-center space-y-8">

        {/* Logo / Header */}
        <div className="space-y-2">
          <div className="w-24 h-24 bg-[#5D4037] rounded-full mx-auto flex items-center justify-center shadow-xl mb-6">
            <span className="text-4xl">🌿</span>
          </div>
          <h1 className="text-3xl font-bold text-[#3E2723] tracking-tight">SPA & MASSAGE</h1>
          <p className="text-[#8D6E63] text-sm">ผ่อนคลายร่างกายและจิตใจของคุณ</p>
        </div>

        {/* Action Buttons */}
        <div className="grid gap-4 w-full">
          <Link href="/appointment" className="group relative w-full overflow-hidden rounded-2xl bg-[#5D4037] p-4 text-white shadow-lg transition-all hover:bg-[#4E342E] hover:scale-[1.02] hover:shadow-xl">
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-2xl">
                  💆‍♀️
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-bold">จองบริการ</h3>
                  <p className="text-xs text-white/80">นัดหมายเวลาที่คุณสะดวก</p>
                </div>
              </div>
              <div className="text-2xl opacity-0 transition-opacity group-hover:opacity-100">
                ➝
              </div>
            </div>
          </Link>

          <Link href="/login" className="group relative w-full overflow-hidden rounded-2xl bg-white p-4 text-[#5D4037] shadow-lg border border-[#D7CCC8]/50 transition-all hover:bg-[#F5F2ED] hover:scale-[1.02] hover:shadow-xl">
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#5D4037]/10 text-2xl">
                  🔐
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-bold">ผู้ดูแลระบบ</h3>
                  <p className="text-xs text-[#8D6E63]">เข้าสู่ระบบจัดการร้าน</p>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Footer info */}
        <div className="pt-8 text-xs text-gray-400">
          <p>© 2024 Spa & Massage Booking System</p>
        </div>
      </div>
    </main>
  );
}
