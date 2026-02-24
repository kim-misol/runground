'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState('HYBRID');
  const [intro, setIntro] = useState('');
  
  // 내 클래스 목록을 저장할 상태 추가
  const [myClasses, setMyClasses] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      alert('로그인이 필요합니다.');
      router.push('/');
    } else {
      // 로그인이 확인되면 내 클래스 목록을 불러옵니다.
      fetchMyClasses(token);
    }
  }, [router]);

  // 내 클래스 목록 API 호출 함수
  const fetchMyClasses = async (token: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001/api';
      const res = await fetch(`${apiUrl}/classes/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyClasses(data);
      }
    } catch (err) {
      console.error('클래스 목록 불러오기 실패:', err);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('accessToken');
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001/api';
      const res = await fetch(`${apiUrl}/classes`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, mode, intro }),
      });

      if (res.status === 403) throw new Error('코치(ADMIN) 권한이 없습니다.');
      if (!res.ok) throw new Error('클래스 생성 실패');

      alert('🎉 새로운 클래스가 성공적으로 생성되었습니다!');
      setTitle('');
      setIntro('');
      
      // 생성이 완료되면 목록을 다시 불러와서 화면을 갱신합니다!
      if (token) fetchMyClasses(token);
      
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 진행 방식 텍스트 변환 헬퍼 함수
  const getModeText = (m: string) => {
    if (m === 'HYBRID') return '🌲 온/오프라인 하이브리드';
    if (m === 'ONLINE_ONLY') return '💻 온라인 전용';
    if (m === 'OFFLINE_ONLY') return '🏃‍♂️ 오프라인 전용';
    return m;
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

      {/* 클래스 생성 폼 */}
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '40px' }}>
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

      {/* 개설한 클래스 목록 렌더링 영역 */}
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>📋 개설한 클래스 목록</h2>
        {myClasses.length === 0 ? (
          <p style={{ color: '#666' }}>아직 개설한 클래스가 없습니다.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {myClasses.map((cls) => (
              <div key={cls.id} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', borderLeft: '5px solid #1e88e5' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>{cls.title}</h3>
                <span style={{ display: 'inline-block', backgroundColor: '#e3f2fd', color: '#1e88e5', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', marginBottom: '12px' }}>
                  {getModeText(cls.mode)}
                </span>
                <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.5' }}>
                  {cls.intro || '소개가 없습니다.'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}