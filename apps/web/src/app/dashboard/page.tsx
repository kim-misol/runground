'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState('HYBRID');
  const [intro, setIntro] = useState('');

  // 페이지 진입 시 로그인 여부 확인
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      alert('로그인이 필요합니다.');
      router.push('/');
    }
  }, [router]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('accessToken');
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const res = await fetch(`${apiUrl}/classes`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // 🛡️ 백엔드에서 만든 문지기를 통과하기 위한 토큰!
        },
        body: JSON.stringify({ title, mode, intro }),
      });

      if (res.status === 403) {
        throw new Error('코치(ADMIN) 권한이 없습니다.');
      }
      if (!res.ok) throw new Error('클래스 생성 실패');

      alert('🎉 새로운 클래스가 성공적으로 생성되었습니다!');
      setTitle('');
      setIntro('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>코치 대시보드</h1>
        <button 
          onClick={() => { localStorage.removeItem('accessToken'); router.push('/'); }}
          style={{ padding: '8px 16px', backgroundColor: '#ffebee', color: '#d32f2f', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          로그아웃
        </button>
      </header>

      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>🏃‍♂️ 새로운 클래스 개설하기</h2>
        <form onSubmit={handleCreateClass} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>클래스 이름</label>
            <input 
              type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
              placeholder="예: 2026 동아마라톤 풀코스 대비반"
              style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>진행 방식</label>
            <select 
              value={mode} onChange={(e) => setMode(e.target.value)}
              style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            >
              <option value="HYBRID">온/오프라인 하이브리드</option>
              <option value="OFFLINE_ONLY">오프라인 전용</option>
              <option value="ONLINE_ONLY">온라인 전용</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>클래스 소개</label>
            <textarea 
              value={intro} onChange={(e) => setIntro(e.target.value)} rows={4}
              placeholder="클래스에 대한 간단한 소개를 적어주세요."
              style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>

          <button type="submit" style={{ padding: '14px', backgroundColor: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
            클래스 개설 완료
          </button>
        </form>
      </div>
    </div>
  );
}