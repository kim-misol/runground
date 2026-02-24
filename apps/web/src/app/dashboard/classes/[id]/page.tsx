'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function ClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [classData, setClassData] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      alert('로그인이 필요합니다.');
      router.push('/');
      return;
    }

    const fetchClassDetails = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001/api';
        const res = await fetch(`${apiUrl}/classes/${params.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
        //   setClassData(await res.json());
          const data = await res.json();
          // 👇 백엔드에서 데이터가 어떻게 오는지 브라우저 콘솔에 찍어봅니다.
          console.log('멤버십 데이터 확인:', data.memberships); 
          setClassData(data);
        } else {
          alert('클래스 정보를 불러오지 못했습니다.');
          router.push('/dashboard');
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchClassDetails();
  }, [params.id, router]);

  if (!classData) return <div style={{ padding: '40px', textAlign: 'center' }}>데이터를 불러오는 중입니다...</div>;

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '40px' }}>
        <Link href="/dashboard" style={{ color: '#1e88e5', textDecoration: 'none', fontWeight: 'bold', marginBottom: '10px', display: 'inline-block' }}>
          ← 대시보드로 돌아가기
        </Link>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '10px' }}>{classData.title}</h1>
        <p style={{ color: '#666', marginTop: '8px' }}>{classData.intro}</p>
      </header>

      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '20px', fontWeight: 'bold' }}>
          👥 구독한 러너 목록 ({classData.memberships.length}명)
        </h2>
        
        {classData.memberships.length === 0 ? (
          <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>아직 구독한 회원이 없습니다.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {classData.memberships.map((member: any) => (
              <li key={member.id} style={{ padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 'bold', fontSize: '16px', display: 'block' }}>{member.user.profile.name} ({member.user.email})</span>
                  <span style={{ color: '#666', fontSize: '14px', marginTop: '4px', display: 'block' }}>
                    구독일: {new Date(member.joinedAt).toLocaleString('ko-KR')}
                  </span>
                </div>
                <span style={{ 
                  backgroundColor: member.role === 'COACH' ? '#e8f5e9' : '#e3f2fd', 
                  color: member.role === 'COACH' ? '#2e7d32' : '#1e88e5', 
                  padding: '6px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' 
                }}>
                  {member.role === 'COACH' ? '코치' : '러너'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}