import { useEffect, useState } from 'react';

const CACHE_KEY = 'currentInstitutionData';

export async function fetchCurrentInstitution(supabase) {
  if (!supabase) return null;
  const storedId = Number(window.localStorage.getItem('currentInstitutionId'));
  let query = supabase.from('institutions').select('*').eq('is_active', true);
  if (Number.isFinite(storedId) && storedId > 0) {
    query = query.eq('id', storedId);
  } else {
    query = query.order('id', { ascending: true });
  }
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) {
    console.warn('Institution loading warning:', error.message);
    return null;
  }
  if (data) {
    window.localStorage.setItem('currentInstitutionId', String(data.id));
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  }
  return data || null;
}

export function useInstitution(supabase) {
  const [institution, setInstitution] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(CACHE_KEY) || 'null');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let cancelled = false;
    fetchCurrentInstitution(supabase).then((data) => {
      if (!cancelled && data) setInstitution(data);
    });
    return () => { cancelled = true; };
  }, [supabase]);

  return institution;
}

export function institutionName(institution) {
  return institution?.official_name || institution?.name || institution?.name_line_1 || 'اسم المؤسسة';
}

export function institutionLogo(institution) {
  return institution?.logo_url || '';
}
