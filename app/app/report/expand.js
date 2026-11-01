'use client';
// 전체 보기(인쇄용)에서 접어 둔 근거(<details>)를 모두 펼친다.
import { useEffect } from 'react';
export default function ExpandAll() {
  useEffect(() => { for (const d of document.querySelectorAll('details')) d.open = true; }, []);
  return null;
}
