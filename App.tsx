
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useMemo } from 'react';
import { LunchStatus, ClassData, SchoolConfig } from './types';
import { db } from './firebase';
import { ref, onValue, set, update, get } from "firebase/database";

const STATUS_ORDER: LunchStatus[] = ['WAITING', 'GO', 'EATING', 'FINISHED'];
const CHARACTER_IMG = "https://i.imgur.com/oBULNzB.jpeg";
const TOP_BANNER_IMG = "https://i.imgur.com/UmGslKw.jpeg";

const App: React.FC = () => {
  const [config, setConfig] = useState<SchoolConfig>({
    gradeCounts: { 1: 6, 2: 8, 3: 9, 4: 11, 5: 10, 6: 10 }
  });
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeGrade, setActiveGrade] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial Logic: Ensure data exists in Firebase
  useEffect(() => {
    const initializeData = async () => {
      try {
        const dbRef = ref(db);
        const snapshot = await get(dbRef);
        if (!snapshot.exists()) {
          // DB is empty, seed it with defaults
          const initialClasses: ClassData[] = [];
          const defaults = { 1: 6, 2: 8, 3: 9, 4: 11, 5: 10, 6: 10 };
          Object.entries(defaults).forEach(([grade, count]) => {
            for (let i = 1; i <= count; i++) {
              initialClasses.push({ id: `${grade}-${i}`, grade: parseInt(grade), classNum: i, status: 'WAITING' });
            }
          });
          await set(ref(db, 'classes'), initialClasses);
          await set(ref(db, 'config'), { gradeCounts: defaults });
          await set(ref(db, 'lastResetDate'), new Date().toLocaleDateString());
        }
      } catch (err: any) {
        console.error("Firebase Init Error:", err);
        setError(err.message || "데이터베이스 연결 실패");
      } finally {
        setLoading(false);
      }
    };
    initializeData();
  }, []);

  // Sync Logic: Listen to Firebase changes
  useEffect(() => {
    const classesRef = ref(db, 'classes');
    const configRef = ref(db, 'config');

    // Subscribe to classes
    const unsubClasses = onValue(classesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setClasses(data);
    });

    // Subscribe to config
    const unsubConfig = onValue(configRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setConfig(data);
    });

    return () => {
      unsubClasses();
      unsubConfig();
    };
  }, []);

  // Daily Auto-Reset Logic (Server-side simulation)
  useEffect(() => {
    const checkAndReset = async () => {
      const today = new Date().toLocaleDateString();
      const dateRef = ref(db, 'lastResetDate');
      const snapshot = await get(dateRef);
      const lastDate = snapshot.val();

      if (lastDate !== today) {
        // Perform reset
        console.log("New day detected. Resetting database...");
        const classesRef = ref(db, 'classes');
        const currentSnapshot = await get(classesRef);
        if (currentSnapshot.exists()) {
          const currentClasses: ClassData[] = currentSnapshot.val();
          const resetClasses = currentClasses.map(c => ({ ...c, status: 'WAITING' }));
          await set(classesRef, resetClasses);
          await set(dateRef, today);
        }
      }
    };

    // Check on load
    checkAndReset();
    // Check periodically
    const interval = setInterval(checkAndReset, 60000);
    return () => clearInterval(interval);
  }, []);

  // Handle Updates
  const updateGradeCount = (grade: number, count: number) => {
    const newConfig = { ...config, gradeCounts: { ...config.gradeCounts, [grade]: count } };

    // Calculate new classes based on config change (Tricky part: merging existing status)
    // For simplicity, we regenerate the list while trying to preserve status of existing classes
    let newClasses = [...classes];
    const currentCount = classes.filter(c => c.grade === grade).length;

    if (count > currentCount) {
      // Add new classes
      for (let i = currentCount + 1; i <= count; i++) {
        newClasses.push({ id: `${grade}-${i}`, grade, classNum: i, status: 'WAITING' });
      }
    } else if (count < currentCount) {
      // Remove classes
      newClasses = newClasses.filter(c => !(c.grade === grade && c.classNum > count));
    }

    // Sort
    newClasses.sort((a, b) => a.grade === b.grade ? a.classNum - b.classNum : a.grade - b.grade);

    // Update DB
    update(ref(db), {
      config: newConfig,
      classes: newClasses
    });
  };

  const toggleStatus = (index: number, currentStatus: LunchStatus) => {
    if (!isAdmin) return;
    const nextIdx = (STATUS_ORDER.indexOf(currentStatus) + 1) % STATUS_ORDER.length;
    const nextStatus = STATUS_ORDER[nextIdx];

    // Update specific class in DB
    // Note: Firebase arrays are 0-indexed objects. We need to find the correct index in the 'classes' array.
    // Since 'classes' is a flat array in our state, 'index' passed here should be the index in that array.
    // However, we filtered in the UI. Let's find the real index.

    // Actually, simple update:
    set(ref(db, `classes/${index}/status`), nextStatus);
  };

  const resetAll = () => {
    if (window.confirm("오늘의 급식 상태를 모두 초기화하시겠습니까?")) {
      const reset = classes.map(c => ({ ...c, status: 'WAITING' }));
      set(ref(db, 'classes'), reset);
    }
  };

  const movingClasses = useMemo(() => classes.filter(c => c.status === 'GO').map(c => `${c.grade}-${c.classNum}`), [classes]);
  const eatingClasses = useMemo(() => classes.filter(c => c.status === 'EATING').map(c => `${c.grade}-${c.classNum}`), [classes]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] text-slate-400 font-bold">로딩중...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-rose-50 text-rose-600 p-6 text-center">
        <h2 className="text-2xl font-black mb-2">오류가 발생했습니다</h2>
        <p className="mb-4 text-sm bg-white p-4 rounded-xl shadow-sm border border-rose-100">{error}</p>
        <p className="text-xs text-rose-400">Firebase Console {'>'} Realtime Database {'>'} 규칙(Rules) 탭에서<br />read/write가 true로 설정되어 있는지 확인해주세요.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] pb-40 font-sans selection:bg-rose-100">
      {/* App Bar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200">
              <img src={CHARACTER_IMG} alt="Logo" className="w-full h-full object-cover scale-150" />
            </div>
            <span className="font-black text-lg tracking-tighter uppercase">급식 신호등</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAdmin(!isAdmin)}
              className={`px-4 py-1.5 rounded-full text-[11px] font-black transition-all ${isAdmin ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              {isAdmin ? '관리 모드 ON' : '뷰어 모드'}
            </button>
            {isAdmin && (
              <button onClick={() => setShowSettings(true)} className="p-2 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6">

        {/* Large Top Banner Image (New URL) */}
        <section className="mt-6 mb-10 relative rounded-[40px] sm:rounded-[60px] overflow-hidden shadow-2xl shadow-slate-200 border-4 border-white aspect-[16/7] sm:aspect-[21/7]">
          <img src={TOP_BANNER_IMG} alt="Lunch Banner" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
          <div className="absolute bottom-6 left-8 sm:bottom-10 sm:left-12">
            <h2 className="text-white text-3xl sm:text-5xl font-black tracking-tighter drop-shadow-lg mb-1 sm:mb-2">급식 신호등 🚦</h2>
            <p className="text-white/90 text-sm sm:text-xl font-bold tracking-tight">실시간으로 확인하는 우리 학교 점심 시간</p>
          </div>
        </section>

        {/* EXTRA LARGE Status Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-16">
          <div className="bg-white p-8 sm:p-14 rounded-[50px] sm:rounded-[80px] border-4 border-emerald-50 shadow-2xl shadow-emerald-100 flex flex-col items-center text-center gap-6 transition-all hover:scale-[1.03] active:scale-[0.98]">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-[30%] bg-emerald-50 text-emerald-500 flex items-center justify-center text-6xl sm:text-7xl animate-bounce">🏃</div>
            <div className="w-full">
              <p className="text-sm sm:text-base font-black text-emerald-600 uppercase tracking-[0.4em] mb-4">지금 내려오세요!</p>
              <div className="min-h-[100px] flex items-center justify-center">
                <p className="text-5xl sm:text-7xl font-black text-slate-900 leading-none tracking-tighter">
                  {movingClasses.length > 0 ? movingClasses.map(c => `${c}반`).join(', ') : '비어있음'}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white p-8 sm:p-14 rounded-[50px] sm:rounded-[80px] border-4 border-blue-50 shadow-2xl shadow-blue-100 flex flex-col items-center text-center gap-6 transition-all hover:scale-[1.03] active:scale-[0.98]">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-[30%] bg-blue-50 text-blue-500 flex items-center justify-center text-6xl sm:text-7xl">🍱</div>
            <div className="w-full">
              <p className="text-sm sm:text-base font-black text-blue-600 uppercase tracking-[0.4em] mb-4">배식 진행 중</p>
              <div className="min-h-[100px] flex items-center justify-center">
                <p className="text-5xl sm:text-7xl font-black text-slate-900 leading-none tracking-tighter">
                  {eatingClasses.length > 0 ? eatingClasses.map(c => `${c}반`).join(', ') : '비어있음'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Grade Selector Header */}
        <div className="flex items-center justify-between mb-8 px-4">
          <h3 className="font-black text-2xl tracking-tight">학년별 상황판</h3>
          <div className="h-1 flex-grow mx-6 bg-slate-100 rounded-full hidden sm:block"></div>
          <div className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Real-time Grid</div>
        </div>

        {/* Grade Selector (Clean Pill Style) */}
        <div className="flex gap-3 overflow-x-auto pb-10 px-2 scrollbar-hide">
          {[1, 2, 3, 4, 5, 6].map(grade => (
            <button
              key={grade}
              onClick={() => setActiveGrade(grade)}
              className={`shrink-0 px-10 py-4 rounded-[28px] font-black text-base transition-all duration-500 ${activeGrade === grade
                ? 'bg-slate-900 text-white shadow-2xl shadow-slate-300 -translate-y-2'
                : 'bg-white text-slate-400 hover:text-slate-900 border border-slate-100'
                }`}
            >
              {grade}학년
            </button>
          ))}
        </div>

        {/* Grid Area */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 sm:gap-8 px-2">
          {classes.map((cls, index) => { // Map all classes to find correct index
            if (cls.grade !== activeGrade) return null; // Filter visually only
            return (
              <ClassCard
                key={cls.id}
                cls={cls}
                isAdmin={isAdmin}
                onClick={() => toggleStatus(index, cls.status)}
              />
            );
          })}
        </div>
      </main>

      {/* Admin Floating Reset */}
      {isAdmin && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 w-full max-w-xs px-6 z-[60]">
          <button
            onClick={resetAll}
            className="w-full bg-rose-500 text-white py-6 rounded-[35px] shadow-3xl shadow-rose-200 font-black text-xl flex items-center justify-center gap-3 active:scale-90 transition-all border-4 border-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></svg>
            초기화
          </button>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/30 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="bg-white p-10 sm:p-14 rounded-[60px] shadow-3xl max-w-md w-full border border-white animate-in zoom-in-95 duration-300">
            <h2 className="text-3xl font-black text-slate-900 mb-10 text-center tracking-tight">반 개수 설정</h2>
            <div className="grid grid-cols-2 gap-5">
              {[1, 2, 3, 4, 5, 6].map(g => (
                <div key={g} className="bg-slate-50/50 p-6 rounded-[35px] border-2 border-slate-100 flex flex-col items-center">
                  <label className="block text-[11px] font-black text-slate-400 uppercase mb-2 tracking-widest">{g}학년</label>
                  <input
                    type="number"
                    value={config.gradeCounts[g] || 0}
                    onChange={(e) => updateGradeCount(g, parseInt(e.target.value) || 0)}
                    className="w-full bg-transparent text-3xl font-black text-slate-900 text-center outline-none"
                    min="0"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="w-full bg-slate-900 text-white py-6 mt-10 rounded-[35px] font-black text-xl active:scale-95 transition-all shadow-2xl shadow-slate-300"
            >
              설정 저장
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ClassCard: React.FC<{ cls: ClassData; isAdmin: boolean; onClick: () => void; }> = ({ cls, isAdmin, onClick }) => {
  const getStyles = () => {
    switch (cls.status) {
      case 'GO': return 'bg-emerald-500 border-emerald-400 text-white shadow-2xl shadow-emerald-200 scale-115 z-10 ring-[12px] ring-emerald-500/10';
      case 'EATING': return 'bg-blue-500 border-blue-400 text-white shadow-2xl shadow-blue-200 scale-115 z-10 ring-[12px] ring-blue-500/10';
      case 'FINISHED': return 'bg-slate-100 border-slate-200 text-slate-300 opacity-40 grayscale';
      default: return 'bg-white border-slate-100 text-slate-500 shadow-md hover:shadow-2xl hover:translate-y-[-6px] hover:border-slate-200';
    }
  };

  const getLabel = () => {
    switch (cls.status) {
      case 'GO': return '이동중';
      case 'EATING': return '배식/식사';
      case 'FINISHED': return '완료';
      default: return '대기';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`relative aspect-[4/5] border-4 cursor-pointer transition-all duration-700 flex flex-col justify-center items-center rounded-[50px] overflow-hidden ${getStyles()} ${isAdmin ? 'active:scale-90' : 'pointer-events-none'}`}
    >
      <div className="text-center">
        <div className="text-4xl font-black mb-1">{cls.classNum}반</div>
        <div className="text-xs font-black uppercase tracking-[0.25em] opacity-70">{getLabel()}</div>
      </div>

      {(cls.status === 'GO' || cls.status === 'EATING') && (
        <div className="absolute top-6 right-8 w-3 h-3 rounded-full bg-white animate-ping"></div>
      )}
    </div>
  );
};

export default App;
