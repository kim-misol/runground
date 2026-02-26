'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function ClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [classData, setClassData] = useState<any>(null);
  
  // 이벤트 기본 정보 상태
  const [events, setEvents] = useState<any[]>([]);
  const [eventTitle, setEventTitle] = useState('');
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 세부 훈련(TrainingDetail) 배열 상태 추가
  const [eventDetails, setEventDetails] = useState<any[]>([
    { section: 'MAIN', type: 'RUN_LSD', distanceKm: '', durationMin: '', reps: '', sets: '', note: '' }
  ]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { alert('로그인이 필요합니다.'); router.push('/'); return; }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001/api';

    const fetchClassDetails = async () => {
      try {
        const res = await fetch(`${apiUrl}/classes/${params.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) setClassData(await res.json());
      } catch (e) { console.error(e); }
    };

    const fetchEvents = async () => {
      try {
        const res = await fetch(`${apiUrl}/classes/${params.id}/events`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) setEvents(await res.json());
      } catch (e) { console.error(e); }
    };

    fetchClassDetails();
    fetchEvents();
  }, [params.id, router]);

  // 세부 훈련 핸들러 (추가/수정/삭제)
  const addDetail = () => setEventDetails([...eventDetails, { section: 'MAIN', type: 'RUN_JOG', distanceKm: '', durationMin: '', reps: '', sets: '', note: '' }]);
  const removeDetail = (index: number) => setEventDetails(eventDetails.filter((_, i) => i !== index));
  const updateDetail = (index: number, field: string, value: string) => {
    const newDetails = [...eventDetails];
    newDetails[index][field] = value;
    setEventDetails(newDetails);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle || !eventStartDate) return alert('제목과 시작 시간은 필수입니다.');
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001/api';
      
      const res = await fetch(`${apiUrl}/classes/${params.id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          kind: 'OFFLINE_SESSION',
          title: eventTitle,
          location: eventLocation,
          startsAt: new Date(eventStartDate).toISOString(),
          endsAt: eventEndDate ? new Date(eventEndDate).toISOString() : undefined,
          details: eventDetails, // 구조화된 세부 훈련 데이터 전송
        }),
      });

      if (res.ok) {
        alert('🎉 세부 일정이 포함된 훈련이 생성되었습니다!');
        setEventTitle(''); setEventStartDate(''); setEventEndDate(''); setEventLocation('');
        setEventDetails([{ section: 'MAIN', type: 'RUN_LSD', distanceKm: '', durationMin: '', reps: '', sets: '', note: '' }]);
        
        const eventsRes = await fetch(`${apiUrl}/classes/${params.id}/events`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (eventsRes.ok) setEvents(await eventsRes.json());
      } else {
        alert('일정 생성에 실패했습니다.');
      }
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  if (!classData) return <div style={{ padding: '40px', textAlign: 'center' }}>데이터를 불러오는 중입니다...</div>;

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '40px' }}>
        <Link href="/dashboard" style={{ color: '#1e88e5', textDecoration: 'none', fontWeight: 'bold', marginBottom: '10px', display: 'inline-block' }}>← 대시보드로 돌아가기</Link>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '10px' }}>{classData.title}</h1>
      </header>

      {/* 훈련 일정 생성 폼 */}
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '20px', fontWeight: 'bold', borderBottom: '2px solid #f0f0f0', paddingBottom: '10px' }}>📅 훈련 일정 및 세부 구성</h2>

        <form onSubmit={handleCreateEvent} style={{ marginBottom: '30px', backgroundColor: '#f9fafb', padding: '20px', borderRadius: '8px', border: '1px solid #eee' }}>
          {/* 기본 정보 */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <input type="text" placeholder="일정 제목 (예: 잠실 인터벌 훈련)" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} required style={{ flex: 2, padding: '12px', border: '1px solid #ddd', borderRadius: '6px' }} />
            <input type="text" placeholder="장소 (예: 트랙)" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} style={{ flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '6px' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: 'bold' }}>시작 시간 *</label>
              <input type="datetime-local" value={eventStartDate} onChange={(e) => setEventStartDate(e.target.value)} required style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: 'bold' }}>종료 시간 (선택)</label>
              <input type="datetime-local" value={eventEndDate} onChange={(e) => setEventEndDate(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px' }} />
            </div>
          </div>

          {/* 세부 훈련 (TrainingDetail) 동적 폼 */}
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', color: '#333' }}>🛠️ 세부 훈련 구성</h3>
          {eventDetails.map((detail, index) => (
            <div key={index} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontWeight: 'bold', color: '#1e88e5' }}>#{index + 1} 훈련 블록</span>
                {eventDetails.length > 1 && (
                  <button type="button" onClick={() => removeDetail(index)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>삭제 ✕</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <select value={detail.section} onChange={(e) => updateDetail(index, 'section', e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                  <option value="WARMUP">웜업</option>
                  <option value="MAIN">본운동</option>
                  <option value="COOLDOWN">쿨다운</option>
                </select>
                <select value={detail.type} onChange={(e) => updateDetail(index, 'type', e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                  <option value="RUN_JOG">조깅</option>
                  <option value="RUN_LSD">LSD</option>
                  <option value="RUN_INTERVAL">인터벌</option>
                  <option value="RUN_TT">TT(타임트라이얼)</option>
                  <option value="RUN_PATLET">파틀렉</option>
                  <option value="STRENGTH">보강운동</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <input type="number" placeholder="거리(m)" value={detail.distanceKm} onChange={(e) => updateDetail(index, 'distanceKm', e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                <input type="number" placeholder="시간(초)" value={detail.durationMin} onChange={(e) => updateDetail(index, 'durationMin', e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <input type="number" placeholder="Reps(회)" value={detail.reps} onChange={(e) => updateDetail(index, 'reps', e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                <input type="number" placeholder="Sets(세트)" value={detail.sets} onChange={(e) => updateDetail(index, 'sets', e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              </div>
              <input type="text" placeholder="참고사항 (예: 페이스 5:30, 휴식 90초)" value={detail.note} onChange={(e) => updateDetail(index, 'note', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
            </div>
          ))}
          
          <button type="button" onClick={addDetail} style={{ width: '100%', padding: '10px', backgroundColor: '#e3f2fd', color: '#1e88e5', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px' }}>
            + 세부 훈련 블록 추가
          </button>

          <button type="submit" disabled={isSubmitting} style={{ width: '100%', padding: '14px', backgroundColor: isSubmitting ? '#90caf9' : '#1e88e5', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
            {isSubmitting ? '생성 중...' : '일정 및 훈련 구성 완료하기'}
          </button>
        </form>

        {/* 생성된 일정 목록 및 세부 정보 렌더링 */}
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#555', marginBottom: '10px' }}>예정된 훈련 ({events.length}개)</h3>
        {events.length === 0 ? (
          <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>등록된 일정이 없습니다.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {events.map((ev: any) => (
              <li key={ev.id} style={{ padding: '20px', border: '1px solid #eee', borderRadius: '8px', marginBottom: '15px', backgroundColor: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#111' }}>{ev.title}</span>
                  <span style={{ backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>오프라인</span>
                </div>
                
                <div style={{ color: '#555', fontSize: '14px', marginBottom: '15px', display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px' }}>
                  <span style={{ fontWeight: 'bold', color: '#888' }}>📍 장소</span><span>{ev.location || '미정'}</span>
                  <span style={{ fontWeight: 'bold', color: '#888' }}>⏰ 시간</span>
                  <span>{new Date(ev.startsAt).toLocaleString()} {ev.endsAt ? ` ~ ${new Date(ev.endsAt).toLocaleTimeString()}` : ''}</span>
                </div>

                {/* 세부 훈련 리스트 출력 */}
                {ev.details && ev.details.length > 0 && (
                  <div style={{ backgroundColor: '#f9fafb', padding: '15px', borderRadius: '6px', border: '1px solid #eee' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', color: '#333' }}>훈련 구성표</h4>
                    <table style={{ width: '100%', fontSize: '13px', textAlign: 'left', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #ddd', color: '#888' }}>
                          <th style={{ paddingBottom: '8px' }}>구분</th>
                          <th style={{ paddingBottom: '8px' }}>종류</th>
                          <th style={{ paddingBottom: '8px' }}>거리/시간</th>
                          <th style={{ paddingBottom: '8px' }}>세트</th>
                          <th style={{ paddingBottom: '8px' }}>참고</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ev.details.map((d: any, i: number) => (
                          <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '8px 0', fontWeight: 'bold', color: d.section === 'MAIN' ? '#1e88e5' : '#666' }}>
                              {d.section === 'WARMUP' ? '웜업' : d.section === 'MAIN' ? '본운동' : '쿨다운'}
                            </td>
                            <td style={{ padding: '8px 0' }}>{d.type.replace('RUN_', '')}</td>
                            <td style={{ padding: '8px 0' }}>
                              {d.distanceKm ? `${d.distanceKm}km` : ''} {d.durationMin ? `${d.durationMin}분` : ''}
                            </td>
                            <td style={{ padding: '8px 0' }}>{d.sets ? `${d.reps || 1}x${d.sets}` : '-'}</td>
                            <td style={{ padding: '8px 0', color: '#777' }}>{d.note || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 멤버 목록 유지 (위치 이동) */}
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '20px', fontWeight: 'bold', borderBottom: '2px solid #f0f0f0', paddingBottom: '10px' }}>
          👥 가입한 러너 목록 ({classData.memberships.length}명)
        </h2>
        {/* ... (기존 멤버 렌더링 코드 유지) ... */}
      </div>
    </div>
  );
}